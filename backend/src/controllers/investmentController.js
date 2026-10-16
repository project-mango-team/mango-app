import mongoose from 'mongoose';
import InvestmentAsset, { MONEDAS_INVERSION, RENTAS } from '../models/InvestmentAsset.js';
import InvestmentMovement, { TIPOS_MOVIMIENTO } from '../models/InvestmentMovement.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { DolarService, hoyArgentina } from '../services/dolarService.js';
import { getInvestmentTypes } from '../config/investmentTypes.js';
import { convertirMonto, calcularResumenActivo, ordenarMovimientos } from '../utils/investmentCalc.js';

// ---------- Helpers ----------

/**
 * Valida una fecha YYYY-MM-DD (no futura) y la devuelve como Date UTC a medianoche
 */
const parseFecha = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new AppError('La fecha debe tener formato YYYY-MM-DD', 400);
  }
  const date = new Date(`${fecha}T00:00:00Z`);
  if (isNaN(date) || date.toISOString().slice(0, 10) !== fecha) {
    throw new AppError('Fecha inválida', 400);
  }
  if (fecha > hoyArgentina()) {
    throw new AppError('La fecha no puede ser futura', 400);
  }
  return date;
};

const parseMonto = (monto) => {
  const n = Number(monto);
  if (monto === '' || monto === null || monto === undefined || !Number.isFinite(n) || n < 0) {
    throw new AppError('El monto debe ser un número mayor o igual a 0', 400);
  }
  return n;
};

const parseCotizacion = (valor, nombre) => {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`La cotización ${nombre} debe ser un número mayor a 0`, 400);
  }
  return n;
};

/**
 * Cotizaciones de la fecha del movimiento: usa las enviadas o las busca (blue promedio / euro)
 */
const resolverCotizaciones = async (moneda, fecha, body) => {
  const usd = parseCotizacion(body.cotizacion_usd, 'USD') ?? (await DolarService.getBlue(fecha)).promedio;
  if (moneda !== 'EUR') return { usd };
  const eur = parseCotizacion(body.cotizacion_eur, 'EUR') ?? (await DolarService.getEuro(fecha)).promedio;
  return { usd, eur };
};

const getCotizacionesHoy = async (incluirEuro) => {
  const usd = (await DolarService.getBlue()).promedio;
  const eur = incluirEuro ? (await DolarService.getEuro()).promedio : undefined;
  return { usd, eur };
};

const findAssetOrFail = async (req, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Activo no encontrado', 404);
  }
  const asset = await InvestmentAsset.findOne(buildUserQuery(req, { _id: id }));
  if (!asset) {
    throw new AppError('Activo no encontrado', 404);
  }
  return asset;
};

const validarDatosActivo = (req, body, { parcial = false } = {}) => {
  const data = {};

  if (!parcial || body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
      throw new AppError('El nombre es obligatorio', 400);
    }
    data.nombre = body.nombre.trim();
  }

  if (!parcial || body.tipo !== undefined) {
    const tipos = getInvestmentTypes(req.user).map(t => t.nombre);
    if (!tipos.includes(body.tipo)) {
      throw new AppError(`Tipo de activo inválido. Opciones: ${tipos.join(', ')}`, 400);
    }
    data.tipo = body.tipo;
  }

  if (!parcial || body.moneda !== undefined) {
    if (!MONEDAS_INVERSION.includes(body.moneda)) {
      throw new AppError(`Moneda inválida. Opciones: ${MONEDAS_INVERSION.join(', ')}`, 400);
    }
    data.moneda = body.moneda;
  }

  if (body.renta !== undefined) {
    if (!RENTAS.includes(body.renta)) {
      throw new AppError(`Renta inválida. Opciones: ${RENTAS.join(', ')}`, 400);
    }
    data.renta = body.renta;
  }

  if (body.plataforma !== undefined) data.plataforma = String(body.plataforma).trim();
  if (body.notas !== undefined) data.notas = String(body.notas);

  return data;
};

