import { describe, it, expect } from 'vitest';
import { fechaTransaccionISO, montoTransaccionUsd } from './transactionCurrency.js';

const historial = [
  { fecha: '2025-03-14', promedio: 1250 },
  { fecha: '2026-10-16', promedio: 1500 }
];

describe('fechaTransaccionISO', () => {
  it('convierte DD/MM/YYYY a YYYY-MM-DD', () => {
    expect(fechaTransaccionISO('05/10/2026')).toBe('2026-10-05');
  });

  it('devuelve null si el formato no es el esperado', () => {
    expect(fechaTransaccionISO('2026-10-05')).toBeNull();
    expect(fechaTransaccionISO(undefined)).toBeNull();
  });
});

describe('montoTransaccionUsd', () => {
  it('un gasto en pesos usa el blue de su fecha, no el de hoy', () => {
    expect(montoTransaccionUsd({ importe: 125000, moneda: 'ARS', fecha: '20/03/2025' }, historial)).toBe(100);
    expect(montoTransaccionUsd({ importe: 150000, moneda: 'ARS', fecha: '16/10/2026' }, historial)).toBe(100);
  });

  it('un gasto en dólares usa el monto original', () => {
    expect(montoTransaccionUsd({ importe: 145000, moneda: 'USD', monto_original: 100, fecha: '20/03/2025' }, historial)).toBe(100);
  });

  it('sin fecha válida no inventa un monto', () => {
    expect(montoTransaccionUsd({ importe: 1000, moneda: 'ARS', fecha: 'ayer' }, historial)).toBe(0);
  });
});
