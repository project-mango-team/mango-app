import IngestDocument from '../models/IngestDocument.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { isExcelFilename } from '../utils/excelToCsv.js';
import { normalizarFecha } from '../utils/transactionDedup.js';
import { DolarService } from './dolarService.js';
import { compararTotales } from '../utils/totalesResumen.js';
import { FUENTES, fuenteDeAviso, homebankingDe, avisoCoincide, elegirAviso, fuenteDeDeteccion } from '../utils/fuentesResumen.js';
import {
  detectarDocumento,
  parsearDocumento,
  marcarDuplicados,
  guardarImportacion,
  hashArchivo,
  buscarImportacionDelArchivo
} from './statementImportService.js';

// Bandeja de resúmenes: cada archivo que entra (subido o, más adelante, por mail) se detecta,
// se parsea y queda listo para revisar e importar. El contenido se guarda para poder re-parsear.

const MAX_ARCHIVO = 10 * 1024 * 1024;

// ---------- Funciones puras ----------

/**
 * Parámetros de parseo a partir de lo detectado
 */
export const parametrosDesdeDeteccion = (deteccion) => ({
  tipo: deteccion?.tipo,
  tipoResumen: deteccion?.tipoResumen || undefined,
  selectedCards: deteccion?.tarjetas || []
});

/**
 * ¿Este resumen tiene consumos que se pesifican con una cotización? (tarjetas)
 */
export const necesitaDolar = ({ tipo, tipoResumen }) =>
  tipo === 'santander' || (tipo === 'galicia' && tipoResumen === 'tarjeta');

/**
 * Resumen de la vista previa: cantidad, duplicados, totales de lo nuevo y rango de fechas (YYYY-MM-DD)
 */
export const resumirPreview = (transacciones) => {
  const nuevas = transacciones.filter(t => !t.duplicado);
  const suma = (tipo) => nuevas.filter(t => t.tipo === tipo).reduce((s, t) => s + (Number(t.importe) || 0), 0);
  const fechas = transacciones
    .map(t => normalizarFecha(t.fecha).split('/'))
    .filter(p => p.length === 3)
    .map(([d, m, y]) => `${y}-${m}-${d}`)
    .sort();
  return {
    cantidad: transacciones.length,
    duplicados: transacciones.length - nuevas.length,
    gastos: Math.round(suma('Gasto') * 100) / 100,
    ingresos: Math.round(suma('Ingreso') * 100) / 100,
    desde: fechas[0] || null,
    hasta: fechas.at(-1) || null
  };
};

/**
 * Nombre para el parser: los Excel se reconocen por extensión, así que si el archivo
 * es Excel (por bytes) y el nombre no lo dice, se la agrega
 */
export const nombreParaParser = (filename, deteccion) =>
  deteccion?.archivo === 'excel' && !isExcelFilename(filename) ? `${filename || 'resumen'}.xlsx` : (filename || 'resumen');

// ---------- Acceso a datos ----------

const findDocumentoOrFail = async (req, id, { conContenido = false } = {}) => {
  const query = IngestDocument.findOne(buildUserQuery(req, { _id: id }));
  if (conContenido) query.select('+contenido');
  const doc = await query.catch(() => null);
  if (!doc) {
    throw new AppError('Documento no encontrado', 404);
  }
  return doc;
};

/**
 * Parsea el documento con sus parámetros y marca duplicados contra lo ya cargado
 */
const transaccionesDe = async (req, doc) => {
  const { transactions } = await parsearDocumento({
    buffer: doc.contenido,
    filename: nombreParaParser(doc.filename, doc.deteccion),
    tipo: doc.parametros.tipo,
    tipoResumen: doc.parametros.tipoResumen,
    valorDolar: doc.parametros.valorDolar,
    // Sin tarjetas elegidas = todas las del archivo
    selectedCards: doc.parametros.selectedCards?.length ? doc.parametros.selectedCards : null,
    categoryKeywords: req.user?.categoryKeywords || null
  });
  return marcarDuplicados(req, transactions);
};

