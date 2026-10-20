import { registrarJob } from '../services/scheduler.js';
import limpiezaCorridas from './limpiezaCorridas.js';
import valuacionDiaria from './valuacionDiaria.js';

// Jobs diarios del scheduler. Para sumar uno: importarlo y agregarlo a esta lista.
const JOBS = [
  limpiezaCorridas,
  valuacionDiaria
];

JOBS.forEach(registrarJob);
