import { describe, it, expect } from 'vitest';
import { parsearPaginacion } from './paginacion.js';

describe('parsearPaginacion', () => {
  it('usa los valores por defecto', () => {
    expect(parsearPaginacion({})).toEqual({ limit: 50, skip: 0 });
    expect(parsearPaginacion()).toEqual({ limit: 50, skip: 0 });
  });
  it('lee limit y skip', () => {
    expect(parsearPaginacion({ limit: '20', skip: '40' })).toEqual({ limit: 20, skip: 40 });
  });
  it('topea el límite y respeta el por defecto configurado', () => {
    expect(parsearPaginacion({ limit: '5000' })).toEqual({ limit: 100, skip: 0 });
    expect(parsearPaginacion({}, { porDefecto: 20 })).toEqual({ limit: 20, skip: 0 });
  });
  it('ignora negativos, NaN, cero y valores que no son string', () => {
    expect(parsearPaginacion({ limit: '-3', skip: '-1' })).toEqual({ limit: 50, skip: 0 });
    expect(parsearPaginacion({ limit: 'abc', skip: 'x' })).toEqual({ limit: 50, skip: 0 });
    expect(parsearPaginacion({ limit: '0' })).toEqual({ limit: 50, skip: 0 });
    expect(parsearPaginacion({ limit: { $gt: '1' }, skip: ['3'] })).toEqual({ limit: 50, skip: 0 });
  });
});
