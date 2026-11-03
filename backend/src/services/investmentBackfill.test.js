import { describe, it, expect, vi, beforeEach } from 'vitest';

const ACTIVO = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTRO = 'dddddddddddddddddddddddd';
const asset = { _id: ACTIVO, nombre: 'Fima Premium', moneda: 'ARS' };

let transacciones = [];
let movimientos = [];
let reglas = [];
const filtrosTransaction = [];
const insertMany = vi.fn(async (docs) => docs);

const cadena = (datos) => {
  const q = { sort: () => q, limit: () => q, select: () => q, lean: async () => datos() };
  return q;
};
vi.mock('../models/Transaction.js', () => ({
  default: { find: (filtro) => { filtrosTransaction.push(filtro); return cadena(() => (filtro._id ? transacciones.filter(t => filtro._id.$in.includes(String(t._id))) : transacciones)); } }
}));
vi.mock('../models/InvestmentMovement.js', () => ({
  default: { find: () => cadena(() => movimientos), insertMany: (...a) => insertMany(...a) }
}));
vi.mock('../models/InvestmentAsset.js', () => ({
  default: { find: () => cadena(() => [asset]) }
}));
vi.mock('./ruleService.js', () => ({ reglasDelUsuario: async () => reglas }));
vi.mock('./investmentQuoteService.js', () => ({
  crearCotizacionesEn: vi.fn(async () => ({ cotizacionesEn: () => ({ usd: 1500 }) }))
}));

const { candidatasDeBackfill, cargarBackfill } = await import('./investmentLinkService.js');

const req = { user: { _id: '64b000000000000000000001' } };
const regla = (extra = {}) => ({
  _id: 'r1', orden: 0, activa: true,
  condiciones: { detalle: { modo: 'contiene', valores: ['FIMA'] } },
  accion: { tipo: 'inversion', categoria: 'Inversión', activo_id: ACTIVO },
  ...extra
});
const tx = (id, extra = {}) => ({ _id: id, fecha: '05/10/2026', detalle: 'SUSCRIPCION FIMA PREMIUM', tipo: 'Gasto', moneda: 'ARS', importe: 50000, monto_original: 50000, categoria: 'Inversión', origen: 'Banco Galicia', ...extra });

beforeEach(() => {
  transacciones = [];
  movimientos = [];
  reglas = [regla()];
  filtrosTransaction.length = 0;
  insertMany.mockClear();
});

describe('candidatasDeBackfill', () => {
  it('sin regla para este activo no busca nada', async () => {
    reglas = [regla({ accion: { tipo: 'inversion', activo_id: OTRO } })];
    transacciones = [tx('t1')];
    expect(await candidatasDeBackfill(req, asset)).toEqual({ candidatas: [], reglas: 0 });
    expect(filtrosTransaction).toHaveLength(0);
  });

  it('toma las Inversión que matchean la regla y busca solo entre las del usuario', async () => {
    transacciones = [tx('t1'), tx('t2', { detalle: 'OTRA COSA' })];
    const { candidatas } = await candidatasDeBackfill(req, asset);
    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]).toMatchObject({ transaction_id: 't1', tipo: 'Aporte', monto: 50000, crear: true, duplicado: null, error: null });
    expect(String(filtrosTransaction[0].user_id)).toBe(req.user._id);
    expect(filtrosTransaction[0].categoria).toBe('Inversión');
  });

  it('respeta el orden de las reglas: si gana otra regla antes, no es de este activo', async () => {
    reglas = [regla({ _id: 'r0', orden: 0, accion: { tipo: 'inversion', activo_id: OTRO } }), regla({ _id: 'r1', orden: 1 })];
    // r0 es de otro activo y también matchea FIMA: gana r0, así que esta transacción no es de este activo
    reglas.push({ _id: 'r2', orden: 2, activa: true, condiciones: { detalle: { modo: 'contiene', valores: ['FIMA'] } }, accion: { tipo: 'inversion', activo_id: ACTIVO } });
    transacciones = [tx('t1')];
    expect((await candidatasDeBackfill(req, asset)).candidatas).toHaveLength(0);
  });

  it('no ofrece las que ya tienen un movimiento vinculado y marca las equivalentes a uno ya cargado', async () => {
    transacciones = [tx('t1'), tx('t2', { fecha: '12/10/2026', importe: 7000, monto_original: 7000 }), tx('t3', { fecha: '20/10/2026', importe: 9000, monto_original: 9000 })];
    movimientos = [
      { fecha: new Date('2026-10-05T00:00:00Z'), tipo: 'Aporte', monto: 50000, transaction_id: 't1' },
      { fecha: new Date('2026-10-14T00:00:00Z'), tipo: 'Aporte', monto: 7000 }
    ];
    const { candidatas } = await candidatasDeBackfill(req, asset);
    expect(candidatas.map(c => c.transaction_id)).toEqual(['t2', 't3']);
    expect(candidatas[0]).toMatchObject({ crear: false, duplicado: { fecha: '2026-10-14' } });
    expect(candidatas[1].crear).toBe(true);
  });

  it('una moneda distinta a la del activo es un error y no se ofrece crear', async () => {
    transacciones = [tx('t1', { moneda: 'USD', monto_original: 10 })];
    const { candidatas } = await candidatasDeBackfill(req, asset);
    expect(candidatas[0]).toMatchObject({ crear: false, error: expect.stringMatching(/USD/) });
  });
});

describe('cargarBackfill', () => {
  it('crea solo las elegidas que siguen siendo válidas, con transaction_id y sin operation_id', async () => {
    transacciones = [tx('t1'), tx('t2', { fecha: '06/10/2026', importe: 8000, monto_original: 8000 })];
    const aviso = await cargarBackfill(req, asset, ['t2', 'no-existe']);
    expect(aviso).toMatchObject({ creados: 1, omitidas: 1 });
    const [doc] = insertMany.mock.calls[0][0];
    expect(doc).toMatchObject({ origen: 'extracto', transaction_id: 't2', monto: 8000, tipo: 'Aporte' });
    expect(doc.operation_id).toBeUndefined();
    expect(String(doc.user_id)).toBe(req.user._id);
  });

  it('no crea las que ya están cargadas aunque el cliente las pida', async () => {
    transacciones = [tx('t1')];
    movimientos = [{ fecha: new Date('2026-10-05T00:00:00Z'), tipo: 'Aporte', monto: 50000 }];
    const aviso = await cargarBackfill(req, asset, ['t1']);
    expect(aviso).toMatchObject({ creados: 0, omitidas: 1 });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('sin regla del activo no crea nada, por más ids que mande el cliente', async () => {
    reglas = [];
    transacciones = [tx('t1')];
    expect(await cargarBackfill(req, asset, ['t1'])).toMatchObject({ creados: 0 });
    expect(insertMany).not.toHaveBeenCalled();
  });
});
