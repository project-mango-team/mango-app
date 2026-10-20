import { BaseParser } from './BaseParser.js';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

/**
 * Parser for Mercado Pago CSV files
 */
export class MercadoPagoParser extends BaseParser {
  /**
   * Reconoce un archivo de Mercado Pago por su contenido
   * @param {string} texto - Texto del archivo (CSV) o del PDF
   * @returns {Object|null} - Detección parcial (ver statementImportService.detectarDocumento)
   */
  static detectar(texto) {
    // El separador cambió de "," a ";" desde mediados de 2026
    if (/INITIAL_BALANCE/.test(texto) && /RELEASE_DATE[,;]TRANSACTION_TYPE/.test(texto)) {
      // Período: primera y última fecha de los movimientos (DD-MM-YYYY)
      const fechas = [...texto.matchAll(/^(\d{2})-(\d{2})-(\d{4})[,;]/gm)].map(m => `${m[3]}-${m[2]}-${m[1]}`).sort();
      return {
        tipo: 'mercadopago',
        producto: 'cuenta',
        descripcion: 'Mercado Pago · cuenta',
        periodo: fechas.length ? { desde: fechas[0], hasta: fechas.at(-1) } : null
      };
    }
    if (/RESUMEN DE CUENTA EN PESOS/.test(texto) && /CVU/.test(texto)) {
      return {
        tipo: 'mercadopago',
        producto: 'cuenta',
        descripcion: 'Mercado Pago · resumen PDF',
        soportado: false,
        motivo: 'El resumen PDF de Mercado Pago no está soportado: descargá el reporte en CSV'
      };
    }
    return null;
  }

  /**
   * Parse Mercado Pago CSV file
   * @returns {Promise<Array>} - Array of parsed transactions
   */
  async parse() {
    return new Promise((resolve, reject) => {
      const transactions = [];
      const rows = [];
      
      const fileContent = this.buffer.toString('utf-8');
      const lines = fileContent.split(/\r?\n/);
      
      // Auto-detect header line index and separator
      let skipLines = 0;
      let separator = ',';
      let headerFound = false;

      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();
        if (
          upperLine.includes('TRANSACTION_NET_AMOUNT') ||
          upperLine.includes('RELEASE_DATE') ||
          upperLine.includes('MONTO_NETO') ||
          upperLine.includes('FECHA_DE_LIBERACION') ||
          upperLine.includes('TRANSACTION_TYPE')
        ) {
          skipLines = i;
          headerFound = true;
          if (line.includes(';')) {
            separator = ';';
          } else if (line.includes('\t')) {
            separator = '\t';
          } else {
            separator = ',';
          }
          break;
        }
      }

      if (!headerFound) {
        if (lines[0] && lines[0].includes(';')) {
          separator = ';';
        }
      }

      // Convert buffer to stream
      const stream = Readable.from(fileContent);
      
      stream
        .pipe(csvParser({
          skipLines,
          separator,
          mapHeaders: ({ header }) => header.trim().replace(/^"/, '').replace(/"$/, '').trim()
        }))
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', () => {
          try {
            if (rows.length === 0) {
              return resolve(transactions);
            }

            const amountKeys = ['TRANSACTION_NET_AMOUNT', 'MONTO_NETO', 'MONTO', 'IMPORTE', 'NET_AMOUNT', 'TRANSACTION NET AMOUNT'];
            const typeKeys = ['TRANSACTION_TYPE', 'TIPO_DE_TRANSACCION', 'TIPO', 'CONCEPTO', 'DESCRIPCION', 'TYPE', 'TRANSACTION TYPE'];
            const dateKeys = ['RELEASE_DATE', 'FECHA_DE_LIBERACION', 'FECHA', 'DATE', 'RELEASE DATE'];

            const getFieldValue = (row, keys) => {
              for (const key of keys) {
                if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                  return String(row[key]).trim();
                }
              }
              return null;
            };

            const firstRow = rows[0];
            const hasAmount = getFieldValue(firstRow, amountKeys) !== null;
            const hasTypeOrDate = getFieldValue(firstRow, typeKeys) !== null || getFieldValue(firstRow, dateKeys) !== null;

            if (!hasAmount || !hasTypeOrDate) {
              return reject(new Error('El CSV no tiene formato de Mercado Pago'));
            }

            // Process each row
            for (const row of rows) {
              try {
                const amountRaw = getFieldValue(row, amountKeys) || '0';
                const monto = this.cleanAmount(amountRaw);
                
                if (monto === 0) continue;
                
                const tipo = monto < 0 ? 'Gasto' : 'Ingreso';
                const desc = getFieldValue(row, typeKeys) || '';
                const fecha = getFieldValue(row, dateKeys) || '';
                const categoria = this.inferCategoria(desc);
                
                const transaction = this.createTransaction({
                  fecha,
                  categoria,
                  detalle: desc,
                  importe: monto,
                  moneda: 'ARS',
                  monto_original: monto,
                  tipo,
                  origen: 'Mercado Pago'
                });
                
                transactions.push(transaction);
              } catch (err) {
                // Skip invalid rows
                continue;
              }
            }
            
            resolve(transactions);
          } catch (error) {
            reject(new Error(`Error processing Mercado Pago file: ${error.message}`));
          }
        })
        .on('error', (error) => {
          reject(new Error(`Error reading Mercado Pago CSV: ${error.message}`));
        });
    });
  }
}
