import { describe, it, expect, vi, beforeEach } from 'vitest';

let existentes = [];
const consultas = [];
const insertMany = vi.fn(async (docs) => docs);
const deleteMany = vi.fn(async () => ({ deletedCount: 2 }));
vi.mock('../models/LoanMovement.js', () => ({
  default: {
    find: (filtro) => { consultas.push(filtro); return { select: () => ({ lean: async () => existentes }) }; },
    insertMany: (...a) => insertMany(...a),
    deleteMany: (...a) => deleteMany(...a)
  }
}));
vi.mock('./dolarService.js', () => ({
  DolarService: { getBlue: vi.fn(async () => ({ promedio: 1000 })) }
}));

const { marcarPrestamosSugeridos, crearPrestamosDeExtracto, revertirPrestamosDeOperacion, textoAvisoPrestamos } = await import('./loanLinkService.js');

const req = { user: { _id: '64b000000000000000000001' } };
const tx = (extra = {}) => ({
  _id: 't1', fecha: '05/10/2026', tipo: 'Gasto', moneda: 'ARS', importe: 100000, monto_original: 100000,
  categoria: 'Préstamo', prestamo: { deudor: 'Juan Perez', crear: true }, ...extra
});

beforeEach(() => {
  existentes = [];
  consultas.length = 0;
  insertMany.mockClear();
  deleteMany.mockClear();
});

describe('marcarPrestamosSugeridos', () => {
  it('sin marcas de préstamo no consulta nada', async () => {
    const ts = [{ detalle: 'x', tipo: 'Gasto' }];
    expect(await marcarPrestamosSugeridos(req, ts)).toBe(ts);
    expect(consultas).toHaveLength(0);
  });

  it('sugiere el préstamo del deudor de la regla, buscando solo entre los del usuario', async () => {
    const [t] = await marcarPrestamosSugeridos(req, [tx({ prestamo: { deudor: 'Juan Perez' } })]);
    expect(t.prestamo).toMatchObject({ deudor: 'Juan Perez', tipo: 'Prestamo', monto: 100000, moneda: 'ARS', crear: true, duplicado: null, error: null });
    expect(String(consultas[0].user_id)).toBe(req.user._id);
  });

  it('avisa lo ya registrado y no ofrece crearlo; una fila duplicada tampoco se ofrece', async () => {
    existentes = [{ deudor: 'juan perez', tipo: 'Prestamo', moneda: 'ARS', fecha: new Date('2026-10-06T00:00:00Z'), monto: 100000, monto_usd: 100 }];
    const [a] = await marcarPrestamosSugeridos(req, [tx()]);
    expect(a.prestamo).toMatchObject({ crear: false, duplicado: { fecha: '2026-10-06' } });
    existentes = [];
    const [b] = await marcarPrestamosSugeridos(req, [tx({ duplicado: true })]);
    expect(b.prestamo.crear).toBe(false);
  });
});

describe('crearPrestamosDeExtracto', () => {
  it('crea el movimiento con origen extracto, operación, transacción y usuario', async () => {
    const aviso = await crearPrestamosDeExtracto(req, [tx()], 'op-1');
    expect(aviso).toEqual({ creados: 1, duplicados: 0, errores: [] });
    const [doc] = insertMany.mock.calls[0][0];
    expect(doc).toMatchObject({ deudor: 'Juan Perez', tipo: 'Prestamo', moneda: 'ARS', monto: 100000, monto_usd: 100, cotizacion_usd: 1000, origen: 'extracto', operation_id: 'op-1', transaction_id: 't1' });
    expect(String(doc.user_id)).toBe(req.user._id);
  });

  it('solo las tildadas y que siguen siendo Préstamo', async () => {
    expect(await crearPrestamosDeExtracto(req, [tx({ prestamo: { deudor: 'Juan', crear: false } })], 'op')).toBeNull();
    expect(await crearPrestamosDeExtracto(req, [tx({ categoria: 'Comida' })], 'op')).toBeNull();
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('no duplica lo ya registrado', async () => {
    existentes = [{ deudor: 'Juan Perez', tipo: 'Prestamo', moneda: 'ARS', fecha: new Date('2026-10-05T00:00:00Z'), monto: 100000, monto_usd: 100 }];
    expect(await crearPrestamosDeExtracto(req, [tx()], 'op')).toEqual({ creados: 0, duplicados: 1, errores: [] });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('una devolución mayor al saldo da error y no se crea', async () => {
    const aviso = await crearPrestamosDeExtracto(req, [tx({ tipo: 'Ingreso' })], 'op');
    expect(aviso.creados).toBe(0);
    expect(aviso.errores[0]).toMatch(/supera/);
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('si el guardado falla no tira: avisa', async () => {
    insertMany.mockRejectedValueOnce(new Error('db caída'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const aviso = await crearPrestamosDeExtracto(req, [tx()], 'op');
    expect(aviso.creados).toBe(0);
    expect(aviso.errores[0]).toMatch(/No se pudieron registrar/);
    spy.mockRestore();
  });
});

describe('revertirPrestamosDeOperacion y texto del aviso', () => {
  it('borra solo los del extracto de esa operación y del usuario', async () => {
    expect(await revertirPrestamosDeOperacion(req, 'op-1')).toEqual({ borrados: 2 });
    const [filtro] = deleteMany.mock.calls[0];
    expect(String(filtro.user_id)).toBe(req.user._id);
    expect(filtro).toMatchObject({ operation_id: 'op-1', origen: 'extracto' });
  });

  it('sin operación no toca nada', async () => {
    expect(await revertirPrestamosDeOperacion(req, undefined)).toEqual({ borrados: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('resume lo creado, lo ya registrado y los errores', () => {
    expect(textoAvisoPrestamos(null)).toBe('');
    expect(textoAvisoPrestamos({ creados: 1, duplicados: 0, errores: [] })).toBe('. Se registraron 1 movimiento en Préstamos');
    expect(textoAvisoPrestamos({ creados: 2, duplicados: 1, errores: [] })).toBe('. Se registraron 2 movimientos en Préstamos. 1 ya estaba registrado');
    expect(textoAvisoPrestamos({ creados: 0, duplicados: 0, errores: ['x'] })).toBe('. No se pudo registrar en Préstamos: x');
  });
});
