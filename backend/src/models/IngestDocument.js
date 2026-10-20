import mongoose from 'mongoose';

export const FUENTES_INGESTA = ['upload', 'email', 'email_aviso', 'api'];

// recibido → listo (detectado y parseado) → importado | descartado
// no_reconocido: no se detectó el formato, hay que elegir banco y tipo a mano
// error: se detectó pero falló el parseo (el archivo se conserva para reintentar)
// pendiente_descarga: llegó un aviso sin archivo (ING-08) → resuelto cuando se sube el archivo que coincide
export const ESTADOS_INGESTA = ['recibido', 'listo', 'no_reconocido', 'error', 'importado', 'descartado', 'pendiente_descarga', 'resuelto'];

// Un resumen que entró a la bandeja (subido, o más adelante por mail), antes y después de importarlo
const ingestDocumentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fuente: {
    type: String,
    enum: FUENTES_INGESTA,
    default: 'upload'
  },
  filename: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 0
  },
  sha256: {
    type: String
  },
  // Los resúmenes pesan menos de 1 MB: entran en el documento
  contenido: {
    type: Buffer,
    select: false
  },
  email: {
    message_id: String,
    from: String,
    subject: String,
    received_at: Date
  },
  // Resultado de detectarDocumento (banco, tipo, tarjetas, período...)
  deteccion: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Parámetros con los que se parsea: los detectados, o los que eligió el usuario
  parametros: {
    tipo: String,
    tipoResumen: String,
    valorDolar: Number,
    selectedCards: [String]
  },
  estado: {
    type: String,
    enum: ESTADOS_INGESTA,
    default: 'recibido',
    index: true
  },
  // Resumen de la vista previa: las transacciones se re-parsean al revisar, no se guardan dos veces
  preview: {
    cantidad: Number,
    duplicados: Number,
    gastos: Number,
    ingresos: Number,
    desde: String,
    hasta: String,
    // ING-12: lo leído contra el total del resumen (utils/totalesResumen.compararTotales)
    control: mongoose.Schema.Types.Mixed
  },
  archivo_ya_importado: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  operation_id: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  importado_at: Date,
  // ING-08: en un aviso, el documento con el archivo que lo cerró; en un archivo, el aviso que cerró
  resuelto_por: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  cierra_aviso: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// El mismo archivo subido dos veces es el mismo documento
ingestDocumentSchema.index(
  { user_id: 1, sha256: 1 },
  { unique: true, partialFilterExpression: { sha256: { $type: 'string' } } }
);
ingestDocumentSchema.index({ user_id: 1, created_at: -1 });

const IngestDocument = mongoose.model('IngestDocument', ingestDocumentSchema);

export default IngestDocument;
