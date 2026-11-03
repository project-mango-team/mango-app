import { describe, it, expect } from 'vitest';
import { esPagoTarjetaMP, pagosDeTarjeta, CATEGORIA_PAGO_TARJETA } from './pagoTarjeta.js';

describe('esPagoTarjetaMP', () => {
  it('reconoce el pago automático y el manual, con o sin tildes y mayúsculas', () => {
    expect(esPagoTarjetaMP('Pago automático Tarjeta de crédito')).toBe(true);
    expect(esPagoTarjetaMP('Pago Tarjeta de crédito')).toBe(true);
    expect(esPagoTarjetaMP('  PAGO AUTOMATICO   TARJETA DE CREDITO ')).toBe(true);
    expect(esPagoTarjetaMP('Pago de la tarjeta de crédito')).toBe(true);
  });

  it('no confunde consumos ni otros pagos', () => {
    expect(esPagoTarjetaMP('Tarjeta de crédito Kiosco')).toBe(false);
    expect(esPagoTarjetaMP('Pago con tarjeta de crédito en Kiosco')).toBe(false);
    expect(esPagoTarjetaMP('Pago de servicios')).toBe(false);
    expect(esPagoTarjetaMP('Transferencia enviada tarjeta de crédito')).toBe(false);
    expect(esPagoTarjetaMP('Pago Tarjeta de crédito Visa Galicia')).toBe(true);
  });

  it('tolera valores vacíos', () => {
    expect(esPagoTarjetaMP('')).toBe(false);
    expect(esPagoTarjetaMP(undefined)).toBe(false);
  });
});

describe('pagosDeTarjeta', () => {
  it('toma solo los gastos de la cuenta de Mercado Pago', () => {
    const lista = [
      { detalle: 'Pago automático Tarjeta de crédito', tipo: 'Gasto', origen: 'Mercado Pago' },
      { detalle: 'Pago automático Tarjeta de crédito', tipo: 'Ingreso', origen: 'Mercado Pago' },
      { detalle: 'Pago automático Tarjeta de crédito', tipo: 'Gasto', origen: 'Santander' },
      { detalle: 'Compra en Kiosco', tipo: 'Gasto', origen: 'Mercado Pago' }
    ];
    expect(pagosDeTarjeta(lista)).toEqual([lista[0]]);
  });

  it('la categoría del pago es Movimiento interno', () => {
    expect(CATEGORIA_PAGO_TARJETA).toBe('Movimiento interno');
  });
});
