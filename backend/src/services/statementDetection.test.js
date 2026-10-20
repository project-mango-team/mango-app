import { describe, it, expect } from 'vitest';
import { detectarDocumento, tipoDeArchivo } from './statementImportService.js';
import { GaliciaParser } from '../parsers/GaliciaParser.js';
import { SantanderParser } from '../parsers/SantanderParser.js';
import { MercadoPagoParser } from '../parsers/MercadoPagoParser.js';

// Encabezados sintéticos con la forma de cada resumen (datos inventados)

const MP_CSV = [
  'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE',
  '100,00;50,00;-30,00;120,00',
  '',
  'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE',
  '02-07-2026;Rendimientos;1;1,00;101,00',
  '28-07-2026;Transferencia enviada;2;-30,00;71,00'
].join('\n');

const SANTANDER_CSV = [
  'Movimientos del resumen,,,,,',
  'Tarjeta Visa Crédito terminada en 1111,,,,,',
  ',,,,,',
  'Fecha de cierre,Fecha de vencimiento,,,,',
  '28/05/26,05/06/26,,,,'
].join('\n');

const GALICIA_CAJA = [
  'Banco Galicia - Caja Ahorro Pesos,,,,,',
  'Nro. de Cuenta: ...1234,,,,,',
  'Intervalo de Consulta: del 01/09/2026 al 30/09/2026,,,,,',
  'Fecha,Movimiento,Débito,Crédito,Saldo Parcial,Comentarios'
].join('\n');

const GALICIA_VISA_PDF = [
  'Tarjeta Crédito VISA',
  'Resumen de tarjeta de credito VISA',
  '27-Ago-26 04-Sep-26 01-Oct-26 09-Oct-26 29-Oct-26 11-Nov-26'
].join('\n');

const GALICIA_MASTER_PDF = [
  'Tarjeta Crédito MASTERCARD BLACK',
  '28-Ago-26 05-Sep-26 01-Oct-26 09-Oct-26 29-Oct-26 10-Nov-26'
].join('\n');

const GALICIA_ERESUMEN = [
  'CIERRE ACTUAL: 01 Oct 26',
  'VISA SIGNATURE',
  'FECHA COMPROBANTE \tDETALLE DE TRANSACCION \tPESOS \tDOLARES'
].join('\n');

describe('detectores por parser', () => {
  it('Mercado Pago CSV (con ; o ,) y período por fechas', () => {
    expect(MercadoPagoParser.detectar(MP_CSV)).toMatchObject({
      tipo: 'mercadopago',
      periodo: { desde: '2026-07-02', hasta: '2026-07-28' }
    });
    expect(MercadoPagoParser.detectar(MP_CSV.replaceAll(';', ','))).toMatchObject({ tipo: 'mercadopago' });
  });

  it('Mercado Pago PDF: reconocido pero no soportado', () => {
    expect(MercadoPagoParser.detectar('RESUMEN DE CUENTA EN PESOS\nCVU: 000')).toMatchObject({ soportado: false });
  });

  it('Santander: tarjeta y cierre con año de 2 dígitos', () => {
    expect(SantanderParser.detectar(SANTANDER_CSV)).toMatchObject({ tipo: 'santander', cardType: 'visa', cierre: '2026-05-28' });
  });

  it('Galicia caja de ahorro con su intervalo', () => {
    expect(GaliciaParser.detectar(GALICIA_CAJA)).toMatchObject({
      tipo: 'galicia', tipoResumen: 'cuenta', periodo: { desde: '2026-09-01', hasta: '2026-09-30' }
    });
  });

  it('Galicia Visa y Mastercard del homebanking, con la fecha de cierre actual', () => {
    expect(GaliciaParser.detectar(GALICIA_VISA_PDF)).toMatchObject({ tipoResumen: 'tarjeta', producto: 'visa', formato: 'homebanking', cierre: '2026-10-01' });
    expect(GaliciaParser.detectar(GALICIA_MASTER_PDF)).toMatchObject({ producto: 'mastercard', cierre: '2026-10-01' });
  });

  it('Galicia Visa eresumen', () => {
    expect(GaliciaParser.detectar(GALICIA_ERESUMEN)).toMatchObject({ producto: 'visa', formato: 'eresumen', cierre: '2026-10-01' });
  });

  it('PDF consolidado de caja de ahorro: reconocido pero no soportado', () => {
    expect(GaliciaParser.detectar('Resumen de Caja de Ahorro en Pesos')).toMatchObject({ soportado: false });
  });

  it('un texto cualquiera no se reconoce', () => {
    for (const detectar of [MercadoPagoParser.detectar, SantanderParser.detectar, GaliciaParser.detectar]) {
      expect(detectar('Hola, esto no es un resumen')).toBeNull();
    }
  });
});

describe('detectarDocumento', () => {
  it('tipo de archivo por bytes, no por extensión', () => {
    expect(tipoDeArchivo(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(tipoDeArchivo(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe('excel');
    expect(tipoDeArchivo(Buffer.from('Fecha,Movimiento'))).toBe('texto');
  });

  it('archivo de texto reconocido: banco, tipo y confianza', async () => {
    const d = await detectarDocumento({ buffer: Buffer.from(GALICIA_CAJA, 'utf8') });
    expect(d).toMatchObject({ soportado: true, confianza: 'alta', banco: 'Galicia', tipo: 'galicia', tipoResumen: 'cuenta', archivo: 'texto' });
  });

  it('CSV en Latin-1 (como exporta Santander) se lee igual', async () => {
    const d = await detectarDocumento({ buffer: Buffer.from(SANTANDER_CSV, 'latin1') });
    expect(d).toMatchObject({ soportado: true, tipo: 'santander' });
  });

  it('desconocido: no soportado, confianza baja y vuelve al flujo manual', async () => {
    const d = await detectarDocumento({ buffer: Buffer.from('nada que ver') });
    expect(d).toMatchObject({ soportado: false, confianza: 'baja' });
    expect(d.motivo).toMatch(/a mano/);
  });
});
