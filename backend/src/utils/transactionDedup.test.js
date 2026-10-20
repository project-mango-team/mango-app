import { describe, it, expect } from 'vitest';
import { huellaTransaccion, marcarTransaccionesDuplicadas, normalizarDetalle } from './transactionDedup.js';

const tx = (over = {}) => ({
  fecha: '05/09/2026', tipo: 'Gasto', moneda: 'ARS', importe: 1500, monto_original: 1500,
  detalle: 'CAFE DE PRUEBA', origen: 'Banco Galicia Tarjeta', ...over
});

describe('huellaTransaccion', () => {
  it('ignora formato de fecha, mayúsculas, espacios y la marca K', () => {
    expect(huellaTransaccion(tx({ fecha: '05-09-26', detalle: 'K  cafe de   prueba' }))).toBe(huellaTransaccion(tx()));
  });

  it('en USD compara el monto en dólares, no el importe en pesos', () => {
    const a = tx({ moneda: 'USD', monto_original: 10, importe: 15000 });
    const b = tx({ moneda: 'USD', monto_original: 10, importe: 14800 });
    expect(huellaTransaccion(a)).toBe(huellaTransaccion(b));
  });

  it('distingue cuotas, tipo y origen', () => {
    const base = huellaTransaccion(tx({ detalle: 'COMPRA Cuota 02/03' }));
    expect(huellaTransaccion(tx({ detalle: 'COMPRA Cuota 03/03' }))).not.toBe(base);
    expect(huellaTransaccion(tx({ detalle: 'COMPRA Cuota 02/03', tipo: 'Ingreso' }))).not.toBe(base);
    expect(huellaTransaccion(tx({ detalle: 'COMPRA Cuota 02/03', origen: 'Mercado Pago' }))).not.toBe(base);
  });

  it('normalizarDetalle no toca palabras que empiezan con K', () => {
    expect(normalizarDetalle('KIOSCO')).toBe('KIOSCO');
    expect(normalizarDetalle('K KIOSCO')).toBe('KIOSCO');
  });
});

describe('marcarTransaccionesDuplicadas', () => {
  it('marca las que ya existen contando repeticiones', () => {
    const nuevas = [tx(), tx(), tx({ importe: 2000, monto_original: 2000 })];
    const existentes = [tx({ fecha: '05/09/2026' })];
    expect(marcarTransaccionesDuplicadas(nuevas, existentes)).toEqual([true, false, false]);
  });

  it('sin existentes no hay duplicados', () => {
    expect(marcarTransaccionesDuplicadas([tx()], [])).toEqual([false]);
  });
});
