import { describe, it, expect } from 'vitest';
import { armarContextoRevision, marcarComerciosNuevos, motivosDeRevision, contarDudosas, claveComercio } from './reviewFocus.js';

const gasto = (detalle, categoria, importe) => ({ detalle, categoria, importe, tipo: 'Gasto' });

describe('armarContextoRevision', () => {
  it('junta comercios vistos y calcula el límite por categoría con suficientes muestras', () => {
    const historial = [
      ...[100, 200, 300, 400, 500].map(i => gasto(`CAFE ${i}123`, 'Comida', i)),
      gasto('YPF', 'Transporte', 1000),
      ...[1, 2, 3, 4, 5].map(i => gasto('FCI', 'Inversión', i * 1e6))
    ];
    const { comercios, limites } = armarContextoRevision(historial);
    expect(comercios.has('CAFE')).toBe(true);
    expect(comercios.has('YPF')).toBe(true);
    expect(limites).toEqual({ Comida: 1000 });
  });
});

describe('marcarComerciosNuevos', () => {
  it('compara por patrón y no marca nada sin historial', () => {
    const comercios = new Set([claveComercio('Pago CAFE 123456')]);
    const r = marcarComerciosNuevos([{ detalle: 'pago cafe 999999' }, { detalle: 'LSH BARRA HOTEL' }], comercios);
    expect(r.map(t => t.comercio_nuevo)).toEqual([false, true]);
    expect(marcarComerciosNuevos([{ detalle: 'X' }], new Set())[0].comercio_nuevo).toBe(false);
  });
});

describe('motivosDeRevision', () => {
  const limites = { Comida: 1000 };
  it('lista cada motivo', () => {
    expect(motivosDeRevision({ ...gasto('a', 'Otros', 10), comercio_nuevo: true }, limites)).toEqual(['otros', 'nuevo']);
    expect(motivosDeRevision({ ...gasto('a', 'Comida', 5000), duplicado: true }, limites)).toEqual(['duplicado', 'monto']);
    expect(motivosDeRevision({ ...gasto('a', 'Transferencia', 10), interno_sugerido: { dias: 0 } }, limites)).toEqual(['interno']);
    expect(motivosDeRevision({ ...gasto('a', 'Movimiento interno', 10), interno_sugerido: { dias: 0 } }, limites)).toEqual([]);
  });

  it('las ignoradas por regla no se revisan y los ingresos no se marcan por monto', () => {
    expect(motivosDeRevision({ ...gasto('a', 'Otros', 10), ignorada: true }, limites)).toEqual([]);
    expect(motivosDeRevision({ detalle: 'a', categoria: 'Comida', importe: 9999, tipo: 'Ingreso' }, limites)).toEqual([]);
    expect(contarDudosas([gasto('a', 'Otros', 1), gasto('b', 'Comida', 1)], limites)).toBe(1);
  });
});
