import { registrarJob } from '../services/scheduler.js';
import limpiezaCorridas from './limpiezaCorridas.js';
import faltantesResumenes from './faltantesResumenes.js';

// Jobs diarios del scheduler. Para sumar uno: importarlo y agregarlo a esta lista.
const JOBS = [
  limpiezaCorridas,
  faltantesResumenes
];

JOBS.forEach(registrarJob);
