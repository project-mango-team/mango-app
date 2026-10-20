import mongoose from 'mongoose';

export const SCOPES_TOKEN = ['ingest'];

// Token personal para integraciones (por ejemplo, el script de Gmail que manda los resúmenes).
// Solo se guarda el hash: el token completo se muestra una única vez al crearlo.
const apiTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  // sha256 del token
  hash: {
    type: String,
    required: true,
    unique: true
  },
  // Primeros caracteres, para reconocerlo en la lista sin mostrarlo entero
  prefijo: {
    type: String,
    required: true
  },
  scopes: {
    type: [String],
    enum: SCOPES_TOKEN,
    default: ['ingest']
  },
  last_used_at: Date,
  revocado_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

const ApiToken = mongoose.model('ApiToken', apiTokenSchema);

export default ApiToken;
