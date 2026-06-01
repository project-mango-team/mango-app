import { BaseParser } from './BaseParser.js';
import iconv from 'iconv-lite';

/**
 * Parser for Santander CSV files (Visa, Amex, etc.)
 * Handles multiple cards in the same file
 */
export class SantanderParser extends BaseParser {
  constructor(buffer, dolarValue, cardFilter = null, categoryKeywords = null) {
    super(buffer, categoryKeywords);
    this.dolarValue = dolarValue || 1;
    this.cardFilter = cardFilter; // Array of card names to filter, or null for all
  }

  /**
   * Clean currency value (handles $ and U$S)
   * @param {string} val - Currency string
   * @returns {number} - Cleaned amount
   */
  cleanCurrency(val) {
    if (!val || val === '') return 0.0;
    
    val = String(val);
    // Remove everything except digits, comma, and minus
    val = val.replace(/[^\d,-]/g, '');
    
    // Replace comma with point for decimal
    if (val.includes(',')) {
      val = val.replace(/\./g, '').replace(',', '.');
    }
    
    try {
      return parseFloat(val);
    } catch {
      return 0.0;
    }
  }

  /**
   * Get list of cards found in the file
   * @returns {Array<string>} - Array of card names
   */
  getCards() {
    const content = iconv.decode(this.buffer, 'latin1');
    const lines = content.split('\n');
    const regex = /(?:Tarjeta de|Adicional de)\s+(.*?)\s+-\s+(?:Visa|Mastercard|Amex).*?terminada en (\d{4})/i;
    const found = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(regex);
      if (match) {
        // Check if next 2 lines contain "Descripción" (indicates transaction header)
        const nextLines = lines.slice(i + 1, i + 3).join('\n');
        if (nextLines.includes('Descripción') || nextLines.includes('Descripcion')) {
          found.push(`${match[1].trim()} (${match[2]})`);
        }
      }
    }

