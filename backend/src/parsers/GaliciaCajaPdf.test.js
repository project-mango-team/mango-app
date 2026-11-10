import { describe, it, expect } from 'vitest';
import { GaliciaParser } from './GaliciaParser.js';
import { extraerTotalesCuenta, compararTotales } from '../utils/totalesResumen.js';

// Resumen consolidado sintético (nombres, CUIL, CBU, comercios y montos inventados) con el layout
// del PDF "Resumen de Caja de Ahorro en Pesos": paginado, encabezados repetidos y texto legal al final.
// Saldo inicial 1,00 + créditos 1.500.000,50 − débitos 1.250.000,25 = saldo final 250.001,25
export const CAJA_PDF = [
  'CUIL del Responsable Impositivo : 20-12345678-9',
  'IVA: Consumidor Final',
  'TITULAR DE PRUEBA',
  'Resumen de Caja de Ahorro en Pesos',
  'Página 1 / 2\tResumen de Caja de Ahorro en Pesos',
  '12345678901234567P',
  'Cantidad de cotitulares: 1',
  'Datos de la cuenta',
  'Tipo de cuenta',
  'Caja de Ahorro en Pesos',
  'CBU',
  '0070000000000000000000',
  '31/10/2026\t01/10/2026',
  'Período de movimientos',
  '$250.001,25',
  '$1,00',
  'Saldos',
  'Movimientos',
  'Fecha Descripción Origen Crédito Débito Saldo',
  '30/10/26 RESCATE FIMA',
  'Fima Ejemplo Clase A',
  '300.000,00 300.001,00',
  '30/10/26 TRANSFERENCIA A TERCEROS',
  'CU 20111111112',
  '00000000000000000001',
  'RIOP',
  '1234XXXXXXXXXX56',
  'VARIOS',
  '-250.000,00 50.001,00',
  '28/10/26 TRANSFERENCIA DE CUENTA',
  'PROPIA',
  'TITULAR DE PRUEBA',
  '20123456789',
  'VARIOS',
  '100.000,00 150.001,00',
  '',
  '-- 1 of 3 --',
  '',
  'Resumen de Caja de Ahorro en Pesos',
  'Página 2 / 2\tResumen de Caja de Ahorro en Pesos',
  '12345678901234567P',
  'Fecha Descripción Origen Crédito Débito Saldo',
  '20/10/26 TRANSFERENCIAS CASH',
  'SUELDOS',
  'EMPRESA EJEMPLO SA',
  '30111111119',
  '1.000.000,00 1.150.001,00',
  '15/10/26 SUSCRIPCION FIMA',
  'FIMA EJEMPLO CLASE A',
  '-600.000,00 150.001,00',
  '15/10/26 SUSCRIPCION FIMA',
  'FIMA EJEMPLO CLASE A',
  '-200,00 149.801,00',
  '10/10/26 TRANSFERENCIA A TERCEROS',
  'Maria Perez Ejemplo',
  '27222222223',
  'VARIOS',
  'TIENDA EJEMPLO SRL',
  '-99.800,00 50.001,00',
  '05/10/26 INTERES CAPITALIZADO',
  'Octubre 2026',
  '0,25 50.001,25',
  '03/10/26 REINTEGRO PROMOCION GALICIA',
  '100.000,25 150.001,50',
  '02/10/26 DEBITO AUTOMATICO SEGURO',
  '-99.999,75 50.001,75',
  '01/10/26 TRANSFERENCIA A TERCEROS',
  'Maria Perez Ejemplo',
  '27222222223',
  'VARIOS',
  '-100.000,25 -149.998,75',
  '01/10/26 TRANSFERENCIA A TERCEROS',
  'Maria Perez Ejemplo',
  '27222222223',
  'VARIOS',
  '-100.000,25 -349.999,25',
  'Total $ 1.500.000,50 -$ 1.250.000,25 $ 250.001,25',
  '',
  '-- 2 of 3 --',
  '',
  'Resumen de Caja de Ahorro en Pesos',
  'Los depósitos en pesos y en moneda extranjera cuentan con la garantía de hasta $10.000.000.',
  '15/12/26 TEXTO LEGAL QUE NO ES UN MOVIMIENTO',
  '-- 3 of 3 --'
].join('\n');

