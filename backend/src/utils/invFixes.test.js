import { describe, it, expect } from 'vitest';
import { fechaISO } from './investmentFromStatement.js';
import { movimientosDeExtractoSinUnidades } from './investmentValuation.js';

const mov = (tipo, fecha, extra = {}) => ({ tipo, fecha: new Date(`${fecha}T00:00:00Z`), monto: 1000, ...extra });

describe('fechaISO valida el calendario', () => {
  it('rechaza fechas que no existen', () => {
    expect(fechaISO('31/13/2025')).toBeNull();
    expect(fechaISO('30/02/2026')).toBeNull();
    expect(fechaISO('2026-02-30')).toBeNull();
    expect(fechaISO('28/02/2026')).toBe('2026-02-28');
  });
});

describe('movimientosDeExtractoSinUnidades (INV-09)', () => {
  const activo = { fuente_precio: 'cafci' };

  it('cuenta los del extracto sin cuotapartes cuando la tenencia queda incompleta', () => {
    const movs = [mov('Aporte', '2026-10-01', { unidades: 100 }), mov('Aporte', '2026-10-05', { origen: 'extracto' })];
    expect(movimientosDeExtractoSinUnidades(activo, movs)).toBe(1);
  });

  it('sin ningún dato de unidades también bloquea', () => {
    expect(movimientosDeExtractoSinUnidades(activo, [mov('Aporte', '2026-10-05', { origen: 'extracto' })])).toBe(1);
  });

  it('no bloquea si una valuación posterior con unidades ya fija la tenencia', () => {
    const movs = [mov('Aporte', '2026-10-05', { origen: 'extracto' }), mov('Valuacion', '2026-10-10', { unidades: 120 })];
    expect(movimientosDeExtractoSinUnidades(activo, movs)).toBe(0);
  });

  it('no bloquea si las unidades las cargó a mano el usuario en el activo', () => {
    expect(movimientosDeExtractoSinUnidades({ ...activo, unidades: 50 }, [mov('Aporte', '2026-10-05', { origen: 'extracto' })])).toBe(0);
  });

  it('ignora los movimientos que no son del extracto', () => {
    expect(movimientosDeExtractoSinUnidades(activo, [mov('Aporte', '2026-10-05')])).toBe(0);
  });
});
