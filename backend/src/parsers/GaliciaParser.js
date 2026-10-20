import { BaseParser } from './BaseParser.js';
import iconv from 'iconv-lite';
import { PDFParse } from 'pdf-parse';
import { extraerTotalesTarjeta } from '../utils/totalesResumen.js';

const MESES_ABREVIADOS = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12'
};

// Foreign currency consumption: the description ends with "<MONEDA> <monto original>"
const MONEDA_EXTRANJERA_FINAL = /\b(?:USD|BRL|EUR|UYU|CLP|GBP|PYG|MXN|COP|PEN|BOB|CAD|AUD|JPY|CHF)\s+\d{1,3}(?:\.\d{3})*,\d{2}$/;

/**
 * Parser for Banco Galicia files
 * Handles both cuenta (savings account) and tarjeta (credit card) formats
 */
export class GaliciaParser extends BaseParser {
  /**
   * Reconoce un archivo de Banco Galicia (caja de ahorro o tarjeta) por su contenido
   * @param {string} texto - Texto del archivo (CSV/XLSX convertido/TXT) o del PDF
   * @returns {Object|null} - Detección parcial (ver statementImportService.detectarDocumento)
   */
  static detectar(texto) {
    // Caja de ahorro: extracto CSV/XLSX del Online Banking
    if (/Banco Galicia - Caja Ahorro/.test(texto) && /Fecha,Movimiento,D.bito,Cr.dito/.test(texto)) {
      const intervalo = texto.match(/Intervalo de Consulta: del (\d{2})\/(\d{2})\/(\d{4}) al (\d{2})\/(\d{2})\/(\d{4})/);
      return {
        tipo: 'galicia',
        tipoResumen: 'cuenta',
        producto: 'caja_ahorro',
        descripcion: 'Galicia · caja de ahorro',
        periodo: intervalo
          ? { desde: `${intervalo[3]}-${intervalo[2]}-${intervalo[1]}`, hasta: `${intervalo[6]}-${intervalo[5]}-${intervalo[4]}` }
          : null
      };
    }
    if (/Resumen de Caja de Ahorro en Pesos/.test(texto)) {
      return {
        tipo: 'galicia',
        tipoResumen: 'cuenta',
        producto: 'caja_ahorro',
        descripcion: 'Galicia · caja de ahorro (PDF consolidado)',
        soportado: false,
        motivo: 'El resumen PDF consolidado de la caja de ahorro no está soportado: descargá el extracto en Excel'
      };
    }

    // Visa del link del mail (eresumen.com.ar)
    if (/DETALLE DE TRANSACCION/.test(texto) && /CIERRE ACTUAL/.test(texto) && /VISA/.test(texto)) {
      const cierre = texto.match(/CIERRE ACTUAL:\s*(\d{2}) ([A-Za-z]{3}) (\d{2})/);
      const mes = cierre && MESES_ABREVIADOS[cierre[2].toLowerCase()];
      return {
        tipo: 'galicia',
        tipoResumen: 'tarjeta',
        producto: 'visa',
        formato: 'eresumen',
        descripcion: 'Visa Galicia (eresumen)',
        cierre: mes ? `20${cierre[3]}-${mes}-${cierre[1]}` : null,
        totales: extraerTotalesTarjeta(texto)
      };
    }

    // PDF de tarjeta del Online Banking: Visa o Mastercard
    const pdfTarjeta = texto.match(/Tarjeta Cr.dito (VISA|MASTERCARD)/);
    if (pdfTarjeta) {
      const producto = pdfTarjeta[1] === 'VISA' ? 'visa' : 'mastercard';
      // Fechas del encabezado: cierre anterior, vto. anterior, cierre actual, vto. actual, ...
      const fechas = texto.match(/(\d{2})-([A-Za-z]{3})-(\d{2})\s+\d{2}-[A-Za-z]{3}-\d{2}\s+(\d{2})-([A-Za-z]{3})-(\d{2})/);
      const mes = fechas && MESES_ABREVIADOS[fechas[5].toLowerCase()];
      return {
        tipo: 'galicia',
        tipoResumen: 'tarjeta',
        producto,
        formato: 'homebanking',
        descripcion: `${producto === 'visa' ? 'Visa' : 'Mastercard'} Galicia`,
        cierre: mes ? `20${fechas[6]}-${mes}-${fechas[4]}` : null,
        totales: extraerTotalesTarjeta(texto)
      };
    }

    // Texto del resumen de tarjeta copiado del Online Banking
    if (/DETALLE DEL CONSUMO/.test(texto) && /FECHA REFERENCIA CUOTA COMPROBANTE/.test(texto)) {
      return {
        tipo: 'galicia',
        tipoResumen: 'tarjeta',
        producto: /MASTERCARD/i.test(texto) ? 'mastercard' : 'visa',
        formato: 'texto',
        descripcion: 'Tarjeta Galicia (texto copiado)',
        confianza: 'media',
        cierre: null
      };
    }

    return null;
  }

