import JobRun from '../models/JobRun.js';
import { AppError } from '../middleware/errorHandler.js';
import { listarJobs, existeJob, correrAhora } from '../services/scheduler.js';

const CORRIDAS_POR_JOB = 10;

const vistaCorrida = (c) => ({
  _id: c._id,
  slot: c.slot,
  estado: c.estado,
  manual: c.manual,
  intentos: c.intentos,
  iniciado_at: c.iniciado_at,
  terminado_at: c.terminado_at || null,
  duracion_ms: c.duracion_ms ?? null,
  resultado: c.resultado ?? null,
  error: c.error || null
});

// Jobs registrados con sus últimas corridas
export const getJobs = async (req, res, next) => {
  try {
    const data = await Promise.all(listarJobs().map(async (job) => {
      const corridas = await JobRun.find({ job: job.nombre }).sort({ iniciado_at: -1 }).limit(CORRIDAS_POR_JOB).lean();
      return { ...job, corridas: corridas.map(vistaCorrida) };
    }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const runJob = async (req, res, next) => {
  try {
    if (!existeJob(req.params.nombre)) {
      throw new AppError('Tarea no encontrada', 404);
    }
    const corrida = await correrAhora(req.params.nombre);
    if (!corrida) {
      throw new AppError('La tarea ya se está ejecutando', 409);
    }
    res.json({
      success: true,
      message: corrida.estado === 'ok' ? 'Tarea ejecutada' : 'La tarea terminó con error',
      data: vistaCorrida(corrida)
    });
  } catch (error) {
    next(error);
  }
};
