import { describe, it, expect } from 'vitest';
import { GaliciaParser } from './GaliciaParser.js';
import { extraerTotalesTarjeta, compararTotales } from '../utils/totalesResumen.js';

// Resúmenes sintéticos (comercios y montos inventados) con el layout de cada fuente.
// El parser acepta texto plano además de PDF, así que alcanza con el texto extraído.
const DOLAR = 1000;

const parsear = (texto) => new GaliciaParser(Buffer.from(texto, 'utf8'), 'tarjeta', DOLAR, null).parse();
const clave = (t) => [t.fecha, t.tipo, t.moneda, t.importe.toFixed(2), t.monto_original.toFixed(2), t.detalle].join(' | ');

// Layout del PDF que genera eresumen.com.ar (celdas separadas por tabs)
const ERESUMEN = [
  'CIERRE ACTUAL: 01 Oct 26',
  'FECHA COMPROBANTE \tDETALLE DE TRANSACCION \tPESOS \tDOLARES',
  'SALDO ANTERIOR \t100.000,00 \t10,00',
  '31.08.26 \tSU PAGO EN USD \t10,00-',
  '04.09.26 \tSU PAGO EN PESOS \t100.000,00-',
  '04.09.26 \tDEV.IMP. RG 1234 30%( 1000,00) \t300,00- \t_',
  '04.08.26 \t111111* \tMERPAGO*CAFETERA \tCuota 02/03 \t20.000,00',
  '28.08.26 \t222222 \tWL *JUEGOS ONLINE \tUSD \t2,50 \t2,50',
  '31.08.26 \t333333K \tPEDIDOS*PIZZERIA \t15.000,50',
  '01.09.26 \t444444 \tTAXI RIO \tBRL \t100,00 \t20,00',
  '21.09.26 \t555555K \tMERPAGO*TIENDA \t5.000,00-',
  'Tarjeta 1234 Total Consumos de TITULAR \t40.000,00 \t22,50 _',
  '01.10.26 \tIMPUESTO DE SELLOS \t$ \t500,00',
  '01.10.26 \tIMPUESTO DE SELLOS \tP $ \t50,00',
  '01.10.26 \tIVA RG 4240 21%( 100,00) \t21,00',
  '01.10.26 \tDB.RG 5617 30% ( 30000,00 ) \t9.000,00',
  'SALDO ACTUAL \t$ \t44.000,00 U$S \t22,50',
  'PAGO MINIMO \t$ \t5.000,00',
  '01.01.27 \t999999 \tNO ES UN MOVIMIENTO \t1,00'
].join('\n');

// Mismos movimientos con el layout del PDF del homebanking
const HOMEBANKING = [
  'CONSOLIDADO PESOS DÓLARES',
  'SALDO ANTERIOR 100.000,00 10,00',
  '31-08-26 SU PAGO EN USD -10,00',
  '04-09-26 SU PAGO EN PESOS -100.000,00',
  '04-09-26 DEV.IMP. RG 1234 30%( 1000,00) -300,00',
  'DETALLE DEL CONSUMO',
  'FECHA REFERENCIA CUOTA COMPROBANTE PESOS DÓLARES',
  '04-08-26 * MERPAGO*CAFETERA 02/03 111111 20.000,00',
  '28-08-26 WL *JUEGOS ONLINE USD 2,50 222222 2,50',
  '31-08-26 K PEDIDOS*PIZZERIA 333333 15.000,50',
  '01-09-26 TAXI RIO BRL 100,00 444444 20,00',
  '21-09-26 K MERPAGO*TIENDA 555555 -5.000,00',
  '01-10-26 IMPUESTO DE SELLOS $ 500,00',
  '01-10-26 IMPUESTO DE SELLOS P $ 50,00',
  '01-10-26 IVA RG 4240 21%( 100,00) 21,00',
  '01-10-26 DB.RG 5617 30% ( 30000,00 ) 9.000,00'
].join('\n');

