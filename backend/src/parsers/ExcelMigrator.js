import ExcelJS from 'exceljs';

/**
 * ExcelMigrator - Reads complete Excel files (historical data) and extracts all transactions
 * Designed for bulk migration of historical data from Excel to MongoDB
 */
export class ExcelMigrator {
  constructor(buffer) {
    this.buffer = buffer;
    this.workbook = null;
  }

  /**
   * Initialize workbook from buffer
   */
  async initialize() {
    this.workbook = new ExcelJS.Workbook();
    await this.workbook.xlsx.load(this.buffer);
  }

  /**
   * Get list of available sheet names
   * @returns {Array<string>}
   */
  getAvailableSheets() {
    if (!this.workbook) return [];
    return this.workbook.worksheets.map(sheet => sheet.name);
  }

  /**
   * Extract transactions from a specific sheet
   * @param {string} sheetName - Name of the sheet to extract from
   * @returns {Object} - { transactions: Array, stats: Object }
   */
  extractTransactionsFromSheet(sheetName) {
    const worksheet = this.workbook.getWorksheet(sheetName);
    if (!worksheet) {
      return { transactions: [], stats: null };
    }

    const transactions = [];

    // Extract GASTOS (Expenses) - Columns B, C, D, E starting from row 14
    // B: Categoría, C: Fecha, D: Detalle, E: Importe
    let rowIdx = 14;
    while (true) {
      const fechaCell = worksheet.getCell(rowIdx, 3); // Column C
      const fecha = this.getCellValue(fechaCell);
      
      if (!fecha) break;

      const categoria = this.getCellValue(worksheet.getCell(rowIdx, 2)); // B
      const detalle = this.getCellValue(worksheet.getCell(rowIdx, 4));   // D
      const importe = this.getCellValue(worksheet.getCell(rowIdx, 5));   // E

      if (importe && importe !== 0) {
        transactions.push({
          fecha: this.formatDate(fecha),
          categoria: categoria || 'Otros',
          detalle: detalle || '',
          importe: Math.abs(parseFloat(importe)),
          moneda: 'ARS',
          monto_original: Math.abs(parseFloat(importe)),
          tipo: 'Gasto',
          origen: 'Migración Excel',
          mes: sheetName
        });
      }

      rowIdx++;
      
      // Safety limit to prevent infinite loops
      if (rowIdx > 1000) break;
    }

    // Extract INGRESOS (Income) - Columns H, I, J starting from row 14
    // H: Fecha, I: Detalle, J: Importe
    let rowIdxIng = 14;
    while (true) {
      const fechaCell = worksheet.getCell(rowIdxIng, 8); // Column H
      const fecha = this.getCellValue(fechaCell);
      
      if (!fecha) break;

      const detalle = this.getCellValue(worksheet.getCell(rowIdxIng, 9));   // I
      const importe = this.getCellValue(worksheet.getCell(rowIdxIng, 10));  // J

      if (importe && importe !== 0) {
        transactions.push({
          fecha: this.formatDate(fecha),
          categoria: 'Ingreso',
          detalle: detalle || '',
          importe: Math.abs(parseFloat(importe)),
          moneda: 'ARS',
          monto_original: Math.abs(parseFloat(importe)),
          tipo: 'Ingreso',
          origen: 'Migración Excel',
          mes: sheetName
        });
      }

      rowIdxIng++;
      
      // Safety limit
      if (rowIdxIng > 1000) break;
    }

    // Calculate stats for this sheet
    const gastos = transactions.filter(t => t.tipo === 'Gasto');
    const ingresos = transactions.filter(t => t.tipo === 'Ingreso');
    
    // If no transactions found, return null stats
    if (transactions.length === 0) {
      return { transactions: [], stats: null };
    }
    
    const stats = {
      gastos: gastos.length,
      ingresos: ingresos.length,
      total: transactions.length,
      importe_gastos: gastos.reduce((sum, t) => sum + t.importe, 0),
      importe_ingresos: ingresos.reduce((sum, t) => sum + t.importe, 0)
    };
    stats.neto = stats.importe_ingresos - stats.importe_gastos;

    return { transactions, stats };
  }

