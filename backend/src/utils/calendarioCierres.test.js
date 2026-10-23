import { describe, it, expect } from 'vitest';
import { ultimoCierre, estadoDeFuente, candidatoDe, armarChecklist, validarConfigFuente } from './calendarioCierres.js';

describe('ultimoCierre', () => {
  it('usa este mes si el cierre ya pasó o es hoy', () => {
    expect(ultimoCierre('2026-10-20', 15)).toBe('2026-10-15');
    expect(ultimoCierre('2026-10-15', 15)).toBe('2026-10-15');
  });
  it('usa el mes anterior si todavía no cerró', () => {
    expect(ultimoCierre('2026-10-10', 15)).toBe('2026-09-15');
    expect(ultimoCierre('2026-01-05', 15)).toBe('2025-12-15');
  });
  it('un día 31 cierra el último día de los meses cortos', () => {
    expect(ultimoCierre('2026-11-30', 31)).toBe('2026-11-30');
    expect(ultimoCierre('2026-03-05', 31)).toBe('2026-02-28');
  });
});

const config = { dia_cierre: 15, llegada: 'adjunto' };
const archivo = (fecha) => ({ fuente: 'galicia_visa', fecha, aviso: false });
const aviso = (fecha) => ({ fuente: 'galicia_visa', fecha, aviso: true });

describe('estadoDeFuente', () => {
  it('recibido si hay un archivo con fecha cercana al cierre', () => {
    expect(estadoDeFuente('2026-10-20', config, [archivo('2026-10-13')]).estado).toBe('recibido');
  });
  it('un archivo de otro mes no cuenta', () => {
    expect(estadoDeFuente('2026-10-25', config, [archivo('2026-09-15')]).estado).toBe('faltante');
  });
  it('esperando dentro de la gracia', () => {
    expect(estadoDeFuente('2026-10-18', config, []).estado).toBe('esperando');
  });
  it('faltante pasada la gracia', () => {
    expect(estadoDeFuente('2026-10-21', config, []).estado).toBe('faltante');
  });
  it('avisado si llegó el mail pero no el archivo', () => {
    expect(estadoDeFuente('2026-10-25', config, [aviso('2026-10-17')]).estado).toBe('avisado');
  });
  it('un aviso del ciclo anterior no cuenta', () => {
    expect(estadoDeFuente('2026-10-25', config, [aviso('2026-09-17')]).estado).toBe('faltante');
  });
  it('respeta la gracia configurada', () => {
    expect(estadoDeFuente('2026-10-21', { ...config, gracia: 10 }, []).estado).toBe('esperando');
  });
});

describe('candidatoDe', () => {
  it('ignora descartados', () => {
    expect(candidatoDe({ estado: 'descartado', deteccion: { tipo: 'galicia', producto: 'visa', cierre: '2026-10-15' } })).toBeNull();
  });
  it('archivo detectado', () => {
    expect(candidatoDe({ estado: 'listo', deteccion: { tipo: 'galicia', producto: 'visa', cierre: '2026-10-15' } }))
      .toEqual({ fuente: 'galicia_visa', fecha: '2026-10-15', aviso: false });
  });
  it('aviso por mail', () => {
    const c = candidatoDe({
      estado: 'pendiente_descarga', fuente: 'email_aviso',
      email: { from: 'e-resumen@mensajesgalicia.com.ar', subject: 'Resumen de Cuenta VISA', received_at: '2026-10-17T12:00:00Z' }
    });
    expect(c).toEqual({ fuente: 'galicia_visa', fecha: '2026-10-17', aviso: true });
  });
  it('documento sin fuente reconocida', () => {
    expect(candidatoDe({ estado: 'no_reconocido', deteccion: null })).toBeNull();
  });
});

describe('armarChecklist', () => {
  it('una fila por fuente activa', () => {
    const docs = [{ estado: 'importado', deteccion: { tipo: 'galicia', producto: 'visa', cierre: '2026-10-15' } }];
    const filas = armarChecklist('2026-10-25', [
      { fuente: 'galicia_visa', dia_cierre: 15, llegada: 'adjunto' },
      { fuente: 'galicia_mastercard', dia_cierre: 15, llegada: 'adjunto' },
      { fuente: 'santander_visa', dia_cierre: 10, llegada: 'manual', activa: false }
    ], docs);
    expect(filas.map(f => [f.fuente, f.estado])).toEqual([['galicia_visa', 'recibido'], ['galicia_mastercard', 'faltante']]);
  });
});

describe('validarConfigFuente', () => {
  it('acepta una config válida', () => {
    expect(validarConfigFuente('galicia_visa', { dia_cierre: '15', llegada: 'aviso' })).toEqual({ ok: true, datos: { dia_cierre: 15, llegada: 'aviso', activa: true } });
  });
  it('rechaza fuente, día o llegada inválidos', () => {
    expect(validarConfigFuente('nada', { dia_cierre: 1, llegada: 'aviso' }).ok).toBe(false);
    expect(validarConfigFuente('galicia_visa', { dia_cierre: 32, llegada: 'aviso' }).ok).toBe(false);
    expect(validarConfigFuente('galicia_visa', { dia_cierre: 5, llegada: 'otra' }).ok).toBe(false);
  });
});
