import { AppError } from '../middleware/errorHandler.js';
import { nombreArchivo } from '../utils/uploadFilename.js';
import { recibirDocumento, buscarPorMensaje, registrarAviso } from '../services/ingestService.js';

// Webhook de integraciones (autenticado con token personal). Lo usa el script de Gmail.

/**
 * Metadata del mail: viene como JSON (string en multipart) con message_id, from, subject y received_at
 */
const leerMetadata = (raw) => {
  let datos = raw;
  if (typeof raw === 'string') {
    try {
      datos = JSON.parse(raw);
    } catch {
      throw new AppError('El campo metadata tiene que ser JSON', 400);
    }
  }
  if (!datos || typeof datos !== 'object') return {};
  const fecha = datos.received_at ? new Date(datos.received_at) : undefined;
  if (fecha && isNaN(fecha)) {
    throw new AppError('received_at no es una fecha válida', 400);
  }
  return {
    message_id: datos.message_id ? String(datos.message_id) : undefined,
    from: datos.from ? String(datos.from) : undefined,
    subject: datos.subject ? String(datos.subject) : undefined,
    received_at: fecha
  };
};

/**
 * POST /api/ingest/documents (multipart: file + metadata)
 * Idempotente: el mismo adjunto del mismo mail, o el mismo archivo, devuelve el documento existente (200)
 */
export const ingestDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No se recibió ningún archivo (campo "file")', 400);
    }
    const email = leerMetadata(req.body.metadata);
    const filename = nombreArchivo(req.file);

    const delMismoMail = await buscarPorMensaje(req, email.message_id, filename);
    if (delMismoMail) {
      return res.status(200).json({ success: true, existente: true, data: delMismoMail });
    }

    const { documento, existente } = await recibirDocumento(req, {
      buffer: req.file.buffer,
      filename,
      fuente: 'email',
      email: email.message_id ? email : undefined
    });
    res.status(existente ? 200 : 201).json({ success: true, existente, data: documento });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ingest/avisos (json: message_id, from, subject, received_at)
 * Mail que avisa que el resumen está disponible pero no trae el archivo
 */
export const ingestAviso = async (req, res, next) => {
  try {
    const { documento, existente } = await registrarAviso(req, leerMetadata(req.body));
    res.status(existente ? 200 : 201).json({ success: true, existente, data: documento });
  } catch (error) {
    next(error);
  }
};
