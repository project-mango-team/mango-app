import { describe, it, expect } from 'vitest';
import { extraerTotalesTarjeta, compararTotales } from './totalesResumen.js';

// Textos sintéticos con el layout de cada PDF (montos y nombres inventados)

const HOMEBANKING_VISA = [
  'Tarjeta Crédito VISA',
  'Resumen de tarjeta de credito VISA',
  '210.500,00',
  '5,00',
  '01-Ago-26 08-Ago-26 01-Sep-26 09-Sep-26 01-Oct-26 09-Oct-26',
  'PAGO MINIMO LÍMITES',
  'En pesos',
  '$ 20.000,00',
  'De compras en un pago y en cuotas',
  '$ 1.000.000,00',
  'CONSOLIDADO PESOS DÓLARES',
  'SALDO ANTERIOR 100.000,00 3,00',
  '05-08-26 SU PAGO EN USD -3,00',
  '08-08-26 SU PAGO EN PESOS -90.000,00',
  '08-08-26 DEV.IMP. RG 5617 30%( 1000,00) -300,00',
  'DETALLE DEL CONSUMO',
  'FECHA REFERENCIA CUOTA COMPROBANTE PESOS DÓLARES',
  '10-08-26 * SUPERMERCADO FICTICIO 123456 150.000,00',
  '12-08-26 * TIENDA INVENTADA 02/03 234567 40.000,00',
  '15-08-26 WL *JUEGOS USD 5,00 345678 5,00',
  'TARJETA 1234 Total Consumos de TITULAR DE PRUEBA 190.000,00 5,00',
  '01-09-26 IMPUESTO DE SELLOS $ 2.000,00',
  '01-09-26 IIBB PERCEP-BSAS 2,00%( 5000,00) 100,00',
  '01-09-26 IVA RG 4240 21%( 5000,00) 1.050,00',
  '01-09-26 DB.RG 5617 30% ( 25000,00 ) 7.500,00',
  'TOTAL A PAGAR 210.350,00 5,00',
  'Los intereses punitorios sobre pago mínimo impago se calculan desde 1.234,56'
].join('\n');

const HOMEBANKING_MASTER = [
  'Tarjeta Crédito MASTERCARD BLACK',
  '50.600,00',
  '0,00',
  'PAGO MINIMO LÍMITES',
  'En pesos',
  '$ 3.000,00',
  'CONSOLIDADO PESOS DÓLARES',
  'SALDO ANTERIOR 0,00 0,00',
  'SALDO PENDIENTE 0,00 0,00',
  'TOTAL CONSUMOS DEL MES 50.000,00 0,00',
  'SUBTOTAL 50.000,00 0,00',
  'IMPUESTO DE SELLOS 600,00',
  'TOTAL A PAGAR 50.600,00 0,00',
  'DETALLE DEL CONSUMO',
  '28-Ago-26 COMBUSTIBLE 06611 50.000,00',
  'SUBTOTAL 50.000,00 0,00',
  'TOTAL A PAGAR 50.600,00 0,00'
].join('\n');

const ERESUMEN_VISA = [
  'CIERRE ACTUAL: 01 Oct 26',
  'VENCIMIENTO \tSALDO $ SALDO U$S PAGO MIN.$ PAGO MIN.U$S',
  '09 Oct 26 210.350,00 \t5,00 \t20.000,00 \t-,--',
  'DETALLE DE TRANSACCION',
  'SALDO ANTERIOR \t100.000,00 \t3,00',
  '05.08.26 \tSU PAGO EN USD \t3,00-',
  '08.08.26 \tSU PAGO EN PESOS \t90.000,00-',
  '08.08.26 \tDEV.IMP. RG 5617 30%( \t1000,00) \t300,00- \t_',
  '10.08.26 \t123456* \tSUPERMERCADO FICTICIO \t150.000,00',
  'Tarjeta 1234 Total Consumos de TITULAR DE PRUEBA \t190.000,00 \t5,00 _',
  '01.09.26 \tIMPUESTO DE SELLOS \t$ \t2.000,00',
  '01.09.26 \tDB.RG 5617 30% ( \t25000,00 ) \t7.500,00',
  '__________________________________________________________',
  'SALDO ACTUAL \t$ \t210.350,00 U$S \t5,00',
  '__________________________________________________________',
  'PAGO MINIMO \t$ \t20.000,00',
  'DEBITAREMOS DE SU CTA 000 LA SUMA DE $ \t210350,00 + U$S \t5,00'
].join('\n');

const tx = (importe, extra = {}) => ({ importe, monto_original: importe, moneda: 'ARS', tipo: 'Gasto', ...extra });

