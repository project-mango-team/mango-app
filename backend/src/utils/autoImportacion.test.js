import { describe, it, expect } from 'vitest';
import { evaluarAutoImportacion } from './autoImportacion.js';

const deteccion = { soportado: true, confianza: 'alta' };
const tx = (extra = {}) => ({ categoria: 'Comida', ...extra });

describe('evaluarAutoImportacion', () => {
  it('importa solo si todo está en orden', () => {
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx(), tx({ ignorada: true, categoria: 'Otros' })] })).toEqual({ ok: true, motivos: [] });
  });
  it('no importa con detección de confianza baja', () => {
    expect(evaluarAutoImportacion({ deteccion: { soportado: true, confianza: 'media' }, transacciones: [tx()] }).ok).toBe(false);
  });
  it('no importa con transacciones en Otros', () => {
    const r = evaluarAutoImportacion({ deteccion, transacciones: [tx(), tx({ categoria: 'Otros' })] });
    expect(r.ok).toBe(false);
    expect(r.motivos[0]).toMatch(/sin categoría/);
  });
  it('no importa con duplicados ni con archivo ya importado', () => {
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx(), tx({ duplicado: true })] }).ok).toBe(false);
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx()], archivoYaImportado: { operation_id: 'x' } }).ok).toBe(false);
  });
  it('no importa si no hay nada nuevo', () => {
    expect(evaluarAutoImportacion({ deteccion, transacciones: [] }).ok).toBe(false);
  });
  it('no importa con internos sugeridos', () => {
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx({ interno_sugerido: { con: 1 } })] }).ok).toBe(false);
  });
  it('una tarjeta sin total para comparar no se importa sola', () => {
    expect(evaluarAutoImportacion({ deteccion: { ...deteccion, producto: 'visa' }, transacciones: [tx()], control: null }).ok).toBe(false);
    expect(evaluarAutoImportacion({ deteccion: { ...deteccion, producto: 'caja_ahorro' }, transacciones: [tx()], control: null }).ok).toBe(true);
  });
  it('mira la diferencia contra el total del resumen', () => {
    const control = (ars) => ({ ars: { sin_explicar: ars }, usd: { sin_explicar: 0 } });
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx()], control: control(0.4) }).ok).toBe(true);
    expect(evaluarAutoImportacion({ deteccion, transacciones: [tx()], control: control(1500) }).ok).toBe(false);
  });
});
