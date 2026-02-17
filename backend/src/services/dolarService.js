import axios from 'axios';

/**
 * Service to get dollar exchange rates
 */
export class DolarService {
  /**
   * Get current dollar "blue" exchange rate
   * @returns {Promise<number>} - Dollar sell value or default 1400
   */
  static async getCotizacion() {
    try {
      const response = await axios.get('https://dolarapi.com/v1/dolares/blue', {
        timeout: 3000
      });
      
      return parseFloat(response.data.venta) || 1400.0;
    } catch (error) {
      console.warn('Error fetching dollar rate, using default:', error.message);
      return 1400.0;
    }
  }
}