  /**
   * Extract all transactions from all sheets
   * @param {Function} progressCallback - Optional callback(sheetName, numTransactions)
   * @returns {Array} - Array of all transactions with their sheet data
   */
  extractAllTransactions(progressCallback = null) {
    const allTransactions = [];
    const sheets = this.getAvailableSheets();
    const sheetStats = {};

    for (const sheetName of sheets) {
      const { transactions, stats } = this.extractTransactionsFromSheet(sheetName);
      
      if (transactions.length > 0) {
        allTransactions.push(...transactions);
        sheetStats[sheetName] = stats;
        
        if (progressCallback) {
          progressCallback(sheetName, transactions.length);
        }
      } else {
        sheetStats[sheetName] = null;
      }
    }

    return { transactions: allTransactions, sheetStats };
  }

  /**
   * Get preview data (statistics only, no full transactions)
   * @returns {Object} - Preview with sheet stats
   */
  getPreview() {
    const sheets = this.getAvailableSheets();
    const sheetStats = {};
    let totalTransactions = 0;
    let totalGastos = 0;
    let totalIngresos = 0;
    let totalImporteGastos = 0;
    let totalImporteIngresos = 0;

    for (const sheetName of sheets) {
      const { stats } = this.extractTransactionsFromSheet(sheetName);
      sheetStats[sheetName] = stats;
      
      if (stats) {
        totalTransactions += stats.total || 0;
        totalGastos += stats.gastos || 0;
        totalIngresos += stats.ingresos || 0;
        totalImporteGastos += stats.importe_gastos || 0;
        totalImporteIngresos += stats.importe_ingresos || 0;
      }
    }

    return {
      sheets: sheetStats,
      totals: {
        sheets: Object.keys(sheetStats).length,
        sheets_con_datos: Object.values(sheetStats).filter(s => s !== null).length,
        sheets_vacias: Object.values(sheetStats).filter(s => s === null).length,
        total_transacciones: totalTransactions || 0,
        total_gastos: totalGastos || 0,
        total_ingresos: totalIngresos || 0,
        importe_gastos: totalImporteGastos || 0,
        importe_ingresos: totalImporteIngresos || 0,
        neto: (totalImporteIngresos || 0) - (totalImporteGastos || 0)
      }
    };
  }

  /**
   * Get cell value handling different data types
   * @param {Object} cell - ExcelJS cell
   * @returns {*} - Cell value
   */
  getCellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) {
      return null;
    }

    // Handle rich text
    if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
      return cell.value.richText.map(t => t.text).join('');
    }

    // Handle formula results
    if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
      return cell.value.result;
    }

    return cell.value;
  }

  /**
   * Format date to DD/MM/YYYY string
   * @param {*} dateValue - Date value (Date object or string)
   * @returns {string} - Formatted date
   */
  formatDate(dateValue) {
    if (!dateValue) return '';

    // If already a string, return as-is
    if (typeof dateValue === 'string') {
      return dateValue;
    }

    // If it's a Date object
    if (dateValue instanceof Date) {
      const day = String(dateValue.getDate()).padStart(2, '0');
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const year = dateValue.getFullYear();
      return `${day}/${month}/${year}`;
    }

    // If it's an Excel serial date number
    if (typeof dateValue === 'number') {
      const date = this.excelSerialToDate(dateValue);
      return this.formatDate(date);
    }

    return String(dateValue);
  }

  /**
   * Convert Excel serial date to JavaScript Date
   * @param {number} serial - Excel serial date
   * @returns {Date}
   */
  excelSerialToDate(serial) {
    const excelEpoch = new Date(1899, 11, 30);
    const msPerDay = 86400000;
    return new Date(excelEpoch.getTime() + serial * msPerDay);
  }
}
