import { describe, it, expect } from 'vitest';
import { fechaISO, movimientoDesdeTransaccion, planDeInversiones } from './investmentFromStatement.js';
import { emparejarConTolerancia } from './investmentImport.js';

const fima = { _id: 'a1', nombre: 'Fima Premium', moneda: 'ARS' };
const tx = (extra = {}) => ({ fecha: '05/10/2026', tipo: 'Gasto', moneda: 'ARS', importe: 50000, monto_original: 50000, inversion: { activo_id: 'a1' }, ...extra });

describe('fechaISO', () => {
  it('entiende los formatos de los parsers', () => {
    expect(fechaISO('05/10/2026')).toBe('2026-10-05');
    expect(fechaISO('5-10-26')).toBe('2026-10-05');
    expect(fechaISO('2026-10-05')).toBe('2026-10-05');
    expect(fechaISO('basura')).toBeNull();
    expect(fechaISO(undefined)).toBeNull();
  });
});

describe('movimientoDesdeTransaccion', () => {
  it('un gasto es un aporte y un ingreso es un retiro, por el importe en pesos', () => {
    expect(movimientoDesdeTransaccion(tx(), fima)).toEqual({ movimiento: { fecha: '2026-10-05', tipo: 'Aporte', monto: 50000 } });
    expect(movimientoDesdeTransaccion(tx({ tipo: 'Ingreso', importe: 1234.5 }), fima).movimiento).toMatchObject({ tipo: 'Retiro', monto: 1234.5 });
  });

  it('en dólares usa el monto original', () => {
    const usd = { moneda: 'USD', nombre: 'Fondo USD' };
    const r = movimientoDesdeTransaccion(tx({ moneda: 'USD', importe: 700000, monto_original: 500 }), usd);
    expect(r.movimiento.monto).toBe(500);
  });

  it('si la moneda no coincide con la del activo es un error, no convierte', () => {
    expect(movimientoDesdeTransaccion(tx({ moneda: 'USD', monto_original: 10 }), fima).error).toMatch(/USD.*ARS/);
    expect(movimientoDesdeTransaccion(tx(), { moneda: 'USD' }).error).toMatch(/ARS.*USD/);
  });

  it('rechaza montos, fechas y tipos inválidos', () => {
    expect(movimientoDesdeTransaccion(tx({ importe: 0 }), fima).error).toBeTruthy();
    expect(movimientoDesdeTransaccion(tx({ fecha: 'x' }), fima).error).toBeTruthy();
    expect(movimientoDesdeTransaccion(tx({ tipo: 'Otro' }), fima).error).toBeTruthy();
  });
});

describe('emparejarConTolerancia', () => {
  const mov = (fecha, tipo, monto) => ({ fecha: new Date(`${fecha}T00:00:00Z`), tipo, monto });

  it('empareja hasta 3 días de diferencia, mismo tipo y monto al centavo', () => {
    const existentes = [mov('2026-10-08', 'Aporte', 50000)];
    expect(emparejarConTolerancia([{ fecha: '2026-10-05', tipo: 'Aporte', monto: 50000 }], existentes)[0]).toBe(existentes[0]);
    expect(emparejarConTolerancia([{ fecha: '2026-10-04', tipo: 'Aporte', monto: 50000 }], existentes)[0]).toBeNull();
    expect(emparejarConTolerancia([{ fecha: '2026-10-05', tipo: 'Retiro', monto: 50000 }], existentes)[0]).toBeNull();
    expect(emparejarConTolerancia([{ fecha: '2026-10-05', tipo: 'Aporte', monto: 50000.01 }], existentes)[0]).toBeNull();
  });

  it('cada existente se usa una vez y gana el del mismo día', () => {
    const cerca = mov('2026-10-06', 'Aporte', 100);
    const exacto = mov('2026-10-05', 'Aporte', 100);
    const ops = [{ fecha: '2026-10-05', tipo: 'Aporte', monto: 100 }, { fecha: '2026-10-05', tipo: 'Aporte', monto: 100 }];
    const [a, b] = emparejarConTolerancia(ops, [cerca, exacto]);
    expect(a).toBe(exacto);
    expect(b).toBe(cerca);
    expect(emparejarConTolerancia(ops, [exacto])[1]).toBeNull();
  });

  it('con dias: 0 es el emparejamiento exacto', () => {
    expect(emparejarConTolerancia([{ fecha: '2026-10-05', tipo: 'Aporte', monto: 1 }], [mov('2026-10-06', 'Aporte', 1)], { dias: 0 })[0]).toBeNull();
  });
});

describe('planDeInversiones', () => {
  const activos = new Map([['a1', fima]]);

  it('sin inversión devuelve null; con inversión arma el movimiento y marca crear', () => {
    const plan = planDeInversiones([{ fecha: '01/10/2026', tipo: 'Gasto', importe: 10 }, tx()], activos);
    expect(plan[0]).toBeNull();
    expect(plan[1]).toMatchObject({ activo_nombre: 'Fima Premium', crear: true, duplicado: null, error: null, movimiento: { tipo: 'Aporte', monto: 50000 } });
  });

  it('un movimiento ya cargado (±3 días) no se vuelve a crear y dice la fecha', () => {
    const existentes = new Map([['a1', [{ fecha: new Date('2026-10-07T00:00:00Z'), tipo: 'Aporte', monto: 50000 }]]]);
    const plan = planDeInversiones([tx()], activos, existentes);
    expect(plan[0]).toMatchObject({ crear: false, duplicado: { fecha: '2026-10-07' } });
  });

  it('dos aportes iguales y uno solo cargado: crea solo el segundo', () => {
    const existentes = new Map([['a1', [{ fecha: new Date('2026-10-05T00:00:00Z'), tipo: 'Aporte', monto: 50000 }]]]);
    const plan = planDeInversiones([tx(), tx()], activos, existentes);
    expect(plan.map(p => p.crear)).toEqual([false, true]);
  });

  it('un activo que no es del usuario (no está en el mapa) es un error y no se crea', () => {
    const plan = planDeInversiones([tx({ inversion: { activo_id: 'ajeno' } })], activos);
    expect(plan[0]).toMatchObject({ crear: false, error: expect.stringMatching(/ya no existe/) });
  });

  it('error de moneda: no se crea', () => {
    const plan = planDeInversiones([tx({ moneda: 'USD', monto_original: 5 })], activos);
    expect(plan[0]).toMatchObject({ crear: false, error: expect.stringMatching(/USD/) });
  });
});
