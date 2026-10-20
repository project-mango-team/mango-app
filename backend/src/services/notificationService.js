import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { normalizarNotificacion } from '../utils/notificaciones.js';
import { esAdmin } from '../utils/admin.js';

// Centro de avisos in-app (PLAT-02). Reciben el userId explícito para poder usarse desde
// controllers (req.user._id) y desde jobs.

const LIMITE_LISTA = 50;

const vista = (n) => ({
  _id: n._id,
  tipo: n.tipo,
  nivel: n.nivel,
  titulo: n.titulo,
  mensaje: n.mensaje || null,
  link: n.link || null,
  leida: Boolean(n.leida_at),
  created_at: n.created_at
});

/**
 * Crea una notificación para el usuario. Con `clave`, no se duplica: si ya existe una con esa clave
 * no se crea otra (ni vuelve a quedar sin leer).
 * @param {{ tipo, titulo, mensaje?, nivel?: 'info'|'exito'|'alerta'|'error', link?: '/ruta', clave? }} datos
 */
export const notificar = async (userId, datos) => {
  const n = normalizarNotificacion(datos);
  if (!n.clave) return Notification.create({ ...n, user_id: userId });
  return Notification.findOneAndUpdate(
    { user_id: userId, clave: n.clave },
    { $setOnInsert: { ...n, user_id: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Para avisos que no deben cortar el flujo principal (por ejemplo, el webhook de ingesta)
export const notificarSinFallar = (userId, datos) =>
  notificar(userId, datos).catch(error => console.error('[notificaciones] no se pudo crear:', error.message));

// Notifica a los administradores (ADMIN_EMAILS; fuera de producción, a todos los usuarios)
export const notificarAdmins = async (datos) => {
  const usuarios = await User.find({}, { email: 1 }).lean();
  await Promise.all(usuarios.filter(u => esAdmin(u.email)).map(u => notificar(u._id, datos)));
};

export const listarNotificaciones = async (userId) => {
  const [notificaciones, noLeidas] = await Promise.all([
    Notification.find({ user_id: userId }).sort({ created_at: -1 }).limit(LIMITE_LISTA).lean(),
    contarNoLeidas(userId)
  ]);
  return { notificaciones: notificaciones.map(vista), noLeidas };
};

export const contarNoLeidas = (userId) =>
  Notification.countDocuments({ user_id: userId, leida_at: { $exists: false } });

// true si existía y era del usuario
export const marcarLeida = async (userId, id) => {
  const n = await Notification.findOne({ _id: id, user_id: userId });
  if (!n) return false;
  if (!n.leida_at) {
    n.leida_at = new Date();
    await n.save();
  }
  return true;
};

export const marcarTodasLeidas = async (userId) => {
  const { modifiedCount } = await Notification.updateMany(
    { user_id: userId, leida_at: { $exists: false } },
    { leida_at: new Date() }
  );
  return modifiedCount;
};
