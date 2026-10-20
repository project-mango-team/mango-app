import { describe, it, expect } from 'vitest';
import {
  leerReporteLiberaciones, montoDelReporte, fechaDelReporte, detalleMovimiento,
  movimientosDelReporte, csvParaBandeja, nombreArchivoSync
} from './mercadoPagoMapping.js';
import { MercadoPagoParser } from '../parsers/MercadoPagoParser.js';

// Reporte de liberaciones sintético, con el formato de la API (encabezados en inglés, punto decimal)
const REPORTE = [
  'DATE,SOURCE_ID,RECORD_TYPE,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,BALANCE_AMOUNT,CURRENCY',
  '2026-10-01T00:00:00.000-03:00,,initial_available_balance,,1000.00,0.00,1000.00,ARS',
  '2026-10-01T09:10:00.000-03:00,1000000000001,release,asset_management_gain,2.50,0.00,1002.50,ARS',
  '2026-10-02T13:00:00.000-03:00,1000000000002,release,payment,0.00,250.75,751.75,ARS',
  '2026-10-03T18:30:00.000-03:00,1000000000003,release,payment,1500.00,0.00,2251.75,ARS',
  '2026-10-04T10:00:00.000-03:00,1000000000004,release,payout,0.00,200.00,2051.75,ARS',
  '2026-10-04T10:00:00.000-03:00,,available_balance,pre_payout_1000000000004,0.00,0.00,2051.75,ARS',
  '2026-10-05T10:00:00.000-03:00,1000000000005,release,tax_withholding_payer,0.00,0.00,2051.75,ARS',
  '2026-10-05T11:00:00.000-03:00,1000000000006,release,"cosa_nueva",3.00,0.00,2054.75,ARS',
  '2026-10-06T11:00:00.000-03:00,1000000000007,release,payment,10.00,0.00,,USD',
  '2026-10-06T23:59:59.000-03:00,,total,,1059.75,450.75,2054.75,ARS'
].join('\n');

describe('leerReporteLiberaciones', () => {
  it('lee las filas con las claves del encabezado y respeta comillas', () => {
    const filas = leerReporteLiberaciones(REPORTE);
    expect(filas).toHaveLength(10);
    expect(filas[7].DESCRIPTION).toBe('cosa_nueva');
    expect(filas[1]).toMatchObject({ SOURCE_ID: '1000000000001', DESCRIPTION: 'asset_management_gain' });
  });

  it('acepta ";" como separador y BOM', () => {
    const filas = leerReporteLiberaciones('﻿date;description;net_credit_amount\n2026-10-01;"a;b";1.00');
    expect(filas[0]).toEqual({ DATE: '2026-10-01', DESCRIPTION: 'a;b', NET_CREDIT_AMOUNT: '1.00' });
  });

  it('rechaza un CSV que no es el reporte', () => {
    expect(() => leerReporteLiberaciones('A,B\n1,2')).toThrow(/DATE y DESCRIPTION/);
    expect(leerReporteLiberaciones('')).toEqual([]);
  });
});

describe('conversiones', () => {
  it('montos con punto decimal o formato argentino', () => {
    expect(montoDelReporte('1234.56')).toBe(1234.56);
    expect(montoDelReporte('1.234,56')).toBe(1234.56);
    expect(montoDelReporte('')).toBe(0);
    expect(montoDelReporte('abc')).toBe(0);
  });

  it('fechas a DD-MM-YYYY tomando el día tal cual viene', () => {
    expect(fechaDelReporte('2026-10-01T23:30:00.000-03:00')).toBe('01-10-2026');
    expect(fechaDelReporte('2026-10-01')).toBe('01-10-2026');
    expect(fechaDelReporte('01/10/2026')).toBe('01-10-2026');
    expect(fechaDelReporte('ayer')).toBeNull();
  });

  it('detalle según el código y el sentido del monto', () => {
    expect(detalleMovimiento('asset_management_gain', 2)).toBe('Rendimientos');
    expect(detalleMovimiento('payment', 10)).toBe('Pago recibido');
    expect(detalleMovimiento('PAYMENT', -10)).toBe('Pago');
    expect(detalleMovimiento('tax_withholding_payer', -1)).toBe('Retención de impuestos');
    expect(detalleMovimiento('tax_iva', -1)).toBe('Impuesto');
    expect(detalleMovimiento('reserve_for_refund', -1)).toBe('Reserva de dinero');
    expect(detalleMovimiento('cosa_nueva', 1)).toBe('Mercado Pago cosa_nueva');
    expect(detalleMovimiento('', 1)).toBe('Movimiento Mercado Pago');
  });
});

