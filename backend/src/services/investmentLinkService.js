import mongoose from 'mongoose';
import InvestmentAsset from '../models/InvestmentAsset.js';
import InvestmentMovement from '../models/InvestmentMovement.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { planDeInversiones } from '../utils/investmentFromStatement.js';
import { convertirMonto } from '../utils/investmentCalc.js';
import { crearCotizacionesEn } from './investmentQuoteService.js';
import { CATEGORIA_INVERSION } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { reglasDelUsuario } from './ruleService.js';
import { compilarReglas, buscarRegla } from '../utils/categoryRules.js';

// Une las transacciones de un extracto con Inversiones (INV): sugiere el aporte o retiro en la vista previa,
// lo crea al guardar y lo revierte con la carga. Todo se recalcula en el servidor y se filtra por usuario:
// del cliente solo se toma el activo elegido (`inversion.activo_id`) y si se tilda "cargar" (`inversion.crear`).

/**
 * Activos del usuario nombrados en las transacciones y sus movimientos ya cargados
 * @returns {Promise<{ activos: Map<string, Object>, existentes: Map<string, Array> }>}
 */
const contextoDeInversiones = async (req, transacciones) => {
  const ids = [...new Set(transacciones
    .map(t => t?.inversion?.activo_id)
    .filter(id => id && mongoose.isValidObjectId(id))
    .map(String))];
  if (!ids.length) return { activos: new Map(), existentes: new Map() };

  const activos = await InvestmentAsset.find(buildUserQuery(req, { _id: { $in: ids } })).select('nombre moneda').lean();
  const delUsuario = new Map(activos.map(a => [String(a._id), a]));
  const movimientos = await InvestmentMovement.find(buildUserQuery(req, { asset_id: { $in: activos.map(a => a._id) } }))
    .select('asset_id fecha tipo monto')
    .lean();

  const existentes = new Map();
  for (const m of movimientos) {
    const id = String(m.asset_id);
    if (!existentes.has(id)) existentes.set(id, []);
    existentes.get(id).push(m);
  }
  return { activos: delUsuario, existentes };
};

/**
 * Vista previa: agrega a cada transacción con `inversion.activo_id` (de una regla) lo que se cargaría en
 * Inversiones: { activo_id, activo_nombre, tipo, monto, crear, duplicado: { fecha }|null, error }.
 * Las filas que ya estaban cargadas o que una regla ignora no se ofrecen.
 */
export const marcarInversionesSugeridas = async (req, transactions) => {
  if (!transactions.some(t => t?.inversion?.activo_id)) return transactions;
  const { activos, existentes } = await contextoDeInversiones(req, transactions);
  const plan = planDeInversiones(transactions, activos, existentes);

  return transactions.map((t, i) => {
    const p = plan[i];
    if (!p) return t;
    const excluida = Boolean(t.duplicado || t.ignorada);
    return {
      ...t,
      inversion: {
        activo_id: p.activo_id,
        activo_nombre: p.activo_nombre,
        tipo: p.movimiento?.tipo ?? null,
        monto: p.movimiento?.monto ?? null,
        crear: p.crear && !excluida,
        duplicado: p.duplicado,
        error: p.error
      }
    };
  });
};

/**
 * Al guardar: crea los aportes/retiros de las transacciones con `inversion.crear` (mejor esfuerzo: si algo falla
 * la importación ya está hecha y se avisa). Vuelve a calcular todo contra la base: el activo tiene que ser del
 * usuario, la moneda coincidir y no puede haber ya un movimiento equivalente.
 * @param {Object} req
 * @param {Array<{ _id, inversion?: { activo_id, crear } }>} transacciones - guardadas, con su _id
 * @param {string} operationId
 * @returns {Promise<null | { creados: number, duplicados: number, errores: string[] }>} null si ninguna pidió inversión
 */
