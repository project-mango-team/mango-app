import mongoose from 'mongoose';

// Regla de categorización (REV-02): condiciones → acción. La lógica está en utils/categoryRules.js
const categoryRuleSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  condiciones: {
    detalle: {
      modo: { type: String, enum: ['contiene', 'regex'], default: 'contiene' },
      valores: { type: [String], default: [] }
    },
    origen: { type: String, default: null },
    tipo: { type: String, enum: ['Gasto', 'Ingreso'], default: null },
    montoMin: { type: Number, default: null },
    montoMax: { type: Number, default: null }
  },
  accion: {
    tipo: { type: String, enum: ['categoria', 'ignorar'], required: true },
    categoria: String
  },
  activa: { type: Boolean, default: true },
  // Se evalúan de menor a mayor y gana la primera que coincide
  orden: { type: Number, required: true },
  // keywords: migrada de las asociaciones viejas · usuario: creada a mano · aprendida: desde una corrección
  creada_por: { type: String, enum: ['keywords', 'usuario', 'aprendida'], default: 'usuario' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

categoryRuleSchema.index({ user_id: 1, orden: 1 });

const CategoryRule = mongoose.model('CategoryRule', categoryRuleSchema);

export default CategoryRule;
