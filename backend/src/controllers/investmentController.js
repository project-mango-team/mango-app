import mongoose from 'mongoose';
import InvestmentAsset, { MONEDAS_INVERSION, RENTAS } from '../models/InvestmentAsset.js';
import InvestmentMovement, { TIPOS_MOVIMIENTO } from '../models/InvestmentMovement.js';
import User from '../models/User.js';
import LoanMovement from '../models/LoanMovement.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { DolarService, hoyArgentina } from '../services/dolarService.js';
import { getInvestmentTypes } from '../config/investmentTypes.js';
import { resumirPrestamos } from '../utils/loanCalc.js';
import { parseFecha, parseMonto, parseCotizacion } from '../utils/inputParsers.js';
import {
  convertirMonto,
  calcularResumenActivo,
  calcularTotalesPortfolio,
  ordenarMovimientos,
  cotizacionEnFecha,
  calcularRendimientoPeriodo,
  cierresDeMes,
  calcularSerieMensual
} from '../utils/investmentCalc.js';

// ---------- Helpers ----------

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

/**
 * Todos los activos del usuario con su resumen calculado a la cotización de hoy
 */
const cargarActivosConResumen = async (req) => {
  const assets = await InvestmentAsset.find(buildUserQuery(req)).sort({ nombre: 1 });
  const movimientos = await InvestmentMovement.find(buildUserQuery(req)).lean();

  const porActivo = new Map();
  for (const mov of movimientos) {
    const key = mov.asset_id.toString();
    if (!porActivo.has(key)) porActivo.set(key, []);
    porActivo.get(key).push(mov);
  }

  const cotizaciones = await getCotizacionesHoy(assets.some(a => a.moneda === 'EUR'));
  const activos = assets.map(a => conResumen(a, porActivo.get(a._id.toString()) || [], cotizaciones));
  return { activos, cotizaciones };
};

// Lista de activos con su resumen. ?estado=abiertos|cerrados|todos (default todos)
export const getAssets = async (req, res, next) => {
  try {
    const { estado = 'todos' } = req.query;
    const { activos, cotizaciones } = await cargarActivosConResumen(req);

    let data = activos;
    if (estado === 'abiertos') data = data.filter(a => !a.resumen.cerrado);
    if (estado === 'cerrados') data = data.filter(a => a.resumen.cerrado);

    res.json({ success: true, count: data.length, cotizaciones, data });
  } catch (error) {
    next(error);
  }
};