describe('movimientosDelReporte', () => {
  const { movimientos, saldoInicial, otrasMonedas } = movimientosDelReporte(leerReporteLiberaciones(REPORTE));

  it('saca las filas de saldo, las de monto cero y las de otra moneda', () => {
    expect(movimientos.map(m => m.referencia)).toEqual([
      '1000000000001', '1000000000002', '1000000000003', '1000000000004', '1000000000006'
    ]);
    expect(otrasMonedas).toEqual(['USD']);
  });

  it('toma el saldo inicial y arma cada movimiento con signo', () => {
    expect(saldoInicial).toBe(1000);
    expect(movimientos[0]).toEqual({ fecha: '01-10-2026', detalle: 'Rendimientos', referencia: '1000000000001', monto: 2.5, saldo: 1002.5 });
    expect(movimientos[1]).toMatchObject({ detalle: 'Pago', monto: -250.75 });
    expect(movimientos[3]).toMatchObject({ detalle: 'Transferencia enviada', monto: -200 });
  });
});

describe('csvParaBandeja', () => {
  const { movimientos, saldoInicial } = movimientosDelReporte(leerReporteLiberaciones(REPORTE));
  const csv = csvParaBandeja(movimientos, { saldoInicial });

  it('lo reconoce la detección de la Bandeja como Mercado Pago, con el período', () => {
    expect(MercadoPagoParser.detectar(csv)).toMatchObject({
      tipo: 'mercadopago',
      producto: 'cuenta',
      periodo: { desde: '2026-10-01', hasta: '2026-10-05' }
    });
  });

  it('el parser actual lo convierte en las mismas transacciones', async () => {
    const transacciones = await new MercadoPagoParser(Buffer.from(csv)).parse();
    expect(transacciones).toHaveLength(5);
    expect(transacciones[0]).toMatchObject({
      fecha: '01-10-2026', detalle: 'Rendimientos', importe: 2.5, tipo: 'Ingreso', moneda: 'ARS', origen: 'Mercado Pago'
    });
    expect(transacciones[1]).toMatchObject({ detalle: 'Pago', importe: 250.75, tipo: 'Gasto' });
    expect(transacciones[2]).toMatchObject({ detalle: 'Pago recibido', importe: 1500, tipo: 'Ingreso' });
  });

  it('el encabezado de saldos cierra con los movimientos', () => {
    const [, saldos] = csv.split('\n');
    expect(saldos).toBe('1000,00;1505,50;-450,75;2054,75');
  });

  it('limpia separadores y saltos de línea de los textos', async () => {
    const raro = csvParaBandeja([{ fecha: '02-10-2026', detalle: 'Pago; "raro"\nlínea', referencia: '1', monto: -5, saldo: null }]);
    const [t] = await new MercadoPagoParser(Buffer.from(raro)).parse();
    expect(t.detalle).toBe('Pago raro línea');
    expect(t.importe).toBe(5);
  });

  it('sin saldo inicial arranca de cero y calcula el saldo corrido', () => {
    const simple = csvParaBandeja([
      { fecha: '01-10-2026', detalle: 'A', referencia: '1', monto: 10, saldo: null },
      { fecha: '02-10-2026', detalle: 'B', referencia: '2', monto: -3.5, saldo: null }
    ]);
    expect(simple).toContain('02-10-2026;B;2;-3,50;6,50');
  });
});

it('nombreArchivoSync indica el período', () => {
  expect(nombreArchivoSync('2026-10-01', '2026-10-19')).toBe('mercadopago-api-2026-10-01-a-2026-10-19.csv');
});
