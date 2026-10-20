import os from 'os';
import mongoose from 'mongoose';
import JobRun from '../models/JobRun.js';
import {
  slotDiario, slotManual, validarHora, filtroReclamable, resumirResultado, mensajeDeError, POLITICA_DEFAULT
} from '../utils/jobSchedule.js';

// Scheduler de jobs diarios dentro del proceso del backend.
// Mango corre en un contenedor siempre prendido (Northflank), así que alcanza con un tick cada minuto:
// - Cada job tiene una hora (Argentina). Si el proceso estaba caído a esa hora, corre apenas vuelve.
// - El lock es el índice único (job, slot) de JobRun: si hay varias réplicas, corre una sola.
// - Una corrida con error se reintenta (hasta 3 veces, cada 30 min) dentro del mismo día.
//
// Para agregar un job: crear backend/src/jobs/<nombre>.js con
//   export default { nombre, descripcion, hora: 'HH:MM', run: async ({ manual, slot }) => resumen }
// y sumarlo a la lista de backend/src/jobs/index.js. El resumen devuelto se muestra en Configuración.

const jobs = new Map();
const enCurso = new Set();
let intervalo = null;

export const registrarJob = (job) => {
  if (!job?.nombre || typeof job.run !== 'function') throw new Error('Un job necesita nombre y run()');
  if (!validarHora(job.hora)) throw new Error(`Job ${job.nombre}: hora inválida "${job.hora}" (usar HH:MM)`);
  if (jobs.has(job.nombre)) throw new Error(`Job ${job.nombre} registrado dos veces`);
  jobs.set(job.nombre, { politica: POLITICA_DEFAULT, ...job });
};

export const listarJobs = () => [...jobs.values()].map(({ nombre, descripcion, hora }) => ({ nombre, descripcion, hora }));

export const existeJob = (nombre) => jobs.has(nombre);

// Toma el lock del slot: crea la corrida o retoma una con error / colgada. Devuelve la corrida o null.
const reclamar = async (job, slot, now, manual) => {
  try {
    return await JobRun.create({ job: job.nombre, slot, estado: 'corriendo', manual, iniciado_at: now });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return JobRun.findOneAndUpdate(
    filtroReclamable(job.nombre, slot, now, job.politica),
    { $set: { estado: 'corriendo', iniciado_at: now }, $inc: { intentos: 1 }, $unset: { error: 1, terminado_at: 1, duracion_ms: 1 } },
    { new: true }
  );
};

const ejecutar = async (job, slot, manual) => {
  if (enCurso.has(job.nombre)) return null;
  enCurso.add(job.nombre);
  try {
    const inicio = new Date();
    const corrida = await reclamar(job, slot, inicio, manual);
    if (!corrida) return null;

    let cambios;
    try {
      const resultado = await job.run({ manual, slot });
      cambios = { estado: 'ok', resultado: resumirResultado(resultado) };
    } catch (error) {
      console.error(`[scheduler] ${job.nombre} (${slot}) falló:`, error.message);
      cambios = { estado: 'error', error: mensajeDeError(error) };
    }
    const fin = new Date();
    return JobRun.findByIdAndUpdate(
      corrida._id,
      { $set: { ...cambios, terminado_at: fin, duracion_ms: fin - inicio } },
      { new: true }
    ).lean();
  } finally {
    enCurso.delete(job.nombre);
  }
};

// Corre ya un job (botón "Correr ahora"). Devuelve la corrida terminada, o null si ya estaba corriendo.
export const correrAhora = async (nombre) => {
  const job = jobs.get(nombre);
  if (!job) throw new Error(`No existe el job ${nombre}`);
  return ejecutar(job, slotManual(new Date()), true);
};

const tick = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const now = new Date();
  for (const job of jobs.values()) {
    const { slot, vencido } = slotDiario(now, job.hora);
    if (!vencido) continue;
    // Los jobs no se esperan entre sí: uno lento no demora a los demás
    ejecutar(job, slot, false).catch(error => console.error(`[scheduler] ${job.nombre}:`, error.message));
  }
};

export const iniciarScheduler = ({ intervaloMs = 60 * 1000 } = {}) => {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('[scheduler] desactivado (SCHEDULER_ENABLED=false)');
    return;
  }
  if (intervalo) return;
  console.log(`[scheduler] activo en ${os.hostname()} con ${jobs.size} job(s): ${[...jobs.keys()].join(', ')}`);
  intervalo = setInterval(tick, intervaloMs);
  intervalo.unref();
  setTimeout(tick, 5000).unref();
};

export const detenerScheduler = () => {
  clearInterval(intervalo);
  intervalo = null;
};
