import mongoose from 'mongoose';

export const MONEDAS_INVERSION = ['ARS', 'USD', 'EUR'];
export const RENTAS = ['Fija', 'Variable', 'N/A'];
// De dónde sale el precio para valuar el activo automáticamente (manual = sin valuación automática)
export const FUENTES_PRECIO = ['manual', 'cafci', 'ticker', 'coingecko', 'tasa_fija'];

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
  fuente_precio: {
    type: String,
    enum: FUENTES_PRECIO,
    default: 'manual'
  },
  // Parámetros de la fuente: solo se usa el de la fuente elegida
  precio_config: {
    fci_nombre: String,      // cafci: fondo y clase como lo publica la CAFCI ("Fima Premium - Clase A")
    fci_categoria: String,   // cafci: mercadoDinero | rentaFija | rentaVariable | rentaMixta | otros
    ticker: String,          // ticker: símbolo ("SPY", "GGAL")
    coingecko_id: String,    // coingecko: id de la moneda ("bitcoin")
    tasa_anual: Number       // tasa_fija: % anual (ej: 8.5)
  },
  // Unidades cargadas a mano. Si algún movimiento trae unidades, mandan las de los movimientos.
  unidades: {
    type: Number,
    min: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

investmentAssetSchema.index({ user_id: 1, nombre: 1 });

const InvestmentAsset = mongoose.model('InvestmentAsset', investmentAssetSchema);

export default InvestmentAsset;
