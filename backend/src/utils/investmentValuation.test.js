import { describe, it, expect } from 'vitest';
import { calcularUnidades, parseUnidades, normalizarFuentePrecio, calcularValuacionPorPrecio, devengarTasaFija } from './investmentValuation.js';

const mov = (tipo, fecha, unidades, created = fecha) => ({
  tipo,
  fecha: new Date(`${fecha}T00:00:00Z`),
  created_at: new Date(`${created}T12:00:00Z`),
  monto: 1000,
  ...(unidades !== undefined && { unidades })
});

describe('calcularUnidades', () => {
  it('sin unidades en ningún lado devuelve null', () => {
    expect(calcularUnidades({}, [mov('Aporte', '2026-01-01')])).toEqual({ unidades: null, origen: null, incompletas: false });
  });

  it('usa las unidades manuales del activo si ningún movimiento las trae', () => {
    expect(calcularUnidades({ unidades: 0.5 }, [mov('Aporte', '2026-01-01')]))
      .toEqual({ unidades: 0.5, origen: 'manual', incompletas: false });
  });

  it('suma aportes y resta retiros en cualquier orden de entrada', () => {
    const movs = [mov('Retiro', '2026-03-01', 120.5), mov('Aporte', '2026-01-01', 1250), mov('Aporte', '2026-02-01', 100.25)];
    expect(calcularUnidades({ unidades: 99 }, movs)).toEqual({ unidades: 1229.75, origen: 'movimientos', incompletas: false });
  });

  it('una valuación con unidades fija la tenencia', () => {
    const movs = [mov('Aporte', '2026-01-01', 10), mov('Valuacion', '2026-02-01', 50), mov('Aporte', '2026-03-01', 5)];
    expect(calcularUnidades({}, movs).unidades).toBe(55);
  });

  it('las valuaciones sin unidades no cambian la cuenta', () => {
    const movs = [mov('Aporte', '2026-01-01', 10), mov('Valuacion', '2026-02-01')];
    expect(calcularUnidades({}, movs)).toEqual({ unidades: 10, origen: 'movimientos', incompletas: false });
  });

  it('marca incompletas si hay aportes o retiros sin unidades', () => {
    expect(calcularUnidades({}, [mov('Aporte', '2026-01-01', 10), mov('Retiro', '2026-02-01')]).incompletas).toBe(true);
    expect(calcularUnidades({}, [mov('Aporte', '2026-01-01'), mov('Aporte', '2026-02-01', 10)]).incompletas).toBe(true);
  });

  it('una valuación con unidades posterior completa la cuenta', () => {
    const movs = [mov('Aporte', '2026-01-01'), mov('Aporte', '2026-02-01', 10), mov('Valuacion', '2026-03-01', 25)];
    expect(calcularUnidades({}, movs)).toEqual({ unidades: 25, origen: 'movimientos', incompletas: false });
  });

  it('redondea el ruido de punto flotante', () => {
    const movs = [mov('Aporte', '2026-01-01', 0.1), mov('Aporte', '2026-01-02', 0.2), mov('Retiro', '2026-01-03', 0.3)];
    expect(calcularUnidades({}, movs).unidades).toBe(0);
  });
});

describe('parseUnidades', () => {
  it('distingue ausente, vacío y número', () => {
    expect(parseUnidades(undefined)).toBeUndefined();
    expect(parseUnidades('')).toBeNull();
    expect(parseUnidades(null)).toBeNull();
    expect(parseUnidades('208.4')).toBe(208.4);
  });

  it('rechaza negativos y texto', () => {
    expect(() => parseUnidades(-1)).toThrow(/unidades/);
    expect(() => parseUnidades('abc')).toThrow(/unidades/);
  });
});

