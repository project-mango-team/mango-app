import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { MarketPriceService } from './marketPriceService.js';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  axios.get.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// Cada test usa ids propios: el servicio cachea los precios 10 minutos
describe('MarketPriceService.getCripto', () => {
  it('pide USD y EUR a CoinGecko y cachea', async () => {
    axios.get.mockResolvedValue({ data: { 'moneda-a': { usd: 2, eur: 1.8 } } });
    await expect(MarketPriceService.getCripto('moneda-a')).resolves.toEqual({ usd: 2, eur: 1.8 });
    await MarketPriceService.getCripto('moneda-a');
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params).toEqual({ ids: 'moneda-a', vs_currencies: 'usd,eur' });
  });

  it('si CoinGecko no responde avisa con 503', async () => {
    axios.get.mockRejectedValue(new Error('429 Too Many Requests'));
    await expect(MarketPriceService.getCripto('moneda-b')).rejects.toMatchObject({ statusCode: 503 });
  });
});
