import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

// Carga el Apps Script real en un contexto aislado con Gmail, UrlFetchApp y Properties simulados
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fs.readFileSync(path.join(__dirname, '../../../integrations/gmail-apps-script/Mango.gs'), 'utf8');

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]; // "%PDF-1"
const LINK_SECRETO = 'https://eresumen.com.ar/r?token=SECRETO123';

const blob = (bytes, nombre = 'archivo') => ({
  _bytes: bytes, _nombre: nombre,
  getBytes: () => bytes, getName() { return this._nombre; }, setName(n) { this._nombre = n; return this; },
  copyBlob() { return blob(bytes, this._nombre); }
});

const respuesta = (codigo, cuerpo = '', { bytes, contentType = 'text/html' } = {}) => ({
  getResponseCode: () => codigo,
  getContentText: () => cuerpo,
  getBlob: () => blob(bytes || [...Buffer.from(cuerpo)]),
  getHeaders: () => ({ 'Content-Type': contentType })
});

const mensaje = ({ asunto, adjuntos = [], body = '', id }) => ({
  getAttachments: () => adjuntos.map(([nombre, bytes]) => ({ getName: () => nombre, copyBlob: () => blob(bytes, nombre) })),
  getBody: () => body,
  getHeader: (h) => (h === 'Message-ID' ? `<${id}@mail>` : ''),
  getId: () => id,
  getFrom: () => 'e-resumen@banco.com',
  getSubject: () => asunto,
  getDate: () => new Date('2026-10-02T10:00:00Z')
});

let ctx;
let llamadas;
let etiquetas;
let logs;

const cargar = ({ mango = () => respuesta(201, '{}'), links = {} } = {}) => {
  llamadas = [];
  etiquetas = {};
  logs = [];
  const hilos = [];
  ctx = {
    module: { exports: {} },
    console: { log: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ({ MANGO_URL: 'https://mango.test/', MANGO_TOKEN: 'mango_tokenDePrueba' })[k] }) },
    GmailApp: {
      getUserLabelByName: (n) => ({ nombre: n }),
      createLabel: (n) => ({ nombre: n }),
      search: (q) => { ctx._consulta = q; return hilos; }
    },
    UrlFetchApp: {
      fetch: (url, opciones = {}) => {
        llamadas.push({ url, opciones });
        if (url.startsWith('https://mango.test/')) return mango(url, opciones);
        return links[url] ? links[url]() : respuesta(404);
      }
    },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create: () => {} }) }) }) },
    _hilos: hilos
  };
  vm.createContext(ctx);
  vm.runInContext(SCRIPT, ctx);
  return ctx.module.exports;
};

const hilo = (asunto, mensajes) => ({
  getMessages: () => mensajes,
  getFirstMessageSubject: () => asunto,
  addLabel: (l) => { etiquetas[asunto] = l.nombre; }
});

describe('funciones puras', () => {
  let s;
  beforeEach(() => { s = cargar(); });

  it('etiquetas anidadas en la búsqueda', () => {
    expect(s.etiquetaParaBusqueda('Mango/Resumenes')).toBe('mango-resumenes');
  });

  it('reconoce adjuntos de resumen y descarta imágenes', () => {
    expect(s.esAdjuntoDeResumen('RESUMEN.PDF')).toBe(true);
    expect(s.esAdjuntoDeResumen('extracto.xlsx')).toBe(true);
    expect(s.esAdjuntoDeResumen('logo.png')).toBe(false);
  });

  it('encuentra el link del botón "Conocer resumen"', () => {
    const html = '<p>Hola</p><a href="https://banco.com/promo">Promos</a><a href="https://eresumen.com.ar/r?a=1&amp;b=2"><b>Conocer&nbsp;resumen</b></a>';
    expect(s.linkDeResumen(html)).toBe('https://eresumen.com.ar/r?a=1&b=2');
    expect(s.linkDeResumen('<a href="https://x.com">Otra cosa</a>')).toBeNull();
  });

  it('detecta PDF por firma o Content-Type', () => {
    expect(s.esPdf(PDF, 'application/octet-stream')).toBe(true);
    expect(s.esPdf([1, 2, 3, 4], 'application/pdf')).toBe(true);
    expect(s.esPdf([...Buffer.from('<html>')], 'text/html')).toBe(false);
  });

  it('resuelve un link a PDF dentro de una página', () => {
    expect(s.linkPdfEnHtml('<iframe src="/doc/resumen.pdf">', 'https://eresumen.com.ar/r?x=1')).toBe('https://eresumen.com.ar/doc/resumen.pdf');
    expect(s.linkPdfEnHtml('<p>nada</p>', 'https://a.com')).toBeNull();
  });
});

