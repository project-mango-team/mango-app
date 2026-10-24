import { describe, it, expect } from 'vitest';
import { validarRegla, aplicarReglas, reglasDesdeKeywords, buscarRegla, compilarReglas } from './categoryRules.js';
import { inferirCategoria, loadDefaultCategoryKeywords } from './categoryInference.js';

const regla = (condiciones, accion, extra = {}) => ({
  condiciones: { detalle: { modo: 'contiene', valores: [] }, origen: null, tipo: null, montoMin: null, montoMax: null, ...condiciones },
  accion,
  activa: true,
  ...extra
});
const t = (detalle, extra = {}) => ({ detalle, tipo: 'Gasto', importe: 1000, origen: 'Mercado Pago', categoria: 'Otros', ...extra });

describe('reglasDesdeKeywords', () => {
  it('clasifica igual que las keywords para todas las default', () => {
    const keywords = loadDefaultCategoryKeywords();
    const reglas = reglasDesdeKeywords(keywords);
    const detalles = Object.values(keywords).flat()
      .flatMap(k => [k, `compra en ${k.toLowerCase()} sucursal`])
      .concat(['nada que ver', 'LSH BARRA HOTEL', '']);
    for (const detalle of detalles) {
      const [conRegla] = aplicarReglas([t(detalle)], reglas);
      expect(conRegla.categoria, detalle).toBe(inferirCategoria(detalle, keywords));
    }
  });

  it('respeta el orden del mapa y descarta listas vacías', () => {
    const reglas = reglasDesdeKeywords(new Map([['A', ['x']], ['B', []], ['C', [' y ', '']]]));
    expect(reglas.map(r => [r.accion.categoria, r.condiciones.detalle.valores, r.orden]))
      .toEqual([['A', ['x'], 0], ['C', ['y'], 1]]);
  });
});

describe('aplicarReglas', () => {
  it('gana la primera regla por orden', () => {
    const reglas = [
      regla({ detalle: { modo: 'contiene', valores: ['BARRA'] } }, { tipo: 'categoria', categoria: 'Comida' }, { orden: 1 }),
      regla({ detalle: { modo: 'contiene', valores: ['lsh barra hotel'] } }, { tipo: 'categoria', categoria: 'Ocio' }, { orden: 0 })
    ];
    expect(aplicarReglas([t('LSH BARRA HOTEL'), t('BARRA DE JUGOS')], reglas).map(x => x.categoria))
      .toEqual(['Ocio', 'Comida']);
  });

  it('combina condiciones de origen, tipo y monto', () => {
    const r = regla(
      { detalle: { modo: 'contiene', valores: ['transferencia'] }, origen: 'Santander', tipo: 'Gasto', montoMin: 500, montoMax: 2000 },
      { tipo: 'categoria', categoria: 'Movimiento interno' }
    );
    const casos = [
      t('Transferencia', { origen: 'Santander' }),
      t('Transferencia', { origen: 'Mercado Pago' }),
      t('Transferencia', { origen: 'Santander', tipo: 'Ingreso' }),
      t('Transferencia', { origen: 'Santander', importe: 100 }),
      t('Transferencia', { origen: 'Santander', importe: 5000 })
    ];
    expect(aplicarReglas(casos, [r]).map(x => x.categoria))
      .toEqual(['Movimiento interno', 'Otros', 'Otros', 'Otros', 'Otros']);
  });

  it('acepta regex sin distinguir mayúsculas', () => {
    const r = regla({ detalle: { modo: 'regex', valores: ['^pago\\s+tarjeta'] } }, { tipo: 'categoria', categoria: 'Movimiento interno' });
    expect(aplicarReglas([t('PAGO  TARJETA VISA'), t('DEBITO PAGO TARJETA')], [r]).map(x => x.categoria))
      .toEqual(['Movimiento interno', 'Otros']);
  });

  it('ignorar marca la transacción y aplica aunque el parser haya fijado la categoría', () => {
    const r = regla({ detalle: { modo: 'contiene', valores: ['rendimientos'] } }, { tipo: 'ignorar' }, { _id: 'r1' });
    const [x] = aplicarReglas([t('Rendimientos', { categoria: 'Impuestos' })], [r]);
    expect(x).toMatchObject({ ignorada: true, regla: 'r1', categoria: 'Impuestos' });
  });

  it('no pisa la categoría que fijó el parser ni usa reglas inactivas', () => {
    const r = regla({ detalle: { modo: 'contiene', valores: ['IVA'] } }, { tipo: 'categoria', categoria: 'Servicios' });
    expect(aplicarReglas([t('IVA RG 4240', { categoria: 'Impuestos' })], [r])[0].categoria).toBe('Impuestos');
    expect(aplicarReglas([t('IVA')], [{ ...r, activa: false }])[0].categoria).toBe('Otros');
  });

  it('una regla sin texto de detalle coincide por las demás condiciones', () => {
    const r = regla({ tipo: 'Ingreso', origen: 'Galicia' }, { tipo: 'categoria', categoria: 'Ingreso' });
    expect(buscarRegla(t('lo que sea', { tipo: 'Ingreso', origen: 'Galicia' }), compilarReglas([r]))).toBe(r);
  });
});

describe('validarRegla', () => {
  const ok = { condiciones: { detalle: { modo: 'contiene', valores: [' Netflix ', 'netflix', ''] } }, accion: { tipo: 'categoria', categoria: 'Ocio' } };

  it('normaliza los valores y completa los vacíos', () => {
    const { regla: r, error } = validarRegla(ok, ['Ocio']);
    expect(error).toBeUndefined();
    expect(r.condiciones).toEqual({ detalle: { modo: 'contiene', valores: ['Netflix', 'netflix'] }, origen: null, tipo: null, montoMin: null, montoMax: null });
    expect(r.activa).toBe(true);
  });

  it('rechaza reglas inválidas', () => {
    const casos = [
      [{ ...ok, accion: { tipo: 'categoria', categoria: 'Inexistente' } }, 'La categoría no existe'],
      [{ ...ok, accion: { tipo: 'borrar' } }, 'Acción inválida'],
      [{ condiciones: {}, accion: { tipo: 'ignorar' } }, 'al menos una condición'],
      [{ condiciones: { detalle: { modo: 'regex', valores: ['(abc'] } }, accion: { tipo: 'ignorar' } }, 'no es válida'],
      [{ condiciones: { montoMin: 10, montoMax: 5 }, accion: { tipo: 'ignorar' } }, 'mínimo'],
      [{ condiciones: { montoMin: 'abc' }, accion: { tipo: 'ignorar' } }, 'números']
    ];
    for (const [datos, mensaje] of casos) {
      expect(validarRegla(datos, ['Ocio']).error).toContain(mensaje);
    }
  });
});
