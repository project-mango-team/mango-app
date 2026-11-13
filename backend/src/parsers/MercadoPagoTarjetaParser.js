import { BaseParser } from './BaseParser.js';
import { PDFParse } from 'pdf-parse';
import iconv from 'iconv-lite';
import { CATEGORIA_IMPUESTOS } from '../models/User.js';
import { extraerTotalesTarjetaMP, cierreDelResumen, mesDeAbreviatura, montosDeLinea } from '../utils/totalesTarjetaMP.js';

export const ORIGEN_TARJETA_MP = 'Mercado Pago Tarjeta';

const SECCIONES = [
  { clave: 'anterior', re: /^Composici[oó]n del saldo del periodo anterior/i },
  { clave: 'consumos', re: /^Consumos$/i },
  { clave: 'impuestos', re: /^Impuestos e intereses\d?$/i },
  { clave: 'pagos', re: /^Pagos anticipados$/i },
  { clave: 'ajustes', re: /^Ajustes y reembolsos$/i }
];

// "9/oct Descripción ... $ 1.234,56" (el monto a veces viene pegado a la descripción)
const FILA = /^(\d{1,2})\/([a-zA-Z]{3})\s+(.+)$/;
const CUOTA = /\b(\d{1,2}) de (\d{1,2})\b/;
const OPERACION = /\b\d{6,}\b/;

/**
 * Parser del resumen PDF de la tarjeta de crédito de Mercado Pago (MP-08).
 * Cada consumo es una transacción de origen "Mercado Pago Tarjeta"; los impuestos e intereses van como Gasto con
 * categoría Impuestos y los ajustes y reembolsos como Ingreso. El saldo anterior y los pagos no se importan.
 */
export class MercadoPagoTarjetaParser extends BaseParser {
  /**
   * Reconoce el PDF por dos firmas propias (portada y estructura del consolidado) para no confundirlo con la tarjeta
   * de Galicia ni con el resumen de cuenta de Mercado Pago.
   * @param {string} texto
   * @returns {Object|null}
   */
  static detectar(texto) {
    if (!/Este es tu resumen de/i.test(texto) || !/Composici[oó]n del saldo del periodo anterior/i.test(texto)) return null;
    if (!/^Consolidado$/im.test(texto) || !/DETALLE DE MOVIMIENTOS/.test(texto)) return null;
    return {
      tipo: 'mercadopago',
      tipoResumen: 'tarjeta',
      producto: 'tarjeta',
      formato: 'pdf',
      descripcion: 'Mercado Pago · tarjeta de crédito',
      cierre: cierreDelResumen(texto),
      totales: extraerTotalesTarjetaMP(texto)
    };
  }

  /**
   * @param {Buffer} buffer - PDF (o su texto)
   * @param {number} dolarValue - ARS por USD para pesificar los consumos en dólares
   * @param {Object} [categoryKeywords]
   * @param {Date} [referencia] - fecha para inferir el año del cierre (por defecto hoy)
   */
  constructor(buffer, dolarValue = 1, categoryKeywords = null, referencia = new Date()) {
    super(buffer, categoryKeywords);
    this.dolarValue = dolarValue;
    this.referencia = referencia;
  }

  async extraerTexto() {
    if (this.buffer.slice(0, 4).toString('latin1') === '%PDF') {
      const pdf = new PDFParse({ data: new Uint8Array(this.buffer), verbosity: 0 });
      await pdf.load();
      return (await pdf.getText()).text;
    }
    const utf8 = iconv.decode(this.buffer, 'utf8');
    return utf8.includes('�') ? iconv.decode(this.buffer, 'latin1') : utf8;
  }

  async parse() {
    return this.parsearTexto(await this.extraerTexto());
  }

  /**
   * @param {string} texto
   * @returns {Array} transacciones
   */
  parsearTexto(texto) {
    const cierre = cierreDelResumen(texto, this.referencia);
    if (!cierre) throw new Error('No se encontró la fecha de cierre del resumen de la tarjeta de Mercado Pago');
    const [anioCierre, mesCierre] = cierre.split('-').map(Number);

    const lineas = texto.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const inicio = lineas.findIndex(l => /^DETALLE DE MOVIMIENTOS$/.test(l));
    if (inicio < 0) throw new Error('No se encontró el detalle de movimientos del resumen');

    const transacciones = [];
    let seccion = null;

    for (const linea of lineas.slice(inicio + 1)) {
      if (/^INFORMACI[OÓ]N ADICIONAL$/.test(linea)) break;
      const nueva = SECCIONES.find(s => s.re.test(linea));
      if (nueva) { seccion = nueva.clave; continue; }
      if (/^Total a pagar$/i.test(linea) || /^Total a pagar [$U]/i.test(linea)) { seccion = null; continue; }
      if (!seccion || seccion === 'anterior' || seccion === 'pagos') continue;

      const fila = FILA.exec(linea);
      if (!fila) continue;
      const mes = mesDeAbreviatura(fila[2]);
      if (!mes) continue;
      const tx = this.filaATransaccion({ dia: Number(fila[1]), mes, resto: fila[3], seccion, anio: mes > mesCierre ? anioCierre - 1 : anioCierre });
      if (tx) transacciones.push(tx);
    }
    return transacciones;
  }

  filaATransaccion({ dia, mes, resto, seccion, anio }) {
    const montos = montosDeLinea(resto);
    if (!montos.tieneArs && !montos.tieneUsd) return null;
    // Una fila trae pesos o dólares; si trae los dos, manda el que no es cero
    const enDolares = montos.tieneUsd && (!montos.tieneArs || (montos.usd !== 0 && montos.ars === 0));
    const valor = enDolares ? montos.usd : montos.ars;
    if (!valor) return null;

    // Descripción: lo que queda sin los montos, la cuota y el número de operación
    let detalle = resto
      .replace(/-?\s*US\$\s*-?[\d.]+,\d{2}/g, ' ')
      .replace(/-?\s*(?<!US)\$\s*-?[\d.]+,\d{2}/g, ' ');
    const cuota = CUOTA.exec(detalle);
    if (cuota) detalle = detalle.replace(CUOTA, ' ');
    detalle = detalle.replace(OPERACION, ' ').replace(/\s+/g, ' ').trim();
    if (!detalle) return null;
    if (cuota) detalle = `${detalle} Cuota ${cuota[1].padStart(2, '0')}/${cuota[2].padStart(2, '0')}`;

    const esImpuesto = seccion === 'impuestos';
    // Impuestos e intereses: Gasto (si fuera negativo, una devolución). Ajustes y reembolsos: un crédito (negativo) es un Ingreso.
    const tipo = valor < 0 ? 'Ingreso' : 'Gasto';
    const importe = Math.abs(enDolares ? valor * this.dolarValue : valor);

    return this.createTransaction({
      fecha: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`,
      categoria: esImpuesto ? CATEGORIA_IMPUESTOS : (seccion === 'ajustes' ? 'Otros' : this.inferCategoria(detalle)),
      detalle,
      importe,
      moneda: enDolares ? 'USD' : 'ARS',
      monto_original: Math.abs(valor),
      tipo,
      origen: ORIGEN_TARJETA_MP
    });
  }
}
