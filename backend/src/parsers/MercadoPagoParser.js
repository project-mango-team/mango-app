import { BaseParser } from './BaseParser.js';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

/**
 * Parser for Mercado Pago CSV files
 */
export class MercadoPagoParser extends BaseParser {
  /**
   * Parse Mercado Pago CSV file
   * @returns {Promise<Array>} - Array of parsed transactions
   */
  async parse() {
    return new Promise((resolve, reject) => {
      const transactions = [];
      const rows = [];
      
      // Convert buffer to stream
      const stream = Readable.from(this.buffer.toString('utf-8'));
      
      stream
        .pipe(csvParser({
          skipLines: 3, // Skip first 3 lines (headers are on line 4)
          mapHeaders: ({ header }) => header.trim()
        }))
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', () => {
          try {
            // Validate required columns
            if (rows.length === 0) {
              return resolve(transactions);
            }

            const firstRow = rows[0];
            if (!firstRow['TRANSACTION_NET_AMOUNT'] || !firstRow['TRANSACTION_TYPE']) {
              return reject(new Error('El CSV no tiene formato de Mercado Pago'));
            }

            // Process each row
            for (const row of rows) {
              try {
                const monto = this.cleanAmount(row['TRANSACTION_NET_AMOUNT'] || '0');
                
                if (monto === 0) continue;
                
                const tipo = monto < 0 ? 'Gasto' : 'Ingreso';
                const desc = row['TRANSACTION_TYPE'] || '';
                const fecha = row['RELEASE_DATE'] || ''; // Format: DD-MM-YYYY
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
