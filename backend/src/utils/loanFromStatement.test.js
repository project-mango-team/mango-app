import { describe, it, expect } from 'vitest';
import { planDePrestamos } from './loanFromStatement.js';

const cot = () => 1000;
const tx = (extra = {}) => ({
  _id: 't1', fecha: '05/10/2026', tipo: 'Gasto', moneda: 'ARS', importe: 100000, monto_original: 100000,
  categoria: 'Préstamo', prestamo: { deudor: 'Juan Perez' }, ...extra
});
const mov = (extra = {}) => ({
  _id: 'm1', deudor: 'Juan Perez', tipo: 'Prestamo', moneda: 'ARS', fecha: new Date('2026-10-05T00:00:00Z'), monto: 100000, monto_usd: 100, ...extra
});

describe('planDePrestamos', () => {
  it('sin préstamo devuelve null; un gasto es un préstamo otorgado y se convierte a USD', () => {
    const plan = planDePrestamos([{ fecha: '01/10/2026', tipo: 'Gasto', importe: 1 }, tx()], [], cot);
    expect(plan[0]).toBeNull();
    expect(plan[1]).toMatchObject({ deudor: 'Juan Perez', crear: true, duplicado: null, error: null, movimiento: { tipo: 'Prestamo', moneda: 'ARS', monto: 100000, monto_usd: 100, fecha: '2026-10-05' } });
  });

  it('un ingreso es una devolución, y en USD usa el monto original', () => {
    const existentes = [mov({ moneda: 'USD', monto: 500, monto_usd: 500 })];
    const plan = planDePrestamos([tx({ tipo: 'Ingreso', moneda: 'USD', importe: 700000, monto_original: 200, fecha: '20/10/2026', _id: 't9' })], existentes, cot);
    expect(plan[0]).toMatchObject({ crear: true, movimiento: { tipo: 'Devolucion', moneda: 'USD', monto: 200, monto_usd: 200 } });
  });

  it('errores: sin deudor, tipo, fecha, monto y moneda', () => {
    const plan = planDePrestamos([
      tx({ prestamo: { deudor: '  ' } }), tx({ tipo: 'Otro' }), tx({ fecha: 'x' }), tx({ importe: 0 }), tx({ moneda: 'EUR' })
    ], [], cot);
    expect(plan.every(p => p.crear === false && p.error)).toBe(true);
  });

  it('duplicado: mismo deudor (sin distinguir mayúsculas), tipo, moneda y monto, ±3 días', () => {
    const existentes = [mov({ deudor: 'JUAN PEREZ', fecha: new Date('2026-10-07T00:00:00Z') })];
    const [p] = planDePrestamos([tx()], existentes, cot);
    expect(p).toMatchObject({ crear: false, duplicado: { fecha: '2026-10-07' } });
    // otro deudor, otra moneda o más de 3 días: no es duplicado
    expect(planDePrestamos([tx({ prestamo: { deudor: 'Ana' } })], existentes, cot)[0].crear).toBe(true);
    expect(planDePrestamos([tx()], [mov({ fecha: new Date('2026-10-10T00:00:00Z') })], cot)[0].crear).toBe(true);
    expect(planDePrestamos([tx()], [mov({ moneda: 'USD' })], cot)[0].crear).toBe(true);
  });

  it('cada movimiento existente se usa una sola vez', () => {
    const plan = planDePrestamos([tx({ _id: 'a' }), tx({ _id: 'b' })], [mov()], cot);
    expect(plan.map(p => p.crear)).toEqual([false, true]);
  });

  it('una transacción ya vinculada a un movimiento (transaction_id) no se vuelve a crear', () => {
    const [p] = planDePrestamos([tx({ _id: 'tx-77' })], [mov({ transaction_id: 'tx-77', fecha: new Date('2026-01-01T00:00:00Z') })], cot);
    expect(p).toMatchObject({ crear: false, duplicado: expect.any(Object) });
  });

  it('una devolución mayor al saldo es un error y no se crea', () => {
    const plan = planDePrestamos([tx({ tipo: 'Ingreso', importe: 300000, monto_original: 300000, fecha: '20/10/2026' })], [mov()], cot);
    expect(plan[0]).toMatchObject({ crear: false, error: expect.stringMatching(/supera lo que Juan Perez te debe/) });
  });

  it('un préstamo y su devolución en el mismo lote: el saldo cuenta el préstamo del lote', () => {
    const plan = planDePrestamos([
      tx({ _id: 'dev', tipo: 'Ingreso', importe: 60000, monto_original: 60000, fecha: '20/10/2026' }),
      tx({ _id: 'pre' })
    ], [], cot);
    expect(plan.map(p => p.crear)).toEqual([true, true]);
  });

  it('una devolución anterior al préstamo del lote no tiene saldo', () => {
    const plan = planDePrestamos([
      tx({ _id: 'dev', tipo: 'Ingreso', importe: 60000, monto_original: 60000, fecha: '01/10/2026' }),
      tx({ _id: 'pre', fecha: '05/10/2026' })
    ], [], cot);
    expect(plan[0].crear).toBe(false);
    expect(plan[1].crear).toBe(true);
  });

  it('sin cotización del dólar es un error claro para préstamos en pesos', () => {
    const [p] = planDePrestamos([tx()], [], () => 0);
    expect(p).toMatchObject({ crear: false, error: expect.stringMatching(/cotización/) });
  });
});
