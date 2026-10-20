import Secret from '../models/Secret.js';
import { AppError } from '../middleware/errorHandler.js';
import { cifrar, descifrar, claveDesdeEntorno, pistaDe, aadDe } from '../utils/secretCrypto.js';

// Secretos cifrados por usuario (PLAT-03). Reciben el userId explícito para poder usarse desde
// controllers (req.user._id) y desde jobs. Nunca loguear ni devolver al cliente el valor descifrado.

const NOMBRE_RE = /^[a-z0-9][a-z0-9:._-]{0,63}$/;

const clave = () => {
  const k = claveDesdeEntorno();
  if (!k) throw new AppError('Falta configurar SECRETS_KEY en el servidor para guardar credenciales', 500);
  return k;
};

const validarNombre = (nombre) => {
  if (!NOMBRE_RE.test(nombre || '')) throw new AppError('Nombre de secreto inválido', 400);
};

const vista = (s) => ({
  nombre: s.nombre,
  descripcion: s.descripcion || null,
  pista: s.pista || null,
  created_at: s.created_at,
  updated_at: s.updated_at,
  last_used_at: s.last_used_at || null
});

// Crea o reemplaza el secreto `nombre` del usuario. Devuelve los metadatos (sin el valor).
export const guardarSecreto = async (userId, nombre, valor, { descripcion } = {}) => {
  validarNombre(nombre);
  if (typeof valor !== 'string' || !valor.trim()) throw new AppError('El valor está vacío', 400);
  const limpio = valor.trim();
  const secreto = await Secret.findOneAndUpdate(
    { user_id: userId, nombre },
    {
      $set: {
        valor_cifrado: cifrar(limpio, clave(), aadDe(userId, nombre)),
        pista: pistaDe(limpio),
        ...(descripcion !== undefined && { descripcion })
      },
      $unset: { last_used_at: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return vista(secreto);
};

// Devuelve el valor descifrado, o null si el usuario no lo tiene guardado.
export const leerSecreto = async (userId, nombre) => {
  validarNombre(nombre);
  const secreto = await Secret.findOne({ user_id: userId, nombre }).lean();
  if (!secreto) return null;
  let valor;
  try {
    valor = descifrar(secreto.valor_cifrado, clave(), aadDe(userId, nombre));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`No se pudo leer la credencial "${nombre}": volvé a cargarla`, 500);
  }
  await Secret.updateOne({ _id: secreto._id }, { last_used_at: new Date() });
  return valor;
};

export const existeSecreto = async (userId, nombre) => Boolean(await Secret.exists({ user_id: userId, nombre }));

export const listarSecretos = async (userId) =>
  (await Secret.find({ user_id: userId }).sort({ nombre: 1 }).lean()).map(vista);

// true si existía
export const borrarSecreto = async (userId, nombre) => {
  validarNombre(nombre);
  const { deletedCount } = await Secret.deleteOne({ user_id: userId, nombre });
  return deletedCount > 0;
};

// Al arrancar: avisa si la clave falta o es inválida (sin cortar el server: solo fallan las features que la usan)
export const verificarClaveSecretos = () => {
  try {
    if (!claveDesdeEntorno()) console.warn('⚠️  SECRETS_KEY no configurada: no se van a poder guardar credenciales cifradas');
  } catch (error) {
    console.error(`⚠️  ${error.message}`);
  }
};
