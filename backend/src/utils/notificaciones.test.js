import { describe, it, expect } from 'vitest';
import { normalizarNotificacion, avisoResumenNuevo, avisoResumenDisponible, avisoJobFallido } from './notificaciones.js';

describe('normalizarNotificacion', () => {
  it('pide tipo y título y completa el nivel', () => {
    expect(() => normalizarNotificacion({ titulo: 'x' })).toThrow();
    expect(() => normalizarNotificacion({ tipo: 'x' })).toThrow();
    expect(normalizarNotificacion({ tipo: 'general', titulo: 'Hola' })).toEqual({ tipo: 'general', nivel: 'info', titulo: 'Hola' });
  });

  it('solo acepta links internos', () => {
    expect(normalizarNotificacion({ tipo: 'a', titulo: 'b', link: '/bandeja' }).link).toBe('/bandeja');
    expect(() => normalizarNotificacion({ tipo: 'a', titulo: 'b', link: 'https://otro.com' })).toThrow();
    expect(() => normalizarNotificacion({ tipo: 'a', titulo: 'b', link: '//otro.com' })).toThrow();
    expect(() => normalizarNotificacion({ tipo: 'a', titulo: 'b', link: '//otro' })).toThrow();
    expect(normalizarNotificacion({ tipo: 'a', titulo: 'b', link: '/datos?mes=Enero' }).link).toBe('/datos?mes=Enero');
  });

  it('recorta textos largos', () => {
    const n = normalizarNotificacion({ tipo: 'a', titulo: 'x'.repeat(300), mensaje: 'y'.repeat(900) });
    expect(n.titulo).toHaveLength(120);
    expect(n.mensaje).toHaveLength(500);
    expect(n.titulo.endsWith('…')).toBe(true);
  });
});

describe('avisos de la Bandeja', () => {
  it('resumen nuevo con fuente detectada', () => {
    const n = avisoResumenNuevo({ _id: 'd1', filename: 'visa.pdf', deteccion: { tipo: 'galicia', producto: 'visa' } });
    expect(n.titulo).toBe('Llegó el resumen de Visa Galicia');
    expect(n.mensaje).toContain('visa.pdf');
    expect(n.link).toBe('/bandeja');
    expect(n.clave).toBe('ingest:d1');
  });

  it('resumen nuevo sin detección', () => {
    expect(avisoResumenNuevo({ _id: 'd2', filename: 'x.pdf', deteccion: null }).titulo).toBe('Llegó un resumen nuevo');
  });

  it('aviso sin archivo usa remitente y asunto', () => {
    const n = avisoResumenDisponible({ _id: 'd3', email: { from: 'avisos@galicia.com.ar', subject: 'Tu resumen Mastercard' } });
    expect(n.titulo).toBe('Tu resumen de Mastercard Galicia está disponible');
    expect(n.nivel).toBe('alerta');
    expect(avisoResumenDisponible({ _id: 'd4' }).titulo).toBe('Tenés un resumen disponible para bajar');
  });
});

describe('avisoJobFallido', () => {
  it('una notificación por job y día', () => {
    const n = avisoJobFallido('valuacion', '2026-10-20', 'timeout');
    expect(n.clave).toBe('job:valuacion:2026-10-20');
    expect(n.nivel).toBe('error');
    expect(n.mensaje).toBe('timeout');
  });
});