const parsear = (texto) => new GaliciaParser(Buffer.from(texto, 'utf8'), 'cuenta', 1, null).parse();
const totalesDelPdf = () => GaliciaParser.detectar(CAJA_PDF).totales;

describe('GaliciaParser.detectar: PDF consolidado de la caja de ahorro', () => {
  it('lo reconoce como soportado con período, cierre y totales', () => {
    const d = GaliciaParser.detectar(CAJA_PDF);
    expect(d).toMatchObject({
      tipo: 'galicia', tipoResumen: 'cuenta', producto: 'caja_ahorro', formato: 'pdf',
      periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, cierre: '2026-10-31',
      totales: { tipo: 'cuenta', creditos: 1500000.5, debitos: 1250000.25, saldo_final: 250001.25, saldo_inicial: 1, conciliacion: 0 }
    });
    expect(d.soportado).not.toBe(false);
  });

  it('la caja de ahorro en dólares se rechaza con un motivo claro', () => {
    const d = GaliciaParser.detectar('Resumen de Caja de Ahorro en Dólares\nCaja de Ahorro en Dólares');
    expect(d).toMatchObject({ soportado: false });
    expect(d.motivo).toMatch(/dólares/);
  });

  it('el parser no importa la caja en dólares como pesos', async () => {
    await expect(parsear('Resumen de Caja de Ahorro en Dólares\nFecha Descripción Origen Crédito Débito Saldo\n01/10/26 X\n10,00 10,00'))
      .rejects.toThrow(/dólares/);
  });
});

describe('GaliciaParser: parseo del PDF consolidado de la caja de ahorro', () => {
  it('lee los 12 movimientos (paginado y texto legal ignorados)', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx).toHaveLength(12);
    expect(tx.every(t => t.origen === 'Banco Galicia' && t.moneda === 'ARS' && t.importe > 0)).toBe(true);
    expect(tx.some(t => /LEGAL/.test(t.detalle))).toBe(false);
  });

  it('rescate FIMA es ingreso y suscripción FIMA es gasto, con el fondo en el detalle (como el Excel)', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx[0]).toMatchObject({ fecha: '30/10/2026', tipo: 'Ingreso', importe: 300000, detalle: 'RESCATE FIMA Fima Ejemplo Clase A' });
    const suscripciones = tx.filter(t => t.detalle.startsWith('SUSCRIPCION FIMA'));
    expect(suscripciones.map(t => [t.tipo, t.importe, t.detalle])).toEqual([
      ['Gasto', 600000, 'SUSCRIPCION FIMA FIMA EJEMPLO CLASE A'],
      ['Gasto', 200, 'SUSCRIPCION FIMA FIMA EJEMPLO CLASE A']
    ]);
  });

  it('transferencia a terceros: todo el texto del movimiento, como el Excel', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx[1]).toMatchObject({ tipo: 'Gasto', importe: 250000, detalle: 'TRANSFERENCIA A TERCEROS CU 20111111112 00000000000000000001 RIOP 1234XXXXXXXXXX56 VARIOS' });
    expect(tx.find(t => t.importe === 99800).detalle).toBe('TRANSFERENCIA A TERCEROS Maria Perez Ejemplo 27222222223 VARIOS TIENDA EJEMPLO SRL');
  });

  it('descripción en dos líneas', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx[2]).toMatchObject({ tipo: 'Ingreso', importe: 100000, detalle: 'TRANSFERENCIA DE CUENTA PROPIA TITULAR DE PRUEBA 20123456789 VARIOS' });
  });

  it('intereses, reintegros y débitos automáticos; año de 2 dígitos → 20YY', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx.find(t => t.detalle === 'INTERES CAPITALIZADO Octubre 2026')).toMatchObject({ fecha: '05/10/2026', tipo: 'Ingreso', importe: 0.25 });
    expect(tx.find(t => t.detalle === 'REINTEGRO PROMOCION GALICIA')).toMatchObject({ tipo: 'Ingreso', importe: 100000.25 });
    expect(tx.find(t => /DEBITO AUTOMATICO/.test(t.detalle))).toMatchObject({ tipo: 'Gasto', importe: 99999.75 });
  });

  it('dos filas iguales el mismo día siguen siendo dos transacciones', async () => {
    const tx = await parsear(CAJA_PDF);
    expect(tx.filter(t => t.fecha === '01/10/2026' && t.importe === 100000.25)).toHaveLength(2);
  });

  it('el mismo movimiento por Excel y por PDF tiene el mismo detalle (no se duplica al subir los dos)', async () => {
    const csv = [
      'Banco Galicia - Caja Ahorro Pesos,,,,,',
      'Fecha,Movimiento,Débito,Crédito,Saldo Parcial,Comentarios',
      '30/10/2026," RESCATE FIMA\n Fima Ejemplo Clase A\n","0,00","300.000,00",300001,'
    ].join('\n');
    const [delExcel] = await parsear(csv);
    const [delPdf] = await parsear(CAJA_PDF);
    expect(delPdf.detalle).toBe(delExcel.detalle);
  });

  it('tolera saltos de línea de Windows y espacios de más', async () => {
    const tx = await parsear(CAJA_PDF.replace(/\n/g, '\r\n').replace('30/10/26 RESCATE', '30/10/26   RESCATE'));
    expect(tx).toHaveLength(12);
  });
});

