import { describe, it, expect } from 'vitest';
import { analizarRegex, esRegexSegura } from './regexSegura.js';
import { validarRegla, compilarReglas, buscarRegla } from './categoryRules.js';

describe('regex peligrosas (ReDoS)', () => {
  it.each([
    '(a+)+$',
    '(a*)*b',
    '(a|aa)+$',
    '(a|a)*',
    '^(\\w+\\s?)*$',
    '([a-zA-Z]+)*x',
    '(x+x+)+y',
    '(.*a){10}',
    '((a+)b)+',
    '(?:(a|b)c)+',
    '(a+){2,}',
    '(a)\\1',
    '(?=a+)a',
    '(?<!x)y'
  ])('rechaza %s', (patron) => {
    expect(analizarRegex(patron).segura).toBe(false);
    expect(analizarRegex(patron).motivo).toBeTruthy();
  });

  it('rechaza demasiadas repeticiones sin tope', () => {
    expect(esRegexSegura('a.*b.*c.*d.*e')).toBe(false);
    expect(esRegexSegura('a.*b.*c.*d')).toBe(true);
  });

  it.each([
    '^PAGO TARJETA',
    '^Transferencia enviada Persona Propia',
    '\\d{4}-\\d{2}-\\d{2}',
    '(?:LSH|BARRA) HOTEL',
    '(abc)?def',
    '.*foo.*bar',
    '[a-z]+\\s+[0-9]{3,5}',
    'a{1,3}b{1,3}',
    '[+*]x'
  ])('acepta %s', (patron) => {
    expect(analizarRegex(patron)).toEqual({ segura: true });
  });
});

describe('validarRegla y evaluación con regex', () => {
  const datos = (patron) => ({ condiciones: { detalle: { modo: 'regex', valores: [patron] } }, accion: { tipo: 'ignorar' } });

  it('no deja guardar una regex peligrosa y explica por qué', () => {
    const r = validarRegla(datos('(a+)+$'), []);
    expect(r.error).toMatch(/seguridad.*otra repetición/);
    expect(validarRegla(datos('^PAGO\\s+TARJETA'), []).error).toBeUndefined();
  });

  it('una regex peligrosa que ya estaba guardada no se evalúa (y no cuelga el proceso)', () => {
    const reglas = [{ _id: 'r1', orden: 0, activa: true, condiciones: { detalle: { modo: 'regex', valores: ['(a+)+$'] } }, accion: { tipo: 'ignorar' } }];
    const inicio = Date.now();
    // Sin el chequeo, esta cadena tardaría 2^40 pasos en fallar
    const encontrada = buscarRegla({ detalle: `${'a'.repeat(40)}!`, tipo: 'Gasto', importe: 1 }, compilarReglas(reglas));
    expect(encontrada).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it('evalúa solo los primeros 300 caracteres del detalle', () => {
    const reglas = [{ _id: 'r2', orden: 0, activa: true, condiciones: { detalle: { modo: 'regex', valores: ['FIN$'] } }, accion: { tipo: 'ignorar' } }];
    const compiladas = compilarReglas(reglas);
    expect(buscarRegla({ detalle: 'x'.repeat(100) + 'FIN' }, compiladas)).toBeTruthy();
    expect(buscarRegla({ detalle: 'x'.repeat(400) + 'FIN' }, compiladas)).toBeNull();
  });
});
