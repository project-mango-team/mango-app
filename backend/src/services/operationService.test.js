import { describe, it, expect, vi, beforeEach } from 'vitest';

const orden = [];
vi.mock('../models/Transaction.js', () => ({
  default: { deleteMany: vi.fn(async () => { orden.push('borrar'); return { deletedCount: 3 }; }) }
}));
vi.mock('./statementImportService.js', () => ({
  restaurarContrapartes: vi.fn(async () => { orden.push('contrapartes'); })
}));
vi.mock('./investmentLinkService.js', () => ({
  revertirMovimientosDeOperacion: vi.fn(async () => { orden.push('inversiones'); return { borrados: 1, desvinculados: 0 }; })
}));
vi.mock('./loanLinkService.js', () => ({
  revertirPrestamosDeOperacion: vi.fn(async () => { orden.push('prestamos'); return { borrados: 2 }; })
}));
const reabrir = vi.fn();
vi.mock('./ingestService.js', () => ({ reabrirPorRollback: (...a) => reabrir(...a) }));

const { revertirOperacion } = await import('./operationService.js');

const req = { user: { _id: '64b000000000000000000001' } };
const nuevaOperacion = () => ({ operation_id: 'op-1', status: 'completed', save: vi.fn(async () => { orden.push('guardar'); }) });

describe('revertirOperacion', () => {
  beforeEach(() => {
    orden.length = 0;
    reabrir.mockReset();
    reabrir.mockImplementation(async () => { orden.push('reabrir'); });
  });

  it('borra, restaura contrapartes, revierte inversiones, marca revertida y reabre el documento, en ese orden', async () => {
    const op = nuevaOperacion();
    const r = await revertirOperacion(req, op);
    expect(orden).toEqual(['borrar', 'contrapartes', 'inversiones', 'prestamos', 'guardar', 'reabrir']);
    expect(op.status).toBe('rolled_back');
    expect(op.rolled_back_at).toBeInstanceOf(Date);
    expect(reabrir).toHaveBeenCalledWith(req, 'op-1');
    expect(r).toEqual({ deletedCount: 3, reabierto: true, inversiones: { borrados: 1, desvinculados: 0 }, prestamos: { borrados: 2 } });
  });

  it('si reabrir falla, la reversión igual sale bien', async () => {
    reabrir.mockRejectedValue(new Error('reparseo roto'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const op = nuevaOperacion();
    const r = await revertirOperacion(req, op);
    expect(op.status).toBe('rolled_back');
    expect(r).toEqual({ deletedCount: 3, reabierto: false, inversiones: { borrados: 1, desvinculados: 0 }, prestamos: { borrados: 2 } });
    spy.mockRestore();
  });
});
