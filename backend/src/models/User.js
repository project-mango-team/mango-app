import mongoose from 'mongoose';

const DEFAULT_CATEGORIES = [
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