    return [...new Set(found)]; // Return unique values
  }

  /**
   * Parse Santander CSV file
   * @returns {Promise<Array>} - Array of parsed transactions
   */
  async parse() {
    try {
      const content = iconv.decode(this.buffer, 'latin1');
      const lines = content.split('\n');
      
      const cardsData = {};
      let currentCard = null;
      let buffer = [];
      let reading = false;
      
      const cardRegex = /(?:Tarjeta de|Adicional de)\s+(.*?)\s+-\s+(?:Visa|Mastercard|Amex).*?terminada en (\d{4})/i;
      
      // Extract transactions for each card
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(cardRegex);
        
        // Check if it's a card header
        let isHeader = false;
        if (match) {
          const nextLines = lines.slice(i + 1, i + 3).join('\n');
          isHeader = nextLines.includes('Descripción') || nextLines.includes('Descripcion');
        }
        
        if (isHeader) {
          // Save previous card data
          if (currentCard && buffer.length > 0) {
            cardsData[currentCard] = buffer;
          }
          
          currentCard = `${match[1].trim()} (${match[2]})`;
          buffer = [];
          reading = true;
          continue;
        }
        
        if (reading) {
          // Stop reading when we hit "Total de" or empty line after transactions
          if (line.includes('Total de') || line.trim() === '') {
            reading = false;
            continue;
          }

          buffer.push(line);
        }
      }
      
      // Save last card
      if (currentCard && buffer.length > 0) {
        cardsData[currentCard] = buffer;
      }
      
      // Process transactions
      const finalData = [];
      const targets = this.cardFilter || Object.keys(cardsData);
      
      const isValidDate = (value) => {
        if (!value) return false;
        const normalized = value.trim().replace(/-/g, '/');
        return /^\d{2}\/\d{2}\/\d{2,4}$/.test(normalized);
      };

      const normalizeDateValue = (value) => {
        if (!value) return '';
        return value.trim().replace(/-/g, '/');
      };

      for (const card of targets) {
        if (!cardsData[card]) continue;
        
        let ultimaFecha = null; // Remember last valid date
        let headerInfo = null;

        const normalizeHeaderValue = (value) => {
          return String(value)
            .toLowerCase()
            .replace(/á/g, 'a')
            .replace(/é/g, 'e')
            .replace(/í/g, 'i')
            .replace(/ó/g, 'o')
            .replace(/ú/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/\s+/g, ' ')
            .trim();
        };

        const getHeaderInfo = (line) => {
          const rawParts = this.parseCSVLine(line).map((part) => part.replace(/"/g, '').trim());
          const parts = rawParts.map(normalizeHeaderValue);

          const fechaIndex = parts.findIndex((value) => value.includes('fecha'));
          const descripcionIndex = parts.findIndex((value) => value.includes('descripcion'));
          const pesosIndex = parts.findIndex((value) => value.includes('monto en pesos') || value.includes('importe en pesos'));
          const dolaresIndex = parts.findIndex((value) => value.includes('monto en dolares') || value.includes('importe en dolares'));

          if (fechaIndex === -1 || descripcionIndex === -1) {
            return null;
          }

          if (pesosIndex === -1 && dolaresIndex === -1) {
            return null;
          }

          return {
            fechaIndex,
            descripcionIndex,
            pesosIndex,
            dolaresIndex
          };
        };
        
        for (const line of cardsData[card]) {
          const maybeHeader = getHeaderInfo(line);
          if (maybeHeader) {
            headerInfo = maybeHeader;
            continue;
          }

          // Parse CSV line (handle quoted fields with commas)
          const parts = this.parseCSVLine(line).map((part) => part.replace(/"/g, '').trim());
          
          if (parts.length < 2) continue;
          
          // Date: if empty, use last valid date
          const fechaIndex = headerInfo?.fechaIndex ?? 0;
          let fecha = normalizeDateValue(parts[fechaIndex]);
          if (fecha && fecha !== '') {
            if (!isValidDate(fecha)) {
              continue;
            }

            ultimaFecha = fecha;
          } else if (ultimaFecha) {
            fecha = ultimaFecha;
          } else {
            continue; // No valid date yet
          }
          
          // Description is second column
          const descripcionIndex = headerInfo?.descripcionIndex ?? 1;
          const desc = parts[descripcionIndex]?.trim();
          if (!desc) continue;
          
          // Find amounts in remaining columns
          let mPesos = 0.0;
          let mDolares = 0.0;

          if (headerInfo) {
            if (headerInfo.pesosIndex !== -1) {
              mPesos = this.cleanCurrency(parts[headerInfo.pesosIndex]);
            }
            if (headerInfo.dolaresIndex !== -1) {
              mDolares = this.cleanCurrency(parts[headerInfo.dolaresIndex]);
            }
          }
          
          if (mPesos === 0 && mDolares === 0) {
            for (const part of parts) {
              if (part.includes('U$S')) {
                mDolares = this.cleanCurrency(part);
              } else if (part.includes('$') && !part.includes('U$S')) {
                mPesos = this.cleanCurrency(part);
              }
            }
          }
          
          const total = mPesos + (mDolares * this.dolarValue);
          
          if (total !== 0) {
            const moneda = mDolares > 0 ? 'USD' : 'ARS';
            const montoOriginal = mDolares > 0 ? mDolares : mPesos;
            const categoria = this.inferCategoria(desc);
            
            const transaction = this.createTransaction({
              fecha,
              categoria,
              detalle: desc,
              importe: total,
              moneda,
              monto_original: montoOriginal,
              tipo: 'Gasto',
              origen: 'Santander'
            });
            
            finalData.push(transaction);
          }
        }
      }
      
      return finalData;
    } catch (error) {
      throw new Error(`Error parsing Santander file: ${error.message}`);
    }
  }

  /**
   * Parse CSV line handling quoted fields
   * @param {string} line - CSV line
   * @returns {Array<string>} - Array of fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
}
