import mongoose from 'mongoose';
import { LLEGADAS } from '../utils/calendarioCierres.js';

// Configuración por fuente de resúmenes (Visa Galicia, Santander Amex...): calendario de cierres (ING-09)
// y, más adelante, la importación automática (ING-10)
const fuenteConfigSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fuente: { type: String, required: true },
  // El día de cierre es opcional: la importación automática (ING-10) se puede activar sin calendario
  dia_cierre: { type: Number, min: 1, max: 31 },
  llegada: { type: String, enum: LLEGADAS, default: 'adjunto' },
  activa: { type: Boolean, default: true },
  // ING-10: importar solo los resúmenes que llegan por mail/API si pasan todos los controles
  auto_importar: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

fuenteConfigSchema.index({ user_id: 1, fuente: 1 }, { unique: true });

export default mongoose.model('FuenteConfig', fuenteConfigSchema);
