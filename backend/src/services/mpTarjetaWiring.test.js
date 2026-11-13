import { describe, it, expect } from 'vitest';
import { detectarDocumento, parsearDocumento } from './statementImportService.js';
import { necesitaDolar, parametrosDesdeDeteccion } from './ingestService.js';
import { fuenteDeDeteccion, fuenteDeAviso } from '../utils/fuentesResumen.js';
import { evaluarAutoImportacion } from '../utils/autoImportacion.js';

// Texto sintético con la forma del PDF de la tarjeta de Mercado Pago (datos inventados)
const TEXTO = [
  'Tarjeta de crédito',
  'Este es tu resumen de octubre',
  'Fecha de cierre', '9 de octubre', 'Fecha de vencimiento', '20 de octubre',
  'Consolidado',
  'Saldo del periodo anterior $ 0,00',
  'Consumos $ 5.000,00 US$ 0,00',
  'Impuestos e intereses $ 0,00',
  'Pagos anticipados $ 0,00 US$ 0,00',
  'Ajustes y reembolsos $ 0,00 US$ 0,00',
  'Total a pagar $ 5.000,00 US$ 0,00',
  'DETALLE DE MOVIMIENTOS',
  'Composición del saldo del periodo anterior',
  'Subtotal $ 0,00 US$ 0,00',
  'Consumos',
  'Fecha Descripción Cuota Operación Pesos Dólares',
  '4/oct KIOSCO DE PRUEBA$ 5.000,00',
  'Subtotal $ 5.000,00 US$ 0,00',
  'INFORMACIÓN ADICIONAL'
].join('\n');

describe('MP-09: la tarjeta de Mercado Pago en la importación', () => {
  it('se detecta sola (tipo mercadopago, tarjeta) y trae los totales', async () => {
    const d = await detectarDocumento({ buffer: Buffer.from(TEXTO, 'utf8') });
    expect(d).toMatchObject({ soportado: true, confianza: 'alta', banco: 'Mercado Pago', tipo: 'mercadopago', tipoResumen: 'tarjeta', producto: 'tarjeta' });
    expect(d.totales.total.ars).toBe(5000);
    expect(parametrosDesdeDeteccion(d)).toMatchObject({ tipo: 'mercadopago', tipoResumen: 'tarjeta' });
  });

  it('se parsea con origen Mercado Pago Tarjeta', async () => {
    const { transactions } = await parsearDocumento({ buffer: Buffer.from(TEXTO, 'utf8'), filename: 'resumen.pdf', tipo: 'mercadopago', tipoResumen: 'tarjeta', valorDolar: 1000 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ origen: 'Mercado Pago Tarjeta', importe: 5000, tipo: 'Gasto' });
  });

  it('necesita el dólar y tiene su fuente propia', () => {
    expect(necesitaDolar({ tipo: 'mercadopago', tipoResumen: 'tarjeta' })).toBe(true);
    expect(necesitaDolar({ tipo: 'mercadopago', tipoResumen: 'cuenta' })).toBe(false);
    expect(fuenteDeDeteccion({ tipo: 'mercadopago', producto: 'tarjeta' })).toBe('mercadopago_tarjeta');
    expect(fuenteDeDeteccion({ tipo: 'mercadopago', producto: 'cuenta' })).toBe('mercadopago_cuenta');
    expect(fuenteDeAviso({ from: 'no-reply@mercadopago.com', subject: 'Tu resumen de la tarjeta de crédito' }).fuente).toBe('mercadopago_tarjeta');
    expect(fuenteDeAviso({ from: 'no-reply@mercadopago.com', subject: 'Tu reporte' }).fuente).toBe('mercadopago_cuenta');
  });

  it('la importación automática exige el total del resumen en la tarjeta', () => {
    const deteccion = { soportado: true, confianza: 'alta', tipo: 'mercadopago', tipoResumen: 'tarjeta', producto: 'tarjeta' };
    const sinControl = evaluarAutoImportacion({ deteccion, transacciones: [{ categoria: 'Comida' }], control: null });
    expect(sinControl.ok).toBe(false);
    expect(sinControl.motivos.join(' ')).toMatch(/total del resumen/);
  });
});
