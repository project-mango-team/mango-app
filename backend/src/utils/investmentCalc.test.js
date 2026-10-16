import { describe, it, expect } from 'vitest';
import {
  convertirMonto,
  calcularValorActual,
  calcularResumenActivo,
  calcularTotalesPortfolio
} from './investmentCalc.js';

// Arma un movimiento con montos convertidos a la cotización indicada
const mov = (tipo, fecha, monto, moneda, cot, created = fecha) => ({
  tipo,
  fecha: new Date(`${fecha}T00:00:00Z`),
  created_at: new Date(`${created}T12:00:00Z`),
  monto,
  ...convertirMonto(monto, moneda, cot)
});

describe('convertirMonto', () => {
  it('convierte ARS a USD con la cotización', () => {
    expect(convertirMonto(150000, 'ARS', { usd: 1500 })).toEqual({ monto_ars: 150000, monto_usd: 100 });
  });

  it('deja USD tal cual y lo pasa a ARS', () => {
    expect(convertirMonto(100, 'USD', { usd: 1500 })).toEqual({ monto_ars: 150000, monto_usd: 100 });
  });

  it('convierte EUR pasando por ARS', () => {
    const r = convertirMonto(100, 'EUR', { usd: 1500, eur: 1800 });
    expect(r.monto_ars).toBe(180000);
    expect(r.monto_usd).toBe(120);
  });

  it('falla sin cotización EUR para un activo en EUR', () => {
    expect(() => convertirMonto(100, 'EUR', { usd: 1500 })).toThrow();
  });

  it('falla con cotización USD inválida', () => {
    expect(() => convertirMonto(100, 'ARS', { usd: 0 })).toThrow();
  });
});

describe('calcularValorActual', () => {
  const cot = { usd: 1000 };

  it('sin valuaciones suma aportes y resta retiros', () => {
    const movs = [
      mov('Aporte', '2025-01-01', 1000, 'USD', cot),
      mov('Retiro', '2025-02-01', 300, 'USD', cot),
      mov('Aporte', '2025-03-01', 50, 'USD', cot)
    ];
    expect(calcularValorActual(movs)).toBe(750);
  });

  it('una valuación pisa el valor y los flujos posteriores se suman encima', () => {
    const movs = [
      mov('Aporte', '2025-01-01', 1000, 'USD', cot),
      mov('Valuacion', '2025-06-01', 1100, 'USD', cot),
      mov('Aporte', '2025-07-01', 200, 'USD', cot)
    ];
    expect(calcularValorActual(movs)).toBe(1300);
  });

  it('ordena por fecha aunque lleguen desordenados', () => {
    const movs = [
      mov('Aporte', '2025-07-01', 200, 'USD', cot),
      mov('Valuacion', '2025-06-01', 1100, 'USD', cot),
      mov('Aporte', '2025-01-01', 1000, 'USD', cot)
    ];
    expect(calcularValorActual(movs)).toBe(1300);
  });

  it('dentro del mismo día respeta el orden de carga', () => {
    const movs = [
      mov('Valuacion', '2025-06-01', 1100, 'USD', cot, '2025-06-02'),
      mov('Aporte', '2025-06-01', 200, 'USD', cot, '2025-06-01')
    ];
    // El aporte se cargó antes, así que la valuación ya lo incluye
    expect(calcularValorActual(movs)).toBe(1100);
  });
});

