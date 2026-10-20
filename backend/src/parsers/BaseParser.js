import { inferirCategoria } from '../utils/categoryInference.js';

/**
 * Base class for transaction parsers
 */
export class BaseParser {
  constructor(buffer, categoryKeywords = null) {
    this.buffer = buffer;
    this.categoryKeywords = categoryKeywords;
  }

  /**
   * Convert Argentine format (1.234,56) to float
   * @param {string} val - Amount string
   * @returns {number} - Parsed amount
   */
  cleanAmount(val) {
    if (!val || val === '') return 0.0;
    
    val = String(val).trim().replace(/"/g, '');
    
    // Remove thousands separator (.), replace decimal comma with point
    val = val.replace(/\./g, '').replace(',', '.');
    
    try {
      return parseFloat(val);
    } catch {
      return 0.0;
    }
  }

  /**
   * Infer category from description
   * @param {string} detalle - Transaction description
   * @returns {string} - Category name
   */
  inferCategoria(detalle) {
    return inferirCategoria(detalle, this.categoryKeywords);
  }

  /**
   * Parse the file and return transactions
   * Must be implemented by subclasses
   * @returns {Promise<Array>} - Array of transactions
   */
  async parse() {
    throw new Error('parse() must be implemented by subclass');
  }

  /**
   * Create standardized transaction object
   */
  createTransaction(data) {
    return {
      fecha: data.fecha,
      categoria: data.categoria,
      detalle: data.detalle,
      // Redondeado a centavos: los consumos en USD se pesifican con una multiplicación
      importe: Math.round(Math.abs(data.importe) * 100) / 100,
      moneda: data.moneda || 'ARS',
      monto_original: Math.round(Math.abs(data.monto_original || data.importe) * 100) / 100,
      tipo: data.tipo,
      origen: data.origen
    };
  }
}
