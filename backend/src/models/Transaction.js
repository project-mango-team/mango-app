import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  fecha: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  detalle: {
    type: String,
    required: true
  },
  importe: {
    type: Number,
    required: true
  },
  moneda: {
    type: String,
    default: 'ARS',
    enum: ['ARS', 'USD']
  },
  monto_original: {
    type: Number,
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['Gasto', 'Ingreso']
  },
  origen: {
    type: String,
    required: true
  },
  mes: {
    type: String,
    required: true
  },
  operation_id: {
    type: String,
    required: true,
    index: true
  },
  batch_id: {
    type: String,
    index: true
  },
  batch_filename: {
    type: String
  },
  batch_timestamp: {
    type: Date
  },
  migration_id: {
    type: String,
    index: true
  },
  migration_filename: {
    type: String
  },
  migration_timestamp: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Índices para mejorar performance
transactionSchema.index({ fecha: 1 });
transactionSchema.index({ tipo: 1 });
transactionSchema.index({ operation_id: 1 });
transactionSchema.index({ batch_id: 1 });
transactionSchema.index({ migration_id: 1 });
transactionSchema.index({ categoria: 1 });
transactionSchema.index({ mes: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
