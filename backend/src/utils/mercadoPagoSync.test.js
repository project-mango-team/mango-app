import { describe, it, expect } from 'vitest';
import {
  fechaMangoAIso, ventanaSync, limitesReporte, reporteParaVentana, reporteEnPreparacion, movimientosEnVentana,
  periodoDeArchivoSync, avisoDeSync, mensajeDeSync
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

  it('elige el reporte procesado que arranca a tiempo y llega más lejos', () => {
    const reportes = [
      reporte('2026-10-02T03:00:00Z', '2026-10-20T02:59:59Z'),                                  // empieza tarde
      reporte('2026-10-01T03:00:00Z', '2026-10-15T02:59:59Z'),
      reporte('2026-09-25T03:00:00Z', '2026-10-20T02:59:59Z', { file_name: 'completo.csv' }),
      reporte('2026-10-01T03:00:00Z', '2026-10-21T02:59:59Z', { status: 'pending' })
    ];
    expect(reporteParaVentana(reportes, ventana)).toMatchObject({ reporte: { file_name: 'completo.csv' }, hasta: '2026-10-19' });
    expect(reporteParaVentana([reportes[0]], ventana)).toBeNull();
    expect(reporteParaVentana(undefined, ventana)).toBeNull();
  });

  it('un reporte que cubre la ventana en parte se usa hasta donde llega', () => {
    // pedido ayer: termina a la medianoche del 15 en Argentina
    const ayer = reporte('2026-10-01T03:00:00Z', '2026-10-15T03:00:00Z');
    expect(reporteParaVentana([ayer], ventana)).toMatchObject({ hasta: '2026-10-14' });
  });

  it('detecta un reporte pedido que todavía se está generando', () => {
    const pendiente = reporte('2026-10-01T03:00:00Z', '2026-10-10T02:59:59Z', { status: 'pending' });
    expect(reporteEnPreparacion([pendiente], ventana)).toBe(true);
    expect(reporteEnPreparacion([{ ...pendiente, status: 'error' }], ventana)).toBe(false);
    expect(reporteEnPreparacion([{ ...pendiente, status: 'processed' }], ventana)).toBe(false);
    expect(reporteEnPreparacion([{ ...pendiente, begin_date: '2026-10-02T03:00:00Z' }], ventana)).toBe(false);
  });

  it('periodoDeArchivoSync lee el período del nombre del archivo', () => {
    expect(periodoDeArchivoSync('mercadopago-api-2026-10-01-a-2026-10-19.csv')).toEqual({ desde: '2026-10-01', hasta: '2026-10-19' });
    expect(periodoDeArchivoSync('resumen.csv')).toBeNull();
  });

  it('movimientosEnVentana deja solo los días de la ventana', () => {
    const movs = ['30-09-2026', '01-10-2026', '19-10-2026', '20-10-2026'].map(fecha => ({ fecha }));
    expect(movimientosEnVentana(movs, ventana).map(m => m.fecha)).toEqual(['01-10-2026', '19-10-2026']);
  });
});

describe('avisos y mensajes', () => {
  const traidos = { estado: 'en_bandeja', movimientos: 3, desde: '2026-10-16', hasta: '2026-10-19' };

  it('avisa los movimientos nuevos con una clave por período', () => {
    expect(avisoDeSync(traidos, '2026-10-20')).toEqual({
      tipo: 'mercadopago_sync',
      nivel: 'info',
      titulo: 'Movimientos de Mercado Pago en la Bandeja',
      mensaje: '3 movimientos del 16/10 al 19/10, listos para revisar.',
      link: '/bandeja',
      clave: 'mp-sync:2026-10-16:2026-10-19'
    });
    expect(avisoDeSync({ ...traidos, movimientos: 1 }, '2026-10-20').mensaje).toMatch(/^1 movimiento del/);
  });

  it('un token rechazado pide cargarlo de nuevo, una vez por día', () => {
    const aviso = avisoDeSync({ estado: 'error', status: 401, mensaje: 'x' }, '2026-10-20');
    expect(aviso).toMatchObject({ nivel: 'error', link: '/configuracion', clave: 'mp-token:2026-10-20' });
  });

  it('otro error es una alerta con el mensaje', () => {
    const aviso = avisoDeSync({ estado: 'error', status: 500, mensaje: 'Mercado Pago GET /x: 500' }, '2026-10-20');
    expect(aviso).toMatchObject({ nivel: 'alerta', clave: 'mp-error:2026-10-20' });
    expect(aviso.mensaje).toContain('Mercado Pago GET /x: 500');
  });

  it('el resto no avisa', () => {
    for (const estado of ['sin_token', 'al_dia', 'reporte_pedido', 'en_preparacion', 'sin_movimientos', 'ya_estaba']) {
      expect(avisoDeSync({ estado }, '2026-10-20')).toBeNull();
    }
  });

  it('mensajeDeSync explica cada resultado', () => {
    expect(mensajeDeSync(traidos)).toBe('3 movimientos del 16/10 al 19/10 en la Bandeja.');
    expect(mensajeDeSync({ estado: 'al_dia' })).toMatch(/hasta ayer/);
    expect(mensajeDeSync({ estado: 'reporte_pedido' })).toMatch(/unos minutos/);
    expect(mensajeDeSync({ estado: 'sin_movimientos', desde: '2026-10-19', hasta: '2026-10-19' })).toBe('No hubo movimientos del 19/10 al 19/10.');
    expect(mensajeDeSync({ estado: 'raro' })).toBe('Sincronización terminada.');
  });
});
