import mongoose from 'mongoose';

export const MONEDAS_INVERSION = ['ARS', 'USD', 'EUR'];
export const RENTAS = ['Fija', 'Variable', 'N/A'];

const investmentAssetSchema = new mongoose.Schema({
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
  tipo: {
    type: String,
    required: true,
    trim: true
  },
  // Moneda en la que se cargan los montos de los movimientos (USDT/USDC se cargan como USD)
  moneda: {
    type: String,
    required: true,
    enum: MONEDAS_INVERSION
  },
  renta: {
    type: String,
    enum: RENTAS,
    default: 'N/A'
  },
  plataforma: {
    type: String,
    trim: true,
    default: ''
  },
  notas: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

investmentAssetSchema.index({ user_id: 1, nombre: 1 });

const InvestmentAsset = mongoose.model('InvestmentAsset', investmentAssetSchema);

export default InvestmentAsset;
