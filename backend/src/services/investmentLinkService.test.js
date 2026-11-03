import { describe, it, expect, vi, beforeEach } from 'vitest';

const ACTIVO = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const AJENO = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const deleteMany = vi.fn(async () => ({ deletedCount: 2 }));
const updateMany = vi.fn(async () => ({ modifiedCount: 1 }));
const insertMany = vi.fn(async (docs) => docs);
let movimientosExistentes = [];
const consultaMovimientos = vi.fn((filtro) => ({ select: () => ({ lean: async () => movimientosExistentes }), filtro }));
vi.mock('../models/InvestmentMovement.js', () => ({
  default: {
    deleteMany: (...a) => deleteMany(...a),
    updateMany: (...a) => updateMany(...a),
    insertMany: (...a) => insertMany(...a),
    find: (...a) => consultaMovimientos(...a)
  }
}));

// Solo el activo ACTIVO es del usuario (el filtro por user_id lo hace buildUserQuery; acá se simula el resultado)
const consultaActivos = vi.fn((filtro) => ({
  select: () => ({
    lean: async () => filtro._id.$in.filter(id => id === ACTIVO).map(id => ({ _id: id, nombre: 'Fima Premium', moneda: 'ARS' }))
  })
}));
vi.mock('../models/InvestmentAsset.js', () => ({ default: { find: (...a) => consultaActivos(...a) } }));
vi.mock('./investmentQuoteService.js', () => ({
  crearCotizacionesEn: vi.fn(async () => ({ cotizacionesEn: () => ({ usd: 1500 }) }))
}));

const { revertirMovimientosDeOperacion, marcarInversionesSugeridas, crearMovimientosDeExtracto } = await import('./investmentLinkService.js');

const req = { user: { _id: '64b000000000000000000001' } };
const tx = (extra = {}) => ({
  _id: 't1', fecha: '05/10/2026', tipo: 'Gasto', moneda: 'ARS', importe: 50000, monto_original: 50000, categoria: 'Inversión',
  inversion: { activo_id: ACTIVO, crear: true }, ...extra
});

beforeEach(() => {
  deleteMany.mockClear();
  updateMany.mockClear();
  insertMany.mockClear();
  consultaActivos.mockClear();
  consultaMovimientos.mockClear();
  movimientosExistentes = [];
});

describe('revertirMovimientosDeOperacion', () => {
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

describe('marcarInversionesSugeridas', () => {
  it('sin reglas de inversión no consulta nada', async () => {
    const ts = [{ detalle: 'x', tipo: 'Gasto' }];
    expect(await marcarInversionesSugeridas(req, ts)).toBe(ts);
    expect(consultaActivos).not.toHaveBeenCalled();
  });

  it('sugiere el aporte y busca el activo solo entre los del usuario', async () => {
    const [t] = await marcarInversionesSugeridas(req, [tx({ inversion: { activo_id: ACTIVO } })]);
    expect(t.inversion).toMatchObject({ activo_nombre: 'Fima Premium', tipo: 'Aporte', monto: 50000, crear: true, duplicado: null, error: null });
    expect(String(consultaActivos.mock.calls[0][0].user_id)).toBe(req.user._id);
    expect(String(consultaMovimientos.mock.calls[0][0].user_id)).toBe(req.user._id);
  });

  it('avisa el movimiento ya cargado (±3 días) y no sugiere crearlo', async () => {
    movimientosExistentes = [{ asset_id: ACTIVO, fecha: new Date('2026-10-07T00:00:00Z'), tipo: 'Aporte', monto: 50000 }];
    const [t] = await marcarInversionesSugeridas(req, [tx({ inversion: { activo_id: ACTIVO } })]);
    expect(t.inversion).toMatchObject({ crear: false, duplicado: { fecha: '2026-10-07' } });
  });

  it('un activo ajeno da error y no se crea', async () => {
    const [t] = await marcarInversionesSugeridas(req, [tx({ inversion: { activo_id: AJENO } })]);
    expect(t.inversion).toMatchObject({ crear: false, error: expect.stringMatching(/ya no existe/) });
  });

  it('una fila duplicada o ignorada no se ofrece', async () => {
    const [t] = await marcarInversionesSugeridas(req, [tx({ duplicado: true, inversion: { activo_id: ACTIVO } })]);
    expect(t.inversion.crear).toBe(false);
  });
});

describe('crearMovimientosDeExtracto', () => {
  it('crea el movimiento con origen extracto, operación y transacción', async () => {
    const aviso = await crearMovimientosDeExtracto(req, [tx()], 'op-9');
    expect(aviso).toEqual({ creados: 1, duplicados: 0, errores: [] });
    const [doc] = insertMany.mock.calls[0][0];
    expect(doc).toMatchObject({ tipo: 'Aporte', monto: 50000, origen: 'extracto', operation_id: 'op-9', transaction_id: 't1', cotizacion_usd: 1500 });
    expect(String(doc.asset_id)).toBe(ACTIVO);
    expect(String(doc.user_id)).toBe(req.user._id);
    expect(doc.fecha.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('solo crea las que el usuario tildó', async () => {
    expect(await crearMovimientosDeExtracto(req, [tx({ inversion: { activo_id: ACTIVO, crear: false } })], 'op')).toBeNull();
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('no duplica un movimiento ya cargado', async () => {
    movimientosExistentes = [{ asset_id: ACTIVO, fecha: new Date('2026-10-04T00:00:00Z'), tipo: 'Aporte', monto: 50000 }];
    const aviso = await crearMovimientosDeExtracto(req, [tx()], 'op');
    expect(aviso).toEqual({ creados: 0, duplicados: 1, errores: [] });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('un activo ajeno nunca se carga (el cliente manda el id)', async () => {
    const aviso = await crearMovimientosDeExtracto(req, [tx({ inversion: { activo_id: AJENO, crear: true } })], 'op');
    expect(aviso.creados).toBe(0);
    expect(aviso.errores).toHaveLength(1);
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('si el guardado falla no tira: avisa', async () => {
    insertMany.mockRejectedValueOnce(new Error('db caída'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const aviso = await crearMovimientosDeExtracto(req, [tx()], 'op');
    expect(aviso.creados).toBe(0);
    expect(aviso.errores[0]).toMatch(/No se pudieron cargar/);
    spy.mockRestore();
  });
});
