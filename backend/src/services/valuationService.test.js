import { describe, it, expect, vi } from 'vitest';
import { FciService } from './fciService.js';
import { obtenerPrecio, calcularValuacionAutomatica, valuarActivos } from './valuationService.js';

vi.mock('./fciService.js', () => ({
  FciService: { getPrecio: vi.fn(async () => ({ precio: 2.5, fecha: '2026-10-16', fuente: 'CAFCI' })) }
}));
vi.mock('./marketPriceService.js', () => ({
  MarketPriceService: {
    getCripto: vi.fn(async () => ({ usd: 80000, eur: 70000 })),
    getTicker: vi.fn(async (ticker) => (ticker.endsWith('.BA')
      ? { precio: 20900, moneda: 'ARS', fecha: '2026-10-17' }
      : { precio: 700, moneda: 'USD', fecha: '2026-10-17' }))
  }
}));
vi.mock('./dolarService.js', () => ({
  hoyArgentina: () => '2026-10-20',
  DolarService: { getBlue: vi.fn(async () => ({ promedio: 1500 })), getEuro: vi.fn(async () => ({ promedio: 1700 })) }
}));

const movimiento = (tipo, fecha, unidades) => ({ tipo, fecha: new Date(`${fecha}T00:00:00Z`), monto: 1, unidades });

