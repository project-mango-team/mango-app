import { AppError } from '../middleware/errorHandler.js';
import { nombreArchivo } from '../utils/uploadFilename.js';
import {
  recibirDocumento,
  listarDocumentos,
  contarPendientes,
  transaccionesParaRevisar,
  actualizarParametros,
  importarDocumento,
  importarListos,
  descartarDocumento
} from '../services/ingestService.js';

// Sube uno o varios archivos a la bandeja (multipart, campo "files")
export const subirDocumentos = async (req, res, next) => {
  try {
    if (!req.files?.length) {
      throw new AppError('No se subió ningún archivo', 400);
    }
    const resultados = [];
    // De a uno: son pocos y así un archivo roto no frena a los demás
    for (const file of req.files) {
      const filename = nombreArchivo(file);
      try {
        const { documento, existente } = await recibirDocumento(req, {
          buffer: file.buffer,
          filename
        });
        resultados.push({ filename, ok: true, existente, documento });
      } catch (error) {
        resultados.push({ filename, ok: false, error: error.message });
      }
    }
    res.status(201).json({ success: true, data: resultados });
  } catch (error) {
    next(error);
  }
};

export const getDocumentos = async (req, res, next) => {
  try {
    const data = await listarDocumentos(req, { incluirDescartados: req.query.descartados === 'true' });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const getPendientes = async (req, res, next) => {
  try {
    res.json({ success: true, data: { pendientes: await contarPendientes(req) } });
  } catch (error) {
    next(error);
  }
};

export const getTransacciones = async (req, res, next) => {
  try {
    res.json({ success: true, data: await transaccionesParaRevisar(req, req.params.id) });
  } catch (error) {
    next(error);
  }
};

// Banco/tipo elegidos a mano, cotización del dólar o tarjetas a importar
export const putParametros = async (req, res, next) => {
  try {
    const { tipo, tipoResumen, valorDolar, selectedCards } = req.body;
    res.json({ success: true, data: await actualizarParametros(req, req.params.id, { tipo, tipoResumen, valorDolar, selectedCards }) });
  } catch (error) {
    next(error);
  }
};

// Body opcional: { transactions } editadas en la revisión
export const postImportar = async (req, res, next) => {
  try {
    const { transactions } = req.body || {};
    if (transactions !== undefined && !Array.isArray(transactions)) {
      throw new AppError('Las transacciones tienen que ser una lista', 400);
    }
    const data = await importarDocumento(req, req.params.id, { transactions });
    res.json({ success: true, message: `Se importaron ${data.resultado.transacciones_guardadas} transacciones`, data });
  } catch (error) {
    next(error);
  }
};

export const postImportarListos = async (req, res, next) => {
  try {
    const data = await importarListos(req);
    const ok = data.filter(r => r.ok);
    res.json({
      success: true,
      message: `Se importaron ${ok.length} de ${data.length} documentos (${ok.reduce((s, r) => s + r.guardadas, 0)} transacciones)`,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const postDescartar = async (req, res, next) => {
  try {
    res.json({ success: true, data: await descartarDocumento(req, req.params.id) });
  } catch (error) {
    next(error);
  }
};