export const crearMovimientosDeExtracto = async (req, transacciones, operationId, { yaDeduplicadas = false } = {}) => {
  // Solo si la fila sigue siendo una Inversión: si el usuario le cambió la categoría, ya no va a Inversiones
  const pedidas = transacciones.filter(t => t?.inversion?.activo_id && t.inversion.crear === true && t.categoria === CATEGORIA_INVERSION);
  if (!pedidas.length) return null;

  const aviso = { creados: 0, duplicados: 0, errores: [] };
  try {
    const { activos, existentes } = await contextoDeInversiones(req, pedidas);
    const plan = planDeInversiones(pedidas, activos, existentes);

    const aCrear = [];
    plan.forEach((p, i) => {
      if (p.error) aviso.errores.push(p.error);
      else if (p.duplicado && !yaDeduplicadas) aviso.duplicados++;
      else if (p.crear || (yaDeduplicadas && p.duplicado)) aCrear.push({ transaccion: pedidas[i], plan: p });
    });
    if (!aCrear.length) return aviso;

    const { cotizacionesEn } = await crearCotizacionesEn(aCrear.some(({ plan: p }) => activos.get(p.activo_id).moneda === 'EUR'));
    const docs = aCrear.map(({ transaccion, plan: p }) => {
      const moneda = activos.get(p.activo_id).moneda;
      const cot = cotizacionesEn(p.movimiento.fecha);
      return {
        asset_id: p.activo_id,
        tipo: p.movimiento.tipo,
        fecha: new Date(`${p.movimiento.fecha}T00:00:00Z`),
        monto: p.movimiento.monto,
        cotizacion_usd: cot.usd,
        cotizacion_eur: moneda === 'EUR' ? cot.eur : undefined,
        notas: 'Cargado desde el extracto',
        origen: 'extracto',
        operation_id: operationId,
        transaction_id: transaccion._id,
        ...convertirMonto(p.movimiento.monto, moneda, cot)
      };
    });
    const creados = await InvestmentMovement.insertMany(addUserToData(req, docs));
    aviso.creados = creados.length;
  } catch (error) {
    console.error('[inversiones] no se pudieron crear los movimientos del extracto:', error.message);
    aviso.errores.push('No se pudieron cargar en Inversiones; cargalos a mano o revertí la carga y probá de nuevo');
  }
  return aviso;
};

// ---------- Backfill del histórico (INV-11) ----------

const MAX_TRANSACCIONES_BACKFILL = 5000;

/**
 * Transacciones 'Inversión' ya cargadas que las reglas mandan a este activo, con lo que se cargaría:
 * { transaction_id, fecha, detalle, tipo, monto, crear, duplicado: { fecha }|null, error }.
 * Respeta el orden de las reglas (gana la primera que coincide) y no ofrece las que ya tienen un movimiento
 * vinculado (transaction_id) ni las que equivalen a uno ya cargado (mismo tipo y monto, ±3 días).
 * Todo filtrado por usuario; el activo tiene que ser del usuario (lo valida el controller).
 */
export const candidatasDeBackfill = async (req, asset) => {
  const reglas = compilarReglas(await reglasDelUsuario(req));
  const deEsteActivo = (regla) => regla?.accion?.tipo === 'inversion' && String(regla.accion.activo_id) === String(asset._id);
  if (!reglas.some(c => deEsteActivo(c.regla))) return { candidatas: [], reglas: 0 };

  const transacciones = await Transaction.find(buildUserQuery(req, { categoria: CATEGORIA_INVERSION }))
    .sort({ _id: -1 })
    .limit(MAX_TRANSACCIONES_BACKFILL)
    .select('fecha detalle tipo origen importe moneda monto_original')
    .lean();
  const coinciden = transacciones
    .filter(t => deEsteActivo(buscarRegla(t, reglas)))
    .map(t => ({ ...t, inversion: { activo_id: String(asset._id) } }));
  if (!coinciden.length) return { candidatas: [], reglas: 1 };

  const movimientos = await InvestmentMovement.find(buildUserQuery(req, { asset_id: asset._id }))
    .select('fecha tipo monto transaction_id')
    .lean();
  const vinculadas = new Set(movimientos.filter(m => m.transaction_id).map(m => String(m.transaction_id)));
  const pendientes = coinciden.filter(t => !vinculadas.has(String(t._id)));

  const plan = planDeInversiones(
    pendientes,
    new Map([[String(asset._id), { _id: asset._id, nombre: asset.nombre, moneda: asset.moneda }]]),
    new Map([[String(asset._id), movimientos]])
  );
  return {
    reglas: 1,
    candidatas: pendientes.map((t, i) => ({
      transaction_id: String(t._id),
      fecha: t.fecha,
      detalle: t.detalle,
      tipo: plan[i].movimiento?.tipo ?? null,
      monto: plan[i].movimiento?.monto ?? null,
      crear: plan[i].crear,
      duplicado: plan[i].duplicado,
      error: plan[i].error
    }))
  };
};

