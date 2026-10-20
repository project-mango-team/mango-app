import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import iconv from 'iconv-lite';
import { PDFParse } from 'pdf-parse';
import { MercadoPagoParser } from '../parsers/MercadoPagoParser.js';
import { SantanderParser } from '../parsers/SantanderParser.js';
import { GaliciaParser } from '../parsers/GaliciaParser.js';
import { DolarService } from './dolarService.js';
import Transaction from '../models/Transaction.js';
import Operation from '../models/Operation.js';
import { addUserToTransactionData, addUserToOperationData, buildUserQuery } from '../utils/userQuery.js';
import { marcarTransaccionesDuplicadas, normalizarFecha } from '../utils/transactionDedup.js';
import { excelToCsvBuffer, isExcelFilename } from '../utils/excelToCsv.js';
import { AppError } from '../middleware/errorHandler.js';
import { aplicarReglas } from '../utils/categoryRules.js';

// Importación de resúmenes bancarios: parseo por banco y guardado como Operation + Transactions.
// Lo usan el upload manual (routes/upload.js) y, más adelante, la bandeja de ingesta.

export const TIPOS_IMPORTACION = ['mercadopago', 'santander', 'galicia'];

const validarTipo = (tipo) => {
  if (!tipo || !TIPOS_IMPORTACION.includes(tipo)) {
    throw new AppError('Tipo de archivo inválido. Debe ser "mercadopago", "santander" o "galicia"', 400);
  }
};

// Helper function to ensure valid numbers
const safeNumber = (value) => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

/**
 * Convierte un Excel a CSV cuando el banco lo necesita; el resto de los formatos pasa tal cual
 * @param {{ buffer: Buffer, filename: string }} archivo
 */
export const normalizarArchivo = async ({ buffer, filename = '' }, tipo, tipoResumen = null) => {
  if (!isExcelFilename(filename)) {
    return buffer;
  }

  if (tipo === 'mercadopago') {
    throw new AppError('El archivo Excel no esta soportado para Mercado Pago', 400);
  }

  const resumen = tipoResumen || 'cuenta';
  if (tipo === 'galicia' && resumen === 'tarjeta') {
    throw new AppError('El resumen de tarjeta Galicia debe ser TXT o PDF, no Excel', 400);
  }

  if (tipo !== 'santander' && tipo !== 'galicia') {
    throw new AppError('El archivo Excel solo esta soportado para Santander y Galicia', 400);
  }

  const encoding = tipo === 'santander' ? 'latin1' : 'utf8';
  return await excelToCsvBuffer(buffer, encoding);
};

// selectedCards puede llegar como JSON string (multipart) o ya parseado
const parseSelectedCards = (selectedCards) => {
  if (!selectedCards) return null;
  try {
    return typeof selectedCards === 'string' ? JSON.parse(selectedCards) : selectedCards;
  } catch (e) {
    return selectedCards;
  }
};

// Cotización del dólar para resúmenes con consumos en USD: la indicada o la del día
const resolverDolar = async (valorDolar) => {
  const dolarVal = parseFloat(valorDolar);
  return !dolarVal || isNaN(dolarVal) ? await DolarService.getCotizacion() : dolarVal;
};

/**
 * Tarjetas presentes en un resumen de Santander (para elegir cuáles importar)
 * @param {{ buffer: Buffer, filename: string }} archivo
 */
export const detectarTarjetasSantander = async (archivo) => {
  const fileBuffer = await normalizarArchivo(archivo, 'santander');
  const parser = new SantanderParser(fileBuffer, 1); // Dollar value not needed for detection
  return parser.getCards();
};

// ---------- Detección automática ----------

const BANCOS = { mercadopago: 'Mercado Pago', santander: 'Santander', galicia: 'Galicia' };

/**
 * Tipo de archivo por sus primeros bytes (no por la extensión)
 * @returns {'pdf'|'excel'|'texto'}
 */
