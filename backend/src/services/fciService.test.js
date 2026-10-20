import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FciService } from './fciService.js';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

// Reportes inventados por URL; cualquier otra URL falla como si la API estuviera caída
let reportes = {};
beforeEach(() => {
  reportes = {};
  axios.get.mockReset();
  axios.get.mockImplementation(async (url) => {
    if (!(url in reportes)) throw new Error('network down');
    return { data: reportes[url] };
  });
});

const URL = 'https://api.argentinadatos.com/v1/finanzas/fci';
const fila = (fondo, vcp, fecha = '2026-10-16') => ({ fondo, horizonte: 'corto', fecha, vcp });

// Cada test usa nombres de fondo propios: el servicio cachea los reportes por una hora
describe('FciService.getPrecio', () => {
  it('trae el valor de una cuotaparte del último reporte de la categoría', async () => {
    reportes[`${URL}/rentaFija/ultimo`] = [fila('Renta Uno - Clase A', 1500), fila('Renta Uno - Clase B', 1600)];
    await expect(FciService.getPrecio({ fci_nombre: 'Renta Uno - Clase B', fci_categoria: 'rentaFija' }))
      .resolves.toEqual({ precio: 1.6, fecha: '2026-10-16', fuente: 'CAFCI' });
  });

  it('si el fondo no informó el último día usa el anterior', async () => {
    reportes[`${URL}/rentaMixta/ultimo`] = [fila('Otro Mixto', 1000)];
    reportes[`${URL}/rentaMixta/penultimo`] = [fila('Mixto Dos', 2000, '2026-10-15')];
    await expect(FciService.getPrecio({ fci_nombre: 'Mixto Dos', fci_categoria: 'rentaMixta' }))
      .resolves.toEqual({ precio: 2, fecha: '2026-10-15', fuente: 'CAFCI' });
  });

  it('si no está en su categoría lo busca en todas', async () => {
    reportes[`${URL}/otros/ultimo`] = [fila('Fondo Otros', 3000)];
    reportes[`${URL}/otros/penultimo`] = [];
    reportes[`${URL}/rentaVariable/ultimo`] = [fila('Variable Mal Categorizado', 4000)];
    await expect(FciService.getPrecio({ fci_nombre: 'Variable Mal Categorizado', fci_categoria: 'otros' }))
      .resolves.toMatchObject({ precio: 4 });
  });

  it('si la API está caída avisa con 503', async () => {
    await expect(FciService.getPrecio({ fci_nombre: 'Caído', fci_categoria: 'mercadoDinero' }))
      .rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('FciService.buscar', () => {
  it('busca en todas las categorías que responden', async () => {
    reportes[`${URL}/mercadoDinero/ultimo`] = [fila('Liquidez Buscable - Clase A', 50000)];
    const fondos = await FciService.buscar('buscable');
    expect(fondos.map(f => [f.nombre, f.categoria, f.precio])).toEqual([['Liquidez Buscable - Clase A', 'mercadoDinero', 50]]);
  });
});
