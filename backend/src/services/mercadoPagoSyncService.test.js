import { describe, it, expect, vi } from 'vitest';
import { sincronizarUsuario, asegurarConfigReporte } from './mercadoPagoSyncService.js';
import { MercadoPagoParser } from '../parsers/MercadoPagoParser.js';

// 20/10/2026 10:00 en Argentina
const AHORA = new Date('2026-10-20T13:00:00Z');

const REPORTE_CSV = [
  'DATE,SOURCE_ID,RECORD_TYPE,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,BALANCE_AMOUNT,CURRENCY',
  '2026-10-10T00:00:00.000-03:00,,initial_available_balance,,500.00,0.00,500.00,ARS',
  '2026-10-10T09:00:00.000-03:00,2000000000001,release,payment,0.00,100.00,400.00,ARS',
  '2026-10-16T09:00:00.000-03:00,2000000000002,release,asset_management_gain,1.25,0.00,401.25,ARS',
  '2026-10-18T09:00:00.000-03:00,2000000000003,release,payout,0.00,50.00,351.25,ARS'
].join('\n');

const procesado = (begin, end, file_name = 'mango-1.csv') => ({ file_name, begin_date: begin, end_date: end, status: 'processed' });

// Cliente de MP simulado
const clienteFalso = ({ reportes = [], despuesDePedir = null, config = { columns: [], report_translation: 'en' }, creaReporte = true } = {}) => {
  let lista = reportes;
  return {
    configReporte: vi.fn(async () => config),
    guardarConfigReporte: vi.fn(async c => c),
    listarReportes: vi.fn(async () => lista),
    pedirReporte: vi.fn(async () => {
      if (despuesDePedir) lista = despuesDePedir;
      return creaReporte;
    }),
    descargarReporte: vi.fn(async () => REPORTE_CSV)
  };
};

const depsCon = (mp, { token = 'APP_USR-x', estado = { ultimaFechaImportada: '15/10/2026', ultimaSync: null }, existente = false } = {}) => ({
  leerToken: vi.fn(async () => token),
  estadoSync: vi.fn(async () => estado),
  recibir: vi.fn(async () => ({ existente })),
  crearCliente: vi.fn(() => mp),
  esperar: vi.fn(async () => {}),
  ahora: AHORA
});

