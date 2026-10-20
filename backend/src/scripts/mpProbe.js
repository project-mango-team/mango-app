// Probe de la API de Mercado Pago (MP-01). Lo corre el usuario con su propio token:
//
//   $env:MP_ACCESS_TOKEN = "APP_USR-..."; node src/scripts/mpProbe.js; Remove-Item Env:MP_ACCESS_TOKEN
//
// Por defecto es de solo lectura y no imprime nombres, montos ni ids: solo cuenta qué tipos de
// movimientos y qué campos trae la API, para confirmar el mapeo de plans/mercadopago.md.
// Con --pedir-reporte crea la configuración del reporte de liberaciones (si no existe) y pide uno
// de los últimos 30 días; volver a correr el probe unos minutos después para leerlo.

import { crearClienteMercadoPago, CONFIG_REPORTE } from '../services/mercadoPagoClient.js';
import { leerReporteLiberaciones, movimientosDelReporte } from '../utils/mercadoPagoMapping.js';

const contar = (valores) => {
  const conteo = {};
  for (const v of valores) conteo[v || '(vacío)'] = (conteo[v || '(vacío)'] || 0) + 1;
  return conteo;
};

// Solo qué campos vienen con datos, nunca su valor
const camposConDatos = (obj, prefijo = '', profundidad = 0) => {
  if (!obj || typeof obj !== 'object' || profundidad > 2) return [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const clave = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) return camposConDatos(v, clave, profundidad + 1);
    const tieneDato = Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
    return tieneDato ? [clave] : [];
  });
};

const seccion = (titulo) => console.log(`\n== ${titulo} ==`);

const main = async () => {
  const mp = crearClienteMercadoPago(process.env.MP_ACCESS_TOKEN);
  const pedirReporte = process.argv.includes('--pedir-reporte');

  seccion('Usuario');
  const usuario = await mp.usuario();
  console.log({ site_id: usuario.site_id, tiene_id: Boolean(usuario.id) });

  seccion('Reporte de liberaciones');
  const config = await mp.configReporte();
  console.log(config ? { configurado: true, columnas: (config.columns || []).map(c => c.key) } : { configurado: false });

  const reportes = await mp.listarReportes();
  console.log({ reportes_generados: reportes.length, estados: contar(reportes.map(r => r.status)) });

  const listo = reportes
    .filter(r => r.file_name && (!r.status || ['processed', 'enabled'].includes(r.status)))
    .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)))[0];

  let fuentes = [];
  if (listo) {
    const filas = leerReporteLiberaciones(await mp.descargarReporte(listo.file_name));
    const { movimientos, otrasMonedas } = movimientosDelReporte(filas);
    fuentes = movimientos.map(m => m.referencia).filter(Boolean);
    console.log({
      periodo: `${String(listo.begin_date).slice(0, 10)} a ${String(listo.end_date).slice(0, 10)}`,
      columnas: Object.keys(filas[0] || {}),
      filas: filas.length,
      record_type: contar(filas.map(f => f.RECORD_TYPE)),
      description: contar(filas.map(f => String(f.DESCRIPTION || '').replace(/_\d+$/, '_<id>'))),
      movimientos: movimientos.length,
      creditos: movimientos.filter(m => m.monto > 0).length,
      debitos: movimientos.filter(m => m.monto < 0).length,
      detalle_mango: contar(movimientos.map(m => m.detalle)),
      otras_monedas: otrasMonedas
    });
  } else {
    console.log('No hay reportes listos para leer.');
  }

  if (pedirReporte) {
    if (!config) {
      await mp.guardarConfigReporte(CONFIG_REPORTE);
      console.log('Configuración del reporte creada.');
    }
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 30 * 86400000);
    const creado = await mp.pedirReporte(desde, hasta);
    console.log(creado ? 'Reporte pedido: correr el probe de nuevo en unos minutos.' : 'Mercado Pago no creó el reporte (203): reintentar más tarde.');
  } else if (!listo) {
    console.log('Para pedir uno: node src/scripts/mpProbe.js --pedir-reporte');
  }

  seccion('Búsqueda de pagos (últimos 30 días)');
  const base = { sort: 'date_created', criteria: 'desc', range: 'date_created', begin_date: 'NOW-30DAYS', end_date: 'NOW', limit: 50 };
  const comoCobrador = await mp.buscarPagos({ ...base, 'collector.id': usuario.id });
  const comoPagador = await mp.buscarPagos({ ...base, 'payer.id': usuario.id });
  const resumir = (r) => ({
    total: r.paging?.total ?? 0,
    operation_type: contar((r.results || []).map(p => p.operation_type)),
    payment_type_id: contar((r.results || []).map(p => p.payment_type_id))
  });
  console.log({ como_cobrador: resumir(comoCobrador), como_pagador: resumir(comoPagador) });

  seccion('Detalle de pagos (qué campos traen datos)');
  // Hasta 3 operaciones del reporte, o de la búsqueda si no hubo reporte
  const ids = [...fuentes, ...(comoPagador.results || []).map(p => p.id), ...(comoCobrador.results || []).map(p => p.id)]
    .filter(Boolean).slice(0, 3);
  for (const [i, id] of ids.entries()) {
    try {
      const pago = await mp.pago(id);
      console.log(`pago ${i + 1}:`, camposConDatos(pago).filter(c => /description|payer|collector|point_of_interaction|operation_type|payment_method|statement_descriptor|additional_info/.test(c)));
    } catch (error) {
      console.log(`pago ${i + 1}: ${error.message}`);
    }
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
