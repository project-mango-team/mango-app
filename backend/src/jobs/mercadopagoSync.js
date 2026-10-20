import Secret from '../models/Secret.js';
import { sincronizarUsuario } from '../services/mercadoPagoSyncService.js';
import { SECRETO_MP } from '../services/mercadoPagoCuentaService.js';
import { notificarSinFallar } from '../services/notificationService.js';
import { avisoDeSync } from '../utils/mercadoPagoSync.js';

// MP-03: trae los movimientos nuevos de cada cuenta de Mercado Pago conectada y los deja en la Bandeja.
// Un usuario que falla no corta a los demás: se le avisa y se reintenta al día siguiente.
export default {
  nombre: 'mercadopago-sync',
  descripcion: 'Trae los movimientos nuevos de Mercado Pago a la Bandeja',
  hora: '06:30',
  run: async ({ slot }) => {
    const dia = String(slot).replace(/^manual-/, '').slice(0, 10);
    const userIds = await Secret.distinct('user_id', { nombre: SECRETO_MP });
    const resumen = { cuentas: userIds.length };
    for (const userId of userIds) {
      let resultado;
      try {
        resultado = await sincronizarUsuario(userId);
      } catch (error) {
        resultado = { estado: 'error', status: error.status ?? error.statusCode ?? null, mensaje: error.message };
      }
      resumen[resultado.estado] = (resumen[resultado.estado] || 0) + 1;
      const aviso = avisoDeSync(resultado, dia);
      if (aviso) await notificarSinFallar(userId, aviso);
    }
    return resumen;
  }
};
