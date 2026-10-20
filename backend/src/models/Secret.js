import mongoose from 'mongoose';

// Secreto de terceros de un usuario (token de Mercado Pago, contraseña de un PDF), cifrado con SECRETS_KEY.
// Nunca se guarda ni se devuelve en texto plano: usar services/secretService.js.
const secretSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Identificador estable, por ejemplo 'mercadopago' o 'pdf:galicia-visa'
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  // Texto para la UI (por ejemplo "Token de Mercado Pago")
  descripcion: String,
  valor_cifrado: {
    type: String,
    required: true
  },
  // Últimos caracteres de un token largo, para reconocerlo; null para contraseñas
  pista: String,
  last_used_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

secretSchema.index({ user_id: 1, nombre: 1 }, { unique: true });

const Secret = mongoose.model('Secret', secretSchema);

export default Secret;
