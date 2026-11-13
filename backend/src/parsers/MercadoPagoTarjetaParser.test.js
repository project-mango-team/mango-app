import { describe, it, expect } from 'vitest';
import { MercadoPagoTarjetaParser } from './MercadoPagoTarjetaParser.js';
import { MercadoPagoParser } from './MercadoPagoParser.js';
import { GaliciaParser } from './GaliciaParser.js';
import { extraerTotalesTarjetaMP, cierreDelResumen } from '../utils/totalesTarjetaMP.js';
import { compararTotales } from '../utils/totalesResumen.js';

// Texto sintético con la forma del PDF (datos inventados)
const PDF = [
  'Tarjeta de crédito',
  '¡Hola, Persona!',
  'Este es tu resumen de octubre',
  'Total a pagar',
  '$ 130.20000',
  'US$ 000',
  'El mínimo a pagar es $ 26.040 00',
  'Fecha de cierre',
  '9 de octubre',
  'Fecha de vencimiento',
  '20 de octubre',
  'Consolidado',
  'Saldo del periodo anterior $ 0,00',
  'Consumos $ 110.500,00 US$ 10,00',
  'Impuestos e intereses $ 2.500,00',
  'Pagos anticipados $ 0,00 US$ 0,00',
  'Ajustes y reembolsos $ 0,00 US$ 0,00',
  'Total a pagar $ 113.000,00 US$ 10,00',
  '',
  '-- 1 of 4 --',
  '',
  'DETALLE DE MOVIMIENTOS',
  'Composición del saldo del periodo anterior',
  'Fecha Descripción Pesos Dólares',
  '9/sep Total a pagar del periodo anterior $ 90.000,00',
  '20/sep Débito automático de tarjeta -$ 90.000,00',
  'Subtotal $ 0,00 US$ 0,00',
  'Consumos',
  'Con tarjeta virtual',
  'Fecha Descripción Cuota Operación Pesos Dólares',
  '21/jul MERPAGO*TIENDA UNO 3 de 6 1234567 $ 60.000,00',
  '12/ago COMERCIOUNO$ 30.000,00',
  '5/sep SERVICIO DEL EXTERIOR US$ 10,00',
  '30/sep REEMBOLSO PARCIAL -$ 500,00',
  '4/oct KIOSCO$ 21.000,00',
  'Subtotal $ 110.500,00 US$ 10,00',
  'Impuestos e intereses1',
  'Fecha Descripción Pesos Dólares',
  '9/oct Impuesto al sello Buenos Aires $ 2.500,00',
  '¹ Los impuestos por consumos en moneda extranjera incluyen todo.',
  'Subtotal $ 2.500,00 US$ 0,00',
  'Pagos anticipados',
  'No realizaste pagos anticipados',
  '',
  '-- 2 of 4 --',
  '',
  'DETALLE DE MOVIMIENTOS',
  'Ajustes y reembolsos',
  'No tenés ajustes ni reembolsos',
  'Total a pagar $ 113.000,00 US$ 10,00',
  '',
  'INFORMACIÓN ADICIONAL',
  'Ciclo de facturación',
  'Cierre anterior 9 de septiembre Vencimiento anterior 20 de septiembre',
  'Cierre actual 9 de octubre Vencimiento actual 20 de octubre',
  '3 de 6 cuotas de ejemplo en el texto legal'
].join('\n');

const referencia = new Date('2026-10-12T00:00:00Z');
const parsear = (dolar = 1000) => new MercadoPagoTarjetaParser(Buffer.from(''), dolar, null, referencia).parsearTexto(PDF);

