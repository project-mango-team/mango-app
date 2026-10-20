import mongoose from 'mongoose';

export const TIPOS_MOVIMIENTO = ['Aporte', 'Retiro', 'Valuacion'];

const investmentMovementSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  asset_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvestmentAsset',
    required: true,
    index: true
  },
  // A diferencia de Transaction, es un Date real (esta colección no la usa mango-py)
  fecha: {
    type: Date,
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: TIPOS_MOVIMIENTO
  },
  // Siempre positivo, en la moneda del activo. En una Valuacion es el valor total del activo.
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  // ARS por USD (blue promedio compra/venta) a la fecha del movimiento
  cotizacion_usd: {
    type: Number,
    required: true,
    min: 0
  },
  // ARS por EUR equivalente al blue (blue × cruce EUR/USD), solo para activos en EUR
  cotizacion_eur: {
    type: Number,
    min: 0
  },
  monto_usd: {
    type: Number,
    required: true
  },
  monto_ars: {
    type: Number,
    required: true
  },
  // Opcional: unidades compradas (Aporte), vendidas (Retiro) o en tenencia (Valuacion), ej. cuotapartes
  unidades: {
    type: Number,
    min: 0
  },
  notas: {
    type: String,
    default: ''
  },
  // Valuación calculada por Mango con la fuente de precio del activo (no la cargó el usuario)
  automatica: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

investmentMovementSchema.index({ user_id: 1, asset_id: 1, fecha: 1 });

const InvestmentMovement = mongoose.model('InvestmentMovement', investmentMovementSchema);

export default InvestmentMovement;
