import FuenteConfig from '../models/FuenteConfig.js';
import IngestDocument from '../models/IngestDocument.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { FUENTES } from '../utils/fuentesResumen.js';
import { armarChecklist, validarConfigFuente } from '../utils/calendarioCierres.js';
import { fechaLocal } from '../utils/jobSchedule.js';

// Calendario de cierres y faltantes (ING-09). Recibe `req` ({ user: { _id } }): sirve desde controllers y jobs.

const documentosDelCalendario = (req) =>
  IngestDocument.find(buildUserQuery(req, { estado: { $ne: 'descartado' } }))
    .select('fuente estado deteccion.tipo deteccion.producto deteccion.cierre deteccion.periodo email')
    .sort({ created_at: -1 }).limit(300).lean();

/**
 * Checklist de las fuentes configuradas y activas: estado del último cierre de cada una
 */
export const checklistDelUsuario = async (req, ahora = new Date()) => {
  const hoy = fechaLocal(ahora).fecha;
  const [configs, documentos] = await Promise.all([
    FuenteConfig.find(buildUserQuery(req)).lean(),
    documentosDelCalendario(req)
  ]);
  return { hoy, configs, checklist: armarChecklist(hoy, configs, documentos) };
};

/**
 * Todas las fuentes conocidas (las no configuradas vienen sin día) con el estado de su último cierre
 */
export const obtenerCalendario = async (req, ahora = new Date()) => {
  const { hoy, configs, checklist } = await checklistDelUsuario(req, ahora);
  const porFuente = new Map(checklist.map(f => [f.fuente, f]));
  const fuentes = Object.entries(FUENTES).map(([fuente, { nombre }]) => {
    const config = configs.find(c => c.fuente === fuente);
    return {
      fuente,
      nombre,
      configurada: Boolean(config),
      dia_cierre: config?.dia_cierre ?? null,
      llegada: config?.llegada ?? null,
      activa: config ? config.activa !== false : false,
      estado: porFuente.get(fuente)?.estado ?? null,
      cierre: porFuente.get(fuente)?.cierre ?? null
    };
  });
  return { hoy, fuentes };
};

export const guardarConfigFuente = async (req, fuente, cuerpo) => {
  const validacion = validarConfigFuente(fuente, cuerpo);
  if (!validacion.ok) throw new AppError(validacion.error, 400);
  await FuenteConfig.findOneAndUpdate(
    buildUserQuery(req, { fuente }),
    { $set: validacion.datos, $setOnInsert: addUserToData(req, { fuente }) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return obtenerCalendario(req);
};

export const borrarConfigFuente = async (req, fuente) => {
  await FuenteConfig.deleteOne(buildUserQuery(req, { fuente }));
  return obtenerCalendario(req);
};
