import { describe, it, expect, vi, beforeEach } from 'vitest';
import { valuarTodos } from '../services/valuationService.js';
import job from './valuacionDiaria.js';

vi.mock('../services/valuationService.js', () => ({ valuarTodos: vi.fn() }));

const RESUMEN = { activos: 2, guardadas: 1, omitidas: 0, sin_tenencia: 0, errores: 1 };

describe('job valuacion-diaria', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('devuelve el resumen sin datos personales', async () => {
    valuarTodos.mockResolvedValue({ resumen: { ...RESUMEN, errores: 0, guardadas: 2 }, errores: [] });
    await expect(job.run({ manual: false, slot: '2026-10-20' })).resolves.toEqual({ ...RESUMEN, errores: 0, guardadas: 2 });
  });

  it('los errores de configuración quedan en el resumen', async () => {
    valuarTodos.mockResolvedValue({ resumen: RESUMEN, errores: [{ asset_id: 'x', status: 404, mensaje: 'No se encontró' }] });
    await expect(job.run({})).resolves.toEqual(RESUMEN);
  });

  it('si falla una fuente externa tira error para que el scheduler reintente', async () => {
    valuarTodos.mockResolvedValue({ resumen: RESUMEN, errores: [{ asset_id: 'x', status: 503, mensaje: 'caída' }] });
    await expect(job.run({})).rejects.toThrow(/1 de 2 activo/);
  });
});