export const tipoDeArchivo = (buffer) => {
  if (buffer.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  // XLSX es un ZIP; XLS viejo es un documento OLE2
  if (buffer.slice(0, 4).toString('latin1') === 'PK\u0003\u0004') return 'excel';
  if (buffer.slice(0, 4).toString('hex') === 'd0cf11e0') return 'excel';
  return 'texto';
};

/**
 * Texto del archivo para buscar firmas: PDF → texto, Excel → CSV, texto → UTF-8 (o Latin-1 si no es UTF-8 válido)
 */
const extraerTexto = async (buffer, archivo) => {
  if (archivo === 'pdf') {
    const pdfParser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
    await pdfParser.load();
    return (await pdfParser.getText()).text;
  }
  if (archivo === 'excel') {
    return (await excelToCsvBuffer(buffer, 'utf8')).toString('utf8');
  }
  const utf8 = iconv.decode(buffer, 'utf8');
  return utf8.includes('�') ? iconv.decode(buffer, 'latin1') : utf8;
};

/**
 * Reconoce de qué banco y tipo de resumen es un archivo, para importarlo sin elegir nada a mano.
 * Cada parser expone `detectar(texto)`; el primero que lo reconoce gana.
 * @param {{ buffer: Buffer, filename?: string }} archivo
 * @returns {Promise<{
 *   soportado: boolean, confianza: 'alta'|'media'|'baja', banco?: string, tipo?: string,
 *   tipoResumen?: string, producto?: string, formato?: string, archivo: string, descripcion?: string,
 *   cardType?: string, tarjetas?: string[], cierre?: string|null, periodo?: { desde, hasta }|null, motivo?: string
 * }>}
 */
export const detectarDocumento = async ({ buffer }) => {
  const archivo = tipoDeArchivo(buffer);
  let texto;
  try {
    texto = await extraerTexto(buffer, archivo);
  } catch (error) {
    return { soportado: false, confianza: 'baja', archivo, motivo: `No se pudo leer el archivo: ${error.message}` };
  }

  const deteccion = MercadoPagoParser.detectar(texto)
    || SantanderParser.detectar(texto)
    || GaliciaParser.detectar(texto);

  if (!deteccion) {
    return {
      soportado: false,
      confianza: 'baja',
      archivo,
      motivo: 'No se reconoció el resumen. Elegí el banco y el tipo a mano.'
    };
  }

  const resultado = {
    soportado: true,
    confianza: 'alta',
    archivo,
    banco: BANCOS[deteccion.tipo],
    ...deteccion
  };

  // Santander trae varias tarjetas en el mismo archivo: por defecto se importan todas
  if (resultado.soportado && resultado.tipo === 'santander') {
    resultado.tarjetas = await detectarTarjetasSantander({ buffer, filename: archivo === 'excel' ? 'resumen.xlsx' : 'resumen.csv' });
  }

  return resultado;
};

/**
 * Parsea un resumen con el parser del banco y devuelve las transacciones sin guardarlas
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.filename
 * @param {'mercadopago'|'santander'|'galicia'} params.tipo
 * @param {'cuenta'|'tarjeta'} [params.tipoResumen] - Solo Galicia (default 'cuenta')
 * @param {number|string} [params.valorDolar] - Santander y tarjetas Galicia; si falta, la cotización del día
 * @param {Array|string} [params.selectedCards] - Solo Santander
 * @param {Object} [params.categoryKeywords] - Keywords para inferir categorías (solo si no vienen reglas)
 * @param {Array} [params.reglas] - Reglas del usuario (REV-02): reemplazan a las keywords
 * @returns {Promise<{ transactions: Array, valorDolar: number|null, cardFilter: Array|null }>}
 */
export const parsearDocumento = async ({ reglas = null, ...params }) => {
  if (!reglas) return parsearConParser(params);
  // Con reglas, el parser no infiere nada (todo queda en "Otros" salvo lo que fija él) y deciden las reglas
  const resultado = await parsearConParser({ ...params, categoryKeywords: {} });
  return { ...resultado, transactions: aplicarReglas(resultado.transactions, reglas) };
};

const parsearConParser = async ({ buffer, filename, tipo, tipoResumen, valorDolar, selectedCards, categoryKeywords = null }) => {
  validarTipo(tipo);
  const fileBuffer = await normalizarArchivo({ buffer, filename }, tipo, tipoResumen);

  if (tipo === 'mercadopago') {
    const parser = new MercadoPagoParser(fileBuffer, categoryKeywords);
    return { transactions: await parser.parse(), valorDolar: null, cardFilter: null };
  }

  if (tipo === 'santander') {
    const dolarVal = await resolverDolar(valorDolar);
    const cardFilter = parseSelectedCards(selectedCards);
    const parser = new SantanderParser(fileBuffer, dolarVal, cardFilter, categoryKeywords);
    return { transactions: await parser.parse(), valorDolar: dolarVal, cardFilter };
  }

  // Galicia: cuenta o tarjeta; solo la tarjeta tiene consumos en USD
  const tipoRes = tipoResumen || 'cuenta';
  const dolarVal = tipoRes === 'tarjeta' ? await resolverDolar(valorDolar) : 0;
  const parser = new GaliciaParser(fileBuffer, tipoRes, dolarVal, categoryKeywords);
  return { transactions: await parser.parse(), valorDolar: null, cardFilter: null };
};

// ---------- Duplicados ----------

/**
 * Hash del contenido del archivo, para reconocer el mismo resumen subido dos veces
 */
export const hashArchivo = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * Si este mismo archivo ya se importó (y no se deshizo), datos de esa importación
 * @returns {Promise<{ operation_id, filename, fecha }|null>}
 */
export const buscarImportacionDelArchivo = async (req, sha256) => {
  if (!sha256) return null;
  const op = await Operation.findOne(buildUserQuery(req, { 'metadata.sha256': sha256, status: 'completed' }))
    .sort({ created_at: -1 })
    .lean();
  return op ? { operation_id: op.operation_id, filename: op.filename, fecha: op.created_at } : null;
};

/**
 * Agrega `duplicado: true|false` a cada transacción según si ya está cargada para el usuario.
 * Solo trae de la DB las del mismo origen y las mismas fechas.
 */
export const marcarDuplicados = async (req, transactions) => {
  if (!transactions.length) return transactions;
  const fechas = [...new Set(transactions.map(t => normalizarFecha(t.fecha)))];
  const origenes = [...new Set(transactions.map(t => t.origen).filter(Boolean))];
  const existentes = await Transaction.find(buildUserQuery(req, { fecha: { $in: fechas }, origen: { $in: origenes } }))
    .select('fecha tipo moneda importe monto_original detalle origen')
    .lean();
  const duplicados = marcarTransaccionesDuplicadas(transactions, existentes);
  return transactions.map((t, i) => ({ ...t, duplicado: duplicados[i] }));
};

// Helper function to convert DD-MM-YYYY or DD/MM/YYYY to standardized format
export const normalizeDate = (dateStr) => {
  if (!dateStr) return '';

  const normalized = String(dateStr).trim().replace(/-/g, '/');
  const parts = normalized.split('/');

  if (parts.length === 3) {
    let [day, month, year] = parts;

    if (year && year.length === 2) {
      year = `20${year}`;
    }

    return `${day}/${month}/${year}`;
  }

  return normalized;
};

// Helper function to extract month name from date
export const getMonthName = (dateStr) => {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    return meses[month] || '';
  }
  return '';
};