  constructor(buffer, tipoResumen = 'cuenta', dolarValue = 1, categoryKeywords = null) {
    super(buffer, categoryKeywords);
    this.tipoResumen = tipoResumen; // 'cuenta' or 'tarjeta'
    this.dolarValue = dolarValue;
  }

  /**
   * Parse the Galicia file based on type
   * @returns {Promise<Array>} - Array of transactions
   */
  async parse() {
    if (this.tipoResumen === 'tarjeta') {
      return this.parseTarjeta();
    } else {
      return this.parseCuenta();
    }
  }

  /**
   * Parse Galicia cuenta (savings account) CSV format
   * @returns {Promise<Array>} - Array of transactions
   */
  async parseCuenta() {
    try {
      // Decode the CSV content - try multiple encodings for Galicia files
      let content;
      try {
        // First try UTF-8
        content = iconv.decode(this.buffer, 'utf8');
      } catch {
        try {
          // Then try latin1 (ISO-8859-1)
          content = iconv.decode(this.buffer, 'latin1');
        } catch {
          // Finally try windows-1252
          content = iconv.decode(this.buffer, 'win1252');
        }
      }

      // Clean up line endings and normalize
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = content.split('\n');
      const transactions = [];

      // Find the header line to determine where data starts
      let startIndex = 0;
      let headerFound = false;
      
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const line = lines[i].trim();
        
        if (line.includes('Fecha') && (line.includes('Movimiento') || line.includes('Débito') || line.includes('Crédito'))) {
          startIndex = i + 1;
          headerFound = true;
          break;
        }
      }

      if (!headerFound) {
        throw new Error('No se encontró el encabezado del archivo. Verifique que sea un extracto válido del Banco Galicia.');
      }

      // Reconstruct complete CSV lines (descriptions can span multiple lines)
      const completeLines = this.reconstructCSVLines(lines, startIndex);

      for (let i = 0; i < completeLines.length; i++) {
        const line = completeLines[i].trim();
        if (!line || line === '') continue;

        try {
          const parsed = this.parseLine(line);
          
          if (parsed) {
            transactions.push(parsed);
          }
        } catch (error) {
          console.warn(`Error parsing Galicia transaction ${i}:`, error.message);
          // Continue processing other lines
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error parsing Galicia file:', error);
      throw new Error(`Error al procesar el archivo de Banco Galicia: ${error.message}`);
    }
  }

  /**
   * Check if a line starts with a date pattern (DD/MM/YYYY)
   * @param {string} line - Line to check
   * @returns {boolean} - True if starts with date
   */
  startsWithDate(line) {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}/;
    return datePattern.test(line.trim());
  }

