import { describe, it, expect } from 'vitest';
import { grupoNeutro, esNeutro, resumirMovimientos } from './movimientosNeutros.js';

const t = (tipo, categoria, importe) => ({ tipo, categoria, importe });

describe('grupoNeutro', () => {
  it('separa inversiones y movimientos internos', () => {
    expect(grupoNeutro(t('Gasto', 'Inversión', 1))).toBe('inversiones');
    expect(grupoNeutro(t('Gasto', 'Movimiento interno', 1))).toBe('internos');
    expect(grupoNeutro(t('Gasto', 'Transferencia', 1))).toBeNull();
    expect(esNeutro(t('Ingreso', 'Movimiento interno', 1))).toBe(true);
    expect(esNeutro(t('Ingreso', 'Ingreso', 1))).toBe(false);
  });
});

describe('resumirMovimientos', () => {
  it('no cuenta los neutros como gasto ni ingreso y los suma aparte', () => {
    const resumen = resumirMovimientos([
      t('Gasto', 'Comida', 100),
      t('Gasto', 'Transferencia', 50),
      t('Ingreso', 'Ingreso', 1000),
      t('Gasto', 'Inversión', 300),
      t('Ingreso', 'Inversión', 20),
      t('Gasto', 'Movimiento interno', 400),
      t('Ingreso', 'Movimiento interno', 400)
    ]);
    expect(resumen).toEqual({
      gastos: 150,
      ingresos: 1000,
      inversiones: { enviado: 300, recibido: 20 },
      internos: { enviado: 400, recibido: 400 }
    });
  });

  it('usa la función de monto pedida', () => {
    const resumen = resumirMovimientos([t('Gasto', 'Comida', 100)], (x) => x.importe / 10);
    expect(resumen.gastos).toBe(10);
  });
});