describe('procesarResumenes', () => {
  it('sube adjuntos, sigue el link de Visa, registra avisos y etiqueta los hilos', () => {
    const s = cargar({
      links: {
        [LINK_SECRETO]: () => respuesta(200, '', { bytes: PDF, contentType: 'application/pdf' }),
        'https://eresumen.com.ar/r?token=JS': () => respuesta(200, '<html><script>armarPdf()</script></html>')
      }
    });
    ctx._hilos.push(
      hilo('Resumen de Tarjeta MasterCard', [mensaje({ asunto: 'Resumen de Tarjeta MasterCard', id: 'm1', adjuntos: [['RESUMEN.PDF', PDF], ['logo.png', [1]]] })]),
      hilo('Resumen de Cuenta VISA', [mensaje({ asunto: 'Resumen de Cuenta VISA', id: 'v1', body: `<a href="${LINK_SECRETO}">Conocer resumen</a>` })]),
      hilo('VISA con JS', [mensaje({ asunto: 'VISA con JS', id: 'v2', body: '<a href="https://eresumen.com.ar/r?token=JS">Conocer resumen</a>' })]),
      hilo('Resumen de cuenta', [mensaje({ asunto: 'Resumen de cuenta', id: 'c1', body: '<p>Descargalo desde Online Banking</p>' })])
    );

    s.procesarResumenes();

    expect(ctx._consulta).toBe('label:mango-resumenes -label:mango-procesado -label:mango-error');
    const aMango = llamadas.filter(l => l.url.startsWith('https://mango.test'));
    expect(aMango.map(l => l.url.replace('https://mango.test', ''))).toEqual([
      '/api/ingest/documents', // adjunto Mastercard (el PNG se ignora)
      '/api/ingest/documents', // PDF bajado del link de Visa
      '/api/ingest/avisos', // el link no dio PDF
      '/api/ingest/avisos' // mail sin archivo
    ]);
    const [master, visa, visaJs] = aMango;
    expect(master.opciones.headers.Authorization).toBe('Bearer mango_tokenDePrueba');
    expect(master.opciones.payload.file.getName()).toBe('RESUMEN.PDF');
    expect(JSON.parse(master.opciones.payload.metadata)).toMatchObject({ message_id: '<m1@mail>', subject: 'Resumen de Tarjeta MasterCard' });
    expect(visa.opciones.payload.file.getName()).toBe('Resumen de Cuenta VISA.pdf');
    expect(JSON.parse(visaJs.opciones.payload)).toMatchObject({ message_id: '<v2@mail>' });
    expect(Object.values(etiquetas)).toEqual(['Mango/Procesado', 'Mango/Procesado', 'Mango/Procesado', 'Mango/Procesado']);
  });

  it('si Mango falla, etiqueta el hilo como error y sigue con los demás', () => {
    const s = cargar({ mango: (url) => (url.endsWith('/documents') ? respuesta(500, '{"message":"explotó"}') : respuesta(201, '{}')) });
    ctx._hilos.push(
      hilo('Con adjunto', [mensaje({ asunto: 'Con adjunto', id: 'a', adjuntos: [['r.pdf', PDF]] })]),
      hilo('Aviso', [mensaje({ asunto: 'Aviso', id: 'b' })])
    );
    s.procesarResumenes();
    expect(etiquetas).toEqual({ 'Con adjunto': 'Mango/Error', Aviso: 'Mango/Procesado' });
    expect(logs.join('\n')).toContain('explotó');
  });

  it('nunca loguea el link del resumen ni el token', () => {
    const s = cargar({ links: { [LINK_SECRETO]: () => respuesta(200, '<html>sin pdf</html>') } });
    ctx._hilos.push(hilo('Visa', [mensaje({ asunto: 'Visa', id: 'v', body: `<a href="${LINK_SECRETO}">Conocer resumen</a>` })]));
    s.procesarResumenes();
    const todo = logs.join('\n');
    expect(todo).not.toContain('SECRETO123');
    expect(todo).not.toContain('mango_tokenDePrueba');
  });
});

describe('configuración', () => {
  it('sin MANGO_URL o MANGO_TOKEN falla con un mensaje claro', () => {
    const s = cargar();
    ctx.PropertiesService.getScriptProperties = () => ({ getProperty: () => null });
    expect(() => s.procesarResumenes()).toThrow(/MANGO_URL/);
  });

  it('probarConexion usa /api/ingest/ping con el token', () => {
    const s = cargar({ mango: () => respuesta(200, '{"success":true}') });
    s.probarConexion();
    expect(llamadas[0].url).toBe('https://mango.test/api/ingest/ping');
    expect(llamadas[0].opciones.headers.Authorization).toBe('Bearer mango_tokenDePrueba');
  });
});
