import { FUENTES, fuenteDeDeteccion, fuenteDeAviso } from './fuentesResumen.js';

// Textos de las notificaciones que genera Mango. Devuelven el objeto que recibe notificar().

const LARGO_TITULO = 120;
const LARGO_MENSAJE = 500;

const recortar = (texto, max) => {
  if (texto === undefined || texto === null) return undefined;
  const s = String(texto).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// Ruta interna: empieza con una sola barra (nada de '//host' ni 'https://')
const LINK_RE = /^\/(?!\/)[a-zA-Z0-9/_?=&#-]*$/;

// Normaliza y valida lo que se va a guardar. El link solo puede ser una ruta interna.
export const normalizarNotificacion = ({ tipo, nivel = 'info', titulo, mensaje, link, clave } = {}) => {
  if (!tipo || !titulo) throw new Error('Una notificación necesita tipo y título');
  if (link && !LINK_RE.test(link)) throw new Error(`Link de notificación inválido: ${link}`);
  return {
    tipo,
    nivel,
    titulo: recortar(titulo, LARGO_TITULO),
    ...(mensaje && { mensaje: recortar(mensaje, LARGO_MENSAJE) }),
    ...(link && { link }),
    ...(clave && { clave: String(clave) })
  };
};

const nombreFuente = (clave) => (clave && FUENTES[clave]?.nombre) || null;

// Llegó un resumen por mail (ING-07) y quedó en la Bandeja
export const avisoResumenNuevo = (documento) => {
  const fuente = nombreFuente(fuenteDeDeteccion(documento.deteccion));
  return {
    tipo: 'resumen_nuevo',
    nivel: 'info',
    titulo: fuente ? `Llegó el resumen de ${fuente}` : 'Llegó un resumen nuevo',
    mensaje: `${documento.filename} está en la Bandeja para revisar.`,
    link: '/bandeja',
    clave: `ingest:${documento._id}`
  };
};

// Llegó un mail que avisa que el resumen está disponible, sin el archivo (ING-08)
export const avisoResumenDisponible = (documento) => {
  const fuente = nombreFuente(fuenteDeAviso(documento.email || {}).fuente);
  return {
    tipo: 'aviso_resumen',
    nivel: 'alerta',
    titulo: fuente ? `Tu resumen de ${fuente} está disponible` : 'Tenés un resumen disponible para bajar',
    mensaje: 'El mail no trae el archivo: bajalo del homebanking y subilo en la Bandeja.',
    link: '/bandeja',
    clave: `ingest:${documento._id}`
  };
};

// Un job del scheduler agotó los reintentos del día (para administradores)
export const avisoJobFallido = (job, slot, error) => ({
  tipo: 'job_error',
  nivel: 'error',
  titulo: `Falló la tarea programada ${job}`,
  mensaje: error,
  link: '/configuracion',
  clave: `job:${job}:${slot}`
});