describe('detección', () => {
  it('reconoce el resumen y no confunde otros', () => {
    const d = MercadoPagoTarjetaParser.detectar(PDF);
    expect(d).toMatchObject({ tipo: 'mercadopago', tipoResumen: 'tarjeta', producto: 'tarjeta', formato: 'pdf' });
    expect(d.totales.total).toBeTruthy();
    // El CSV de la cuenta de MP, el PDF de Galicia y un texto cualquiera no coinciden
    expect(MercadoPagoTarjetaParser.detectar('INITIAL_BALANCE\nRELEASE_DATE,TRANSACTION_TYPE')).toBeNull();
    expect(MercadoPagoTarjetaParser.detectar('Tarjeta Crédito VISA\nCONSOLIDADO PESOS DÓLARES\nDETALLE DEL CONSUMO')).toBeNull();
    expect(MercadoPagoTarjetaParser.detectar('Tarjeta de crédito\nEste es tu resumen de octubre')).toBeNull();
  });

  it('las otras firmas no reconocen este PDF', () => {
    expect(MercadoPagoParser.detectar(PDF)).toBeNull();
    expect(GaliciaParser.detectar(PDF)).toBeNull();
  });
});

describe('cierre y año', () => {
  it('toma el año del cierre más reciente que no sea posterior a la referencia', () => {
    expect(cierreDelResumen(PDF, new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-09');
    expect(cierreDelResumen(PDF, new Date('2027-01-15T00:00:00Z'))).toBe('2026-10-09');
    expect(cierreDelResumen(PDF, new Date('2026-10-01T00:00:00Z'))).toBe('2025-10-09');
  });

  it('el año de cada movimiento: se resta uno si el mes es posterior al del cierre', () => {
    const fechas = parsear().map(t => t.fecha);
    expect(fechas).toContain('21/07/2026');
    expect(fechas).toContain('04/10/2026');
    const enero = new MercadoPagoTarjetaParser(Buffer.from(''), 1000, null, new Date('2026-01-20T00:00:00Z'))
      .parsearTexto(PDF.replace(/9 de octubre/g, '9 de enero').replace('4/oct', '4/ene').replace('9/oct', '9/ene'));
    expect(enero.map(t => t.fecha)).toContain('21/07/2025');
    expect(enero.map(t => t.fecha)).toContain('04/01/2026');
  });
});

describe('parseo', () => {
  it('importa consumos, impuestos y reembolsos; saltea el saldo anterior y el pago', () => {
    const txs = parsear();
    expect(txs).toHaveLength(6);
    expect(txs.every(t => t.origen === 'Mercado Pago Tarjeta')).toBe(true);
    expect(txs.some(t => /Débito automático|Total a pagar/i.test(t.detalle))).toBe(false);
  });

  it('cuotas: "<comercio> Cuota NN/MM" sin el número de operación', () => {
    const t = parsear().find(x => /TIENDA UNO/.test(x.detalle));
    expect(t.detalle).toBe('MERPAGO*TIENDA UNO Cuota 03/06');
    expect(t).toMatchObject({ importe: 60000, moneda: 'ARS', tipo: 'Gasto' });
  });

  it('el monto pegado a la descripción y el consumo en dólares', () => {
    const txs = parsear(1000);
    expect(txs.find(x => x.detalle === 'COMERCIOUNO')).toMatchObject({ importe: 30000, moneda: 'ARS' });
    expect(txs.find(x => /EXTERIOR/.test(x.detalle))).toMatchObject({ moneda: 'USD', monto_original: 10, importe: 10000, tipo: 'Gasto' });
  });

  it('impuestos como Gasto de categoría Impuestos; un monto negativo es un Ingreso', () => {
    const txs = parsear();
    expect(txs.find(x => /Impuesto al sello/.test(x.detalle))).toMatchObject({ categoria: 'Impuestos', tipo: 'Gasto', importe: 2500 });
    expect(txs.find(x => /REEMBOLSO/.test(x.detalle))).toMatchObject({ tipo: 'Ingreso', importe: 500 });
  });

  it('la misma compra en cuotas de dos resúmenes tiene detalles distintos (ING-04 las distingue por cuota)', () => {
    const otro = PDF.replace('3 de 6', '4 de 6');
    const t = new MercadoPagoTarjetaParser(Buffer.from(''), 1000, null, referencia).parsearTexto(otro).find(x => /TIENDA UNO/.test(x.detalle));
    expect(t.detalle).toBe('MERPAGO*TIENDA UNO Cuota 04/06');
  });

  it('sin fecha de cierre o sin detalle falla con un mensaje claro', () => {
    expect(() => new MercadoPagoTarjetaParser(Buffer.from(''), 1).parsearTexto('hola')).toThrow(/fecha de cierre/);
  });
});

describe('casos de borde del reviewer', () => {
  const con = (linea) => PDF.replace('4/oct KIOSCO$ 21.000,00', linea);

  it('un comercio que termina en "US" con el monto pegado es un monto en pesos', () => {
    const t = new MercadoPagoTarjetaParser(Buffer.from(''), 1000, null, referencia).parsearTexto(con('21/sep DISNEYPLUS$ 5.000,00')).find(x => /DISNEY/.test(x.detalle));
    expect(t).toMatchObject({ detalle: 'DISNEYPLUS', moneda: 'ARS', importe: 5000 });
  });

  it('un movimiento del mismo mes del cierre pero con día posterior es del año anterior', () => {
    const t = new MercadoPagoTarjetaParser(Buffer.from(''), 1000, null, referencia).parsearTexto(con('21/oct MERPAGO*COMPRA 12 de 12 $ 1.000,00')).find(x => /COMPRA/.test(x.detalle));
    expect(t.fecha).toBe('21/10/2025');
  });

  it('el encabezado de impuestos con nota al pie en superíndice o con espacio', () => {
    for (const marca of ['¹', ' ¹', ' 1', '1']) {
      const n = new MercadoPagoTarjetaParser(Buffer.from(''), 1000, null, referencia).parsearTexto(PDF.replace('Impuestos e intereses1', `Impuestos e intereses${marca}`))
        .filter(x => x.categoria === 'Impuestos').length;
      expect(n).toBe(1);
    }
  });

  it('los pagos anticipados cuentan igual si el PDF los trae con signo negativo', () => {
    const texto = PDF.replace('Pagos anticipados $ 0,00 US$ 0,00', 'Pagos anticipados -$ 5.000,00 US$ 0,00');
    expect(extraerTotalesTarjetaMP(texto).pagos.ars).toBe(-5000);
  });
});

describe('totales (misma forma que extraerTotalesTarjeta)', () => {
  it('lee el consolidado y no la portada', () => {
    const t = extraerTotalesTarjetaMP(PDF);
    expect(t.total).toEqual({ ars: 113000, usd: 10 });
    expect(t.consumos).toEqual({ ars: 110500, usd: 10 });
    expect(t.saldo_anterior).toEqual({ ars: 0, usd: 0 });
    expect(t.pagos).toEqual({ ars: 0, usd: 0 });
    expect(t.pago_minimo).toBe(26040);
    expect(t.cargos).toEqual([{ detalle: 'Impuesto al sello Buenos Aires', importe: 2500 }]);
  });

  it('el control de totales cierra con diferencia 0 contra lo importado', () => {
    const control = compararTotales(extraerTotalesTarjetaMP(PDF), parsear(1000));
    expect(control.ars.diferencia).toBe(0);
    expect(control.ars.sin_explicar).toBe(0);
    expect(control.usd.diferencia).toBe(0);
  });

  it('sin consolidado devuelve null', () => {
    expect(extraerTotalesTarjetaMP('nada')).toBeNull();
    expect(extraerTotalesTarjetaMP('')).toBeNull();
  });

  it('los pagos anticipados y el saldo anterior explican la diferencia', () => {
    const texto = PDF
      .replace('Saldo del periodo anterior $ 0,00', 'Saldo del periodo anterior $ 1.000,00')
      .replace('Pagos anticipados $ 0,00 US$ 0,00', 'Pagos anticipados $ 5.000,00 US$ 0,00')
      .replace(/Total a pagar \$ 113\.000,00 US\$ 10,00/g, 'Total a pagar $ 109.000,00 US$ 10,00');
    const control = compararTotales(extraerTotalesTarjetaMP(texto), parsear(1000));
    expect(control.ars.sin_explicar).toBe(0);
    expect(control.ars.saldo_pendiente).toBe(-4000);
  });
});
