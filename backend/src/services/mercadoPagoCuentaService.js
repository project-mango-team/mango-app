import { AppError } from '../middleware/errorHandler.js';
import { crearClienteMercadoPago, MercadoPagoError } from './mercadoPagoClient.js';
import { guardarSecreto, leerSecreto, borrarSecreto, listarSecretos } from './secretService.js';

// Cuenta de Mercado Pago conectada (MP-02): el access token se guarda cifrado (PLAT-03) con el nombre
// `mercadopago`. El token nunca vuelve al navegador ni se loguea. Ver plans/mercadopago.md.

export const SECRETO_MP = 'mercadopago';

const DEPS = { crearCliente: crearClienteMercadoPago, guardarSecreto, leerSecreto, borrarSecreto, listarSecretos };

/**
 * Chequea la forma del token antes de llamar a MP. Devuelve el token limpio.
 */
export const validarFormatoToken = (token) => {
  const limpio = typeof token === 'string' ? token.trim() : '';
  if (!limpio) throw new AppError('Pegá el access token de Mercado Pago', 400);
  if (/^TEST-/.test(limpio)) {
    throw new AppError('Ese es un token de prueba: usá el access token de las credenciales de producción (empieza con APP_USR-)', 400);
  }
  if (!/^APP_USR-[\w-]{20,}$/.test(limpio)) {
    throw new AppError('No parece un access token de Mercado Pago: tiene que empezar con APP_USR-', 400);
  }
  return limpio;
};

// Errores del cliente a errores de la API de Mango
export const errorDeMercadoPago = (error) => {
  if (!(error instanceof MercadoPagoError)) return error;
  if (error.status === 401 || error.status === 403) return new AppError(error.message, 400);
  return new AppError('No se pudo contactar a Mercado Pago, probá de nuevo en un rato', 502);
};

// Lo que se muestra de la cuenta: el alias y el país, nada más
const vistaCuenta = (usuario) => ({ nickname: usuario?.nickname || null, site_id: usuario?.site_id || null });

/**
 * Prueba el token contra MP y, si anda, lo guarda cifrado
 * @returns {Promise<{ conectado: true, cuenta, credencial }>}
 */
export const conectarCuenta = async (userId, token, deps = DEPS) => {
  const limpio = validarFormatoToken(token);
  let usuario;
  try {
    usuario = await deps.crearCliente(limpio).usuario();
  } catch (error) {
    throw errorDeMercadoPago(error);
  }
  if (usuario?.site_id && usuario.site_id !== 'MLA') {
    throw new AppError('La cuenta de Mercado Pago no es de Argentina: Mango solo lee cuentas en pesos', 400);
  }
  const credencial = await deps.guardarSecreto(userId, SECRETO_MP, limpio, { descripcion: 'Token de Mercado Pago' });
  return { conectado: true, cuenta: vistaCuenta(usuario), credencial };
};

/**
 * Prueba la conexión con el token guardado
 * @returns {Promise<{ conectado: true, cuenta }>}
 */
export const probarConexion = async (userId, deps = DEPS) => {
  const token = await deps.leerSecreto(userId, SECRETO_MP);
  if (!token) throw new AppError('No hay una cuenta de Mercado Pago conectada', 404);
  try {
    return { conectado: true, cuenta: vistaCuenta(await deps.crearCliente(token).usuario()) };
  } catch (error) {
    throw errorDeMercadoPago(error);
  }
};

/**
 * Si hay token guardado y sus metadatos (pista, fechas), sin llamar a MP
 */
export const estadoCuenta = async (userId, deps = DEPS) => {
  const credencial = (await deps.listarSecretos(userId)).find(s => s.nombre === SECRETO_MP) || null;
  return { conectado: Boolean(credencial), credencial };
};

export const desconectarCuenta = async (userId, deps = DEPS) => ({ borrado: await deps.borrarSecreto(userId, SECRETO_MP) });
