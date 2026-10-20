import { describe, it, expect } from 'vitest';
import { armarEjemplos, prepararTransacciones, validarSugerencias, esquemaRespuesta, armarMensaje, MAX_TRANSACCIONES } from './aiSuggestions.js';

const categorias = ['Comida', 'Transporte', 'Otros'];

describe('armarEjemplos', () => {
  it('una categoría por comercio (la más usada), los más frecuentes primero, sin Otros', () => {
    const historial = [
      { detalle: 'YPF 123456', categoria: 'Transporte' },
      { detalle: 'YPF 999999', categoria: 'Transporte' },
      { detalle: 'YPF 777777', categoria: 'Comida' },
      { detalle: 'CAFE', categoria: 'Comida' },
      { detalle: 'RARO', categoria: 'Otros' },
      { detalle: 'VIEJA', categoria: 'Borrada' }
    ];
    expect(armarEjemplos(historial, categorias)).toEqual([
      { detalle: 'YPF', categoria: 'Transporte' },
      { detalle: 'CAFE', categoria: 'Comida' }
    ]);
    expect(armarEjemplos(historial, categorias, 1)).toHaveLength(1);
  });
});

describe('prepararTransacciones', () => {
  it('manda solo detalle, monto, tipo y origen, con límite', () => {
    const [t] = prepararTransacciones([{ id: 3, detalle: '  Pago   X ', importe: 10.456, tipo: 'Gasto', origen: 'MP', user_id: 'u', categoria: 'Otros' }]);
    expect(t).toEqual({ id: 3, detalle: 'Pago X', importe: 10.46, tipo: 'Gasto', origen: 'MP' });
    const muchas = Array.from({ length: 100 }, (_, id) => ({ id, detalle: 'x' }));
    expect(prepararTransacciones(muchas)).toHaveLength(MAX_TRANSACCIONES);
    expect(prepararTransacciones([{ id: 'a', detalle: 'x' }, { id: 1, detalle: ' ' }])).toEqual([]);
  });

  it('el mensaje es JSON con categorías, ejemplos y movimientos', () => {
    expect(JSON.parse(armarMensaje({ categorias, ejemplos: [], transacciones: [] }))).toEqual({ categorias, ejemplos: [], movimientos: [] });
  });
});

describe('validarSugerencias', () => {
  it('filtra ids no pedidos, repetidos, categorías inválidas u Otros y acota la confianza', () => {
    const respuesta = {
      sugerencias: [
        { id: 1, categoria: 'Comida', confianza: 0.876 },
        { id: 1, categoria: 'Transporte', confianza: 0.5 },
        { id: 2, categoria: 'Otros', confianza: 0.9 },
        { id: 3, categoria: 'Inventada', confianza: 0.9 },
        { id: 4, categoria: 'Transporte', confianza: 7 },
        { id: 99, categoria: 'Comida', confianza: 1 }
      ]
    };
    expect(validarSugerencias(respuesta, [1, 2, 3, 4], categorias)).toEqual([
      { id: 1, categoria: 'Comida', confianza: 0.88 },
      { id: 4, categoria: 'Transporte', confianza: 1 }
    ]);
    expect(validarSugerencias(null, [1], categorias)).toEqual([]);
  });

  it('el esquema restringe la categoría a las del usuario', () => {
    expect(esquemaRespuesta(categorias).properties.sugerencias.items.properties.categoria.enum).toEqual(categorias);
  });
});