const conResumen = (asset, movimientos, cotizacionesHoy) => ({
  ...asset.toObject(),
  resumen: calcularResumenActivo(asset, movimientos, cotizacionesHoy)
});

// ---------- Tipos de activo ----------

export const getTypes = async (req, res, next) => {
  try {
    res.json({ success: true, data: getInvestmentTypes(req.user) });
  } catch (error) {
    next(error);
  }
};

export const createType = async (req, res, next) => {
  try {
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) {
      throw new AppError('El nombre del tipo es obligatorio', 400);
    }
    const existe = getInvestmentTypes(req.user).some(t => t.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) {
      throw new AppError('Ese tipo de activo ya existe', 409);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { investmentTypes: { nombre, liquido: Boolean(req.body.liquido) } } },
      { new: true }
    );

    res.status(201).json({ success: true, data: getInvestmentTypes(user) });
  } catch (error) {
    next(error);
  }
};

export const deleteType = async (req, res, next) => {
  try {
    const { nombre } = req.params;
    const tipo = getInvestmentTypes(req.user).find(t => t.nombre === nombre);
    if (!tipo || !tipo.custom) {
      throw new AppError('Solo se pueden borrar tipos propios', 400);
    }
    const enUso = await InvestmentAsset.countDocuments(buildUserQuery(req, { tipo: nombre }));
    if (enUso > 0) {
      throw new AppError(`Hay ${enUso} activo(s) con este tipo. Cambialos antes de borrarlo.`, 409);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { investmentTypes: { nombre } } },
      { new: true }
    );

    res.json({ success: true, data: getInvestmentTypes(user) });
  } catch (error) {
    next(error);
  }
};

// ---------- Activos ----------

// Lista de activos con su resumen. ?estado=abiertos|cerrados|todos (default todos)
export const getAssets = async (req, res, next) => {
  try {
    const { estado = 'todos' } = req.query;
    const assets = await InvestmentAsset.find(buildUserQuery(req)).sort({ nombre: 1 });
    const movimientos = await InvestmentMovement.find(buildUserQuery(req)).lean();

    const porActivo = new Map();
    for (const mov of movimientos) {
      const key = mov.asset_id.toString();
      if (!porActivo.has(key)) porActivo.set(key, []);
      porActivo.get(key).push(mov);
    }

    const cotizacionesHoy = await getCotizacionesHoy(assets.some(a => a.moneda === 'EUR'));
    let data = assets.map(a => conResumen(a, porActivo.get(a._id.toString()) || [], cotizacionesHoy));

    if (estado === 'abiertos') data = data.filter(a => !a.resumen.cerrado);
    if (estado === 'cerrados') data = data.filter(a => a.resumen.cerrado);

    res.json({ success: true, count: data.length, cotizaciones: cotizacionesHoy, data });
  } catch (error) {
    next(error);
  }
};

