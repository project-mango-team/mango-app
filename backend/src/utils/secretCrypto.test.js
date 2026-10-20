import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { cifrar, descifrar, claveDesdeEntorno, pistaDe, aadDe } from './secretCrypto.js';

const clave = crypto.randomBytes(32);

describe('cifrar / descifrar', () => {
  it('ida y vuelta, sin el texto plano en el resultado', () => {
    const c = cifrar('APP_USR-123456789-secreto', clave, 'u1:mp');
    expect(c.startsWith('v1.')).toBe(true);
    expect(c).not.toContain('secreto');
    expect(descifrar(c, clave, 'u1:mp')).toBe('APP_USR-123456789-secreto');
  });

  it('usa un IV distinto en cada cifrado', () => {
    expect(cifrar('igual', clave, 'a')).not.toBe(cifrar('igual', clave, 'a'));
  });

  it('soporta texto con acentos', () => {
    expect(descifrar(cifrar('contraseña ñandú', clave, 'a'), clave, 'a')).toBe('contraseña ñandú');
  });

  it('falla con otra clave, otro dueño o datos alterados', () => {
    const c = cifrar('token', clave, 'u1:mp');
    expect(() => descifrar(c, crypto.randomBytes(32), 'u1:mp')).toThrow('No se pudo descifrar');
    expect(() => descifrar(c, clave, 'u2:mp')).toThrow('No se pudo descifrar');
    const partes = c.split('.');
    partes[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => descifrar(partes.join('.'), clave, 'u1:mp')).toThrow('No se pudo descifrar');
  });

  it('rechaza formatos desconocidos y textos vacíos', () => {
    expect(() => descifrar('texto-plano', clave, 'a')).toThrow('Formato');
    expect(() => descifrar(undefined, clave, 'a')).toThrow('Formato');
    expect(() => cifrar('', clave, 'a')).toThrow();
  });
});

describe('claveDesdeEntorno', () => {
  it('lee 32 bytes en base64', () => {
    expect(claveDesdeEntorno({ SECRETS_KEY: clave.toString('base64') }).equals(clave)).toBe(true);
  });

  it('en producción rechaza la clave de dev de nodemon.json', () => {
    const dev = 'r21MeKzZqZdDxlvzl1IiimRIpL8x2hqkVm7TbyWDZto=';
    expect(() => claveDesdeEntorno({ SECRETS_KEY: dev, NODE_ENV: 'production' })).toThrow('desarrollo');
    expect(claveDesdeEntorno({ SECRETS_KEY: dev, NODE_ENV: 'development' })).toHaveLength(32);
  });

  it('sin variable devuelve null y con largo incorrecto falla', () => {
    expect(claveDesdeEntorno({})).toBeNull();
    expect(() => claveDesdeEntorno({ SECRETS_KEY: crypto.randomBytes(16).toString('base64') })).toThrow('32 bytes');
  });
});

describe('pistaDe / aadDe', () => {
  it('muestra los últimos 4 solo en textos largos', () => {
    expect(pistaDe('APP_USR-1234567890abcd')).toBe('…abcd');
    expect(pistaDe('clave123')).toBeNull();
  });

  it('el AAD combina usuario y nombre', () => {
    expect(aadDe('abc', 'mercadopago')).toBe('abc:mercadopago');
  });
});
