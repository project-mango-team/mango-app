import { valuarTodos } from '../services/valuationService.js';

// VAL-03: valúa cada día los activos con fuente de precio automática (unidades × precio).
// La CAFCI publica el valor de la cuotaparte del día hábil anterior, así que alcanza con correr una vez por día.
export default {
  nombre: 'valuacion-diaria',
  descripcion: 'Valúa las inversiones con fuente de precio automática (FCI, cripto, tasa fija)',
  hora: '19:00',
  run: async () => {
    const { resumen, errores } = await valuarTodos();
    for (const e of errores) {
      console.warn(`valuacion-diaria: activo ${e.asset_id} (${e.status}): ${e.mensaje}`);
    }
    // Si fallaron fuentes externas (5xx) se tira error para que el scheduler reintente.
    // Los errores de configuración (4xx, ej. fondo inexistente) quedan contados en el resumen.
    if (errores.some(e => e.status >= 500)) {
      throw new Error(`No se pudieron valuar ${resumen.errores} de ${resumen.activos} activo(s): falló una fuente de precios`);
    }
    return resumen;
  }
};