export const getAsset = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    const movimientos = await InvestmentMovement.find(buildUserQuery(req, { asset_id: asset._id })).lean();
    const cotizacionesHoy = await getCotizacionesHoy(asset.moneda === 'EUR');

    res.json({
      success: true,
      data: {
        ...conResumen(asset, movimientos, cotizacionesHoy),
        movimientos: ordenarMovimientos(movimientos).reverse()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (req, res, next) => {
  try {
    const data = validarDatosActivo(req, req.body);
    const asset = await InvestmentAsset.create(addUserToData(req, data));
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    const data = validarDatosActivo(req, req.body, { parcial: true });

    if (data.moneda && data.moneda !== asset.moneda) {
      const tieneMovimientos = await InvestmentMovement.exists(buildUserQuery(req, { asset_id: asset._id }));
      if (tieneMovimientos) {
        throw new AppError('No se puede cambiar la moneda de un activo con movimientos', 400);
      }
    }

    asset.set(data);
    await asset.save();
    res.json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
};

// Borra el activo y todos sus movimientos
export const deleteAsset = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    const { deletedCount } = await InvestmentMovement.deleteMany(buildUserQuery(req, { asset_id: asset._id }));
    await InvestmentAsset.deleteOne(buildUserQuery(req, { _id: asset._id }));

    res.json({
      success: true,
      message: `Activo eliminado junto con ${deletedCount} movimiento(s)`
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Movimientos ----------

export const getMovements = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    const movimientos = await InvestmentMovement.find(buildUserQuery(req, { asset_id: asset._id })).lean();
    const data = ordenarMovimientos(movimientos).reverse();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const createMovement = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    const { tipo, fecha, monto, notas = '' } = req.body;

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
      throw new AppError(`Tipo de movimiento inválido. Opciones: ${TIPOS_MOVIMIENTO.join(', ')}`, 400);
    }
    const fechaDate = parseFecha(fecha);
    const montoNum = parseMonto(monto);
    const cot = await resolverCotizaciones(asset.moneda, fecha, req.body);

    const movimiento = await InvestmentMovement.create(addUserToData(req, {
      asset_id: asset._id,
      tipo,
      fecha: fechaDate,
      monto: montoNum,
      cotizacion_usd: cot.usd,
      cotizacion_eur: cot.eur,
      notas: String(notas),
      ...convertirMonto(montoNum, asset.moneda, cot)
    }));

    res.status(201).json({ success: true, data: movimiento });
  } catch (error) {
    next(error);
  }
};

export const updateMovement = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    if (!mongoose.isValidObjectId(req.params.movId)) {
      throw new AppError('Movimiento no encontrado', 404);
    }
    const movimiento = await InvestmentMovement.findOne(
      buildUserQuery(req, { _id: req.params.movId, asset_id: asset._id })
    );
    if (!movimiento) {
      throw new AppError('Movimiento no encontrado', 404);
    }

    const { tipo, fecha, monto, notas } = req.body;

    if (tipo !== undefined) {
      if (!TIPOS_MOVIMIENTO.includes(tipo)) {
        throw new AppError(`Tipo de movimiento inválido. Opciones: ${TIPOS_MOVIMIENTO.join(', ')}`, 400);
      }
      movimiento.tipo = tipo;
    }
    if (notas !== undefined) movimiento.notas = String(notas);

    const fechaAnterior = movimiento.fecha.toISOString().slice(0, 10);
    const cambioFecha = fecha !== undefined && fecha !== fechaAnterior;
    if (fecha !== undefined) movimiento.fecha = parseFecha(fecha);
    if (monto !== undefined) movimiento.monto = parseMonto(monto);

    // Si cambió la fecha y no mandaron cotización, se busca la del nuevo día
    const cotBody = {
      cotizacion_usd: req.body.cotizacion_usd ?? (cambioFecha ? undefined : movimiento.cotizacion_usd),
      cotizacion_eur: req.body.cotizacion_eur ?? (cambioFecha ? undefined : movimiento.cotizacion_eur)
    };
    const cot = await resolverCotizaciones(asset.moneda, fecha ?? fechaAnterior, cotBody);
    movimiento.cotizacion_usd = cot.usd;
    movimiento.cotizacion_eur = cot.eur;
    movimiento.set(convertirMonto(movimiento.monto, asset.moneda, cot));

    await movimiento.save();
    res.json({ success: true, data: movimiento });
  } catch (error) {
    next(error);
  }
};

export const deleteMovement = async (req, res, next) => {
  try {
    const asset = await findAssetOrFail(req, req.params.id);
    if (!mongoose.isValidObjectId(req.params.movId)) {
      throw new AppError('Movimiento no encontrado', 404);
    }
    const movimiento = await InvestmentMovement.findOneAndDelete(
      buildUserQuery(req, { _id: req.params.movId, asset_id: asset._id })
    );
    if (!movimiento) {
      throw new AppError('Movimiento no encontrado', 404);
    }
    res.json({ success: true, message: 'Movimiento eliminado' });
  } catch (error) {
    next(error);
  }
};
