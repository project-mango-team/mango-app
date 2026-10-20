import { describe, it, expect, vi } from 'vitest';
import { validarFormatoToken, conectarCuenta, probarConexion, estadoCuenta, desconectarCuenta, SECRETO_MP } from './mercadoPagoCuentaService.js';
import { MercadoPagoError } from './mercadoPagoClient.js';

const TOKEN = 'APP_USR-1234567890123456-102026-abcdef0123456789abcdef0123456789-111222333';

const depsCon = ({ usuario = { id: 1, nickname: 'USUARIO_PRUEBA', site_id: 'MLA', email: 'no@mostrar' }, fallo = null, guardado = TOKEN, secretos = [] } = {}) => ({
  crearCliente: vi.fn(() => ({
    usuario: vi.fn(async () => {
      if (fallo) throw fallo;
      return usuario;
    })
  })),
  guardarSecreto: vi.fn(async (userId, nombre) => ({ nombre, pista: '3333' })),
  leerSecreto: vi.fn(async () => guardado),
  borrarSecreto: vi.fn(async () => true),
  listarSecretos: vi.fn(async () => secretos)
});

describe('validarFormatoToken', () => {
  it('acepta un token de producción y lo limpia', () => {
    expect(validarFormatoToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('rechaza vacío, tokens de prueba y cualquier otra cosa', () => {
    expect(() => validarFormatoToken('')).toThrow(/Pegá/);
    expect(() => validarFormatoToken(undefined)).toThrow(/Pegá/);
    expect(() => validarFormatoToken('TEST-123')).toThrow(/prueba/);
    expect(() => validarFormatoToken('hola')).toThrow(/APP_USR-/);
    expect(() => validarFormatoToken('APP_USR-corto')).toThrow(/APP_USR-/);
  });
});

describe('conectarCuenta', () => {
  it('prueba el token y lo guarda cifrado; devuelve solo alias y país', async () => {
    const deps = depsCon();
    const r = await conectarCuenta('u1', TOKEN, deps);
    expect(deps.crearCliente).toHaveBeenCalledWith(TOKEN);
    expect(deps.guardarSecreto).toHaveBeenCalledWith('u1', SECRETO_MP, TOKEN, { descripcion: 'Token de Mercado Pago' });
    expect(r).toEqual({ conectado: true, cuenta: { nickname: 'USUARIO_PRUEBA', site_id: 'MLA' }, credencial: { nombre: 'mercadopago', pista: '3333' } });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });

  it('un token rechazado por MP es un 400 y no se guarda', async () => {
    const deps = depsCon({ fallo: new MercadoPagoError('Mercado Pago rechazó el token: revisá…', 401) });
    await expect(conectarCuenta('u1', TOKEN, deps)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/rechazó/) });
    expect(deps.guardarSecreto).not.toHaveBeenCalled();
  });

  it('MP caído es un 502', async () => {
    const deps = depsCon({ fallo: new MercadoPagoError('Mercado Pago GET /users/me: 500', 500) });
    await expect(conectarCuenta('u1', TOKEN, deps)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('una cuenta de otro país no se conecta', async () => {
    const deps = depsCon({ usuario: { nickname: 'X', site_id: 'MLB' } });
    await expect(conectarCuenta('u1', TOKEN, deps)).rejects.toThrow(/Argentina/);
    expect(deps.guardarSecreto).not.toHaveBeenCalled();
  });
});

describe('probarConexion', () => {
  it('usa el token guardado', async () => {
    const deps = depsCon();
    expect(await probarConexion('u1', deps)).toEqual({ conectado: true, cuenta: { nickname: 'USUARIO_PRUEBA', site_id: 'MLA' } });
    expect(deps.leerSecreto).toHaveBeenCalledWith('u1', 'mercadopago');
  });

  it('sin cuenta conectada es un 404', async () => {
    await expect(probarConexion('u1', depsCon({ guardado: null }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('un token vencido o revocado es un 400', async () => {
    const deps = depsCon({ fallo: new MercadoPagoError('rechazó', 401) });
    await expect(probarConexion('u1', deps)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('estado y desconexión', () => {
  it('estadoCuenta mira solo los metadatos del secreto mercadopago', async () => {
    const credencial = { nombre: 'mercadopago', pista: '3333' };
    expect(await estadoCuenta('u1', depsCon({ secretos: [{ nombre: 'pdf:galicia' }, credencial] }))).toEqual({ conectado: true, credencial });
    expect(await estadoCuenta('u1', depsCon())).toEqual({ conectado: false, credencial: null });
  });

  it('desconectarCuenta borra el secreto', async () => {
    const deps = depsCon();
    expect(await desconectarCuenta('u1', deps)).toEqual({ borrado: true });
    expect(deps.borrarSecreto).toHaveBeenCalledWith('u1', 'mercadopago');
  });
});
