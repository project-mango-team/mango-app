import { describe, it, expect, vi } from 'vitest';
import { FciService } from './fciService.js';
import { obtenerPrecio, calcularValuacionAutomatica } from './valuationService.js';

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
