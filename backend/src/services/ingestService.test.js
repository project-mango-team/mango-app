import { describe, it, expect } from 'vitest';
import { resumirPreview, parametrosDesdeDeteccion, necesitaDolar, nombreParaParser } from './ingestService.js';

describe('resumirPreview', () => {
  it('cuenta duplicados, suma solo lo nuevo y arma el rango de fechas', () => {
    const r = resumirPreview([
      { fecha: '15/09/2026', tipo: 'Gasto', importe: 1000 },
      { fecha: '02-09-26', tipo: 'Gasto', importe: 500, duplicado: true },
      { fecha: '20/09/2026', tipo: 'Ingreso', importe: 300 }
    ]);
    expect(r).toEqual({ cantidad: 3, duplicados: 1, gastos: 1000, ingresos: 300, desde: '2026-09-02', hasta: '2026-09-20' });
  });

  it('sin transacciones', () => {
    expect(resumirPreview([])).toMatchObject({ cantidad: 0, desde: null, hasta: null });
  });
});

describe('parámetros', () => {
  it('desde la detección: tipo, tipo de resumen y todas las tarjetas', () => {
    expect(parametrosDesdeDeteccion({ tipo: 'santander', tarjetas: ['A', 'B'] })).toEqual({ tipo: 'santander', tipoResumen: undefined, selectedCards: ['A', 'B'] });
    expect(parametrosDesdeDeteccion({ tipo: 'galicia', tipoResumen: 'tarjeta' })).toMatchObject({ tipo: 'galicia', tipoResumen: 'tarjeta', selectedCards: [] });
  });

  it('solo las tarjetas necesitan cotización del dólar', () => {
    expect(necesitaDolar({ tipo: 'santander' })).toBe(true);
    expect(necesitaDolar({ tipo: 'galicia', tipoResumen: 'tarjeta' })).toBe(true);
    expect(necesitaDolar({ tipo: 'galicia', tipoResumen: 'cuenta' })).toBe(false);
    expect(necesitaDolar({ tipo: 'mercadopago' })).toBe(false);
  });

  it('un Excel sin extensión recibe .xlsx para el parser', () => {
    expect(nombreParaParser('adjunto', { archivo: 'excel' })).toBe('adjunto.xlsx');
    expect(nombreParaParser('extracto.xlsx', { archivo: 'excel' })).toBe('extracto.xlsx');
    expect(nombreParaParser('resumen.pdf', { archivo: 'pdf' })).toBe('resumen.pdf');
  });
});
