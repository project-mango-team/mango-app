import { describe, it, expect } from 'vitest';
import {
  fechaMangoAIso, ventanaSync, limitesReporte, reporteParaVentana, reporteEnPreparacion, movimientosEnVentana
} from './mercadoPagoSync.js';

// 20/10/2026 a las 10 de la mañana en Argentina
const AHORA = new Date('2026-10-20T13:00:00Z');

describe('fechaMangoAIso', () => {
  it('convierte DD/MM/YYYY y DD-MM-YYYY', () => {
    expect(fechaMangoAIso('05/10/2026')).toBe('2026-10-05');
    expect(fechaMangoAIso('05-10-2026')).toBe('2026-10-05');
    expect(fechaMangoAIso('5/10/26')).toBeNull();
    expect(fechaMangoAIso(null)).toBeNull();
  });
});

describe('ventanaSync', () => {
  it('sin nada cargado trae los últimos 30 días hasta ayer', () => {
    expect(ventanaSync({ ahora: AHORA })).toEqual({ desde: '2026-09-20', hasta: '2026-10-19' });
  });

  it('arranca el día siguiente a lo último importado a mano', () => {
    expect(ventanaSync({ ultimaFechaImportada: '30/09/2026', ahora: AHORA })).toEqual({ desde: '2026-10-01', hasta: '2026-10-19' });
  });

  it('usa lo más nuevo entre lo importado y la sync anterior', () => {
    expect(ventanaSync({ ultimaFechaImportada: '30/09/2026', ultimaSync: '2026-10-15', ahora: AHORA }))
      .toEqual({ desde: '2026-10-16', hasta: '2026-10-19' });
    expect(ventanaSync({ ultimaFechaImportada: '17/10/2026', ultimaSync: '2026-10-15', ahora: AHORA }))
      .toEqual({ desde: '2026-10-18', hasta: '2026-10-19' });
  });

  it('null si ya está todo hasta ayer', () => {
    expect(ventanaSync({ ultimaSync: '2026-10-19', ahora: AHORA })).toBeNull();
  });

  it('usa el día de Argentina: a las 23 de Argentina ya es mañana en UTC', () => {
    const noche = new Date('2026-10-21T02:00:00Z'); // 20/10 23:00 en Argentina
    expect(ventanaSync({ ultimaSync: '2026-10-18', ahora: noche })).toEqual({ desde: '2026-10-19', hasta: '2026-10-19' });
  });

  it('corta en 60 días; la sync siguiente sigue desde ahí', () => {
    const v = ventanaSync({ ultimaFechaImportada: '31/05/2026', ahora: AHORA });
    expect(v).toEqual({ desde: '2026-06-01', hasta: '2026-07-30' });
    expect(ventanaSync({ ultimaSync: v.hasta, ahora: AHORA })).toEqual({ desde: '2026-07-31', hasta: '2026-09-28' });
  });
});

describe('reportes', () => {
  const ventana = { desde: '2026-10-01', hasta: '2026-10-19' };
  const reporte = (begin, end, extra = {}) => ({ file_name: `mango-${begin}.csv`, begin_date: begin, end_date: end, status: 'processed', ...extra });

  it('limitesReporte cubre los días completos en hora de Argentina', () => {
    expect(limitesReporte(ventana)).toEqual({ desde: '2026-10-01T00:00:00-03:00', hasta: '2026-10-19T23:59:59-03:00' });
  });

  it('elige un reporte procesado que cubra toda la ventana, el más nuevo', () => {
    const reportes = [
      reporte('2026-10-01T03:00:00Z', '2026-10-15T02:59:59Z'),                                  // no llega al final
      reporte('2026-10-01T03:00:00Z', '2026-10-20T02:59:59Z', { date_created: '2026-10-20T09:00:00Z' }),
      reporte('2026-09-25T03:00:00Z', '2026-10-20T02:59:59Z', { date_created: '2026-10-20T10:00:00Z', file_name: 'nuevo.csv' }),
      reporte('2026-10-01T03:00:00Z', '2026-10-20T02:59:59Z', { status: 'pending', date_created: '2026-10-20T11:00:00Z' })
    ];
    expect(reporteParaVentana(reportes, ventana).file_name).toBe('nuevo.csv');
    expect(reporteParaVentana([reportes[0]], ventana)).toBeNull();
    expect(reporteParaVentana(undefined, ventana)).toBeNull();
  });

  it('detecta un reporte pedido que todavía se está generando', () => {
    const pendiente = reporte('2026-10-01T03:00:00Z', '2026-10-20T02:59:59Z', { status: 'pending' });
    expect(reporteEnPreparacion([pendiente], ventana)).toBe(true);
    expect(reporteEnPreparacion([{ ...pendiente, status: 'error' }], ventana)).toBe(false);
    expect(reporteEnPreparacion([{ ...pendiente, status: 'processed' }], ventana)).toBe(false);
  });

  it('movimientosEnVentana deja solo los días de la ventana', () => {
    const movs = ['30-09-2026', '01-10-2026', '19-10-2026', '20-10-2026'].map(fecha => ({ fecha }));
    expect(movimientosEnVentana(movs, ventana).map(m => m.fecha)).toEqual(['01-10-2026', '19-10-2026']);
  });
});
