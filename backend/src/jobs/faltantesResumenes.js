import FuenteConfig from '../models/FuenteConfig.js';
import { checklistDelUsuario } from '../services/calendarioService.js';
import { notificar } from '../services/notificationService.js';
import { FUENTES } from '../utils/fuentesResumen.js';

const fechaCorta = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

// Avisa los resúmenes esperados que no llegaron (ING-09). Idempotente: la clave del aviso es fuente + cierre.
export default {
  nombre: 'faltantes-resumenes',
  descripcion: 'Avisa los resúmenes que deberían haber llegado según el calendario de cierres y no llegaron',
  hora: '10:00',
  run: async () => {
    const userIds = await FuenteConfig.distinct('user_id', { activa: { $ne: false } });
    let faltantes = 0;
    let errores = 0;
    for (const userId of userIds) {
      let checklist;
      try {
        ({ checklist } = await checklistDelUsuario({ user: { _id: userId } }));
      } catch (error) {
        // Un usuario con problemas no frena a los demás
        console.error('[faltantes-resumenes] falló un usuario:', error.message);
        errores++;
        continue;
      }
      for (const fila of checklist.filter(f => f.estado === 'faltante')) {
        faltantes++;
        const aviso = fila.llegada === 'aviso';
        await notificar(userId, {
          tipo: 'resumen_faltante',
          nivel: 'alerta',
          titulo: `Falta el resumen de ${FUENTES[fila.fuente].nombre}`,
          mensaje: `Cerró el ${fechaCorta(fila.cierre)} y todavía no llegó.${aviso ? '' : ' Revisá el mail o bajalo del homebanking y subilo a la Bandeja.'}`,
          link: '/bandeja',
          clave: `faltante:${fila.fuente}:${fila.cierre}`
        });
      }
    }
    return { usuarios: userIds.length, faltantes, errores };
  }
};
