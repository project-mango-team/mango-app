import mongoose from 'mongoose';

// Movimientos hacia o desde inversiones: no cuentan como gasto ni ingreso en los dashboards
export const CATEGORIA_INVERSION = 'Inversión';

// Impuestos y percepciones del resumen de tarjeta (sellos, IIBB, IVA, RG 5617)
export const CATEGORIA_IMPUESTOS = 'Impuestos';

export const DEFAULT_CATEGORIES = [
  'Transferencia',
  'Transporte',
  'Salud',
  'Supermercado',
  'Comida',
  'Servicios',
  'Ocio',
  'Ropa',
  'Mantenimiento',
  'Ingreso',
  CATEGORIA_INVERSION,
  CATEGORIA_IMPUESTOS,
  'Otros'
];

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String,
    default: ''
  },
  categories: {
    type: [String],
    default: DEFAULT_CATEGORIES
  },
  categoryKeywords: {
    type: Map,
    of: [String],
    default: {}
  },
  // Marca que ya se le agregó la categoría Inversión (para no volver a agregarla si la borra)
  categoriaInversionAgregada: {
    type: Boolean,
    default: false
  },
  // Igual para la categoría Impuestos (ING-14)
  categoriaImpuestosAgregada: {
    type: Boolean,
    default: false
  },
  // Tipos de activo propios; los base están en config/investmentTypes.js
  investmentTypes: {
    type: [{
      _id: false,
      nombre: { type: String, required: true, trim: true },
      liquido: { type: Boolean, default: false }
    }],
    default: []
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSchema.index({ googleId: 1 });
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

export default User;
