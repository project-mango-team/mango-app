import { describe, it, expect } from 'vitest';
import { precioCuotaparte, filaAFondo, buscarFondos, encontrarFondo } from './fciPrices.js';

// Fondos inventados con el formato del reporte diario de la CAFCI
const FONDOS = [
  { fondo: 'Ahorro Plus - Clase A', horizonte: 'corto', fecha: '2026-10-16', vcp: 85000.5 },
  { fondo: 'Ahorro Plus - Clase B', horizonte: 'corto', fecha: '2026-10-16', vcp: 99000 },
  { fondo: 'Acciones Región Ñandú', horizonte: 'largo', fecha: '2026-10-16', vcp: 1234567.891 },
  { fondo: 'Fondo Sin Valor', horizonte: 'corto', fecha: '2026-10-16', vcp: null }
].map(f => filaAFondo(f, 'mercadoDinero'));

describe('precioCuotaparte', () => {
  it('la CAFCI publica el valor cada 1.000 cuotapartes', () => {
    expect(precioCuotaparte({ vcp: 85000.5 })).toBe(85.0005);
  });

  it('sin valor válido devuelve null', () => {
    expect(precioCuotaparte({ vcp: null })).toBeNull();
    expect(precioCuotaparte({ vcp: 0 })).toBeNull();
    expect(precioCuotaparte(undefined)).toBeNull();
  });
});

describe('filaAFondo', () => {
  it('arma el fondo con su categoría y el precio por cuotaparte', () => {
    expect(FONDOS[0]).toEqual({
      nombre: 'Ahorro Plus - Clase A', categoria: 'mercadoDinero', horizonte: 'corto', fecha: '2026-10-16', precio: 85.0005
    });
  });
});

describe('buscarFondos', () => {
  it('busca por todas las palabras, sin tildes ni mayúsculas, ordenado', () => {
    expect(buscarFondos(FONDOS, 'plus AHORRO').map(f => f.nombre)).toEqual(['Ahorro Plus - Clase A', 'Ahorro Plus - Clase B']);
    expect(buscarFondos(FONDOS, 'region nandu').map(f => f.nombre)).toEqual(['Acciones Región Ñandú']);
    expect(buscarFondos(FONDOS, 'clase b').map(f => f.nombre)).toEqual(['Ahorro Plus - Clase B']);
  });

  it('ignora fondos sin valor y consultas vacías, y respeta el límite', () => {
    expect(buscarFondos(FONDOS, 'sin valor')).toEqual([]);
    expect(buscarFondos(FONDOS, '   ')).toEqual([]);
    expect(buscarFondos(FONDOS, 'ahorro', 1)).toHaveLength(1);
  });
});

describe('encontrarFondo', () => {
  it('encuentra por nombre exacto normalizado', () => {
    expect(encontrarFondo(FONDOS, '  ahorro plus -  clase a ')?.precio).toBe(85.0005);
  });

  it('no confunde clases ni devuelve fondos sin valor', () => {
    expect(encontrarFondo(FONDOS, 'Ahorro Plus')).toBeNull();
    expect(encontrarFondo(FONDOS, 'Fondo Sin Valor')).toBeNull();
  });
});
