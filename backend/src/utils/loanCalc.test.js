import { describe, it, expect } from 'vitest';
import { montoPrestamoUsd, saldoDeudor, resumirPrestamos } from './loanCalc.js';

const mov = (_id, deudor, tipo, fecha, monto_usd) => ({ _id, deudor, tipo, fecha: new Date(`${fecha}T00:00:00Z`), monto_usd });

describe('montoPrestamoUsd', () => {
  it('USD queda igual', () => {
    expect(montoPrestamoUsd(500, 'USD', 1500)).toBe(500);
  });

  it('ARS se divide por la cotización', () => {
    expect(montoPrestamoUsd(1500000, 'ARS', 1500)).toBe(1000);
  });

  it('ARS sin cotización falla', () => {
    expect(() => montoPrestamoUsd(1000, 'ARS', 0)).toThrow();
  });
});

describe('saldoDeudor', () => {
  const movs = [
    mov('1', 'Mama', 'Prestamo', '2025-01-01', 700),
    mov('2', ' MAMA ', 'Prestamo', '2025-01-02', 100),
    mov('3', 'Mama ', 'Devolucion', '2025-02-01', 200),
    mov('4', 'Papa', 'Prestamo', '2025-01-01', 1000)
  ];

  it('suma préstamos y resta devoluciones sin distinguir mayúsculas ni espacios', () => {
    expect(saldoDeudor(movs, 'mama')).toBe(600);
  });

  it('puede excluir un movimiento (al editar)', () => {
    expect(saldoDeudor(movs, 'Mama', '3')).toBe(800);
  });
});

describe('resumirPrestamos', () => {
  it('separa pendientes y saldados y suma el total pendiente', () => {
    const r = resumirPrestamos([
      mov('1', 'Mama', 'Prestamo', '2025-01-01', 700),
      mov('2', 'Mama', 'Devolucion', '2025-03-01', 200),
      mov('3', 'Papa', 'Prestamo', '2025-01-01', 1683.48),
      mov('4', 'Juan', 'Prestamo', '2024-05-01', 300),
      mov('5', 'juan', 'Devolucion', '2024-08-01', 300)
    ]);

    expect(r.pendientes.map(d => [d.deudor, d.saldo_usd])).toEqual([['Papa', 1683.48], ['Mama', 500]]);
    expect(r.saldados.map(d => [d.deudor, d.prestado_usd, d.saldado])).toEqual([['juan', 300, true]]);
    expect(r.total_pendiente_usd).toBe(2183.48);
  });

  it('sin movimientos', () => {
    expect(resumirPrestamos([])).toEqual({ pendientes: [], saldados: [], total_pendiente_usd: 0 });
  });
});
