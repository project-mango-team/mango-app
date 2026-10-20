import { describe, it, expect } from 'vitest';
import { fuenteDeAviso, fuenteDeDeteccion, homebankingDe, fechaDelResumen, avisoCoincide, elegirAviso } from './fuentesResumen.js';

// Mails y detecciones sintéticos
const aviso = (subject, received_at, from = 'Banco Galicia <avisos@galicia.example>') => ({ email: { from, subject, received_at } });
const CAJA_SEPTIEMBRE = { tipo: 'galicia', producto: 'caja_ahorro', periodo: { desde: '2026-09-01', hasta: '2026-09-30' } };

describe('fuenteDeAviso', () => {
  it('Galicia caja de ahorro por el asunto', () => {
    expect(fuenteDeAviso({ from: 'Galicia <x@galicia.example>', subject: 'Ya está listo el resumen de tu cuenta' }))
      .toEqual({ banco: 'galicia', fuente: 'galicia_caja_ahorro' });
  });

  it('tarjetas por el asunto', () => {
    expect(fuenteDeAviso({ from: 'Galicia', subject: 'Tu resumen de Visa' }).fuente).toBe('galicia_visa');
    expect(fuenteDeAviso({ from: 'Galicia', subject: 'Resumen Mastercard' }).fuente).toBe('galicia_mastercard');
    expect(fuenteDeAviso({ from: 'Santander <a@santander.example>', subject: 'Resumen American Express' }).fuente).toBe('santander_amex');
  });

  it('banco conocido sin producto: hay link pero no fuente', () => {
    expect(fuenteDeAviso({ from: 'Santander', subject: 'Tu resumen está disponible' })).toEqual({ banco: 'santander', fuente: null });
  });

  it('remitente desconocido', () => {
    expect(fuenteDeAviso({ from: 'otro@ejemplo.com', subject: 'Resumen de cuenta' })).toEqual({ banco: null, fuente: null });
    expect(fuenteDeAviso()).toEqual({ banco: null, fuente: null });
  });
});

describe('fuenteDeDeteccion y homebanking', () => {
  it('banco + producto del parser', () => {
    expect(fuenteDeDeteccion(CAJA_SEPTIEMBRE)).toBe('galicia_caja_ahorro');
    expect(fuenteDeDeteccion({ tipo: 'santander', producto: 'visa' })).toBe('santander_visa');
    expect(fuenteDeDeteccion({ tipo: 'galicia' })).toBeNull();
    expect(fuenteDeDeteccion(null)).toBeNull();
  });

  it('link por banco', () => {
    expect(homebankingDe('galicia')).toMatch(/^https:\/\//);
    expect(homebankingDe(null)).toBeNull();
  });

  it('fecha del resumen: cierre o fin del período', () => {
    expect(fechaDelResumen({ cierre: '2026-10-01' })).toBe('2026-10-01');
    expect(fechaDelResumen(CAJA_SEPTIEMBRE)).toBe('2026-09-30');
    expect(fechaDelResumen({})).toBeNull();
  });
});

describe('avisoCoincide', () => {
  const avisoCaja = aviso('Ya está listo el resumen de tu cuenta', '2026-10-03T12:00:00Z');

  it('misma fuente y período', () => {
    expect(avisoCoincide(avisoCaja, CAJA_SEPTIEMBRE)).toBe(true);
  });

  it('otro producto del mismo banco no lo cierra', () => {
    expect(avisoCoincide(avisoCaja, { tipo: 'galicia', producto: 'visa', cierre: '2026-10-01' })).toBe(false);
  });

  it('otro período no lo cierra', () => {
    const agosto = { ...CAJA_SEPTIEMBRE, periodo: { desde: '2026-08-01', hasta: '2026-08-31' } };
    const noviembre = { ...CAJA_SEPTIEMBRE, periodo: { desde: '2026-10-01', hasta: '2026-10-31' } };
    expect(avisoCoincide(avisoCaja, agosto)).toBe(false);
    expect(avisoCoincide(avisoCaja, noviembre)).toBe(false);
  });

  it('sin fecha en el resumen o en el mail no se cierra', () => {
    expect(avisoCoincide(avisoCaja, { tipo: 'galicia', producto: 'caja_ahorro', periodo: null })).toBe(false);
    expect(avisoCoincide(aviso('Resumen de tu cuenta', undefined), CAJA_SEPTIEMBRE)).toBe(false);
  });

  it('un extracto bajado unos días después del mail también lo cierra', () => {
    expect(avisoCoincide(avisoCaja, { ...CAJA_SEPTIEMBRE, periodo: { desde: '2026-09-01', hasta: '2026-10-10' } })).toBe(true);
  });
});

describe('elegirAviso', () => {
  it('entre varios avisos de la misma fuente, el más cercano al cierre', () => {
    const septiembre = { _id: 'sep', ...aviso('Resumen de tu cuenta', '2026-10-02T12:00:00Z') };
    const agosto = { _id: 'ago', ...aviso('Resumen de tu cuenta', '2026-09-02T12:00:00Z') };
    const visa = { _id: 'visa', ...aviso('Resumen Visa', '2026-10-02T12:00:00Z') };
    expect(elegirAviso([agosto, visa, septiembre], CAJA_SEPTIEMBRE)._id).toBe('sep');
    expect(elegirAviso([visa], CAJA_SEPTIEMBRE)).toBeNull();
  });
});
