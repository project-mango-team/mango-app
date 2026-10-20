import { describe, it, expect, vi } from 'vitest';
import { FciService } from './fciService.js';
import { obtenerPrecio, calcularValuacionAutomatica, valuarActivos } from './valuationService.js';

vi.mock('./fciService.js', () => ({
  FciService: { getPrecio: vi.fn(async () => ({ precio: 2.5, fecha: '2026-10-16', fuente: 'CAFCI' })) }
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
    await expect(obtenerPrecio({ fuente_precio: 'coingecko' })).rejects.toMatchObject({ statusCode: 501 });
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
    expect(resumen).toEqual({ activos: 2, guardadas: 2, omitidas: 0, sin_unidades: 0, errores: 0 });
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
    expect(resumen).toEqual({ activos: 3, guardadas: 0, omitidas: 1, sin_unidades: 2, errores: 0 });
    expect(d.calcular).toHaveBeenCalledTimes(1);
  });

  it('un error en un activo no corta los demás', async () => {
    const error = Object.assign(new Error('CAFCI caída'), { statusCode: 503 });
    const d = deps({ calcular: vi.fn(async (a) => { if (a._id === 'a') throw error; return { fecha: '2026-10-16' }; }) });
    const { resumen, errores } = await valuarActivos([activo('a', 1), activo('b', 1)], d);
    expect(resumen).toMatchObject({ guardadas: 1, errores: 1 });
    expect(errores).toEqual([{ asset_id: 'a', status: 503, mensaje: 'CAFCI caída' }]);
  });
});
