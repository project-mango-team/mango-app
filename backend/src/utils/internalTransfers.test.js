import { describe, it, expect } from 'vitest';
import { sugerirInternos, fechasCandidatas, contrapartesAMarcar, diaDeFecha } from './internalTransfers.js';

const t = (fecha, tipo, importe, origen, extra = {}) => ({
  fecha, tipo, importe, monto_original: importe, moneda: 'ARS', origen, detalle: `${tipo} ${origen}`, categoria: 'Transferencia', ...extra
});

describe('fechasCandidatas', () => {
  it('cubre ±2 días, cruzando meses', () => {
    expect(fechasCandidatas([t('01/03/2026', 'Gasto', 1, 'A')]))
      .toEqual(['27/02/2026', '28/02/2026', '01/03/2026', '02/03/2026', '03/03/2026']);
    expect(diaDeFecha('5-3-26')).toBe(diaDeFecha('05/03/2026'));
  });
});

describe('sugerirInternos', () => {
  it('empareja un egreso con un ingreso ya cargado de otra cuenta', () => {
    const nuevas = [t('10/09/2026', 'Gasto', 50000, 'Mercado Pago')];
    const existentes = [t('11/09/2026', 'Ingreso', 50000, 'Santander', { _id: 'x1' })];
    const [s] = sugerirInternos(nuevas, existentes);
    expect(s.interno_sugerido).toMatchObject({ dias: 1, con: { _id: 'x1', origen: 'Santander', tipo: 'Ingreso' } });
  });

  it('no empareja mismo origen, mismo tipo, otro monto ni más de 2 días', () => {
    const nuevas = [t('10/09/2026', 'Gasto', 100, 'MP')];
    const existentes = [
      t('10/09/2026', 'Ingreso', 100, 'MP'),
      t('10/09/2026', 'Gasto', 100, 'Santander'),
      t('10/09/2026', 'Ingreso', 101, 'Santander'),
      t('13/09/2026', 'Ingreso', 100, 'Santander')
    ];
    expect(sugerirInternos(nuevas, existentes)[0].interno_sugerido).toBeUndefined();
  });

  it('cada transacción se usa una vez y gana la más cercana', () => {
    const nuevas = [t('10/09/2026', 'Gasto', 100, 'MP'), t('12/09/2026', 'Gasto', 100, 'MP')];
    const existentes = [t('12/09/2026', 'Ingreso', 100, 'Santander', { _id: 'cerca' })];
    const r = sugerirInternos(nuevas, existentes);
    expect(r[0].interno_sugerido).toBeUndefined();
    expect(r[1].interno_sugerido.con._id).toBe('cerca');
  });

  it('empareja dentro de la misma importación si son de otra cuenta', () => {
    const r = sugerirInternos([t('10/09/2026', 'Gasto', 100, 'Galicia'), t('10/09/2026', 'Ingreso', 100, 'Galicia Tarjeta')]);
    expect(r[0].interno_sugerido.con.origen).toBe('Galicia Tarjeta');
    expect(r[1].interno_sugerido.con.origen).toBe('Galicia');
  });

  it('en USD compara el monto en dólares y saltea duplicadas, ignoradas y pares ya internos', () => {
    const usd = (fecha, tipo, origen, importe) => t(fecha, tipo, importe, origen, { moneda: 'USD', monto_original: 10 });
    expect(sugerirInternos([usd('10/09/2026', 'Gasto', 'A', 14000)], [usd('10/09/2026', 'Ingreso', 'B', 14500)])[0].interno_sugerido).toBeDefined();
    const ex = [t('10/09/2026', 'Ingreso', 100, 'B')];
    expect(sugerirInternos([t('10/09/2026', 'Gasto', 100, 'A', { duplicado: true })], ex)[0].interno_sugerido).toBeUndefined();
    expect(sugerirInternos([t('10/09/2026', 'Gasto', 100, 'A', { ignorada: true })], ex)[0].interno_sugerido).toBeUndefined();
    const interno = { categoria: 'Movimiento interno' };
    expect(sugerirInternos([t('10/09/2026', 'Gasto', 100, 'A', interno)], [t('10/09/2026', 'Ingreso', 100, 'B', interno)])[0].interno_sugerido).toBeUndefined();
  });
});

describe('contrapartesAMarcar', () => {
  it('solo las que quedaron como Movimiento interno y tienen contraparte', () => {
    expect(contrapartesAMarcar([
      { categoria: 'Movimiento interno', interno_con: 'a' },
      { categoria: 'Movimiento interno', interno_con: 'a' },
      { categoria: 'Transferencia', interno_con: 'b' },
      { categoria: 'Movimiento interno' }
    ])).toEqual(['a']);
  });
});