describe('extraerTotalesTarjeta', () => {
  it('PDF Visa del homebanking: total, pago mínimo, saldo anterior, pagos y cargos', () => {
    const t = extraerTotalesTarjeta(HOMEBANKING_VISA);
    expect(t.total).toEqual({ ars: 210350, usd: 5 });
    expect(t.pago_minimo).toBe(20000);
    expect(t.saldo_anterior).toEqual({ ars: 100000, usd: 3 });
    expect(t.pagos).toEqual({ ars: -90000, usd: -3 });
    expect(t.consumos).toEqual({ ars: 190000, usd: 5 });
    expect(t.cargos).toEqual([
      { detalle: 'DEV.IMP. RG 5617 30%( 1000,00)', importe: -300 },
      { detalle: 'IMPUESTO DE SELLOS', importe: 2000 },
      { detalle: 'IIBB PERCEP-BSAS 2,00%( 5000,00)', importe: 100 },
      { detalle: 'IVA RG 4240 21%( 5000,00)', importe: 1050 },
      { detalle: 'DB.RG 5617 30% ( 25000,00 )', importe: 7500 }
    ]);
  });

  it('PDF Mastercard: el total está en el consolidado, antes del detalle', () => {
    const t = extraerTotalesTarjeta(HOMEBANKING_MASTER);
    expect(t.total).toEqual({ ars: 50600, usd: 0 });
    expect(t.pago_minimo).toBe(3000);
    expect(t.consumos).toEqual({ ars: 50000, usd: 0 });
    expect(t.cargos).toEqual([{ detalle: 'IMPUESTO DE SELLOS', importe: 600 }]);
  });

  it('PDF de eresumen: montos negativos con el signo al final y pago mínimo después del saldo', () => {
    const t = extraerTotalesTarjeta(ERESUMEN_VISA);
    expect(t.total).toEqual({ ars: 210350, usd: 5 });
    expect(t.pago_minimo).toBe(20000);
    expect(t.saldo_anterior).toEqual({ ars: 100000, usd: 3 });
    expect(t.pagos).toEqual({ ars: -90000, usd: -3 });
    expect(t.cargos.map(c => c.importe)).toEqual([-300, 2000, 7500]);
  });

  it('sin total (texto copiado, otro banco) devuelve null', () => {
    expect(extraerTotalesTarjeta('DETALLE DEL CONSUMO\n10-08-26 * TIENDA 123456 1.000,00')).toBeNull();
    expect(extraerTotalesTarjeta('')).toBeNull();
  });
});

describe('compararTotales', () => {
  it('explica la diferencia con el saldo no pagado y los cargos que no están importados', () => {
    const totales = extraerTotalesTarjeta(HOMEBANKING_VISA);
    // Lo que lee el parser: consumos en pesos, el consumo en dólares y la percepción DB.RG
    const transacciones = [
      tx(150000), tx(40000), tx(7500),
      { importe: 5000, monto_original: 5, moneda: 'USD', tipo: 'Gasto' }
    ];
    const c = compararTotales(totales, transacciones);
    expect(c.ars).toEqual({
      importado: 197500,
      resumen: 210350,
      diferencia: 12850,
      saldo_pendiente: 10000,
      cargos_no_importados: 2850,
      sin_explicar: 0
    });
    expect(c.usd).toEqual({ importado: 5, resumen: 5, diferencia: 0, saldo_pendiente: 0, sin_explicar: 0 });
    expect(c.cargos.filter(x => x.importado).map(x => x.detalle)).toEqual(['DB.RG 5617 30% ( 25000,00 )']);
    expect(c.pago_minimo).toBe(20000);
  });

  it('lo que falta leer queda sin explicar', () => {
    const c = compararTotales(extraerTotalesTarjeta(HOMEBANKING_MASTER), [tx(30000)]);
    expect(c.ars.diferencia).toBe(20600);
    expect(c.ars.cargos_no_importados).toBe(600);
    expect(c.ars.sin_explicar).toBe(20000);
  });

  it('las devoluciones restan y cada transacción explica un solo cargo', () => {
    const totales = {
      total: { ars: 1000, usd: 0 },
      saldo_anterior: { ars: 0, usd: 0 },
      pagos: { ars: 0, usd: 0 },
      cargos: [{ detalle: 'IMPUESTO DE SELLOS', importe: 100 }, { detalle: 'IMPUESTO DE SELLOS P', importe: 100 }]
    };
    const c = compararTotales(totales, [tx(900), tx(100), tx(100, { tipo: 'Ingreso' })]);
    expect(c.cargos.map(x => x.importado)).toEqual([true, false]);
    expect(c.ars.importado).toBe(900);
    expect(c.ars.sin_explicar).toBe(0);
  });

  it('sin totales no hay control', () => {
    expect(compararTotales(null, [tx(1)])).toBeNull();
  });
});
