import Anthropic from '@anthropic-ai/sdk';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery } from '../utils/userQuery.js';
import {
  SISTEMA,
  armarEjemplos,
  prepararTransacciones,
  armarMensaje,
  esquemaRespuesta,
  validarSugerencias
} from '../utils/aiSuggestions.js';

// REV-06: sugerencias de categoría con Claude Haiku. Opt-in por usuario (User.iaSugerencias) y
// solo si el servidor tiene ANTHROPIC_API_KEY. Manda detalle, monto, tipo y origen de los
// movimientos sin categoría y ejemplos del historial (comercio → categoría); nunca se loguean.
export const MODELO = 'claude-haiku-5-5';

let clientePorDefecto = null;
const cliente = () => {
  clientePorDefecto ??= new Anthropic();
  return clientePorDefecto;
};

export const configurado = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const estadoSugerencias = async (req) => {
  const user = await User.findById(req.user._id).select('iaSugerencias').lean();
  return { activo: user?.iaSugerencias === true, configurado: configurado() };
};

export const cambiarSugerencias = async (req, activo) => {
  await User.updateOne({ _id: req.user._id }, { $set: { iaSugerencias: activo === true } });
  return estadoSugerencias(req);
};

/**
 * @param {Array} transacciones - [{ id, detalle, importe, tipo, origen }] (id: el de la fila en el editor)
 * @param {Object} [opciones.client] - cliente de Anthropic (para tests)
 * @returns {Promise<Array<{ id, categoria, confianza }>>}
 */
export const sugerirCategorias = async (req, transacciones, { client = null } = {}) => {
  const { activo } = await estadoSugerencias(req);
  if (!activo) throw new AppError('Las sugerencias con IA están desactivadas. Activalas en Configuración.', 403);
  if (!client && !configurado()) throw new AppError('Las sugerencias con IA no están configuradas en el servidor', 503);

  const pedido = prepararTransacciones(transacciones);
  if (pedido.length === 0) return [];

  const user = await User.findById(req.user._id).select('categories').lean();
  const categorias = (user?.categories || []).filter(c => c !== 'Otros');
  if (categorias.length === 0) return [];
  const historial = await Transaction.find(buildUserQuery(req)).select('detalle categoria').lean();

  let respuesta;
  try {
    respuesta = await (client || cliente()).messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: SISTEMA,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: esquemaRespuesta(categorias) }
      },
      messages: [{
        role: 'user',
        content: armarMensaje({ categorias, ejemplos: armarEjemplos(historial, categorias), transacciones: pedido })
      }]
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AppError('La IA está saturada, probá en un rato', 503);
    if (error instanceof Anthropic.AuthenticationError) throw new AppError('La clave de la IA del servidor no es válida', 503);
    if (error instanceof Anthropic.APIError) throw new AppError('No se pudo consultar la IA', 502);
    throw error;
  }

  if (respuesta.stop_reason === 'refusal') throw new AppError('La IA no quiso clasificar estos movimientos', 502);
  if (respuesta.stop_reason === 'max_tokens') throw new AppError('La respuesta de la IA quedó cortada: probá con menos movimientos', 502);
  const texto = respuesta.content.find(b => b.type === 'text')?.text;
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new AppError('La IA devolvió una respuesta que no se pudo leer', 502);
  }
  return validarSugerencias(datos, pedido.map(t => t.id), categorias);
};