  /**
   * Reconstruct complete CSV lines from multi-line fields
   * Galicia CSVs have descriptions that span multiple lines within quotes
   * @param {Array<string>} lines - All lines from the file
   * @param {number} startIndex - Index to start processing from
   * @returns {Array<string>} - Complete reconstructed lines
   */
  reconstructCSVLines(lines, startIndex) {
    const completeLines = [];
    let currentLine = '';
    let inQuotes = false;
    let quoteCount = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Count quotes in this line
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '"') {
          // Check if it's an escaped quote
          if (j > 0 && line[j - 1] === '"') {
            continue; // Skip escaped quote
          }
          quoteCount++;
          inQuotes = !inQuotes;
        }
      }

      // Add line to current transaction
      if (currentLine === '') {
        currentLine = line;
      } else {
        // Join with space to preserve the multi-line description
        currentLine += ' ' + line.trim();
      }

      // If quotes are balanced, we have a complete line
      if (!inQuotes && currentLine.trim() !== '') {
        // Verify it starts with a date (should be a complete transaction)
        if (this.startsWithDate(currentLine)) {
          completeLines.push(currentLine);
          currentLine = '';
          quoteCount = 0;
        }
      }
    }

    // Add any remaining line
    if (currentLine.trim() !== '') {
      completeLines.push(currentLine);
    }

    return completeLines;
  }

  /**
   * Parse a single CSV line into a transaction
   * @param {string} line - CSV line to parse
   * @returns {Object|null} - Parsed transaction or null if invalid
   */
  parseLine(line) {
    // Parse CSV considering that descriptions can contain commas, quotes, and line breaks
    const fields = this.parseCSVLine(line);
    
    if (fields.length < 5) {
      return null; // Invalid line
    }

    const [fecha, movimiento, debito, credito, saldoParcial, comentarios = ''] = fields;

    // Validate date format
    if (!this.isValidDate(fecha)) {
      return null;
    }

    // Clean amounts 
    const debitoAmount = this.cleanAmount(debito);
    const creditoAmount = this.cleanAmount(credito);

    // Determine transaction type and amount
    let importe = 0;
    let tipo = 'Ingreso';

    if (debitoAmount > 0) {
      importe = debitoAmount;
      tipo = 'Gasto';
    } else if (creditoAmount > 0) {
      importe = creditoAmount;
      tipo = 'Ingreso';
    } else {
      return null; // No amount, skip
    }

    // Clean and prepare description - remove extra whitespace and normalize
    let detalle = movimiento
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim();
    
    if (comentarios && comentarios.trim()) {
      const comentarioClean = comentarios.trim().replace(/\s+/g, ' ');
      if (comentarioClean && comentarioClean !== detalle) {
        detalle += ` - ${comentarioClean}`;
      }
    }

    // Parse date (DD/MM/YYYY format)
    const fechaFormatted = this.formatDate(fecha);
    if (!fechaFormatted) {
      return null;
    }

    return this.createTransaction({
      fecha: fechaFormatted,
      categoria: this.inferCategoria(detalle),
      detalle: detalle,
      importe: importe,
      moneda: 'ARS',
      tipo: tipo,
      origen: 'Banco Galicia'
    });
  }

  /**
   * Validate if a string is a valid date in DD/MM/YYYY format
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} - True if valid
   */
  isValidDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!datePattern.test(dateStr.trim())) return false;
    
    const [day, month, year] = dateStr.trim().split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getDate() === day && 
           date.getMonth() === month - 1 && 
           date.getFullYear() === year;
  }

  /**
   * Format date from DD/MM/YYYY to the expected format
   * @param {string} dateStr - Date string in DD/MM/YYYY
   * @returns {string|null} - Formatted date or null if invalid
   */
  formatDate(dateStr) {
    if (!this.isValidDate(dateStr)) return null;
    
    const [day, month, year] = dateStr.trim().split('/');
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse a CSV line handling commas within quoted fields
   * @param {string} line - CSV line to parse
   * @returns {Array<string>} - Array of field values
   */
  parseCSVLine(line) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        fields.push(currentField.trim());
        currentField = '';
        i++;
      } else {
        // Regular character
        currentField += char;
        i++;
      }
    }

    // Add the last field
    fields.push(currentField.trim());

    return fields;
  }

  /**
   * Clean amount string from Galicia format
   * @param {string} val - Amount string in format "-123.456,78" or "123.456,78"
   * @returns {number} - Cleaned amount
   */
  cleanAmount(val, keepSign = false) {
    if (!val || val === '' || val === '0,00') {
      return 0.0;
    }
    
    val = String(val).trim().replace(/"/g, '');
    
    // Handle negative sign
    const isNegative = val.includes('-');
    val = val.replace('-', '');
    
    // Convert Argentine format: remove dots (thousands) and replace comma with dot (decimals)
    val = val.replace(/\./g, '').replace(',', '.');
    
    try {
      const amount = parseFloat(val);
      if (isNaN(amount)) return 0.0;
      
      // For tarjeta parser, we need to keep negative signs
      if (keepSign && isNegative) {
        return -amount;
      }
      
      return Math.abs(amount);
    } catch {
      return 0.0;
    }
  }

  /**
   * Parse Galicia tarjeta (credit card) text format
   * Handles text copied from PDF or home banking
   * @returns {Promise<Array>} - Array of transactions
   */
  async parseTarjeta() {
    try {
      let content;

      // Check if buffer is a PDF file
      if (this.buffer && this.buffer.slice(0, 4).toString() === '%PDF') {
        const pdfParser = new PDFParse({ data: new Uint8Array(this.buffer), verbosity: 0 });
        await pdfParser.load();
        const result = await pdfParser.getText();
        content = result.text;
      } else {
        try {
          content = iconv.decode(this.buffer, 'utf8');
        } catch {
          content = iconv.decode(this.buffer, 'latin1');
        }
      }

      // Clean up line endings
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = content.split('\n').map(line => line.trim()).filter(line => line !== '');

      // Visa keeps the historical origen so existing data stays consistent
      this.origenTarjeta = /MASTERCARD/i.test(content) ? 'Banco Galicia Mastercard' : 'Banco Galicia Tarjeta';

      // Visa PDF generated by eresumen.com.ar (link in the notice email)
      if (content.includes('DETALLE DE TRANSACCION')) {
        return this.parseTarjetaEresumen(lines);
      }

      const transactions = [];
      let inDetalleConsumo = false;
      const hasDetalleHeader = content.includes('DETALLE DEL CONSUMO');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('DETALLE DEL CONSUMO')) {
          inDetalleConsumo = true;
          continue;
        }

        // If file contains "DETALLE DEL CONSUMO" section, skip anything before it
        if (hasDetalleHeader && !inDetalleConsumo) {
          continue;
        }

        // Skip payment of previous summary
        if (line.includes('SU PAGO EN PESOS') ||
            line.includes('SU PAGO EN DOLARES') ||
            line.includes('SU PAGO EN U$S') ||
            line.includes('PAGO DE RESUMEN')) {
          continue;
        }

        // Skip header lines
        if ((line.includes('FECHA') && line.includes('REFERENCIA')) ||
            (line.includes('TARJETA') && line.includes('Total Consumos')) ||
            line.includes('TOTAL A PAGAR') ||
            line.includes('CONSOLIDADO') ||
            line.includes('SALDO ANTERIOR')) {
          continue;
        }

        // Skip tax/summary lines
        if (line.includes('IMPUESTO DE SELLOS') ||
            line.includes('IIBB PERCEP') ||
            line.includes('IVA RG')) {
          continue;
        }

        try {
          const parsed = this.parseLineaTarjeta(line);
          if (parsed) {
            transactions.push(parsed);
          }
        } catch (error) {
          console.warn(`Error parsing Galicia Tarjeta line: ${line}`, error.message);
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error parsing Galicia Tarjeta file:', error);
      throw new Error(`Error al procesar el resumen de tarjeta Galicia: ${error.message}`);
    }
  }

  /**
   * Parse a tarjeta line into a transaction
   * Format: DD-MM-YY DESCRIPTION [CUOTA] COMPROBANTE AMOUNT [AMOUNT_USD]
   * Mastercard uses a month abbreviation instead: DD-Mmm-YY (e.g. 28-Ago-26)
   * @param {string} line - Line to parse
   * @returns {Object|null} - Parsed transaction or null if invalid
   */
  parseLineaTarjeta(line) {
    // Check if line starts with a date pattern DD-MM-YY, DD/MM/YY, DD-MM-YYYY or DD-Mmm-YY
    const dateMatch = line.match(/^(\d{2})[-/](\d{2}|[A-Za-z]{3})[-/](\d{2}|\d{4})\s+(.+)$/);
    if (!dateMatch) {
      return null;
    }

    const [, day, monthRaw, yearRaw, resto] = dateMatch;
    const month = /^\d{2}$/.test(monthRaw) ? monthRaw : MESES_ABREVIADOS[monthRaw.toLowerCase()];
    if (!month) {
      return null;
    }

    // Build full year
    const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const fecha = `${day}/${month}/${fullYear}`;

    // Try to find amounts at the end
    const amountPattern = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
    const amounts = [];
    let match;
    while ((match = amountPattern.exec(resto)) !== null) {
      amounts.push({
        value: match[0],
        index: match.index
      });
    }

    if (amounts.length === 0) {
      return null;
    }

    // Get the last amount as the primary amount
    const lastAmount = amounts[amounts.length - 1];
    const beforeAmount = resto.substring(0, lastAmount.index).trim();

    // Extract description: Visa comprobantes have 6 digits, Mastercard 5
    const comprobanteMatch = beforeAmount.match(/(\d{5,6})\s*$/);
    let detalle = comprobanteMatch ? beforeAmount.substring(0, comprobanteMatch.index).trim() : beforeAmount;

    // Remove asterisk
    detalle = detalle.replace(/^\*\s*/, '');

    // Extract CUOTA pattern (e.g., "01/12" for installment 1 of 12)
    const cuotaMatch = detalle.match(/\s+(\d{2}\/\d{2})\s*$/);
    if (cuotaMatch) {
      detalle = `${detalle.substring(0, cuotaMatch.index).trim()} Cuota ${cuotaMatch[1]}`;
    }

    return this.crearTransaccionTarjeta({ fecha, detalle, monto: lastAmount.value });
  }

  /**
   * Parse the Visa layout generated by eresumen.com.ar (link in the Galicia notice email).
   * Same movements as the home banking PDF, different layout (cells separated by tabs):
   *   DD.MM.YY  COMPROBANTE[*|K]  DETALLE  [Cuota NN/MM]  [MONEDA MONTO]  IMPORTE[-]
   * Movements start after the "DETALLE DE TRANSACCION" header and end at "SALDO ACTUAL".
   * @param {Array<string>} lines - Non-empty trimmed lines
   * @returns {Array} - Transactions
   */
  parseTarjetaEresumen(lines) {
    const transactions = [];
    let enMovimientos = false;

    for (const line of lines) {
      if (line.includes('DETALLE DE TRANSACCION')) {
        enMovimientos = true;
        continue;
      }
      if (!enMovimientos) continue;
      if (line.startsWith('SALDO ACTUAL')) break;

      // Same exclusions as the home banking layout: previous balance, payments,
      // tax refunds (they live in its CONSOLIDADO section) and taxes skipped there too
      if (line.includes('SALDO ANTERIOR') ||
          line.includes('SU PAGO EN') ||
          line.includes('DEV.IMP.') ||
          line.includes('Total Consumos') ||
          line.includes('IMPUESTO DE SELLOS') ||
          line.includes('IIBB PERCEP') ||
          line.includes('IVA RG')) {
        continue;
      }

      try {
        const parsed = this.parseLineaEresumen(line);
        if (parsed) {
          transactions.push(parsed);
        }
      } catch (error) {
        console.warn(`Error parsing Galicia eresumen line: ${line}`, error.message);
      }
    }

    return transactions;
  }

  /**
   * Parse one eresumen movement line
   * @param {string} line
   * @returns {Object|null}
   */
  parseLineaEresumen(line) {
    const dateMatch = line.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(.+)$/);
    if (!dateMatch) {
      return null;
    }
    const [, day, month, year, resto] = dateMatch;

    let celdas = resto.split('\t').map(c => c.trim()).filter(c => c && c !== '_');
    // Comprobante with its marker (* or K) comes before the description
    if (celdas.length && /^\d{5,6}[*K]?$/.test(celdas[0])) {
      celdas = celdas.slice(1);
    }

    const monto = celdas.pop();
    if (!monto || !/^\d{1,3}(?:\.\d{3})*,\d{2}-?$/.test(monto)) {
      return null;
    }

    return this.crearTransaccionTarjeta({
      fecha: `${day}/${month}/20${year}`,
      detalle: celdas.join(' '),
      monto
    });
  }

  /**
   * Build a card transaction from its description and final amount (pesos or dollars column).
   * Foreign currency consumptions end with "<MONEDA> <monto original>" in the description
   * (USD, BRL, EUR...): the card bills them in dollars, so the final amount is USD.
   * @param {{ fecha: string, detalle: string, monto: string }} params
   * @returns {Object|null}
   */
  crearTransaccionTarjeta({ fecha, detalle, monto }) {
    // Remove consumption markers (* or K) and normalize spaces
    let detalleLimpio = detalle.replace(/\s+/g, ' ').trim().replace(/^[*K]\s+/, '');
    if (!detalleLimpio) {
      return null;
    }

    const esMonedaExtranjera = MONEDA_EXTRANJERA_FINAL.test(detalleLimpio);
    const valor = this.cleanAmount(monto, true);

    const importePesos = esMonedaExtranjera ? valor * this.dolarValue : valor;
    const moneda = esMonedaExtranjera ? 'USD' : 'ARS';

    return this.createTransaction({
      fecha,
      categoria: this.inferCategoria(detalleLimpio),
      detalle: detalleLimpio,
      importe: Math.abs(importePesos),
      moneda,
      monto_original: Math.abs(valor),
      tipo: valor < 0 ? 'Ingreso' : 'Gasto',
      origen: this.origenTarjeta || 'Banco Galicia Tarjeta'
    });
  }
}