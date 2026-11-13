import { describe, it, expect, vi, beforeEach } from 'vitest';

let docs = [];
const filtros = [];
vi.mock('../models/IngestDocument.js', () => ({
  default: { find: (filtro) => { filtros.push(filtro); return { select: () => ({ lean: async () => docs }) }; } }
}));

const { marcarPagosTarjeta } = await import('./pagoTarjetaService.js');

const req = { user: { _id: '64b000000000000000000001' } };
const pago = (extra = {}) => ({ fecha: '05/10/2026', tipo: 'Gasto', origen: 'Banco Galicia', moneda: 'ARS', importe: 100000, detalle: 'PAGO TARJETA VISA', categoria: 'Otros', ...extra });
const doc = (extra = {}) => ({ _id: 'd1', filename: 'visa-sep.pdf', operation_id: 'op1', deteccion: { producto: 'visa', cierre: '2026-09-24', totales: { total: { ars: 100000 } } }, ...extra });

beforeEach(() => { docs = []; filtros.length = 0; });

describe('marcarPagosTarjeta', () => {
  it('sin pagos de tarjeta no consulta la base', async () => {
    const ts = [{ tipo: 'Gasto', origen: 'Banco Galicia', detalle: 'COMPRA DEBITO' }];
    expect(await marcarPagosTarjeta(req, ts)).toBe(ts);
    expect(filtros).toHaveLength(0);
  });

  it('con el resumen importado: movimiento interno y a qué resumen corresponde (filtrado por usuario)', async () => {
    docs = [doc()];
    const [t] = await marcarPagosTarjeta(req, [pago()]);
    expect(t.categoria).toBe('Movimiento interno');
    expect(t.pago_tarjeta).toMatchObject({ estado: 'cubierto', resumen: { filename: 'visa-sep.pdf', operation_id: 'op1', total: 100000 } });
    expect(String(filtros[0].user_id)).toBe(req.user._id);
    expect(filtros[0]).toMatchObject({ estado: 'importado', 'deteccion.tipo': 'galicia', 'deteccion.tipoResumen': 'tarjeta' });
  });

  it('sin el resumen: pendiente y la categoría no se toca', async () => {
    const [t] = await marcarPagosTarjeta(req, [pago()]);
    expect(t.categoria).toBe('Otros');
    expect(t.pago_tarjeta).toEqual({ estado: 'pendiente', producto: 'visa' });
  });

  it('respeta una categoría que ya eligió una regla', async () => {
    docs = [doc()];
    const [t] = await marcarPagosTarjeta(req, [pago({ categoria: 'Servicios' })]);
    expect(t.categoria).toBe('Servicios');
    expect(t.pago_tarjeta.estado).toBe('cubierto');
  });

  it('ignora resúmenes sin total', async () => {
    docs = [doc({ deteccion: { producto: 'visa', cierre: '2026-09-24' } })];
    expect((await marcarPagosTarjeta(req, [pago()]))[0].pago_tarjeta.estado).toBe('pendiente');
  });
});
