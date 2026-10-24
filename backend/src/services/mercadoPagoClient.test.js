import { describe, it, expect, vi } from 'vitest';
import { crearClienteMercadoPago, MercadoPagoError, MP_API_URL } from './mercadoPagoClient.js';

const TOKEN = 'APP_USR-token-de-prueba';

// http simulado: responde según método y ruta; registra los requests
const httpFalso = (rutas) => {
  const request = vi.fn(async ({ method, url }) => {
    const clave = `${method} ${url.replace(MP_API_URL, '')}`;
    const r = rutas[clave];
    if (!r) throw Object.assign(new Error('not found'), { response: { status: 404, data: { message: 'not_found' } } });
    if (r.error) throw Object.assign(new Error('fallo'), { response: { status: r.error, data: { message: r.message } } });
    return { status: r.status ?? 200, data: r.data };
  });
  return { request };
};

describe('crearClienteMercadoPago', () => {
  it('pide token', () => {
    expect(() => crearClienteMercadoPago('')).toThrow(MercadoPagoError);
  });

  it('manda el token como Bearer y devuelve los datos', async () => {
    const http = httpFalso({ 'GET /users/me': { data: { id: 123, site_id: 'MLA' } } });
    const mp = crearClienteMercadoPago(TOKEN, { http });
    expect(await mp.usuario()).toEqual({ id: 123, site_id: 'MLA' });
    expect(http.request.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('config inexistente es null', async () => {
    const mp = crearClienteMercadoPago(TOKEN, { http: httpFalso({}) });
    expect(await mp.configReporte()).toBeNull();
  });

  it('guarda la config con POST o PUT', async () => {
    const http = httpFalso({
      'POST /v1/account/release_report/config': { status: 201, data: { ok: 'post' } },
      'PUT /v1/account/release_report/config': { data: { ok: 'put' } }
    });
    const mp = crearClienteMercadoPago(TOKEN, { http });
    expect(await mp.guardarConfigReporte({})).toEqual({ ok: 'post' });
    expect(await mp.guardarConfigReporte({}, { existente: true })).toEqual({ ok: 'put' });
  });

  it('pide un reporte con fechas ISO y respeta el 203', async () => {
    const http = httpFalso({ 'POST /v1/account/release_report': { status: 202 } });
    const mp = crearClienteMercadoPago(TOKEN, { http });
    expect(await mp.pedirReporte('2026-10-01T00:00:00Z', '2026-10-19T00:00:00Z')).toBe(true);
    expect(http.request.mock.calls[0][0].data).toEqual({
      begin_date: '2026-10-01T00:00:00.000Z', end_date: '2026-10-19T00:00:00.000Z'
    });

    const mp203 = crearClienteMercadoPago(TOKEN, { http: httpFalso({ 'POST /v1/account/release_report': { status: 203 } }) });
    expect(await mp203.pedirReporte('2026-10-01', '2026-10-02')).toBe(false);
  });

  it('no pide reportes de más de 60 días', async () => {
    const mp = crearClienteMercadoPago(TOKEN, { http: httpFalso({}) });
    await expect(mp.pedirReporte('2026-01-01', '2026-04-01')).rejects.toThrow(/60 días/);
  });

  it('baja el reporte como texto', async () => {
    const http = httpFalso({ 'GET /v1/account/release_report/mango-1.csv': { data: 'DATE,DESCRIPTION\n' } });
    const mp = crearClienteMercadoPago(TOKEN, { http });
    expect(await mp.descargarReporte('mango-1.csv')).toBe('DATE,DESCRIPTION\n');
    expect(http.request.mock.calls[0][0].responseType).toBe('text');
  });

  it('busca pagos con los parámetros dados', async () => {
    const http = httpFalso({ 'GET /v1/payments/search': { data: { results: [], paging: { total: 0 } } } });
    const mp = crearClienteMercadoPago(TOKEN, { http });
    await mp.buscarPagos({ 'payer.id': 123 });
    expect(http.request.mock.calls[0][0].params).toEqual({ 'payer.id': 123 });
  });

  it('un token rechazado da un mensaje claro y sin el token', async () => {
    const mp = crearClienteMercadoPago(TOKEN, { http: httpFalso({ 'GET /users/me': { error: 401, message: 'invalid_token' } }) });
    const error = await mp.usuario().catch(e => e);
    expect(error).toBeInstanceOf(MercadoPagoError);
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/rechazó el token/);
    expect(error.message).not.toContain(TOKEN);
  });

  it('otros errores dicen método, ruta y status', async () => {
    const mp = crearClienteMercadoPago(TOKEN, { http: httpFalso({ 'GET /v1/payments/9': { error: 500, message: 'boom' } }) });
    await expect(mp.pago(9)).rejects.toThrow('Mercado Pago GET /v1/payments/9: 500 boom');
  });
});
