import mongoose from 'mongoose';
import InvestmentAsset from '../models/InvestmentAsset.js';
import InvestmentMovement from '../models/InvestmentMovement.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { planDeInversiones } from '../utils/investmentFromStatement.js';
import { convertirMonto } from '../utils/investmentCalc.js';
import { crearCotizacionesEn } from './investmentQuoteService.js';

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
export const crearMovimientosDeExtracto = async (req, transacciones, operationId) => {
  const pedidas = transacciones.filter(t => t?.inversion?.activo_id && t.inversion.crear === true);
  if (!pedidas.length) return null;

  const aviso = { creados: 0, duplicados: 0, errores: [] };
  try {
    const { activos, existentes } = await contextoDeInversiones(req, pedidas);
    const plan = planDeInversiones(pedidas, activos, existentes);

    const aCrear = [];
    plan.forEach((p, i) => {
      if (p.error) aviso.errores.push(p.error);
      else if (p.duplicado) aviso.duplicados++;
      else if (p.crear) aCrear.push({ transaccion: pedidas[i], plan: p });
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
