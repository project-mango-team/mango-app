import mongoose from 'mongoose';

// Una corrida de un job del scheduler (ver services/scheduler.js).
// El índice único (job, slot) es el lock: dos procesos no pueden correr el mismo job en el mismo día.
// Los jobs son de sistema (recorren todos los usuarios si hace falta): `resultado` guarda solo un resumen
// sin datos personales (conteos, ids).
const jobRunSchema = new mongoose.Schema({
  job: { type: String, required: true },
  // 'YYYY-MM-DD' (día local de Argentina) para corridas programadas, 'manual-<ISO>' para las manuales
  slot: { type: String, required: true },
  estado: { type: String, enum: ['corriendo', 'ok', 'error'], required: true },
  manual: { type: Boolean, default: false },
  intentos: { type: Number, default: 1 },
  iniciado_at: { type: Date, required: true },
  terminado_at: Date,
  duracion_ms: Number,
  resultado: mongoose.Schema.Types.Mixed,
  error: String
});

jobRunSchema.index({ job: 1, slot: 1 }, { unique: true });
jobRunSchema.index({ job: 1, iniciado_at: -1 });

const JobRun = mongoose.model('JobRun', jobRunSchema);

export default JobRun;