/**
 * Detecta (si hace falta), parsea y deja el documento `listo`, `no_reconocido` o en `error`
 * @param {boolean} [redetectar] - Volver a detectar aunque ya tenga parámetros
 */
const procesar = async (req, doc, { redetectar = true } = {}) => {
  doc.error = null;

  if (redetectar) {
    doc.deteccion = await detectarDocumento({ buffer: doc.contenido });
    if (!doc.deteccion.soportado) {
      doc.estado = doc.deteccion.tipo ? 'error' : 'no_reconocido';
      doc.error = doc.deteccion.motivo;
      doc.preview = undefined;
      return doc.save();
    }
    doc.parametros = { ...parametrosDesdeDeteccion(doc.deteccion), valorDolar: doc.parametros?.valorDolar };
  }

  try {
    // La cotización se fija al procesar, así la revisión y la importación usan la misma
    if (necesitaDolar(doc.parametros) && !doc.parametros.valorDolar) {
      doc.parametros.valorDolar = await DolarService.getCotizacion();
    }
    const transacciones = await transaccionesDe(req, doc);
    if (transacciones.length === 0) {
      throw new Error('No se encontraron transacciones en el archivo');
    }
    doc.preview = { ...resumirPreview(transacciones), control: compararTotales(doc.deteccion?.totales, transacciones) };
    doc.archivo_ya_importado = await buscarImportacionDelArchivo(req, doc.sha256);
    doc.estado = 'listo';
  } catch (error) {
    doc.estado = 'error';
    doc.error = error.message;
    doc.preview = undefined;
  }
  return doc.save();
};

// Lo que se devuelve a la UI (sin el contenido binario). Los avisos llevan su fuente y el link al homebanking.
const vista = (doc) => {
  const { contenido, ...resto } = doc.toObject ? doc.toObject() : doc;
  if (resto.fuente !== 'email_aviso') return resto;
  const { banco, fuente } = fuenteDeAviso(resto.email);
  return { ...resto, aviso: { fuente, nombre: FUENTES[fuente]?.nombre || null, homebanking: homebankingDe(banco) } };
};

/**
 * Si el archivo es el que anunciaba un aviso pendiente (misma fuente y período), cierra el aviso
 */
const cerrarAvisoCoincidente = async (req, doc) => {
  if (doc.cierra_aviso || doc.estado === 'descartado' || !fuenteDeDeteccion(doc.deteccion)) return;
  const avisos = await IngestDocument.find(buildUserQuery(req, { estado: 'pendiente_descarga' })).lean();
  const aviso = elegirAviso(avisos, doc.deteccion);
  if (!aviso) return;
  await IngestDocument.updateOne(
    buildUserQuery(req, { _id: aviso._id, estado: 'pendiente_descarga' }),
    { estado: 'resuelto', resuelto_por: doc._id }
  );
  doc.cierra_aviso = aviso._id;
  await doc.save();
};

// ---------- Casos de uso ----------

/**
 * Agrega un archivo a la bandeja. Si el mismo archivo ya estaba, devuelve ese documento.
 * Con `reabrir` (subida desde la UI) un documento descartado o con error se vuelve a procesar;
 * las integraciones no lo usan, para que un script no deshaga un descarte del usuario.
 * @returns {Promise<{ documento, existente: boolean }>}
 */
