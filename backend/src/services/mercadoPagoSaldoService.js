import InvestmentAsset from '../models/InvestmentAsset.js';
import InvestmentMovement from '../models/InvestmentMovement.js';
import { convertirMonto } from '../utils/investmentCalc.js';
import { DolarService } from './dolarService.js';
import { guardarValuacionAutomatica } from './valuationService.js';

// MP-04: el saldo de la cuenta de Mercado Pago como activo "Cuenta remunerada" de Inversiones.
// Lo valúa la sync diaria con el saldo del reporte, sin pasar por el sistema de precios de VAL.

export const ACTIVO_MP = { nombre: 'Cuenta remunerada', plataforma: 'Mercado Pago', tipo: 'Cuenta remunerada', moneda: 'ARS' };

/**
 * Activo de Mercado Pago del usuario; lo crea la primera vez
 */
export const asegurarActivoMp = async (userId, { crear = true } = {}) => {
  const filtro = { user_id: userId, plataforma: ACTIVO_MP.plataforma, tipo: ACTIVO_MP.tipo, moneda: 'ARS' };
  const existente = await InvestmentAsset.findOne(filtro);
  if (existente || !crear) return existente;
  return InvestmentAsset.create({
    ...ACTIVO_MP,
    user_id: userId,
    renta: 'Variable',
    notas: 'Saldo de Mercado Pago, se actualiza solo con la sync diaria.'
  });
};

const NOTA_INICIAL = 'Automática · Mercado Pago · saldo inicial';
const NOTA_FLUJO = 'Automática · Mercado Pago · plata que entró o salió';

// Aporte o Retiro automático del día; reemplaza el que ya hubiera con esa nota
const guardarFlujo = async (asset, fecha, monto, nota, cot) => {
  await InvestmentMovement.findOneAndUpdate(
    { user_id: asset.user_id, asset_id: asset._id, automatica: true, notas: nota, fecha: new Date(`${fecha}T00:00:00Z`) },
    { $set: { tipo: monto >= 0 ? 'Aporte' : 'Retiro', monto: Math.abs(monto), cotizacion_usd: cot.usd, ...convertirMonto(Math.abs(monto), asset.moneda, cot) } },
    { upsert: true, runValidators: true }
  );
};

/**
 * Guarda el saldo de MP al cierre de `fecha` como valuación automática del día, y la plata que entró o salió
 * como aportes y retiros (si no, todo el saldo se contaría como ganancia). Nunca pisa una valuación manual.
 * @param {*} userId
 * @param {{ fecha: string, saldo: number, desde?: string, saldoInicial?: number|null, flujos?: { fecha: string, monto: number }[] }} datos
 *   fechas YYYY-MM-DD; flujos sin los rendimientos; saldoInicial se registra como aporte solo la primera vez
 */
export const valuarSaldoMp = async (userId, { fecha, saldo, desde = fecha, saldoInicial = null, flujos = [] }) => {
  // Cuenta vacía y sin activo: no vale la pena crearlo. Si ya existe, el 0 sí se registra.
  const asset = await asegurarActivoMp(userId, { crear: saldo > 0 });
  if (!asset) return { estado: 'omitida', motivo: 'Saldo en cero' };

  const cots = new Map();
  const cotDe = async (f) => {
    if (!cots.has(f)) cots.set(f, { usd: (await DolarService.getBlue(f)).promedio });
    return cots.get(f);
  };

  const esNuevo = !(await InvestmentMovement.exists({ user_id: asset.user_id, asset_id: asset._id }));
  if (esNuevo && saldoInicial > 0) {
    await guardarFlujo(asset, desde, saldoInicial, NOTA_INICIAL, await cotDe(desde));
  }
  for (const flujo of flujos) {
    await guardarFlujo(asset, flujo.fecha, flujo.monto, NOTA_FLUJO, await cotDe(flujo.fecha));
  }
  return guardarValuacionAutomatica(asset, { fecha, monto: saldo, fuente: 'Mercado Pago' }, await cotDe(fecha));
};
