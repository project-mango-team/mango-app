import { registrarJob } from '../services/scheduler.js';
import limpiezaCorridas from './limpiezaCorridas.js';
import mercadopagoSync from './mercadopagoSync.js';
import valuacionDiaria from './valuacionDiaria.js';
import faltantesResumenes from './faltantesResumenes.js';

// Jobs diarios del scheduler. Para sumar uno: importarlo y agregarlo a esta lista.
const JOBS = [
  limpiezaCorridas,
  mercadopagoSync,
  valuacionDiaria,
  faltantesResumenes
];

JOBS.forEach(registrarJob);
