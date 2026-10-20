import { registrarJob } from '../services/scheduler.js';
import limpiezaCorridas from './limpiezaCorridas.js';

// Jobs diarios del scheduler. Para sumar uno: importarlo y agregarlo a esta lista.
const JOBS = [
  limpiezaCorridas
];

JOBS.forEach(registrarJob);