export const recibirDocumento = async (req, { buffer, filename, fuente = 'upload', email, reabrir = true }) => {
  if (!buffer?.length) {
    throw new AppError('El archivo está vacío', 400);
  }
  if (buffer.length > MAX_ARCHIVO) {
    throw new AppError('El archivo supera los 10 MB', 400);
  }

  const sha256 = hashArchivo(buffer);
  const existente = await IngestDocument.findOne(buildUserQuery(req, { sha256 })).select('+contenido');
  if (existente) {
    if (reabrir && ['descartado', 'error'].includes(existente.estado)) {
      await procesar(req, existente);
      await cerrarAvisoCoincidente(req, existente);
    }
    return { documento: vista(existente), existente: true };
  }

  const doc = new IngestDocument(addUserToData(req, {
    fuente,
    filename: filename || '',
    size: buffer.length,
    sha256,
    contenido: buffer,
    ...(email && { email })
  }));
  await procesar(req, doc);
  await cerrarAvisoCoincidente(req, doc);
  return { documento: vista(doc), existente: false };
};

/**
 * Documento que ya llegó por este mail (mismo message_id y mismo adjunto), para no duplicar
 * si el script de Gmail lo vuelve a mandar
 */
export const buscarPorMensaje = async (req, messageId, filename) => {
  if (!messageId) return null;
  const doc = await IngestDocument.findOne(buildUserQuery(req, { 'email.message_id': messageId, filename: filename || '' })).lean();
  return doc;
};

/**
 * Aviso de resumen sin archivo adjunto ("tu resumen está disponible"): queda en la bandeja
 * como pendiente de descargar. Idempotente por message_id.
 * @returns {Promise<{ documento, existente: boolean }>}
 */
export const registrarAviso = async (req, { message_id, from, subject, received_at }) => {
  if (!message_id) {
    throw new AppError('Falta el message_id del mail', 400);
  }
  const existente = await IngestDocument.findOne(buildUserQuery(req, { fuente: 'email_aviso', 'email.message_id': message_id })).lean();
  if (existente) {
    return { documento: existente, existente: true };
  }
  const email = { message_id, from, subject, received_at };

  // Si el archivo ya se había subido antes de que llegara el mail, el aviso nace cerrado
  const archivos = await IngestDocument.find(buildUserQuery(req, {
    fuente: { $ne: 'email_aviso' },
    estado: { $ne: 'descartado' },
    cierra_aviso: null
  })).select('_id deteccion').sort({ created_at: -1 }).lean();
  const archivo = archivos.find(a => avisoCoincide({ email }, a.deteccion));

  const doc = await IngestDocument.create(addUserToData(req, {
    fuente: 'email_aviso',
    filename: subject || 'Aviso de resumen',
    estado: archivo ? 'resuelto' : 'pendiente_descarga',
    resuelto_por: archivo?._id || null,
    email
  }));
  if (archivo) {
    await IngestDocument.updateOne(buildUserQuery(req, { _id: archivo._id }), { cierra_aviso: doc._id });
  }
  return { documento: vista(doc), existente: false };
};

/**
 * Documentos de la bandeja, más nuevos primero. Por defecto oculta los descartados y los avisos ya resueltos.
 */
export const listarDocumentos = async (req, { incluirDescartados = false } = {}) => {
  const filtro = incluirDescartados ? {} : { estado: { $nin: ['descartado', 'resuelto'] } };
  const docs = await IngestDocument.find(buildUserQuery(req, filtro)).sort({ created_at: -1 }).limit(200).lean();
  return docs.map(vista);
};

/**
 * Cantidad de documentos esperando revisión (para el badge del menú)
 */
export const contarPendientes = (req) =>
  IngestDocument.countDocuments(buildUserQuery(req, { estado: { $in: ['listo', 'no_reconocido', 'error', 'pendiente_descarga'] } }));

/**
 * Transacciones del documento para revisar en el editor
 */
export const transaccionesParaRevisar = async (req, id) => {
  const doc = await findDocumentoOrFail(req, id, { conContenido: true });
  if (!['listo', 'importado'].includes(doc.estado)) {
    throw new AppError('El documento no está listo para revisar', 400);
  }
  return { documento: vista(doc), transactions: await transaccionesDe(req, doc) };
};

