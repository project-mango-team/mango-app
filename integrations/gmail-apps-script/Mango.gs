/**
 * Mango · resúmenes por mail
 *
 * Corre en tu cuenta de Gmail (Google Apps Script). Cada hora busca los mails con la etiqueta
 * "Mango/Resumenes" y los manda a la Bandeja de Mango:
 *   - adjuntos PDF/XLSX/CSV/TXT → se suben como documentos
 *   - mails con link "Conocer resumen" (Visa Galicia) → baja el PDF del link y lo sube
 *   - mails sin archivo → se registran como aviso ("falta el archivo")
 * Después etiqueta el hilo "Mango/Procesado" (o "Mango/Error" si algo falló).
 *
 * Configuración (Configuración del proyecto → Propiedades del script):
 *   MANGO_URL    URL de Mango, por ejemplo https://mi-mango.com (sin barra final)
 *   MANGO_TOKEN  Token de integración creado en Mango → Configuración
 *
 * Instalación: ver README.md en esta misma carpeta. Ejecutá `configurar` una vez.
 */

const CONFIG = {
  ETIQUETA_ENTRADA: 'Mango/Resumenes',
  ETIQUETA_OK: 'Mango/Procesado',
  ETIQUETA_ERROR: 'Mango/Error',
  EXTENSIONES: ['pdf', 'xlsx', 'xls', 'csv', 'txt'],
  // Texto del botón que lleva al resumen cuando el mail no lo trae adjunto
  TEXTO_LINK: /conocer\s+resumen|ver\s+resumen|descargar\s+resumen/i,
  MAX_HILOS_POR_CORRIDA: 20
};

// ---------- Funciones que ejecutás a mano ----------

/**
 * Ejecutala una vez: verifica la configuración, crea las etiquetas, prueba la conexión
 * y programa la corrida cada hora.
 */
function configurar() {
  const { url } = leerConfiguracion();
  [CONFIG.ETIQUETA_ENTRADA, CONFIG.ETIQUETA_OK, CONFIG.ETIQUETA_ERROR].forEach(obtenerEtiqueta);
  probarConexion();

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'procesarResumenes')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('procesarResumenes').timeBased().everyHours(1).create();

  console.log(`Listo: cada hora se van a mandar a ${url} los mails con la etiqueta "${CONFIG.ETIQUETA_ENTRADA}".`);
}

/**
 * Verifica que la URL y el token funcionen (no manda nada)
 */
function probarConexion() {
  const { url, token } = leerConfiguracion();
  const respuesta = UrlFetchApp.fetch(`${url}/api/ingest/ping`, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });
  const codigo = respuesta.getResponseCode();
  if (codigo !== 200) {
    throw new Error(`Mango respondió ${codigo}: ${mensajeDe(respuesta)}. Revisá MANGO_URL y MANGO_TOKEN.`);
  }
  console.log('Conexión con Mango OK');
}

/**
 * Procesa los mails pendientes. La corre el disparador cada hora (también se puede correr a mano).
 */
function procesarResumenes() {
  const config = leerConfiguracion();
  const ok = obtenerEtiqueta(CONFIG.ETIQUETA_OK);
  const error = obtenerEtiqueta(CONFIG.ETIQUETA_ERROR);
  const consulta = `label:${etiquetaParaBusqueda(CONFIG.ETIQUETA_ENTRADA)} -label:${etiquetaParaBusqueda(CONFIG.ETIQUETA_OK)} -label:${etiquetaParaBusqueda(CONFIG.ETIQUETA_ERROR)}`;
  const hilos = GmailApp.search(consulta, 0, CONFIG.MAX_HILOS_POR_CORRIDA);

  let enviados = 0;
  hilos.forEach(hilo => {
    try {
      hilo.getMessages().forEach(mensaje => {
        enviados += procesarMensaje(mensaje, config);
      });
      hilo.addLabel(ok);
    } catch (e) {
      // Nunca loguear links ni el token: solo el asunto y el motivo
      console.error(`Error con "${hilo.getFirstMessageSubject()}": ${e.message}`);
      hilo.addLabel(error);
    }
  });
  console.log(`${hilos.length} hilo(s) procesados, ${enviados} envío(s) a Mango`);
}

// ---------- Procesamiento ----------

/**
 * Manda a Mango lo que tenga el mensaje. Devuelve cuántos envíos hizo.
 */
function procesarMensaje(mensaje, config) {
  const metadata = metadataDe(mensaje);

  const adjuntos = mensaje.getAttachments({ includeInlineImages: false })
    .filter(a => esAdjuntoDeResumen(a.getName()));
  if (adjuntos.length) {
    adjuntos.forEach(adjunto => enviarDocumento(adjunto.copyBlob().setName(adjunto.getName()), metadata, config));
    return adjuntos.length;
  }

  const link = linkDeResumen(mensaje.getBody());
  if (link) {
    const pdf = bajarPdf(link);
    if (pdf) {
      enviarDocumento(pdf.setName(`${nombreSeguro(metadata.subject)}.pdf`), metadata, config);
      return 1;
    }
    console.warn(`"${metadata.subject}": el link no devolvió un PDF; se registra como aviso`);
  }

  enviarAviso(metadata, config);
  return 1;
}

/**
 * Sigue el link del resumen y devuelve el PDF como Blob, o null si no llega a un PDF.
 * Si la página es HTML, prueba una vez con el primer link a un PDF que encuentre.
 */
