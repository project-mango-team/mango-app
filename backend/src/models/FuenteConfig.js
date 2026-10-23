import mongoose from 'mongoose';
import { LLEGADAS } from '../utils/calendarioCierres.js';

// Configuración por fuente de resúmenes (Visa Galicia, Santander Amex...): calendario de cierres (ING-09)
// y, más adelante, la importación automática (ING-10)
const fuenteConfigSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fuente: { type: String, required: true },
  dia_cierre: { type: Number, required: true, min: 1, max: 31 },
  llegada: { type: String, enum: LLEGADAS, default: 'adjunto' },
  activa: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

fuenteConfigSchema.index({ user_id: 1, fuente: 1 }, { unique: true });

export default mongoose.model('FuenteConfig', fuenteConfigSchema);