/**
 * Cambia los parámetros (banco/tipo elegidos a mano, cotización, tarjetas) y vuelve a procesar
 */
export const actualizarParametros = async (req, id, { tipo, tipoResumen, valorDolar, selectedCards }) => {
  const doc = await findDocumentoOrFail(req, id, { conContenido: true });
  if (doc.estado === 'importado') {
    throw new AppError('El documento ya se importó: deshacé la importación para cambiarlo', 400);
  }
  const dolar = valorDolar === undefined || valorDolar === '' ? doc.parametros?.valorDolar : Number(valorDolar);
  doc.parametros = {
    tipo: tipo ?? doc.parametros?.tipo,
    tipoResumen: tipoResumen ?? doc.parametros?.tipoResumen,
    valorDolar: Number.isFinite(dolar) && dolar > 0 ? dolar : undefined,
    selectedCards: selectedCards ?? doc.parametros?.selectedCards ?? []
  };
  await procesar(req, doc, { redetectar: false });
  return vista(doc);
};

/**
 * Importa el documento. Con `transactions` (editadas en la revisión) guarda esas;
 * si no, las del archivo sin las que ya estaban cargadas.
 */
export const importarDocumento = async (req, id, { transactions } = {}) => {
  const doc = await findDocumentoOrFail(req, id, { conContenido: true });
  if (doc.estado !== 'listo') {
    throw new AppError(doc.estado === 'importado' ? 'El documento ya se importó' : 'El documento no está listo para importar', 400);
  }

  const aGuardar = transactions
    ? transactions.map(({ duplicado, incluir, ...t }) => t)
    : (await transaccionesDe(req, doc)).filter(t => !t.duplicado).map(({ duplicado, ...t }) => t);

  if (aGuardar.length === 0) {
    throw new AppError('No hay transacciones nuevas para importar', 400);
  }

  const resultado = await guardarImportacion({
    req,
    transactions: aGuardar,
    tipo: doc.parametros.tipo,
    filename: doc.filename,
    sha256: doc.sha256
  });

  doc.estado = 'importado';
  doc.operation_id = resultado.operation_id;
  doc.importado_at = new Date();
  await doc.save();
  return { documento: vista(doc), resultado };
};

/**
 * Importa todos los documentos `listo` sin revisión (sin las transacciones ya cargadas)
 */
export const importarListos = async (req) => {
  const listos = await IngestDocument.find(buildUserQuery(req, { estado: 'listo' })).select('_id filename').lean();
  const resultados = [];
  for (const { _id, filename } of listos) {
    try {
      const { resultado } = await importarDocumento(req, _id);
      resultados.push({ id: _id, filename, ok: true, guardadas: resultado.transacciones_guardadas });
    } catch (error) {
      resultados.push({ id: _id, filename, ok: false, error: error.message });
    }
  }
  return resultados;
};

export const descartarDocumento = async (req, id) => {
  const doc = await findDocumentoOrFail(req, id);
  if (doc.estado === 'importado') {
    throw new AppError('El documento ya se importó: deshacé la importación desde el historial', 400);
  }
  doc.estado = 'descartado';
  // Si este archivo había cerrado un aviso, el aviso vuelve a quedar pendiente
  if (doc.cierra_aviso) {
    await IngestDocument.updateOne(
      buildUserQuery(req, { _id: doc.cierra_aviso, estado: 'resuelto' }),
      { estado: 'pendiente_descarga', resuelto_por: null }
    );
    doc.cierra_aviso = null;
  }
  await doc.save();
  return vista(doc);
};

/**
 * Después de un rollback, el documento vuelve a quedar para revisar
 */
export const reabrirPorRollback = async (req, operationId) => {
  const doc = await IngestDocument.findOne(buildUserQuery(req, { operation_id: operationId })).select('+contenido');
  if (!doc) return;
  doc.operation_id = null;
  doc.importado_at = undefined;
  await procesar(req, doc, { redetectar: false });
};
