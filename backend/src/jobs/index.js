import { registrarJob } from '../services/scheduler.js';
import limpiezaCorridas from './limpiezaCorridas.js';
import mercadopagoSync from './mercadopagoSync.js';

// Jobs diarios del scheduler. Para sumar uno: importarlo y agregarlo a esta lista.
const JOBS = [
  limpiezaCorridas,
  mercadopagoSync
];

JOBS.forEach(registrarJob);
