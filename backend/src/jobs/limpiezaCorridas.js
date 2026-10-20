import JobRun from '../models/JobRun.js';

const DIAS_RETENCION = 90;

// Borra el historial de corridas de jobs con más de 90 días
export default {
  nombre: 'limpieza-corridas',
  descripcion: `Borra el historial de tareas programadas de más de ${DIAS_RETENCION} días`,
  hora: '04:00',
  run: async () => {
    const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000);
    const { deletedCount } = await JobRun.deleteMany({ iniciado_at: { $lt: limite }, estado: { $ne: 'corriendo' } });
    return { borradas: deletedCount };
  }
};
