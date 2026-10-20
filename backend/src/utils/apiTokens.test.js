import { describe, it, expect } from 'vitest';
import { generarToken, hashToken, prefijoVisible, tokenDesdeHeader, crearLimitador } from './apiTokens.js';

describe('tokens', () => {
  it('genera tokens distintos con prefijo mango_', () => {
    const a = generarToken();
    const b = generarToken();
    expect(a).toMatch(/^mango_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('el hash es estable y no contiene el token', () => {
    const t = generarToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toContain(t.slice(6));
  });

  it('prefijo visible no revela el token', () => {
    expect(prefijoVisible('mango_abcdefghijklmnop')).toBe('mango_abcd…');
  });

  it('lee solo headers Bearer con formato de token de Mango', () => {
    const t = generarToken();
    expect(tokenDesdeHeader(`Bearer ${t}`)).toBe(t);
    expect(tokenDesdeHeader(t)).toBeNull();
    expect(tokenDesdeHeader('Bearer otra-cosa')).toBeNull();
    expect(tokenDesdeHeader(undefined)).toBeNull();
  });
});

describe('crearLimitador', () => {
  it('deja pasar hasta max por ventana y después corta', () => {
    let t = 0;
    const permitir = crearLimitador({ max: 2, ventanaMs: 1000, ahora: () => t });
    expect(permitir('a')).toBe(true);
    expect(permitir('a')).toBe(true);
    expect(permitir('a')).toBe(false);
    expect(permitir('b')).toBe(true);
    t = 1001;
    expect(permitir('a')).toBe(true);
  });
});