describe('sincronizarUsuario', () => {
  it('sin token no hace nada', async () => {
    const deps = depsCon(clienteFalso(), { token: null });
    expect(await sincronizarUsuario('u1', deps)).toEqual({ estado: 'sin_token' });
    expect(deps.crearCliente).not.toHaveBeenCalled();
  });

  it('al día si ya trajo hasta ayer', async () => {
    const deps = depsCon(clienteFalso(), { estado: { ultimaFechaImportada: null, ultimaSync: '2026-10-19' } });
    expect(await sincronizarUsuario('u1', deps)).toEqual({ estado: 'al_dia' });
  });

  it('con un reporte listo deja en la Bandeja solo los días que faltan', async () => {
    const mp = clienteFalso({ reportes: [procesado('2026-10-10T03:00:00Z', '2026-10-20T03:00:00Z')] });
    const deps = depsCon(mp);
    const r = await sincronizarUsuario('u1', deps);

    expect(r).toEqual({ estado: 'en_bandeja', movimientos: 2, desde: '2026-10-16', hasta: '2026-10-19' });
    const [userId, { buffer, filename }] = deps.recibir.mock.calls[0];
    expect(userId).toBe('u1');
    expect(filename).toBe('mercadopago-api-2026-10-16-a-2026-10-19.csv');

    // El archivo es el CSV de siempre: lo detecta y lo parsea MercadoPagoParser
    const csv = buffer.toString('utf-8');
    expect(MercadoPagoParser.detectar(csv)).toMatchObject({ tipo: 'mercadopago' });
    expect(csv.split('\n')[1]).toBe('400,00;1,25;-50,00;351,25');
    const transacciones = await new MercadoPagoParser(buffer).parse();
    expect(transacciones.map(t => [t.fecha, t.detalle, t.importe, t.tipo])).toEqual([
      ['16-10-2026', 'Rendimientos', 1.25, 'Ingreso'],
      ['18-10-2026', 'Transferencia enviada', 50, 'Gasto']
    ]);
    expect(mp.pedirReporte).not.toHaveBeenCalled();
  });

  it('el mismo período ya en la Bandeja da ya_estaba', async () => {
    const mp = clienteFalso({ reportes: [procesado('2026-10-10T03:00:00Z', '2026-10-20T03:00:00Z')] });
    expect((await sincronizarUsuario('u1', depsCon(mp, { existente: true }))).estado).toBe('ya_estaba');
  });

  it('sin reporte lo pide, espera y lo usa si sale a tiempo', async () => {
    const mp = clienteFalso({ despuesDePedir: [procesado('2026-10-16T03:00:00Z', '2026-10-20T02:59:59Z')] });
    const deps = depsCon(mp);
    const r = await sincronizarUsuario('u1', deps);

    expect(mp.pedirReporte).toHaveBeenCalledWith('2026-10-16T00:00:00-03:00', '2026-10-19T23:59:59-03:00');
    expect(deps.esperar).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ estado: 'en_bandeja', movimientos: 2 });
  });

  it('si el reporte no sale, termina en reporte_pedido sin tocar la Bandeja', async () => {
    const mp = clienteFalso();
    const deps = depsCon(mp);
    expect(await sincronizarUsuario('u1', deps)).toEqual({ estado: 'reporte_pedido', desde: '2026-10-16', hasta: '2026-10-19' });
    expect(deps.esperar).toHaveBeenCalledTimes(6);
    expect(deps.recibir).not.toHaveBeenCalled();
  });

  it('con esperas: 0 (desde la UI) pide el reporte y vuelve enseguida', async () => {
    const mp = clienteFalso();
    const deps = { ...depsCon(mp), esperas: 0 };
    expect((await sincronizarUsuario('u1', deps)).estado).toBe('reporte_pedido');
    expect(mp.pedirReporte).toHaveBeenCalledTimes(1);
    expect(deps.esperar).not.toHaveBeenCalled();
  });

  it('con un reporte en preparación no pide otro', async () => {
    const mp = clienteFalso({ reportes: [{ begin_date: '2026-10-16T03:00:00Z', end_date: '2026-10-20T02:59:59Z', status: 'pending' }] });
    expect((await sincronizarUsuario('u1', depsCon(mp))).estado).toBe('en_preparacion');
    expect(mp.pedirReporte).not.toHaveBeenCalled();
  });

  it('un 203 de MP no espera: reintenta la próxima corrida', async () => {
    const mp = clienteFalso({ creaReporte: false });
    const deps = depsCon(mp);
    expect((await sincronizarUsuario('u1', deps)).estado).toBe('reporte_pedido');
    expect(deps.esperar).not.toHaveBeenCalled();
  });

  it('sin movimientos en el período no crea nada', async () => {
    const mp = clienteFalso({ reportes: [procesado('2026-10-19T03:00:00Z', '2026-10-20T03:00:00Z')] });
    const deps = depsCon(mp, { estado: { ultimaFechaImportada: '18/10/2026', ultimaSync: null } });
    expect(await sincronizarUsuario('u1', deps)).toEqual({ estado: 'sin_movimientos', desde: '2026-10-19', hasta: '2026-10-19' });
    expect(deps.recibir).not.toHaveBeenCalled();
  });
});

describe('asegurarConfigReporte', () => {
  it('crea la configuración si no hay', async () => {
    const mp = clienteFalso({ config: null });
    expect(await asegurarConfigReporte(mp)).toBe('creada');
    expect(mp.guardarConfigReporte.mock.calls[0][0].report_translation).toBe('en');
  });

  it('suma las columnas que faltan sin sacar las del usuario', async () => {
    const mp = clienteFalso({ config: { columns: [{ key: 'DATE' }, { key: 'STORE_NAME' }], report_translation: 'es', file_name_prefix: 'mio' } });
    expect(await asegurarConfigReporte(mp)).toBe('actualizada');
    const [config, opciones] = mp.guardarConfigReporte.mock.calls[0];
    expect(opciones).toEqual({ existente: true });
    expect(config.file_name_prefix).toBe('mio');
    expect(config.report_translation).toBe('en');
    expect(config.columns.map(c => c.key)).toEqual(expect.arrayContaining(['DATE', 'STORE_NAME', 'DESCRIPTION', 'NET_DEBIT_AMOUNT']));
  });

  it('no toca una configuración que ya sirve', async () => {
    const columns = ['DATE', 'SOURCE_ID', 'RECORD_TYPE', 'DESCRIPTION', 'NET_CREDIT_AMOUNT', 'NET_DEBIT_AMOUNT', 'BALANCE_AMOUNT', 'CURRENCY'].map(key => ({ key }));
    const mp = clienteFalso({ config: { columns, report_translation: 'en' } });
    expect(await asegurarConfigReporte(mp)).toBe('ok');
    expect(mp.guardarConfigReporte).not.toHaveBeenCalled();
  });
});
