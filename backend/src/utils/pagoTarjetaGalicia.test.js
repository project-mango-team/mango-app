import { describe, it, expect } from 'vitest';
import { esPagoTarjetaGalicia, emparejarPagosConResumenes } from './pagoTarjetaGalicia.js';

describe('esPagoTarjetaGalicia', () => {
  it('reconoce el pago de Visa y de Mastercard', () => {
    expect(esPagoTarjetaGalicia('PAGO TARJETA VISA\nRESUMEN 123')).toEqual({ producto: 'visa' });
    expect(esPagoTarjetaGalicia('Pago tarjeta Master')).toEqual({ producto: 'mastercard' });
    expect(esPagoTarjetaGalicia('  PAGO  TARJETA   MASTERCARD  ')).toEqual({ producto: 'mastercard' });
    expect(esPagoTarjetaGalicia('PAGO TARJ. VISA')).toEqual({ producto: 'visa' });
  });

  it('no confunde otros pagos ni compras', () => {
    expect(esPagoTarjetaGalicia('PAGO CON TRANSFERENCIA')).toBeNull();
    expect(esPagoTarjetaGalicia('COMPRA DEBITO TARJETA VISA')).toBeNull();
    expect(esPagoTarjetaGalicia('PAGO CON TARJETA VISA EN KIOSCO')).toBeNull();
    expect(esPagoTarjetaGalicia('')).toBeNull();
    expect(esPagoTarjetaGalicia(undefined)).toBeNull();
  });
});

describe('emparejarPagosConResumenes', () => {
  const resumen = (extra = {}) => ({ ingest_document_id: 'd1', operation_id: 'op1', filename: 'visa.pdf', producto: 'visa', cierre: '2026-09-24', total: 250000.5, ...extra });
  const pago = (extra = {}) => ({ fecha: '05/10/2026', tipo: 'Gasto', origen: 'Banco Galicia', moneda: 'ARS', importe: 250000.5, detalle: 'PAGO TARJETA VISA', ...extra });

  it('con el resumen importado el pago queda cubierto y dice a cuál corresponde', () => {
    const [r] = emparejarPagosConResumenes([pago()], [resumen()]);
    expect(r).toMatchObject({ estado: 'cubierto', resumen: { filename: 'visa.pdf', cierre: '2026-09-24' } });
  });

  it('tolera un peso de diferencia, no más', () => {
    expect(emparejarPagosConResumenes([pago({ importe: 250001 })], [resumen()])[0].estado).toBe('cubierto');
    expect(emparejarPagosConResumenes([pago({ importe: 250003 })], [resumen()])[0].estado).toBe('pendiente');
  });

  it('exige que la fecha esté entre el cierre y 30 días después', () => {
    expect(emparejarPagosConResumenes([pago({ fecha: '20/09/2026' })], [resumen()])[0].estado).toBe('pendiente');
    expect(emparejarPagosConResumenes([pago({ fecha: '20/10/2026' })], [resumen()])[0].estado).toBe('cubierto');
    expect(emparejarPagosConResumenes([pago({ fecha: '30/11/2026' })], [resumen()])[0].estado).toBe('pendiente');
  });

  it('el producto tiene que coincidir', () => {
    expect(emparejarPagosConResumenes([pago({ detalle: 'PAGO TARJETA MASTER' })], [resumen()])[0].estado).toBe('pendiente');
  });

  it('sin resumen importado queda pendiente con el producto', () => {
    expect(emparejarPagosConResumenes([pago()], [])[0]).toEqual({ estado: 'pendiente', producto: 'visa' });
  });

  it('cada resumen se usa una sola vez', () => {
    const r = emparejarPagosConResumenes([pago(), pago()], [resumen()]);
    expect(r.map(x => x.estado)).toEqual(['cubierto', 'pendiente']);
  });

  it('gana el cierre más cercano', () => {
    const lejano = resumen({ ingest_document_id: 'd0', cierre: '2026-09-10', filename: 'viejo.pdf' });
    const cercano = resumen({ ingest_document_id: 'd2', cierre: '2026-09-30', filename: 'nuevo.pdf' });
    expect(emparejarPagosConResumenes([pago()], [lejano, cercano])[0].resumen.filename).toBe('nuevo.pdf');
  });

  it('no toca lo que no es un gasto en pesos de Banco Galicia, ni duplicados ni ignorados', () => {
    const ts = [pago({ tipo: 'Ingreso' }), pago({ origen: 'Santander' }), pago({ moneda: 'USD' }), pago({ duplicado: true }), pago({ ignorada: true }), pago({ detalle: 'COMPRA' })];
    expect(emparejarPagosConResumenes(ts, [resumen()])).toEqual([null, null, null, null, null, null]);
  });
});