describe('calcularResumenActivo', () => {
  it('activo en USD: ganancia no realizada por valuación', () => {
    const cot = { usd: 1000 };
    const movs = [
      mov('Aporte', '2025-01-01', 5088, 'USD', cot),
      mov('Valuacion', '2026-10-01', 5384, 'USD', cot)
    ];
    const r = calcularResumenActivo({ moneda: 'USD' }, movs, { usd: 1500 });
    expect(r.valor_actual_usd).toBe(5384);
    expect(r.ganancia_usd).toBe(296);
    expect(r.rendimiento_usd).toBeCloseTo(296 / 5088);
    expect(r.cerrado).toBe(false);
  });

  it('activo en ARS: rinde en pesos pero se mide contra el dólar de cada fecha', () => {
    // Aporto 1.000.000 ARS con dólar a 1000 (= 1000 USD)
    // Hoy vale 1.300.000 ARS pero el dólar está a 1500 (= 866,67 USD)
    const movs = [
      mov('Aporte', '2025-01-01', 1000000, 'ARS', { usd: 1000 }),
      mov('Valuacion', '2026-10-01', 1300000, 'ARS', { usd: 1500 })
    ];
    const r = calcularResumenActivo({ moneda: 'ARS' }, movs, { usd: 1500 });
    expect(r.ganancia_ars).toBe(300000);
    expect(r.rendimiento_ars).toBeCloseTo(0.3);
    expect(r.ganancia_usd).toBeCloseTo(-133.33, 2);
  });

  it('activo cerrado conserva la ganancia realizada', () => {
    const cot = { usd: 1000 };
    const movs = [
      mov('Aporte', '2025-01-01', 1000, 'USD', cot),
      mov('Valuacion', '2025-12-01', 1150, 'USD', cot),
      mov('Retiro', '2026-01-15', 1150, 'USD', cot)
    ];
    const r = calcularResumenActivo({ moneda: 'USD' }, movs, { usd: 1500 });
    expect(r.valor_actual_usd).toBe(0);
    expect(r.cerrado).toBe(true);
    expect(r.ganancia_usd).toBe(150);
    expect(r.rendimiento_usd).toBeCloseTo(0.15);
  });

  it('retiros parciales cuentan como ganancia realizada', () => {
    const cot = { usd: 1000 };
    const movs = [
      mov('Aporte', '2025-01-01', 1000, 'USD', cot),
      mov('Valuacion', '2025-06-01', 1200, 'USD', cot),
      mov('Retiro', '2025-06-02', 200, 'USD', cot)
    ];
    const r = calcularResumenActivo({ moneda: 'USD' }, movs, { usd: 1000 });
    expect(r.valor_actual_usd).toBe(1000);
    expect(r.retirado_usd).toBe(200);
    expect(r.ganancia_usd).toBe(200);
  });

  it('activo sin movimientos queda en cero y abierto', () => {
    const r = calcularResumenActivo({ moneda: 'USD' }, [], { usd: 1500 });
    expect(r.valor_actual_usd).toBe(0);
    expect(r.ganancia_usd).toBe(0);
    expect(r.rendimiento_usd).toBe(0);
    expect(r.cerrado).toBe(false);
  });

  it('activo en EUR usa la cotización del euro de hoy para el valor actual', () => {
    const movs = [mov('Aporte', '2025-01-01', 265, 'EUR', { usd: 1000, eur: 1100 })];
    const r = calcularResumenActivo({ moneda: 'EUR' }, movs, { usd: 1500, eur: 1700 });
    expect(r.valor_actual_ars).toBe(450500);
    expect(r.aportado_usd).toBeCloseTo(291.5, 1);
    expect(r.valor_actual_usd).toBeCloseTo(300.33, 2);
  });
});

describe('calcularTotalesPortfolio', () => {
  const resumen = (valor_usd, aportado_usd, extra = {}) => ({
    valor_actual_usd: valor_usd,
    valor_actual_ars: valor_usd * 1000,
    aportado_usd,
    aportado_ars: aportado_usd * 1000,
    ganancia_usd: valor_usd - aportado_usd,
    ganancia_ars: (valor_usd - aportado_usd) * 1000,
    cerrado: false,
    ...extra
  });
  const tipos = [{ nombre: 'FCI', liquido: true }, { nombre: 'ETF', liquido: false }];

  it('suma activos abiertos, separa liquidez y agrupa por tipo', () => {
    const { totales, por_tipo } = calcularTotalesPortfolio([
      { tipo: 'FCI', resumen: resumen(1100, 1000) },
      { tipo: 'FCI', resumen: resumen(500, 500) },
      { tipo: 'ETF', resumen: resumen(2000, 1500) },
      { tipo: 'ETF', resumen: resumen(0, 800, { cerrado: true, ganancia_usd: 100 }) }
    ], tipos);

    expect(totales.valor_usd).toBe(3600);
    expect(totales.liquidez_usd).toBe(1600);
    expect(totales.aportado_usd).toBe(3000);
    expect(totales.ganancia_usd).toBe(600);
    expect(totales.rendimiento_usd).toBeCloseTo(0.2);
    expect(por_tipo.map(t => [t.tipo, t.valor_usd, t.liquido])).toEqual([
      ['ETF', 2000, false],
      ['FCI', 1600, true]
    ]);
  });

  it('portfolio vacío da todo en cero', () => {
    const { totales, por_tipo } = calcularTotalesPortfolio([], tipos);
    expect(totales.valor_usd).toBe(0);
    expect(totales.rendimiento_usd).toBe(0);
    expect(por_tipo).toEqual([]);
  });
});
