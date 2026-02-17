import mongoose from 'mongoose';

/**
 * Operation Model
 * Tracks all data import operations (uploads, migrations, manual entries)
 * Used for tracking history and enabling rollback functionality
 */
const operationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  operation_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['upload', 'migration', 'manual'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['completed', 'failed', 'rolled_back'],
    default: 'completed'
  },
  origen: {
    type: String,
    required: true
  },
  filename: {
    type: String
  },
  transactions_count: {
    type: Number,
    required: true,
    default: 0
  },
  total_gastos: {
    type: Number,
    default: 0
  },
  total_ingresos: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  rolled_back_at: {
    type: Date
  }
});

// Índices adicionales
operationSchema.index({ status: 1, created_at: -1 });
operationSchema.index({ type: 1, created_at: -1 });

// Compound indexes for multi-tenancy
operationSchema.index({ user_id: 1, created_at: -1 });
operationSchema.index({ user_id: 1, type: 1, created_at: -1 });
operationSchema.index({ user_id: 1, status: 1 });

const Operation = mongoose.model('Operation', operationSchema);

export default Operation;