describe('normalizarFuentePrecio', () => {
  it('manual por defecto, sin parámetros', () => {
    expect(normalizarFuentePrecio(undefined, { ticker: 'SPY' })).toEqual({ fuente_precio: 'manual', precio_config: {} });
  });

  it('se queda solo con los parámetros de la fuente elegida', () => {
    expect(normalizarFuentePrecio('ticker', { ticker: ' spy ', coingecko_id: 'bitcoin' }))
      .toEqual({ fuente_precio: 'ticker', precio_config: { ticker: 'SPY' } });
    expect(normalizarFuentePrecio('coingecko', { coingecko_id: 'Bitcoin' }))
      .toEqual({ fuente_precio: 'coingecko', precio_config: { coingecko_id: 'bitcoin' } });
    expect(normalizarFuentePrecio('tasa_fija', { tasa_anual: '8.5' }))
      .toEqual({ fuente_precio: 'tasa_fija', precio_config: { tasa_anual: 8.5 } });
    expect(normalizarFuentePrecio('cafci', { fci_nombre: 'Fondo X - Clase A', fci_categoria: 'mercadoDinero' }))
      .toEqual({ fuente_precio: 'cafci', precio_config: { fci_nombre: 'Fondo X - Clase A', fci_categoria: 'mercadoDinero' } });
  });

  it('valida los parámetros obligatorios', () => {
    expect(() => normalizarFuentePrecio('bolsa')).toThrow(/Fuente de precio inválida/);
    expect(() => normalizarFuentePrecio('ticker', {})).toThrow(/ticker/);
    expect(() => normalizarFuentePrecio('coingecko', { coingecko_id: ' ' })).toThrow(/CoinGecko/);
    expect(() => normalizarFuentePrecio('tasa_fija', { tasa_anual: '' })).toThrow(/tasa anual/);
    expect(() => normalizarFuentePrecio('tasa_fija', { tasa_anual: -1 })).toThrow(/tasa anual/);
    expect(() => normalizarFuentePrecio('cafci', { fci_nombre: 'X' })).toThrow(/Categoría/);
    expect(() => normalizarFuentePrecio('cafci', { fci_categoria: 'rentaFija' })).toThrow(/fondo/);
  });
});

describe('calcularValuacionPorPrecio', () => {
  const movs = [mov('Aporte', '2026-10-01', 1000), mov('Retiro', '2026-10-10', 200), mov('Aporte', '2026-10-17', 500)];

  it('unidades a la fecha del precio × precio, redondeado a centavos', () => {
    expect(calcularValuacionPorPrecio({}, movs, { precio: 86.021448, fecha: '2026-10-16' }))
      .toEqual({ fecha: '2026-10-16', precio: 86.021448, unidades: 800, monto: 68817.16 });
  });

  it('cuenta los movimientos del mismo día del precio', () => {
    expect(calcularValuacionPorPrecio({}, movs, { precio: 1, fecha: '2026-10-17' }).unidades).toBe(1300);
  });

  it('usa las unidades manuales si los movimientos no traen', () => {
    expect(calcularValuacionPorPrecio({ unidades: 0.5 }, [mov('Aporte', '2026-10-01')], { precio: 60000, fecha: '2026-10-16' }).monto)
      .toBe(30000);
  });

  it('sin unidades o sin precio válido, falla con un mensaje claro', () => {
    expect(() => calcularValuacionPorPrecio({}, [], { precio: 10, fecha: '2026-10-16' })).toThrow(/Faltan las unidades/);
    expect(() => calcularValuacionPorPrecio({ unidades: 1 }, [], { precio: 0, fecha: '2026-10-16' })).toThrow(/precio válido/);
  });
});

describe('devengarTasaFija', () => {
  const m = (tipo, fecha, monto, created = fecha) => ({ ...mov(tipo, fecha, undefined, created), monto });

  it('devenga interés compuesto diario desde el aporte', () => {
    // 1000 al 10% anual durante 365 días: (1 + 0,1/365)^365 = 1,10516
    expect(devengarTasaFija([m('Aporte', '2025-01-01', 1000)], 10, '2026-01-01')).toBe(1105.16);
  });

  it('aportes y retiros posteriores mueven la base', () => {
    const movs = [m('Aporte', '2026-01-01', 1000), m('Aporte', '2026-01-11', 500), m('Retiro', '2026-01-21', 200)];
    const tasaDiaria = 0.0365 / 365;
    const esperado = ((1000 * (1 + tasaDiaria) ** 10 + 500) * (1 + tasaDiaria) ** 10 - 200) * (1 + tasaDiaria) ** 10;
    expect(devengarTasaFija(movs, 3.65, '2026-01-31')).toBe(Math.round(esperado * 100) / 100);
  });

  it('una valuación fija el valor desde ahí', () => {
    const movs = [m('Aporte', '2026-01-01', 1000), m('Valuacion', '2026-06-01', 2000)];
    expect(devengarTasaFija(movs, 0, '2026-10-01')).toBe(2000);
  });

  it('ignora movimientos posteriores a la fecha y no devuelve negativos', () => {
    expect(devengarTasaFija([m('Aporte', '2026-01-01', 1000), m('Aporte', '2026-12-01', 5)], 0, '2026-06-01')).toBe(1000);
    expect(devengarTasaFija([m('Retiro', '2026-01-01', 10)], 5, '2026-06-01')).toBe(0);
    expect(devengarTasaFija([], 5, '2026-06-01')).toBe(0);
  });
});
