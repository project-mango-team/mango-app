import { describe, it, expect } from 'vitest';
import { parseCoingecko, convertirPrecio } from './marketPrices.js';

describe('parseCoingecko', () => {
  it('lee el precio en USD y EUR', () => {
    expect(parseCoingecko({ bitcoin: { usd: 80000, eur: 70000 } }, 'bitcoin')).toEqual({ usd: 80000, eur: 70000 });
    expect(parseCoingecko({ rara: { usd: 0.5 } }, 'rara')).toEqual({ usd: 0.5 });
  });

  it('un id desconocido avisa con 404', () => {
    expect(() => parseCoingecko({}, 'bitcoyn')).toThrow(/No se encontró "bitcoyn"/);
  });
});

describe('convertirPrecio', () => {
  const cot = { usd: 1500, eur: 1700 };

  it('convierte entre ARS, USD y EUR pasando por pesos', () => {
    expect(convertirPrecio(10, 'USD', 'ARS', cot)).toBe(15000);
    expect(convertirPrecio(15000, 'ARS', 'USD', cot)).toBe(10);
    expect(convertirPrecio(17, 'USD', 'EUR', cot)).toBe(15);
    expect(convertirPrecio(5, 'EUR', 'EUR', cot)).toBe(5);
  });

  it('rechaza monedas que no maneja y cotizaciones faltantes', () => {
    expect(() => convertirPrecio(1, 'GBP', 'USD', cot)).toThrow(/GBP/);
    expect(() => convertirPrecio(1, 'EUR', 'ARS', { usd: 1500 })).toThrow(/cotización/);
  });
});
