import { describe, it, expect } from 'vitest';
import { canalDeOperacion, canalDeFuente } from './canalOperacion.js';

import { filtroPorCanal } from './canalOperacion.js';

describe('filtroPorCanal', () => {
  it('canal común: filtra por canal', () => {
    expect(filtroPorCanal('mail')).toEqual({ canal: 'mail' });
  });
  it('migración y manual incluyen las cargas viejas sin canal', () => {
    expect(filtroPorCanal('migracion').$or).toContainEqual({ canal: { $exists: false }, type: 'migration' });
    expect(filtroPorCanal('manual').$or).toContainEqual({ canal: { $exists: false }, 'metadata.tipo': 'manual' });
  });
  it('canal inválido o que no es string no filtra', () => {
    expect(filtroPorCanal('x')).toEqual({});
    expect(filtroPorCanal({ $ne: 'mail' })).toEqual({});
    expect(filtroPorCanal(undefined)).toEqual({});
  });
  it('nunca incluye user_id', () => {
    for (const c of ['manual', 'migracion', 'mail', 'archivo']) expect(JSON.stringify(filtroPorCanal(c))).not.toContain('user_id');
  });
});

describe('canalDeOperacion', () => {
  it('usa el canal guardado en la operación', () => {
    expect(canalDeOperacion({ canal: 'mail', automatica: true, ingest_document_id: 'abc' })).toEqual({ canal: 'mail', automatica: true, ingest_document_id: 'abc' });
  });

  it('una migración vieja es "migracion"', () => {
    expect(canalDeOperacion({ type: 'migration' }).canal).toBe('migracion');
  });

  it('una carga manual vieja se reconoce por su metadata', () => {
    expect(canalDeOperacion({ type: 'upload', metadata: { tipo: 'manual' } }).canal).toBe('manual');
  });

  it('una operación vieja con documento de la Bandeja toma la fuente y si fue automática', () => {
    const doc = { _id: 'd1', fuente: 'email', auto_importado: true };
    expect(canalDeOperacion({ type: 'upload', metadata: { tipo: 'galicia' } }, doc)).toEqual({ canal: 'mail', automatica: true, ingest_document_id: 'd1' });
    expect(canalDeOperacion({ type: 'upload' }, { _id: 'd2', fuente: 'api' }).canal).toBe('api');
    expect(canalDeOperacion({ type: 'upload' }, { _id: 'd3', fuente: 'upload' })).toMatchObject({ canal: 'bandeja', automatica: false });
  });

  it('sin canal ni documento es un archivo subido en Datos', () => {
    expect(canalDeOperacion({ type: 'upload', metadata: { tipo: 'santander' } })).toEqual({ canal: 'archivo', automatica: false, ingest_document_id: null });
  });

  it('fuentes desconocidas caen en bandeja', () => {
    expect(canalDeFuente('otra')).toBe('bandeja');
  });
});