describe('obtenerPrecio', () => {
  it('los FCI van a la CAFCI con su configuración', async () => {
    const config = { fci_nombre: 'Fondo X', fci_categoria: 'rentaFija' };
    await expect(obtenerPrecio({ fuente_precio: 'cafci', precio_config: config })).resolves.toMatchObject({ precio: 2.5 });
    expect(FciService.getPrecio).toHaveBeenCalledWith(config);
  });

  it('manual no tiene precio y las fuentes que faltan avisan', async () => {
    await expect(obtenerPrecio({ fuente_precio: 'manual' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(obtenerPrecio({ fuente_precio: 'otra' })).rejects.toMatchObject({ statusCode: 501 });
  });
});

describe('calcularValuacionAutomatica', () => {
  it('unidades × precio de la fuente, con la fecha del precio', async () => {
    const asset = { fuente_precio: 'cafci', precio_config: {} };
    const movs = [movimiento('Aporte', '2026-10-01', 100), movimiento('Aporte', '2026-10-18', 50)];
    await expect(calcularValuacionAutomatica(asset, movs))
      .resolves.toEqual({ fecha: '2026-10-16', precio: 2.5, unidades: 100, monto: 250, fuente: 'CAFCI' });
  });
});

describe('valuarActivos', () => {
  const activo = (id, unidades, moneda = 'ARS') => ({ _id: id, moneda, unidades });
  const deps = (overrides = {}) => ({
    movimientosDe: vi.fn(async () => []),
    calcular: vi.fn(async (asset) => ({ fecha: '2026-10-16', monto: asset.unidades * 2 })),
    cotizaciones: vi.fn(async () => ({ usd: 1500 })),
    guardar: vi.fn(async () => ({ estado: 'guardada' })),
    ...overrides
  });

  it('valúa cada activo con unidades y guarda con la cotización de la fecha del precio', async () => {
    const d = deps();
    const { resumen, errores } = await valuarActivos([activo('a', 10), activo('b', 5, 'EUR')], d);
    expect(resumen).toEqual({ activos: 2, guardadas: 2, omitidas: 0, sin_tenencia: 0, errores: 0 });
    expect(errores).toEqual([]);
    expect(d.cotizaciones).toHaveBeenCalledWith('2026-10-16', 'EUR');
    expect(d.guardar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'a' }), { fecha: '2026-10-16', monto: 20 }, { usd: 1500 });
  });

  it('saltea activos sin unidades o vendidos y cuenta las omitidas por valuación manual', async () => {
    const d = deps({
      movimientosDe: vi.fn(async (a) => (a._id === 'vendido'
        ? [movimiento('Aporte', '2026-01-01', 10), movimiento('Retiro', '2026-02-01', 10)]
        : [])),
      guardar: vi.fn(async () => ({ estado: 'omitida' }))
    });
    const { resumen } = await valuarActivos([activo('sin', undefined), activo('vendido', undefined), activo('ok', 3)], d);
    expect(resumen).toEqual({ activos: 3, guardadas: 0, omitidas: 1, sin_tenencia: 2, errores: 0 });
    expect(d.calcular).toHaveBeenCalledTimes(1);
  });

  it('un error en un activo no corta los demás', async () => {
    const error = Object.assign(new Error('CAFCI caída'), { statusCode: 503 });
    const d = deps({ calcular: vi.fn(async (a) => { if (a._id === 'a') throw error; return { fecha: '2026-10-16', monto: 1 }; }) });
    const { resumen, errores } = await valuarActivos([activo('a', 1), activo('b', 1)], d);
    expect(resumen).toMatchObject({ guardadas: 1, errores: 1 });
    expect(errores).toEqual([{ asset_id: 'a', status: 503, mensaje: 'CAFCI caída' }]);
  });
});

describe('tasa fija', () => {
  it('devenga hasta hoy sin unidades ni precio', async () => {
    const asset = { fuente_precio: 'tasa_fija', precio_config: { tasa_anual: 0 } };
    const v = await calcularValuacionAutomatica(asset, [{ tipo: 'Aporte', fecha: new Date('2026-01-01T00:00:00Z'), monto: 100 }]);
    expect(v).toMatchObject({ precio: null, unidades: null, monto: 100, fuente: 'Tasa fija', tasa_anual: 0 });
    expect(v.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el job valúa activos a tasa fija aunque no tengan unidades y saltea los cerrados', async () => {
    const calcular = vi.fn(async (a) => ({ fecha: '2026-10-20', monto: a._id === 'cerrado' ? 0 : 105 }));
    const guardar = vi.fn(async () => ({ estado: 'guardada' }));
    const { resumen } = await valuarActivos(
      [{ _id: 'nexo', fuente_precio: 'tasa_fija' }, { _id: 'cerrado', fuente_precio: 'tasa_fija' }],
      { movimientosDe: async () => [], calcular, cotizaciones: async () => ({ usd: 1500 }), guardar }
    );
    expect(resumen).toEqual({ activos: 2, guardadas: 1, omitidas: 0, sin_tenencia: 1, errores: 0 });
  });
});

describe('cripto', () => {
  const btc = (moneda) => ({ fuente_precio: 'coingecko', moneda, precio_config: { coingecko_id: 'bitcoin' } });

  it('USD y EUR salen directo de CoinGecko, con la fecha de hoy', async () => {
    await expect(obtenerPrecio(btc('USD'))).resolves.toEqual({ precio: 80000, fecha: '2026-10-20', fuente: 'CoinGecko' });
    await expect(obtenerPrecio(btc('EUR'))).resolves.toMatchObject({ precio: 70000 });
  });

  it('ARS se convierte con el dólar blue de hoy', async () => {
    await expect(obtenerPrecio(btc('ARS'))).resolves.toMatchObject({ precio: 120000000 });
  });
});

describe('tickers', () => {
  const activo = (ticker, moneda) => ({ fuente_precio: 'ticker', moneda, precio_config: { ticker } });

  it('en la moneda de cotización va directo, con la fecha del mercado', async () => {
    await expect(obtenerPrecio(activo('SPY', 'USD'))).resolves.toEqual({ precio: 700, fecha: '2026-10-17', fuente: 'Yahoo Finance' });
    await expect(obtenerPrecio(activo('SPY.BA', 'ARS'))).resolves.toMatchObject({ precio: 20900 });
  });

  it('en otra moneda se convierte con el blue de la fecha del precio', async () => {
    const { DolarService } = await import('./dolarService.js');
    await expect(obtenerPrecio(activo('SPY', 'ARS'))).resolves.toMatchObject({ precio: 1050000 });
    expect(DolarService.getBlue).toHaveBeenCalledWith('2026-10-17');
  });
});
