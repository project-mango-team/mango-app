import { describe, it, expect, vi, beforeEach } from 'vitest';

const opFindOne = vi.fn();
const txFind = vi.fn();
const txCount = vi.fn();
vi.mock('../models/Operation.js', () => ({ default: { findOne: (...a) => opFindOne(...a) } }));
vi.mock('../models/Transaction.js', () => ({ default: { find: (...a) => txFind(...a), countDocuments: (...a) => txCount(...a) } }));

const { getTransaccionesDeOperacion } = await import('./operationController.js');

const encadenable = (resultado) => {
  const q = { select: vi.fn(() => q), sort: vi.fn(() => q), skip: vi.fn(() => q), limit: vi.fn(() => q), lean: vi.fn(async () => resultado) };
  return q;
};
const req = (query = {}, id = 'op-1') => ({ user: { _id: 'u1' }, params: { operationId: id }, query });
const res = () => ({ json: vi.fn() });

describe('getTransaccionesDeOperacion', () => {
  beforeEach(() => { opFindOne.mockReset(); txFind.mockReset(); txCount.mockReset(); });

  it('busca la operación y las transacciones por usuario y operación, ordenadas por _id', async () => {
    opFindOne.mockReturnValue(encadenable({ operation_id: 'op-1' }));
    const q = encadenable([{ detalle: 'a' }, { detalle: 'b' }]);
    txFind.mockReturnValue(q);
    txCount.mockResolvedValue(5);
    const r = res();
    await getTransaccionesDeOperacion(req({ limit: '2', skip: '0' }), r, vi.fn());
    expect(opFindOne).toHaveBeenCalledWith({ user_id: 'u1', operation_id: 'op-1' });
    expect(txFind).toHaveBeenCalledWith({ user_id: 'u1', operation_id: 'op-1' });
    expect(txCount).toHaveBeenCalledWith({ user_id: 'u1', operation_id: 'op-1' });
    expect(q.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(q.limit).toHaveBeenCalledWith(2);
    const { data } = r.json.mock.calls[0][0];
    expect(data.total).toBe(5);
    expect(data.hasMore).toBe(true);
  });

  it('la última página no tiene más', async () => {
    opFindOne.mockReturnValue(encadenable({ operation_id: 'op-1' }));
    txFind.mockReturnValue(encadenable([{ detalle: 'a' }]));
    txCount.mockResolvedValue(3);
    const r = res();
    await getTransaccionesDeOperacion(req({ skip: '2' }), r, vi.fn());
    expect(r.json.mock.calls[0][0].data.hasMore).toBe(false);
  });

  it('si la operación no es del usuario devuelve 404 y no consulta transacciones', async () => {
    opFindOne.mockReturnValue(encadenable(null));
    const next = vi.fn();
    await getTransaccionesDeOperacion(req(), res(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(txFind).not.toHaveBeenCalled();
  });
});
