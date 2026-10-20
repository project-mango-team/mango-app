import { describe, it, expect } from 'vitest';
import { patronDeDetalle, transaccionesACambiar, validarDeshacer } from './ruleLearning.js';

describe('patronDeDetalle', () => {
  it('saca cuotas, números de operación y fechas', () => {
    expect(patronDeDetalle('MERPAGO*CAFE 123456 Cuota 02/06')).toBe('MERPAGO*CAFE');
    expect(patronDeDetalle('LSH BARRA HOTEL')).toBe('LSH BARRA HOTEL');
    expect(patronDeDetalle('Pago 15/09 NETFLIX.COM 0012345')).toBe('Pago NETFLIX.COM');
    expect(patronDeDetalle('  Transferencia enviada Persona Propia  ')).toBe('Transferencia enviada Persona Propia');
  });

  it('conserva números cortos que son parte del nombre', () => {
    expect(patronDeDetalle('7 ELEVEN 24')).toBe('7 ELEVEN 24');
  });

  it('tolera vacíos', () => {
    expect(patronDeDetalle(null)).toBe('');
    expect(patronDeDetalle('123456')).toBe('');
  });
});

describe('transaccionesACambiar', () => {
  const regla = {
    condiciones: { detalle: { modo: 'contiene', valores: ['barra hotel'] }, origen: 'Galicia', tipo: null, montoMin: null, montoMax: null },
    accion: { tipo: 'categoria', categoria: 'Ocio' },
    activa: false
  };
  const t = (detalle, categoria, origen = 'Galicia') => ({ detalle, categoria, origen, tipo: 'Gasto', importe: 10 });

  it('devuelve las que coinciden y tienen otra categoría, aunque la regla esté pausada', () => {
    const txs = [t('LSH BARRA HOTEL', 'Comida'), t('LSH BARRA HOTEL', 'Ocio'), t('LSH BARRA HOTEL', 'Comida', 'Santander'), t('OTRA COSA', 'Comida')];
    expect(transaccionesACambiar(txs, regla)).toEqual([txs[0]]);
  });

  it('no aplica a reglas de ignorar', () => {
    expect(transaccionesACambiar([t('LSH BARRA HOTEL', 'Comida')], { ...regla, accion: { tipo: 'ignorar' } })).toEqual([]);
  });
});

describe('validarDeshacer', () => {
  it('acepta pares id/categoría y rechaza lo demás', () => {
    expect(validarDeshacer([{ _id: 'a', categoria: ' Comida ' }])).toEqual({ cambios: [{ _id: 'a', categoria: 'Comida' }] });
    expect(validarDeshacer([]).error).toBeTruthy();
    expect(validarDeshacer([{ _id: 1, categoria: 'x' }]).error).toBeTruthy();
    expect(validarDeshacer([{ _id: 'a', categoria: '' }]).error).toBeTruthy();
  });
});