describe('Control de totales de la caja de ahorro', () => {
  it('extrae créditos, débitos, saldo final y la conciliación', () => {
    expect(extraerTotalesCuenta(CAJA_PDF)).toEqual({
      tipo: 'cuenta', creditos: 1500000.5, debitos: 1250000.25, saldo_final: 250001.25, saldo_inicial: 1, conciliacion: 0
    });
  });

  it('saldo final negativo (descubierto) se conserva con su signo', () => {
    const t = extraerTotalesCuenta('$-1.000,00\n$5,00\nSaldos\nTotal $ 2.000,00 -$ 3.005,00 $ -1.000,00');
    expect(t).toMatchObject({ creditos: 2000, debitos: 3005, saldo_final: -1000, saldo_inicial: 5, conciliacion: 0 });
  });

  it('sin línea de totales no hay control', () => {
    expect(extraerTotalesCuenta('Resumen de Caja de Ahorro en Pesos\n01/10/26 X')).toBeNull();
  });

  it('lo importado cuadra con el resumen: sin diferencia', async () => {
    const control = compararTotales(totalesDelPdf(), await parsear(CAJA_PDF));
    expect(control.ars).toMatchObject({ importado: 250000.25, resumen: 250000.25, diferencia: 0, sin_explicar: 0 });
    expect(control.cuenta.creditos).toMatchObject({ importado: 1500000.5, diferencia: 0 });
    expect(control.cuenta.debitos).toMatchObject({ importado: 1250000.25, diferencia: 0 });
    expect(control.cuenta.saldo_final).toBe(250001.25);
  });

  it('si falta una transacción, queda sin explicar', async () => {
    const tx = (await parsear(CAJA_PDF)).filter(t => t.importe !== 250000);
    const control = compararTotales(totalesDelPdf(), tx);
    expect(control.ars.sin_explicar).toBe(-250000);
    expect(control.cuenta.debitos.diferencia).toBe(250000);
  });

  it('un crédito y un débito mal leídos que se compensan en el neto igual se detectan', async () => {
    const tx = (await parsear(CAJA_PDF)).map(t => (t.importe === 100000 ? { ...t, importe: 99999 } : t.importe === 99800 ? { ...t, importe: 99799 } : t));
    const control = compararTotales(totalesDelPdf(), tx);
    expect(control.ars.diferencia).toBe(0);
    expect(control.ars.sin_explicar).not.toBe(0);
  });
});
