import { describe, it, expect } from 'vitest';
import { fechaLocal, slotDiario, validarHora, filtroReclamable, resumirResultado, mensajeDeError, POLITICA_DEFAULT } from './jobSchedule.js';

describe('fechaLocal', () => {
  it('usa la hora de Argentina (UTC-3)', () => {
    // 02:30 UTC del 21/10 son las 23:30 del 20/10 en Argentina
    expect(fechaLocal(new Date('2026-10-21T02:30:00Z'))).toEqual({ fecha: '2026-10-20', minutos: 23 * 60 + 30 });
  });

  it('medianoche local es el minuto 0', () => {
    expect(fechaLocal(new Date('2026-10-21T03:00:00Z'))).toEqual({ fecha: '2026-10-21', minutos: 0 });
  });
});

describe('slotDiario', () => {
  it('no está vencido antes de la hora', () => {
    expect(slotDiario(new Date('2026-10-20T08:59:00Z'), '06:00')).toEqual({ slot: '2026-10-20', vencido: false });
  });

  it('está vencido a la hora exacta y después', () => {
    expect(slotDiario(new Date('2026-10-20T09:00:00Z'), '06:00').vencido).toBe(true);
    expect(slotDiario(new Date('2026-10-20T20:00:00Z'), '06:00').vencido).toBe(true);
  });

  it('el slot cambia con el día local, no con el UTC', () => {
    expect(slotDiario(new Date('2026-10-21T01:00:00Z'), '06:00').slot).toBe('2026-10-20');
  });

  it('rechaza horas inválidas', () => {
    expect(() => slotDiario(new Date(), '6:00')).toThrow();
    expect(validarHora('23:59')).toBe(true);
    expect(validarHora('24:00')).toBe(false);
  });
});

describe('filtroReclamable', () => {
  it('permite reintentar errores viejos con intentos disponibles y retomar corridas colgadas', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const f = filtroReclamable('demo', '2026-10-20', now);
    expect(f.job).toBe('demo');
    expect(f.slot).toBe('2026-10-20');
    const [error, colgada] = f.$or;
    expect(error.estado).toBe('error');
    expect(error.intentos.$lt).toBe(POLITICA_DEFAULT.maxIntentos);
    expect(error.terminado_at.$lte.getTime()).toBe(now.getTime() - POLITICA_DEFAULT.reintentoMs);
    expect(colgada.estado).toBe('corriendo');
    expect(colgada.iniciado_at.$lte.getTime()).toBe(now.getTime() - POLITICA_DEFAULT.timeoutMs);
  });
});

describe('resumirResultado', () => {
  it('deja pasar objetos chicos y envuelve valores sueltos', () => {
    expect(resumirResultado({ procesados: 3 })).toEqual({ procesados: 3 });
    expect(resumirResultado(5)).toEqual({ valor: 5 });
    expect(resumirResultado(undefined)).toBeNull();
  });

  it('trunca resultados grandes', () => {
    const r = resumirResultado({ lista: 'x'.repeat(5000) }, 100);
    expect(r.truncado).toHaveLength(100);
  });

  it('no rompe con referencias circulares', () => {
    const a = {};
    a.a = a;
    expect(resumirResultado(a)).toEqual({ valor: 'resultado no serializable' });
  });
});

describe('mensajeDeError', () => {
  it('toma el mensaje y lo recorta', () => {
    expect(mensajeDeError(new Error('falló'))).toBe('falló');
    expect(mensajeDeError('x'.repeat(20), 5)).toBe('xxxxx…');
  });
});