// Vista Portfolio: activos abiertos + totales, liquidez y distribución por tipo
export const getPortfolio = async (req, res, next) => {
  try {
    const { activos, cotizaciones } = await cargarActivosConResumen(req);
    const tipos = getInvestmentTypes(req.user);
    const { totales, por_tipo } = calcularTotalesPortfolio(activos, tipos);

    // Los préstamos suman al patrimonio pero no a la liquidez ni a la ganancia
    const prestamos = resumirPrestamos(await LoanMovement.find(buildUserQuery(req)).lean());
    const prestamosUsd = prestamos.total_pendiente_usd;
    const prestamosArs = Math.round(prestamosUsd * cotizaciones.usd * 100) / 100;

    res.json({
      success: true,
      data: {
        cotizaciones,
        totales: {
          ...totales,
          prestamos_usd: prestamosUsd,
          prestamos_ars: prestamosArs,
          patrimonio_usd: Math.round((totales.valor_usd + prestamosUsd) * 100) / 100,
          patrimonio_ars: Math.round((totales.valor_ars + prestamosArs) * 100) / 100
        },
        por_tipo,
        activos: activos.filter(a => !a.resumen.cerrado),
        cantidad_cerrados: activos.filter(a => a.resumen.cerrado).length
      }
    });
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

// Carga varias valuaciones con la misma fecha: { fecha, cotizacion_usd?, cotizacion_eur?, valuaciones: [{ asset_id, monto }] }
export const createValuations = async (req, res, next) => {
  try {
    const { fecha, valuaciones } = req.body;
    const fechaDate = parseFecha(fecha);
    if (!Array.isArray(valuaciones) || valuaciones.length === 0) {
      throw new AppError('No hay valuaciones para guardar', 400);
    }

    const ids = valuaciones.map(v => v.asset_id);
    if (!ids.every(id => mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) {
      throw new AppError('Lista de activos inválida', 400);
    }
    const assets = await InvestmentAsset.find(buildUserQuery(req, { _id: { $in: ids } }));
    if (assets.length !== ids.length) {
      throw new AppError('Activo no encontrado', 404);
    }
    const assetsById = new Map(assets.map(a => [a._id.toString(), a]));

    // Una sola consulta de cotización para todo el lote
    const necesitaEuro = assets.some(a => a.moneda === 'EUR');
    const cot = await resolverCotizaciones(necesitaEuro ? 'EUR' : 'USD', fecha, req.body);

    const docs = valuaciones.map(({ asset_id, monto }) => {
      const asset = assetsById.get(asset_id);
      const montoNum = parseMonto(monto);
      return {
        asset_id: asset._id,
        tipo: 'Valuacion',
        fecha: fechaDate,
        monto: montoNum,
        cotizacion_usd: cot.usd,
        cotizacion_eur: asset.moneda === 'EUR' ? cot.eur : undefined,
        ...convertirMonto(montoNum, asset.moneda, cot)
      };
    });

    const movimientos = await InvestmentMovement.insertMany(addUserToData(req, docs));
    res.status(201).json({ success: true, count: movimientos.length, data: movimientos });
  } catch (error) {
    next(error);
  }
};

// ---------- Rendimientos ----------

const validarFechaOpcional = (fecha, nombre) => {
  if (fecha === undefined || fecha === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(new Date(`${fecha}T00:00:00Z`))) {
    throw new AppError(`${nombre} debe tener formato YYYY-MM-DD`, 400);
  }
  return fecha;
};

/**
 * Ganancias por activo (incluye cerrados), totales realizada/no realizada y serie mensual.
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (opcionales; sin desde = desde el primer movimiento)
 */
export const getPerformance = async (req, res, next) => {
  try {
    const hoy = hoyArgentina();
    const desde = validarFechaOpcional(req.query.desde, 'desde');
    const hastaQuery = validarFechaOpcional(req.query.hasta, 'hasta');
    const hasta = !hastaQuery || hastaQuery > hoy ? hoy : hastaQuery;
    if (desde && desde > hasta) {
      throw new AppError('La fecha desde no puede ser posterior a hasta', 400);
    }

    const assets = await InvestmentAsset.find(buildUserQuery(req)).sort({ nombre: 1 });
    const movimientos = await InvestmentMovement.find(buildUserQuery(req)).lean();

    const porActivo = new Map(assets.map(a => [a._id.toString(), []]));
    for (const mov of movimientos) {
      porActivo.get(mov.asset_id.toString())?.push(mov);
    }

    const necesitaEuro = assets.some(a => a.moneda === 'EUR');
    const [historialUsd, historialEur, cotHoy] = await Promise.all([
      DolarService.getHistorial('blue'),
      necesitaEuro ? DolarService.getHistorialEuro() : null,
      getCotizacionesHoy(necesitaEuro)
    ]);
    // Hoy usa la cotización en vivo (igual que Portfolio); días pasados, el historial.
    // El historial del euro arranca en 2023: antes de eso se usa su primer valor.
    const cotizacionesEn = (fecha) => (fecha >= hoy
      ? cotHoy
      : { usd: cotizacionEnFecha(historialUsd, fecha), eur: historialEur ? cotizacionEnFecha(historialEur, fecha) : undefined });

    const activos = assets
      .map(asset => {
        const movs = porActivo.get(asset._id.toString());
        return {
          _id: asset._id,
          nombre: asset.nombre,
          tipo: asset.tipo,
          moneda: asset.moneda,
          plataforma: asset.plataforma,
          cerrado: calcularResumenActivo(asset, movs, cotHoy).cerrado,
          primer_movimiento: movs.length ? ordenarMovimientos(movs)[0].fecha : null,
          ...calcularRendimientoPeriodo(asset, movs, { desde, hasta }, cotizacionesEn)
        };
      })
      .filter(a => a.activo_en_periodo);

    const totales = { ganancia_usd: 0, ganancia_ars: 0, realizada_usd: 0, realizada_ars: 0, no_realizada_usd: 0, no_realizada_ars: 0 };
    for (const a of activos) {
      const clave = a.cerrado ? 'realizada' : 'no_realizada';
      totales.ganancia_usd += a.ganancia_usd;
      totales.ganancia_ars += a.ganancia_ars;
      totales[`${clave}_usd`] += a.ganancia_usd;
      totales[`${clave}_ars`] += a.ganancia_ars;
    }
    const base = activos.reduce(
      (acc, a) => ({ usd: acc.usd + a.valor_inicio_usd + a.aportado_usd, ars: acc.ars + a.valor_inicio_ars + a.aportado_ars }),
      { usd: 0, ars: 0 }
    );
    for (const key of Object.keys(totales)) {
      totales[key] = Math.round(totales[key] * 100) / 100;
    }
    totales.rendimiento_usd = base.usd > 0 ? totales.ganancia_usd / base.usd : 0;
    totales.rendimiento_ars = base.ars > 0 ? totales.ganancia_ars / base.ars : 0;

    const primeraFecha = movimientos.length
      ? ordenarMovimientos(movimientos)[0].fecha.toISOString().slice(0, 10)
      : null;
    const inicioSerie = desde && primeraFecha && desde > primeraFecha ? desde : primeraFecha;
    const serie = inicioSerie && inicioSerie <= hasta
      ? calcularSerieMensual(
        assets.map(a => ({ moneda: a.moneda, movimientos: porActivo.get(a._id.toString()) })),
        cierresDeMes(inicioSerie, hasta),
        cotizacionesEn
      )
      : [];

    res.json({
      success: true,
      data: {
        desde: desde || primeraFecha,
        hasta,
        totales,
        activos: activos.sort((a, b) => b.ganancia_usd - a.ganancia_usd),
        serie
      }
    });
  } catch (error) {
    next(error);
  }
};
