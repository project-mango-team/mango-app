import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteMany = vi.fn(async () => ({ deletedCount: 2 }));
const updateMany = vi.fn(async () => ({ modifiedCount: 1 }));
vi.mock('../models/InvestmentMovement.js', () => ({
  default: { deleteMany: (...a) => deleteMany(...a), updateMany: (...a) => updateMany(...a) }
}));

const { revertirMovimientosDeOperacion } = await import('./investmentLinkService.js');

const req = { user: { _id: '64b000000000000000000001' } };

describe('revertirMovimientosDeOperacion', () => {
  beforeEach(() => {
    deleteMany.mockClear();
    updateMany.mockClear();
  });

  it('borra los del extracto sin cuotapartes y desvincula el resto, siempre del usuario', async () => {
    const r = await revertirMovimientosDeOperacion(req, 'op-1');
    expect(r).toEqual({ borrados: 2, desvinculados: 1 });

    const [filtroBorrar] = deleteMany.mock.calls[0];
    expect(String(filtroBorrar.user_id)).toBe(req.user._id);
    expect(filtroBorrar).toMatchObject({ operation_id: 'op-1', origen: 'extracto' });
    expect(filtroBorrar.$or).toEqual([{ unidades: { $exists: false } }, { unidades: null }]);

    const [filtroDesvincular, cambio] = updateMany.mock.calls[0];
    expect(String(filtroDesvincular.user_id)).toBe(req.user._id);
    expect(filtroDesvincular).toMatchObject({ operation_id: 'op-1', origen: 'extracto' });
    expect(cambio).toEqual({ $unset: { operation_id: 1, transaction_id: 1 }, $set: { origen: 'app' } });
  });

  it('el borrado va antes que el desvincular (los borrados ya no aparecen)', async () => {
    const orden = [];
    deleteMany.mockImplementationOnce(async () => { orden.push('borrar'); return { deletedCount: 0 }; });
    updateMany.mockImplementationOnce(async () => { orden.push('desvincular'); return { modifiedCount: 0 }; });
    await revertirMovimientosDeOperacion(req, 'op-2');
    expect(orden).toEqual(['borrar', 'desvincular']);
  });

  it('sin operation_id no toca nada', async () => {
    expect(await revertirMovimientosDeOperacion(req, undefined)).toEqual({ borrados: 0, desvinculados: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
