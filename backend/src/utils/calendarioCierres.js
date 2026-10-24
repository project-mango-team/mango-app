// Calendario de cierres (ING-09): por fuente, qué día del mes cierra y cómo llega el resumen.
// Con eso se calcula el cierre esperado más reciente y si el resumen llegó, está avisado o falta.
// Todo son funciones puras sobre fechas 'YYYY-MM-DD'.

import { fechaLocal } from './jobSchedule.js';
import { FUENTES, fuenteDeDeteccion, fuenteDeAviso, fechaDelResumen } from './fuentesResumen.js';

export const LLEGADAS = ['adjunto', 'aviso', 'manual'];

// Días después del cierre en los que todavía no se considera faltante (el banco tarda en mandarlo)
export const GRACIA_DEFAULT = 5;
// Un resumen cuenta para un cierre si su fecha cae a esta distancia (el día de cierre real se corre unos días)
const TOLERANCIA_DIAS = 6;
// Un aviso cuenta para un cierre si el mail llegó entre el cierre y este tope de días después
const VENTANA_AVISO_DIAS = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

const aFecha = (s) => new Date(`${s}T00:00:00Z`);
const aTexto = (d) => d.toISOString().slice(0, 10);
const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / MS_DIA);
const sumarDias = (s, n) => aTexto(new Date(aFecha(s).getTime() + n * MS_DIA));

export const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

// Cierre del mes dado (mes 1-12); un día 31 en un mes de 30 días cierra el último
const cierreDelMes = (anio, mes, dia) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, diasDelMes(anio, mes))).padStart(2, '0')}`;

/**
 * Último cierre esperado que ya pasó (o es hoy), según el día de cierre configurado
 * @param {string} hoy - 'YYYY-MM-DD'
 * @param {number} dia - 1..31
 */
export const ultimoCierre = (hoy, dia) => {
  const [anio, mes] = hoy.split('-').map(Number);
  const esteMes = cierreDelMes(anio, mes, dia);
  if (esteMes <= hoy) return esteMes;
  return mes === 1 ? cierreDelMes(anio - 1, 12, dia) : cierreDelMes(anio, mes - 1, dia);
};

/**
 * Estado de una fuente para su último cierre.
 * - recibido: hay un archivo (no descartado) con fecha cercana al cierre
 * - avisado: llegó el aviso del banco pero no el archivo
 * - esperando: el cierre es reciente, todavía no corresponde reclamarlo
 * - faltante: pasó la gracia y no llegó nada
 * @param {{ dia_cierre: number, llegada: string, gracia?: number }} config
 * @param {Array<{ fuente: string|null, fecha: string|null, aviso: boolean, recibido_at?: string|null }>} candidatos
 *   documentos ya reducidos a su fuente y fecha (ver `candidatoDe`)
 * @returns {{ cierre: string, estado: string, vence: string }}
 */
export const estadoDeFuente = (hoy, config, candidatos) => {
  const cierre = ultimoCierre(hoy, config.dia_cierre);
  const vence = sumarDias(cierre, config.gracia ?? GRACIA_DEFAULT);

  const archivo = candidatos.some(c => !c.aviso && c.fecha && Math.abs(diasEntre(cierre, c.fecha)) <= TOLERANCIA_DIAS);
  if (archivo) return { cierre, estado: 'recibido', vence };

  const avisado = candidatos.some(c => {
    if (!c.aviso || !c.fecha) return false;
    const d = diasEntre(cierre, c.fecha);
    return d >= -TOLERANCIA_DIAS && d <= VENTANA_AVISO_DIAS;
  });
  if (avisado) return { cierre, estado: 'avisado', vence };

  return { cierre, estado: hoy > vence ? 'faltante' : 'esperando', vence };
};

/**
 * Reduce un documento de la bandeja a { fuente, fecha, aviso } para el calendario.
 * Los descartados no cuentan; los avisos usan la fecha del mail.
 */
export const candidatoDe = (doc) => {
  if (!doc || doc.estado === 'descartado') return null;
  if (doc.fuente === 'email_aviso') {
    const recibido = doc.email?.received_at ? new Date(doc.email.received_at) : null;
    const { fuente } = fuenteDeAviso(doc.email);
    return fuente && recibido && !isNaN(recibido) ? { fuente, fecha: fechaLocal(recibido).fecha, aviso: true } : null;
  }
  // Un archivo que no se pudo leer todavía no cuenta como recibido
  if (doc.estado === 'error' || doc.estado === 'no_reconocido') return null;
  const fuente = fuenteDeDeteccion(doc.deteccion);
  return fuente ? { fuente, fecha: fechaDelResumen(doc.deteccion), aviso: false } : null;
};

/**
 * Checklist: una fila por fuente configurada y activa
 * @param {string} hoy
 * @param {Array} configs - { fuente, dia_cierre, llegada, activa, gracia? }
 * @param {Array} documentos - documentos de la bandeja
 */
export const armarChecklist = (hoy, configs, documentos) => {
  const candidatos = documentos.map(candidatoDe).filter(Boolean);
  return configs
    .filter(c => c.dia_cierre && c.activa !== false && FUENTES[c.fuente])
    .map(c => ({
      fuente: c.fuente,
      nombre: FUENTES[c.fuente].nombre,
      dia_cierre: c.dia_cierre,
      llegada: c.llegada,
      ...estadoDeFuente(hoy, c, candidatos.filter(x => x.fuente === c.fuente))
    }));
};

/**
 * Valida y normaliza lo que manda la UI para una fuente
 * @returns {{ ok: true, datos } | { ok: false, error }}
 */
export const validarConfigFuente = (fuente, { dia_cierre, llegada, activa } = {}) => {
  if (!FUENTES[fuente]) return { ok: false, error: 'Fuente desconocida' };
  const dia = Number(dia_cierre);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, error: 'El día de cierre tiene que ser entre 1 y 31' };
  if (!LLEGADAS.includes(llegada)) return { ok: false, error: 'Elegí cómo llega el resumen' };
  return { ok: true, datos: { dia_cierre: dia, llegada, activa: activa !== false } };
};
