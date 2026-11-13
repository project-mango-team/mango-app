import { describe, it, expect } from 'vitest';
import { validarRegla, aplicarReglas } from './categoryRules.js';

describe('acción prestamo (PUL-07)', () => {
  const datos = (accion) => ({ condiciones: { detalle: { modo: 'contiene', valores: ['JUAN PEREZ'] } }, accion });

  it('exige el deudor, lo limpia y fija la categoría Préstamo', () => {
    const { regla } = validarRegla(datos({ tipo: 'prestamo', deudor: '  Juan   Perez ' }), ['Comida']);
    expect(regla.accion).toEqual({ tipo: 'prestamo', categoria: 'Préstamo', deudor: 'Juan Perez' });
    expect(validarRegla(datos({ tipo: 'prestamo' }), []).error).toMatch(/a quién/);
    expect(validarRegla(datos({ tipo: 'prestamo', deudor: 'x'.repeat(81) }), []).error).toBeTruthy();
  });

  it('aplicarReglas deja la categoría Préstamo y marca el deudor, solo si estaba en Otros', () => {
    const reglas = [{ _id: 'r1', orden: 0, activa: true, creada_por: 'usuario', condiciones: { detalle: { modo: 'contiene', valores: ['JUAN PEREZ'] } }, accion: { tipo: 'prestamo', categoria: 'Préstamo', deudor: 'Juan Perez' } }];
    const [a, b] = aplicarReglas([
      { detalle: 'Transferencia a Juan Perez', categoria: 'Otros', tipo: 'Gasto', importe: 10 },
      { detalle: 'Transferencia a Juan Perez', categoria: 'Impuestos', tipo: 'Gasto', importe: 10 }
    ], reglas);
    expect(a).toMatchObject({ categoria: 'Préstamo', regla: 'r1', prestamo: { deudor: 'Juan Perez' } });
    expect(b.prestamo).toBeUndefined();
  });
});
