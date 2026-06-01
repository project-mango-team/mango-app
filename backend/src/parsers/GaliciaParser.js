import { BaseParser } from './BaseParser.js';
import iconv from 'iconv-lite';

/**
 * Parser for Banco Galicia files
 * Handles both cuenta (savings account) and tarjeta (credit card) formats
 */
export class GaliciaParser extends BaseParser {
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
      // Decode the text content
      let content;
      try {
        content = iconv.decode(this.buffer, 'utf8');
      } catch {
        content = iconv.decode(this.buffer, 'latin1');
      }

      // Clean up line endings
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = content.split('\n').map(line => line.trim()).filter(line => line !== '');

      const transactions = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip header lines
        if (line.includes('DETALLE DEL CONSUMO') || 
            line.includes('FECHA') && line.includes('REFERENCIA') ||
            line.includes('TARJETA') && line.includes('Total Consumos') ||
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
   * @param {string} line - Line to parse
   * @returns {Object|null} - Parsed transaction or null if invalid
   */
  parseLineaTarjeta(line) {
    // Check if line starts with a date pattern DD-MM-YY
    const dateMatch = line.match(/^(\d{2})-(\d{2})-(\d{2})\s+(.+)$/);
    if (!dateMatch) {
      return null;
    }

    const [, day, month, year, resto] = dateMatch;

    // Build full year (assuming 20XX)
    const fullYear = `20${year}`;
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

    // Check if there's a second amount (USD) right before
    let importePesos = 0;
    let importeDolares = 0;
    let moneda = 'ARS';

    if (amounts.length >= 2) {
      // Check if line contains "USD" indicator
      if (resto.includes('USD')) {
        // It's a USD transaction
        importeDolares = this.cleanAmount(lastAmount.value, true);
        importePesos = importeDolares * this.dolarValue;
        moneda = 'USD';
      } else {
        // Last amount is pesos
        importePesos = this.cleanAmount(lastAmount.value, true);
        importeDolares = 0;
        moneda = 'ARS';
      }
    } else {
      // Single amount - assume it's in pesos
      importePesos = this.cleanAmount(lastAmount.value, true);
      importeDolares = 0;
      moneda = 'ARS';
    }

    // Extract description
    const comprobanteMatch = beforeAmount.match(/(\d{6})\s*$/);
    let detalle = beforeAmount;
    
    if (comprobanteMatch) {
      detalle = beforeAmount.substring(0, comprobanteMatch.index).trim();
    }

    // Remove asterisk
    detalle = detalle.replace(/^\*\s*/, '');
    
    // Extract CUOTA pattern (e.g., "01/12" for installment 1 of 12)
    const cuotaMatch = detalle.match(/\s+(\d{2}\/\d{2})\s*$/);
    let cuotaInfo = '';
    if (cuotaMatch) {
      cuotaInfo = ` Cuota ${cuotaMatch[1]}`;
      detalle = detalle.substring(0, cuotaMatch.index).trim();
    }
    
    // Clean up multiple spaces
    detalle = detalle.replace(/\s+/g, ' ').trim();
    
    // Add cuota info if exists
    if (cuotaInfo) {
      detalle += cuotaInfo;
    }

    if (!detalle) {
      return null;
    }

    // Determine if it's income or expense
    let tipo = 'Gasto';
    let importe = Math.abs(importePesos);

    if (importePesos < 0) {
      tipo = 'Ingreso';
      importe = Math.abs(importePesos);
    }

    return this.createTransaction({
      fecha: fecha,
      categoria: this.inferCategoria(detalle),
      detalle: detalle,
      importe: importe,
      moneda: moneda,
      monto_original: moneda === 'USD' ? Math.abs(importeDolares) : Math.abs(importePesos),
      tipo: tipo,
      origen: 'Banco Galicia Tarjeta'
    });
  }
}