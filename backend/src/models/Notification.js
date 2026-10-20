import mongoose from 'mongoose';

export const NIVELES_NOTIFICACION = ['info', 'exito', 'alerta', 'error'];

const DIAS_RETENCION = 120;

// Aviso in-app para un usuario (PLAT-02). Se crean con services/notificationService.js.
const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Qué lo generó: 'resumen_nuevo', 'aviso_resumen', 'resumen_faltante', 'error_sync', 'valuacion', 'job_error'...
  tipo: { type: String, required: true },
  nivel: { type: String, enum: NIVELES_NOTIFICACION, default: 'info' },
  titulo: { type: String, required: true },
  mensaje: String,
  // Ruta del frontend a la que lleva (por ejemplo '/bandeja')
  link: String,
  // Opcional: evita duplicados (una sola notificación por clave y usuario)
  clave: String,
  leida_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index(
  { user_id: 1, clave: 1 },
  { unique: true, partialFilterExpression: { clave: { $type: 'string' } } }
);
// Las notificaciones se borran solas después de 120 días
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: DIAS_RETENCION * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