/**
 * Guarda transacciones ya parseadas (y eventualmente editadas) como una importación:
 * una Operation con su operation_id y las Transactions que lo referencian (así funcionan el historial y el rollback)
 * @param {Object} params
 * @param {{ user: { _id } }} params.req - Request (o cualquier objeto con `user`) para el user_id
 * @param {Array} params.transactions
 * @param {string} params.tipo - Origen del import ('mercadopago', 'santander', 'galicia', 'manual')
 * @param {string} params.filename
 * @param {string} [params.sha256] - Hash del archivo, para avisar si se vuelve a subir el mismo
 */
export const guardarImportacion = async ({ req, transactions, tipo, filename, sha256 }) => {
  if (!transactions || transactions.length === 0) {
    throw new AppError('No se encontraron transacciones válidas en el archivo', 400);
  }

  // Generate unique operation ID for this import
  const operationId = uuidv4();
  const batchId = uuidv4();
  const timestamp = new Date();

  // Transform transactions to MongoDB format and save
  const transactionsToSave = addUserToTransactionData(req, transactions.map(t => ({
    fecha: normalizeDate(t.fecha),
    mes: getMonthName(normalizeDate(t.fecha)),
    categoria: t.categoria,
    detalle: t.detalle,
    importe: t.importe,
    moneda: t.moneda,
    monto_original: t.monto_original,
    tipo: t.tipo,
    origen: t.origen,
    operation_id: operationId,
    batch_id: batchId,
    batch_filename: filename,
    batch_timestamp: timestamp
  })));

  // Calculate totals
  const gastos = transactionsToSave.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (t.importe || 0), 0);
  const ingresos = transactionsToSave.filter(t => t.tipo === 'Ingreso').reduce((sum, t) => sum + (t.importe || 0), 0);

  // Insert transactions into MongoDB
  const result = await Transaction.insertMany(transactionsToSave, { ordered: false });

  // Create operation record with safe numeric values
  await Operation.create(addUserToOperationData(req, {
    operation_id: operationId,
    type: 'upload',
    status: 'completed',
    origen: transactions[0]?.origen || tipo,
    filename,
    transactions_count: result.length,
    total_gastos: safeNumber(gastos),
    total_ingresos: safeNumber(ingresos),
    balance: safeNumber(ingresos - gastos),
    metadata: {
      batch_id: batchId,
      tipo,
      transacciones_procesadas: transactions.length,
      ...(sha256 && { sha256 })
    },
    created_at: timestamp
  }));

  return {
    operation_id: operationId,
    batch_id: batchId,
    filename,
    tipo,
    transacciones_procesadas: transactions.length,
    transacciones_guardadas: result.length,
    timestamp
  };
};
