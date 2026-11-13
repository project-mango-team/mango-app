import mongoose from 'mongoose';
import CategoryRule from '../models/CategoryRule.js';
import Transaction from '../models/Transaction.js';
import User, { CATEGORIA_INVERSION } from '../models/User.js';
import InvestmentAsset from '../models/InvestmentAsset.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { loadDefaultCategoryKeywords } from '../utils/categoryInference.js';
import { reglasDesdeKeywords, validarRegla, ordenarReglas, ordenConNuevaRegla, nivelDeRegla } from '../utils/categoryRules.js';
import { transaccionesACambiar, validarDeshacer } from '../utils/ruleLearning.js';

/**
 * La primera vez, convierte las asociaciones (keywords) del usuario en reglas equivalentes.
 * `categoryKeywords` queda como estaba: la versión Python todavía lo lee.
 */
const migrarKeywords = async (req) => {
  // Marca atómica: si dos pedidos llegan juntos, migra uno solo
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, reglasMigradas: { $ne: true } },
    { $set: { reglasMigradas: true } },
    { new: false }
  ).select('categoryKeywords');
  if (!user) return;

  const keywords = user.categoryKeywords?.size ? user.categoryKeywords : loadDefaultCategoryKeywords();
  const reglas = reglasDesdeKeywords(keywords);
  if (reglas.length) {
    try {
      await CategoryRule.insertMany(addUserToData(req, reglas));
    } catch (error) {
      // Si no se pudieron guardar, se quita la marca para que se reintente en el próximo pedido
      await User.updateOne({ _id: req.user._id }, { $unset: { reglasMigradas: 1 } });
      throw error;
    }
  }
};

/**
 * Reglas del usuario en orden de evaluación (migra las keywords si todavía no lo hizo)
 */
export const reglasDelUsuario = async (req) => {
  await migrarKeywords(req);
  // PUL-06: las del usuario antes que las asociaciones anteriores (keywords)
  return ordenarReglas(await CategoryRule.find(buildUserQuery(req)).lean());
};

const categoriasDelUsuario = async (req) => {
  const user = await User.findById(req.user._id).select('categories').lean();
  return user?.categories || [];
};

// INV-03: la inversión de la regla tiene que ser del usuario (el id viene del cliente)
const validarActivoDeLaRegla = async (req, regla) => {
  if (regla.accion?.tipo !== 'inversion') return;
  const existe = await InvestmentAsset.exists(buildUserQuery(req, { _id: regla.accion.activo_id }));
  if (!existe) throw new AppError('La inversión elegida no existe', 400);
};

const findReglaOrFail = async (req, id) => {
  const regla = mongoose.isValidObjectId(id) ? await CategoryRule.findOne(buildUserQuery(req, { _id: id })) : null;
  if (!regla) throw new AppError('Regla no encontrada', 404);
  return regla;
};

/**
 * Crea una regla. Por defecto va primera, así le gana a las más generales (por ejemplo,
 * "LSH BARRA HOTEL → Ocio" antes que "BARRA → Comida").
 */
export const crearRegla = async (req, datos, { creadaPor = 'usuario' } = {}) => {
  await migrarKeywords(req);
  const { regla, error } = validarRegla(datos, await categoriasDelUsuario(req));
  if (error) throw new AppError(error, 400);
  await validarActivoDeLaRegla(req, regla);
  const primera = await CategoryRule.findOne(buildUserQuery(req)).sort({ orden: 1 }).select('orden').lean();
  const existentes = await reglasDelUsuario(req);
  const creada = await CategoryRule.create(addUserToData(req, {
    ...regla,
    orden: primera ? primera.orden - 1 : 0,
    creada_por: creadaPor
  }));
  // PUL-06: si tapa a una regla explícita más específica, queda después de ella (la más específica gana)
  const ids = ordenConNuevaRegla(existentes, creada);
  if (ids.indexOf(String(creada._id)) !== 0) await reordenarReglas(req, ids);
  return creada;
};

export const actualizarRegla = async (req, id, datos) => {
  const existente = await findReglaOrFail(req, id);
  const { regla, error } = validarRegla(datos, await categoriasDelUsuario(req));
  if (error) throw new AppError(error, 400);
  await validarActivoDeLaRegla(req, regla);
  existente.set(regla);
  return existente.save();
};

export const eliminarRegla = async (req, id) => {
  const regla = await findReglaOrFail(req, id);
  await regla.deleteOne();
};

