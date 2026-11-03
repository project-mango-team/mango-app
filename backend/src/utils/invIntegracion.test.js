import { describe, it, expect } from 'vitest';
import { sugerirInternos } from './internalTransfers.js';
import { marcarComerciosNuevos, motivosDeRevision, claveComercio } from './reviewFocus.js';
import { evaluarAutoImportacion } from './autoImportacion.js';
import { textoAvisoInversiones } from '../services/investmentLinkService.js';

const t = (fecha, tipo, importe, origen, extra = {}) => ({
  fecha, tipo, importe, monto_original: importe, moneda: 'ARS', origen, detalle: `${tipo} ${origen}`, categoria: 'Transferencia', ...extra
});

describe('INV-12: integración con las revisiones', () => {
  it('una transacción de inversión no se sugiere como movimiento interno', () => {
    const existentes = [t('11/09/2026', 'Ingreso', 50000, 'Santander', { _id: 'x1' })];
    const conRegla = t('10/09/2026', 'Gasto', 50000, 'Banco Galicia', { categoria: 'Inversión', inversion: { activo_id: 'a1' } });
    expect(sugerirInternos([conRegla], existentes)[0].interno_sugerido).toBeUndefined();
    const soloCategoria = t('10/09/2026', 'Gasto', 50000, 'Banco Galicia', { categoria: 'Inversión' });
    expect(sugerirInternos([soloCategoria], existentes)[0].interno_sugerido).toBeUndefined();
    const comun = t('10/09/2026', 'Gasto', 50000, 'Banco Galicia');
    expect(sugerirInternos([comun], existentes)[0].interno_sugerido).toBeTruthy();
  });

  it('una inversión por regla no es un comercio nuevo, y un error de inversión es motivo de revisión', () => {
    const comercios = new Set([claveComercio('otro comercio')]);
    const [a, b] = marcarComerciosNuevos([
      { detalle: 'FIMA PREMIUM 123', inversion: { activo_id: 'a1' } },
      { detalle: 'KIOSCO NUEVO' }
    ], comercios);
    expect(a.comercio_nuevo).toBe(false);
    expect(b.comercio_nuevo).toBe(true);
    expect(motivosDeRevision({ categoria: 'Inversión', tipo: 'Gasto', inversion: { activo_id: 'a1', error: 'moneda' } })).toContain('inversion');
    expect(motivosDeRevision({ categoria: 'Inversión', tipo: 'Gasto', inversion: { activo_id: 'a1', crear: true } })).toEqual([]);
  });

  it('la importación automática no sigue con una inversión que no se puede cargar', () => {
    const deteccion = { soportado: true, confianza: 'alta' };
    const ok = evaluarAutoImportacion({ deteccion, transacciones: [{ categoria: 'Inversión', inversion: { activo_id: 'a1', crear: true } }] });
    expect(ok.ok).toBe(true);
    const mal = evaluarAutoImportacion({ deteccion, transacciones: [{ categoria: 'Inversión', inversion: { activo_id: 'a1', error: 'x' } }] });
    expect(mal.ok).toBe(false);
    expect(mal.motivos[0]).toMatch(/inversión/);
  });
});

describe('textoAvisoInversiones', () => {
  it('resume lo creado, lo ya cargado y los errores', () => {
    expect(textoAvisoInversiones(null)).toBe('');
    expect(textoAvisoInversiones({ creados: 1, duplicados: 0, errores: [] })).toBe('. Se cargaron 1 movimiento en Inversiones');
    expect(textoAvisoInversiones({ creados: 2, duplicados: 1, errores: [] })).toBe('. Se cargaron 2 movimientos en Inversiones. 1 ya estaba cargado');
    expect(textoAvisoInversiones({ creados: 0, duplicados: 0, errores: ['moneda distinta'] })).toBe('. No se pudo cargar en Inversiones: moneda distinta');
    expect(textoAvisoInversiones({ creados: 0, duplicados: 0, errores: [] })).toBe('');
  });
});