describe('GaliciaParser · Visa eresumen', () => {
  it('lee consumos, cuotas, moneda extranjera y devoluciones', async () => {
    const tx = (await parsear(ERESUMEN)).filter(t => t.categoria !== 'Impuestos');
    expect(tx.map(t => [t.fecha, t.detalle, t.tipo, t.moneda, t.monto_original])).toEqual([
      ['04/08/2026', 'MERPAGO*CAFETERA Cuota 02/03', 'Gasto', 'ARS', 20000],
      ['28/08/2026', 'WL *JUEGOS ONLINE USD 2,50', 'Gasto', 'USD', 2.5],
      ['31/08/2026', 'PEDIDOS*PIZZERIA', 'Gasto', 'ARS', 15000.5],
      ['01/09/2026', 'TAXI RIO BRL 100,00', 'Gasto', 'USD', 20],
      ['21/09/2026', 'MERPAGO*TIENDA', 'Ingreso', 'ARS', 5000]
    ]);
  });

  it('importa los impuestos, la percepción RG 5617 y su devolución (ING-14)', async () => {
    const tx = (await parsear(ERESUMEN)).filter(t => t.categoria === 'Impuestos');
    expect(tx.map(t => [t.fecha, t.detalle, t.tipo, t.moneda, t.monto_original])).toEqual([
      ['04/09/2026', 'DEV.IMP. RG 1234 30%( 1000,00)', 'Ingreso', 'ARS', 300],
      ['01/10/2026', 'IMPUESTO DE SELLOS', 'Gasto', 'ARS', 500],
      ['01/10/2026', 'IMPUESTO DE SELLOS P', 'Gasto', 'ARS', 50],
      ['01/10/2026', 'IVA RG 4240 21%( 100,00)', 'Gasto', 'ARS', 21],
      ['01/10/2026', 'DB.RG 5617 30% ( 30000,00 )', 'Gasto', 'ARS', 9000]
    ]);
  });

  it('los consumos en moneda extranjera se pesifican con el dólar del resumen', async () => {
    const tx = await parsear(ERESUMEN);
    const taxi = tx.find(t => t.detalle.startsWith('TAXI RIO'));
    expect(taxi.importe).toBe(20 * DOLAR);
  });

  it('ignora saldo anterior, pagos y lo posterior a SALDO ACTUAL', async () => {
    const detalles = (await parsear(ERESUMEN)).map(t => t.detalle).join(' ');
    for (const excluido of ['SALDO', 'SU PAGO', 'Total Consumos', 'NO ES UN MOVIMIENTO']) {
      expect(detalles).not.toContain(excluido);
    }
  });
});

describe('GaliciaParser · Visa homebanking', () => {
  it('da las mismas transacciones que el formato eresumen del mismo resumen', async () => {
    const homebanking = (await parsear(HOMEBANKING)).map(clave);
    const eresumen = (await parsear(ERESUMEN)).map(clave);
    expect(homebanking).toEqual(eresumen);
  });

  it('un consumo en reales va en USD, no como pesos', async () => {
    const taxi = (await parsear(HOMEBANKING)).find(t => t.detalle.startsWith('TAXI RIO'));
    expect(taxi.moneda).toBe('USD');
    expect(taxi.monto_original).toBe(20);
  });

  it('saca la marca K del detalle', async () => {
    const tx = await parsear(HOMEBANKING);
    expect(tx.some(t => t.detalle.startsWith('K '))).toBe(false);
  });
});

// Layout del PDF de Mastercard del homebanking: los impuestos van en el consolidado, sin fecha
const MASTERCARD = [
  'Tarjeta Crédito MASTERCARD BLACK',
  '01-Ago-26 08-Ago-26 01-Sep-26 09-Sep-26 01-Oct-26 09-Oct-26',
  'CONSOLIDADO PESOS DÓLARES',
  'SALDO ANTERIOR 0,00 0,00',
  'TOTAL CONSUMOS DEL MES 30.000,00 0,00',
  'SUBTOTAL 30.000,00 0,00',
  'IMPUESTO DE SELLOS 360,00',
  'TOTAL A PAGAR 30.360,00 0,00',
  'DETALLE DEL CONSUMO',
  'FECHA REFERENCIA COMPROBANTE PESOS DÓLARES',
  '10-Ago-26 COMBUSTIBLE 11111 30.000,00',
  'SUBTOTAL 30.000,00 0,00',
  'TOTAL A PAGAR 30.360,00 0,00'
].join('\n');

describe('GaliciaParser · Mastercard homebanking', () => {
  it('el impuesto del consolidado va con la fecha de cierre', async () => {
    const tx = await parsear(MASTERCARD);
    expect(tx.map(t => [t.fecha, t.detalle, t.categoria, t.importe, t.origen])).toEqual([
      ['01/09/2026', 'IMPUESTO DE SELLOS', 'Impuestos', 360, 'Banco Galicia Mastercard'],
      ['10/08/2026', 'COMBUSTIBLE', expect.any(String), 30000, 'Banco Galicia Mastercard']
    ]);
  });

  it('con los impuestos importados, el control de totales cierra en $0', async () => {
    const control = compararTotales(extraerTotalesTarjeta(MASTERCARD), await parsear(MASTERCARD));
    expect(control.ars.diferencia).toBe(0);
    expect(control.cargos.every(c => c.importado)).toBe(true);
  });
});