/**
 * Reordena según la lista de ids (las que no estén quedan al final, en su orden actual)
 */
export const reordenarReglas = async (req, ids) => {
  if (!Array.isArray(ids)) throw new AppError('Se espera la lista de ids en orden', 400);
  const reglas = await reglasDelUsuario(req);
  const posicion = new Map(ids.map((id, i) => [String(id), i]));
  // PUL-06: la posición pedida no puede subir una asociación anterior (keywords) por encima de una regla del usuario
  const ordenadas = [...reglas].sort((a, b) =>
    nivelDeRegla(a) - nivelDeRegla(b)
    || (posicion.get(String(a._id)) ?? Infinity) - (posicion.get(String(b._id)) ?? Infinity) || a.orden - b.orden);
  await CategoryRule.bulkWrite(ordenadas.map((r, orden) => ({
    updateOne: { filter: buildUserQuery(req, { _id: r._id }), update: { $set: { orden } } }
  })));
  return reglasDelUsuario(req);
};

// ---------- Aprender de las correcciones (REV-03) ----------

const EJEMPLOS = 5;

const aCambiarPorRegla = async (req, id) => {
  // Objeto plano: la lógica pura no sabe de documentos de Mongoose
  const regla = (await findReglaOrFail(req, id)).toObject();
  const transactions = await Transaction.find(buildUserQuery(req))
    .select('fecha detalle tipo origen importe categoria')
    .lean();
  return { regla, cambiar: transaccionesACambiar(transactions, regla) };
};

/**
 * Cuántas transacciones ya cargadas cambiaría la regla, con algunos ejemplos
 */
export const coincidenciasDeRegla = async (req, id) => {
  const { regla, cambiar } = await aCambiarPorRegla(req, id);
  return {
    categoria: regla.accion.categoria || null,
    total: cambiar.length,
    ejemplos: cambiar.slice(0, EJEMPLOS).map(({ _id, fecha, detalle, categoria, importe, tipo }) => ({ _id, fecha, detalle, categoria, importe, tipo }))
  };
};

/**
 * Pasa a la categoría de la regla las transacciones ya cargadas que coinciden.
 * Devuelve la categoría que tenía cada una, para poder deshacer.
 */
export const aplicarReglaACargadas = async (req, id) => {
  const { regla, cambiar } = await aCambiarPorRegla(req, id);
  if (cambiar.length) {
    await Transaction.updateMany(
      buildUserQuery(req, { _id: { $in: cambiar.map(t => t._id) } }),
      { $set: { categoria: regla.accion.categoria } }
    );
  }
  return {
    modificadas: cambiar.length,
    cambios: cambiar.map(t => ({ _id: String(t._id), categoria: t.categoria }))
  };
};

export const deshacerAplicacion = async (req, datos) => {
  const { cambios, error } = validarDeshacer(datos);
  if (error) throw new AppError(error, 400);
  const validos = cambios.filter(c => mongoose.isValidObjectId(c._id));
  if (validos.length) {
    await Transaction.bulkWrite(validos.map(c => ({
      updateOne: { filter: buildUserQuery(req, { _id: c._id }), update: { $set: { categoria: c.categoria } } }
    })));
  }
  return { restauradas: validos.length };
};

// ---------- Cambios de categorías ----------

export const renombrarCategoriaEnReglas = (req, anterior, nueva) => CategoryRule.updateMany(
  buildUserQuery(req, { 'accion.tipo': 'categoria', 'accion.categoria': anterior }),
  { $set: { 'accion.categoria': nueva } }
);

/**
 * Al borrar una inversión, las reglas que cargaban en ella pasan a ser reglas de categoría Inversión
 * (la transacción sigue categorizada, pero ya no se ofrece cargarla como movimiento).
 */
export const reglasDeInversionACategoria = (req, activoId) => CategoryRule.updateMany(
  buildUserQuery(req, { 'accion.tipo': 'inversion', 'accion.activo_id': activoId }),
  { $set: { 'accion.tipo': 'categoria', 'accion.categoria': CATEGORIA_INVERSION }, $unset: { 'accion.activo_id': 1 } }
);

export const eliminarReglasDeCategoria = (req, categoria) => CategoryRule.deleteMany(
  buildUserQuery(req, { 'accion.tipo': 'categoria', 'accion.categoria': categoria })
);
