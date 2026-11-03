import { describe, it, expect } from 'vitest';
import { validarRegla, aplicarReglas } from './categoryRules.js';

describe('acción inversion (INV-03)', () => {
  const ID = 'a'.repeat(24);
  const datos = (accion) => ({ condiciones: { detalle: { modo: 'contiene', valores: ['FIMA'] } }, accion });

  it('valida el id del activo y fija la categoría Inversión', () => {
    const { regla } = validarRegla(datos({ tipo: 'inversion', activo_id: ID, categoria: 'Cualquiera' }), ['Comida']);
    expect(regla.accion).toEqual({ tipo: 'inversion', categoria: 'Inversión', activo_id: ID });
    expect(validarRegla(datos({ tipo: 'inversion' }), []).error).toBeTruthy();
    expect(validarRegla(datos({ tipo: 'inversion', activo_id: 'no-es-un-id' }), []).error).toBeTruthy();
  });

  it('aplicarReglas deja la categoría Inversión y marca el activo, solo si estaba en Otros', () => {
    const reglas = [{ _id: 'r1', orden: 0, activa: true, condiciones: { detalle: { modo: 'contiene', valores: ['FIMA'] } }, accion: { tipo: 'inversion', categoria: 'Inversión', activo_id: ID } }];
    const [a, b] = aplicarReglas([
      { detalle: 'Suscripcion FIMA PREMIUM', categoria: 'Otros', tipo: 'Gasto', importe: 10 },
      { detalle: 'Suscripcion FIMA', categoria: 'Impuestos', tipo: 'Gasto', importe: 10 }
    ], reglas);
    expect(a).toMatchObject({ categoria: 'Inversión', regla: 'r1', inversion: { activo_id: ID } });
    expect(b.inversion).toBeUndefined();
    expect(b.categoria).toBe('Impuestos');
  });
});