/**
 * Crea los movimientos de las transacciones elegidas. Se vuelven a calcular las candidatas en el servidor:
 * solo se cargan las que siguen cumpliendo todo (regla del activo, sin duplicado ni error).
 * @param {string[]} ids - transaction_id elegidos en la vista previa
 * @returns {Promise<{ creados: number, duplicados: number, errores: string[], omitidas: number }>}
 */
export const cargarBackfill = async (req, asset, ids) => {
  const elegidos = new Set((Array.isArray(ids) ? ids : []).map(String));
  const { candidatas } = await candidatasDeBackfill(req, asset);
  const aCrear = candidatas.filter(c => elegidos.has(c.transaction_id) && c.crear);
  const omitidas = elegidos.size - aCrear.length;
  if (!aCrear.length) return { creados: 0, duplicados: 0, errores: [], omitidas };

  const transacciones = await Transaction.find(buildUserQuery(req, { _id: { $in: aCrear.map(c => c.transaction_id) } }))
    .select('fecha tipo importe moneda monto_original categoria')
    .lean();
  const aviso = await crearMovimientosDeExtracto(
    req,
    transacciones.map(t => ({ ...t, inversion: { activo_id: String(asset._id), crear: true } })),
    undefined,
    // Las candidatas ya salieron de deduplicar contra todo: no volver a emparejar solo las elegidas
    { yaDeduplicadas: true }
  );
  return { creados: 0, duplicados: 0, errores: [], ...(aviso || {}), omitidas };
};

/**
 * Frase para sumar al mensaje de la importación: qué pasó con lo que se pidió cargar en Inversiones
 * @param {null | { creados: number, duplicados: number, errores: string[] }} aviso
 */
export const textoAvisoInversiones = (aviso) => {
  if (!aviso) return '';
  const partes = [];
  if (aviso.creados) partes.push(`Se cargaron ${aviso.creados} movimiento${aviso.creados === 1 ? '' : 's'} en Inversiones`);
  if (aviso.duplicados) partes.push(`${aviso.duplicados} ya estaba${aviso.duplicados === 1 ? '' : 'n'} cargado${aviso.duplicados === 1 ? '' : 's'}`);
  if (aviso.errores?.length) partes.push(`No se pudo cargar en Inversiones: ${aviso.errores[0]}`);
  return partes.length ? `. ${partes.join('. ')}` : '';
};

/**
 * Al revertir una importación (INV-02), los movimientos de Inversiones que creó el extracto:
 * - sin cuotapartes: se borran, porque solo existen por esa transacción;
 * - con cuotapartes (el usuario ya las completó con el importador de Fima): se conservan y se
 *   desvinculan (vuelven a 'app'), porque ya tienen datos que no vienen del extracto.
 * Todo filtrado por usuario y por la operación.
 * @returns {Promise<{ borrados: number, desvinculados: number }>}
 */
export const revertirMovimientosDeOperacion = async (req, operationId) => {
  if (!operationId) return { borrados: 0, desvinculados: 0 };
  const deDeLaOperacion = { operation_id: operationId, origen: 'extracto' };

  const borrados = await InvestmentMovement.deleteMany(buildUserQuery(req, {
    ...deDeLaOperacion,
    $or: [{ unidades: { $exists: false } }, { unidades: null }]
  }));
  const desvinculados = await InvestmentMovement.updateMany(
    buildUserQuery(req, deDeLaOperacion),
    { $unset: { operation_id: 1, transaction_id: 1 }, $set: { origen: 'app' } }
  );
  return { borrados: borrados.deletedCount ?? 0, desvinculados: desvinculados.modifiedCount ?? 0 };
};
