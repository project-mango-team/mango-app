import { describe, it, expect } from 'vitest';
import { aplicarReglas, buscarCoincidencia, compilarReglas, ordenarReglas, ordenConNuevaRegla, pisaA, nivelDeRegla } from './categoryRules.js';

const regla = (id, valores, categoria, extra = {}) => ({
  _id: id,
  orden: 0,
  activa: true,
  creada_por: 'usuario',
  condiciones: { detalle: { modo: 'contiene', valores }, origen: null, tipo: null, montoMin: null, montoMax: null },
  accion: { tipo: 'categoria', categoria },
  ...extra
});

describe('PUL-06: la regla del usuario gana sobre las asociaciones anteriores', () => {
  it('una explícita con orden mayor le gana a una keyword con orden 0', () => {
    const reglas = [
      regla('k1', ['TRANSFERENCIA'], 'Transferencia', { creada_por: 'keywords', orden: 0 }),
      regla('u1', ['JUAN PEREZ'], 'Comida', { orden: 50 })
    ];
    const [t] = aplicarReglas([{ detalle: 'Transferencia enviada a Juan Perez', categoria: 'Otros', tipo: 'Gasto', importe: 100 }], reglas);
    expect(t.categoria).toBe('Comida');
    expect(t.regla).toBe('u1');
  });

  it('niveles y orden de evaluación', () => {
    expect(nivelDeRegla({ creada_por: 'keywords' })).toBe(1);
    expect(nivelDeRegla({ creada_por: 'usuario' })).toBe(0);
    expect(nivelDeRegla({ creada_por: 'aprendida' })).toBe(0);
    const ids = ordenarReglas([
      regla('k', ['A'], 'X', { creada_por: 'keywords', orden: -5 }),
      regla('u2', ['B'], 'X', { orden: 3 }),
      regla('u1', ['C'], 'X', { orden: -1 })
    ]).map(r => r._id);
    expect(ids).toEqual(['u1', 'u2', 'k']);
  });
});

describe('PUL-06: por qué se eligió la categoría', () => {
  it('guarda el texto que coincidió, de dónde viene la regla y la categoría', () => {
    const [t] = aplicarReglas(
      [{ detalle: 'Pago NETFLIX 123', categoria: 'Otros', tipo: 'Gasto', importe: 10 }],
      [regla('u1', ['Spotify', 'Netflix'], 'Ocio')]
    );
    expect(t.regla_motivo).toEqual({ texto: 'Netflix', modo: 'contiene', creada_por: 'usuario', categoria: 'Ocio' });
  });

  it('una regla solo por origen o tipo no tiene texto', () => {
    const r = regla('u1', [], 'Ocio', { condiciones: { detalle: { modo: 'contiene', valores: [] }, origen: 'Mercado Pago', tipo: null, montoMin: null, montoMax: null } });
    const [t] = aplicarReglas([{ detalle: 'x', categoria: 'Otros', origen: 'Mercado Pago', tipo: 'Gasto', importe: 1 }], [r]);
    expect(t.regla_motivo.texto).toBeNull();
  });

  it('una regex informa el patrón', () => {
    const r = regla('u1', ['^PAGO\\s+TARJETA'], 'Movimiento interno', { condiciones: { detalle: { modo: 'regex', valores: ['^PAGO\\s+TARJETA'] }, origen: null, tipo: null, montoMin: null, montoMax: null } });
    const c = buscarCoincidencia({ detalle: 'Pago tarjeta Visa', tipo: 'Gasto', importe: 1 }, compilarReglas([r]));
    expect(c.texto).toBe('^PAGO\\s+TARJETA');
  });

  it('lo que fijó el parser no se pisa y se marca como categoría fija', () => {
    const [t] = aplicarReglas(
      [{ detalle: 'IMPUESTO SELLOS', categoria: 'Impuestos', tipo: 'Gasto', importe: 5 }],
      [regla('u1', ['IMPUESTO'], 'Otros gastos')]
    );
    expect(t.categoria).toBe('Impuestos');
    expect(t.categoria_fija).toBe(true);
    expect(t.regla_motivo).toBeUndefined();
  });
});

describe('PUL-06: pisaA y orden de una regla nueva', () => {
  const general = regla('g', ['TRANSFERENCIA'], 'Transferencia');
  const especifica = regla('e', ['TRANSFERENCIA A JUAN PEREZ'], 'Comida');

  it('la general tapa a la específica y no al revés', () => {
    expect(pisaA(general, especifica)).toBe(true);
    expect(pisaA(especifica, general)).toBe(false);
  });

  it('considera origen, tipo y montos', () => {
    const conOrigen = regla('o', ['TRANSFERENCIA'], 'X', { condiciones: { detalle: { modo: 'contiene', valores: ['TRANSFERENCIA'] }, origen: 'Santander', tipo: null, montoMin: null, montoMax: null } });
    expect(pisaA(general, conOrigen)).toBe(true);
    expect(pisaA(conOrigen, general)).toBe(false);
    const rango = regla('r', ['TRANSFERENCIA'], 'X', { condiciones: { detalle: { modo: 'contiene', valores: ['TRANSFERENCIA'] }, origen: null, tipo: null, montoMin: 100, montoMax: 500 } });
    const rangoChico = regla('rc', ['TRANSFERENCIA'], 'X', { condiciones: { detalle: { modo: 'contiene', valores: ['TRANSFERENCIA'] }, origen: null, tipo: null, montoMin: 200, montoMax: 300 } });
    expect(pisaA(rango, rangoChico)).toBe(true);
    expect(pisaA(rangoChico, rango)).toBe(false);
  });

  it('con regex no se puede saber: no tapa', () => {
    const rx = regla('x', ['^TRANSF'], 'X', { condiciones: { detalle: { modo: 'regex', valores: ['^TRANSF'] }, origen: null, tipo: null, montoMin: null, montoMax: null } });
    expect(pisaA(rx, especifica)).toBe(false);
    expect(pisaA(general, rx)).toBe(false);
  });

  it('una "TRANSFERENCIA" nueva queda después de "TRANSFERENCIA A JUAN PEREZ"', () => {
    const nueva = { ...general, _id: 'n' };
    expect(ordenConNuevaRegla([especifica], nueva)).toEqual(['e', 'n']);
  });

  it('una específica nueva queda primera, antes de las generales y de las keywords', () => {
    const keyword = regla('k', ['TRANSFERENCIA'], 'Transferencia', { creada_por: 'keywords' });
    const nueva = { ...especifica, _id: 'n' };
    expect(ordenConNuevaRegla([general, keyword], nueva)).toEqual(['n', 'g', 'k']);
  });

  it('una regla sin relación con las demás va primera', () => {
    expect(ordenConNuevaRegla([general], regla('n', ['KIOSCO'], 'Comida'))).toEqual(['n', 'g']);
  });
});
