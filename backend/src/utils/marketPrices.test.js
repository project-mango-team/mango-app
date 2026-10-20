import { describe, it, expect } from 'vitest';
import { parseYahooChart, parseCoingecko, convertirPrecio } from './marketPrices.js';

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

describe('parseYahooChart', () => {
  // 2026-10-17 20:00 UTC = 17:00 en Buenos Aires
  const chart = (meta) => ({ chart: { result: [{ meta }] } });

  it('lee el último precio, la moneda y la fecha en el huso de la bolsa', () => {
    expect(parseYahooChart(chart({ currency: 'ars', regularMarketPrice: 5765, regularMarketTime: 1792267200, gmtoffset: -10800 }), 'X.BA'))
      .toEqual({ precio: 5765, moneda: 'ARS', fecha: '2026-10-17' });
  });

  it('usa el offset para no correr la fecha al día siguiente', () => {
    // 2026-10-18 02:00 UTC = 17/10 23:00 en Nueva York (UTC-4)
    expect(parseYahooChart(chart({ currency: 'USD', regularMarketPrice: 1, regularMarketTime: 1792288800, gmtoffset: -14400 }), 'X').fecha)
      .toBe('2026-10-17');
  });

  it('un ticker inexistente avisa y sugiere .BA', () => {
    const noEncontrado = { chart: { result: null, error: { code: 'Not Found' } } };
    expect(() => parseYahooChart(noEncontrado, 'GGAL')).toThrow(/\.BA/);
  });
});
