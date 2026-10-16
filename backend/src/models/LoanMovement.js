import mongoose from 'mongoose';

export const TIPOS_PRESTAMO = ['Prestamo', 'Devolucion'];
export const MONEDAS_PRESTAMO = ['ARS', 'USD'];

// Préstamos que hace el usuario a terceros. Modelo plano: el saldo por deudor sale de sumar sus movimientos.
const loanMovementSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deudor: {
    type: String,
    required: true,
    trim: true
  },
  concepto: {
    type: String,
    trim: true,
    default: ''
  },
  fecha: {
    type: Date,
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: TIPOS_PRESTAMO
  },
  // Moneda en la que se cargó; el saldo siempre se lleva en USD
  moneda: {
    type: String,
    required: true,
    enum: MONEDAS_PRESTAMO
  },
  // Monto en la moneda original, siempre positivo
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  // ARS por USD (blue promedio) a la fecha; convierte los préstamos en pesos
  cotizacion_usd: {
    type: Number,
    required: true,
    min: 0
  },
  monto_usd: {
    type: Number,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

loanMovementSchema.index({ user_id: 1, deudor: 1, fecha: 1 });

const LoanMovement = mongoose.model('LoanMovement', loanMovementSchema);

export default LoanMovement;