function bajarPdf(url) {
  const respuesta = UrlFetchApp.fetch(url, { followRedirects: true, muteHttpExceptions: true });
  if (respuesta.getResponseCode() !== 200) return null;

  const blob = respuesta.getBlob();
  if (esPdf(blob.getBytes(), respuesta.getHeaders()['Content-Type'])) return blob;

  const siguiente = linkPdfEnHtml(respuesta.getContentText(), url);
  if (!siguiente) return null;
  const segunda = UrlFetchApp.fetch(siguiente, { followRedirects: true, muteHttpExceptions: true });
  if (segunda.getResponseCode() !== 200) return null;
  const blob2 = segunda.getBlob();
  return esPdf(blob2.getBytes(), segunda.getHeaders()['Content-Type']) ? blob2 : null;
}

function enviarDocumento(blob, metadata, config) {
  const respuesta = UrlFetchApp.fetch(`${config.url}/api/ingest/documents`, {
    method: 'post',
    headers: { Authorization: `Bearer ${config.token}` },
    payload: { file: blob, metadata: JSON.stringify(metadata) },
    muteHttpExceptions: true
  });
  verificarRespuesta(respuesta, `subir "${blob.getName()}"`);
}

function enviarAviso(metadata, config) {
  const respuesta = UrlFetchApp.fetch(`${config.url}/api/ingest/avisos`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${config.token}` },
    payload: JSON.stringify(metadata),
    muteHttpExceptions: true
  });
  verificarRespuesta(respuesta, `registrar el aviso "${metadata.subject}"`);
}

// ---------- Utilidades de Apps Script ----------

function leerConfiguracion() {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty('MANGO_URL') || '').replace(/\/+$/, '');
  const token = props.getProperty('MANGO_TOKEN') || '';
  if (!/^https?:\/\//.test(url)) {
    throw new Error('Falta MANGO_URL en las propiedades del script (por ejemplo https://mi-mango.com)');
  }
  if (!/^mango_/.test(token)) {
    throw new Error('Falta MANGO_TOKEN en las propiedades del script (crealo en Mango → Configuración)');
  }
  return { url, token };
}

function obtenerEtiqueta(nombre) {
  return GmailApp.getUserLabelByName(nombre) || GmailApp.createLabel(nombre);
}

function verificarRespuesta(respuesta, accion) {
  const codigo = respuesta.getResponseCode();
  if (codigo !== 200 && codigo !== 201) {
    throw new Error(`No se pudo ${accion}: Mango respondió ${codigo} (${mensajeDe(respuesta)})`);
  }
}

function mensajeDe(respuesta) {
  try {
    return JSON.parse(respuesta.getContentText()).message || '';
  } catch (e) {
    return '';
  }
}

function metadataDe(mensaje) {
  return {
    message_id: mensaje.getHeader('Message-ID') || mensaje.getId(),
    from: mensaje.getFrom(),
    subject: mensaje.getSubject(),
    received_at: mensaje.getDate().toISOString()
  };
}

// ---------- Funciones puras (testeadas en Node) ----------

/**
 * "Mango/Resumenes" → "mango-resumenes" (así se escriben las etiquetas anidadas en la búsqueda de Gmail)
 */
function etiquetaParaBusqueda(nombre) {
  return nombre.toLowerCase().replace(/[\/\s]+/g, '-');
}

function esAdjuntoDeResumen(nombre) {
  const ext = String(nombre || '').toLowerCase().split('.').pop();
  return CONFIG.EXTENSIONES.indexOf(ext) !== -1;
}

/**
 * Link del botón "Conocer resumen" (o similar) en el HTML del mail, o null
 */
function linkDeResumen(html) {
  const anclas = String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
  for (const ancla of anclas) {
    const texto = ancla.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    const href = ancla.match(/href\s*=\s*["']([^"']+)["']/i);
    if (href && CONFIG.TEXTO_LINK.test(texto) && /^https?:\/\//i.test(href[1])) {
      return href[1].replace(/&amp;/g, '&');
    }
  }
  return null;
}

/**
 * ¿Son los bytes de un PDF? (por la firma %PDF o el Content-Type)
 */
function esPdf(bytes, contentType) {
  const firma = bytes && bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  return Boolean(firma || /application\/pdf/i.test(contentType || ''));
}

/**
 * Primer link a un PDF dentro de una página HTML (href/src que contenga "pdf"), resuelto contra la URL base
 */
function linkPdfEnHtml(html, base) {
  const match = String(html || '').match(/(?:href|src)\s*=\s*["']([^"']*pdf[^"']*)["']/i);
  if (!match) return null;
  const destino = match[1].replace(/&amp;/g, '&');
  if (/^https?:\/\//i.test(destino)) return destino;
  const origen = String(base).match(/^(https?:\/\/[^/]+)/i);
  if (!origen) return null;
  return destino.startsWith('/') ? origen[1] + destino : `${String(base).replace(/[^/]*$/, '')}${destino}`;
}

/**
 * Asunto como nombre de archivo
 */
function nombreSeguro(texto) {
  return String(texto || 'resumen').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'resumen';
}

// Para los tests en Node (en Apps Script `module` no existe)
if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG, procesarResumenes, procesarMensaje, configurar, probarConexion,
    etiquetaParaBusqueda, esAdjuntoDeResumen, linkDeResumen, esPdf, linkPdfEnHtml, nombreSeguro
  };
}
