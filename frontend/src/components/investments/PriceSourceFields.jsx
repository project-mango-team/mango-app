import { FUENTES_PRECIO, usaUnidades } from './valuacion'

/**
 * Sección "Valuación automática" del form de activo: fuente de precio, sus parámetros y unidades manuales.
 * `value`: { fuente_precio, precio_config, unidades } (unidades como texto editable)
 * `tenencia`: resumen.tenencia del activo, si ya existe
 */
const PriceSourceFields = ({ value, onChange, tenencia }) => {
  const { fuente_precio: fuente, precio_config: config } = value
  const setConfig = (campo) => (e) => onChange({ ...value, precio_config: { ...config, [campo]: e.target.value } })
  const unidadesDeMovimientos = tenencia?.origen === 'movimientos'

  return (
    <fieldset className="space-y-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700">
      <legend className="px-1 text-sm text-gray-300">Valuación automática</legend>

      <label className="block">
        <span className="text-sm text-gray-400">Fuente de precio</span>
        <select
          value={fuente}
          onChange={e => onChange({ ...value, fuente_precio: e.target.value })}
          className="input-field w-full mt-1"
        >
          {FUENTES_PRECIO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{FUENTES_PRECIO.find(f => f.value === fuente)?.ayuda}</span>
      </label>

      {fuente === 'cafci' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-sm text-gray-400">Fondo y clase</span>
            <input
              type="text"
              value={config.fci_nombre || ''}
              onChange={setConfig('fci_nombre')}
              placeholder="ej: Fima Premium - Clase A"
              className="input-field w-full mt-1"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Categoría</span>
            <select value={config.fci_categoria || 'mercadoDinero'} onChange={setConfig('fci_categoria')} className="input-field w-full mt-1">
              <option value="mercadoDinero">Money market</option>
              <option value="rentaFija">Renta fija</option>
              <option value="rentaVariable">Renta variable</option>
              <option value="rentaMixta">Renta mixta</option>
              <option value="otros">Otros</option>
            </select>
          </label>
        </div>
      )}
      {fuente === 'ticker' && (
        <label className="block">
          <span className="text-sm text-gray-400">Ticker</span>
          <input type="text" value={config.ticker || ''} onChange={setConfig('ticker')} placeholder="ej: SPY, GGAL" className="input-field w-full mt-1" required />
        </label>
      )}
      {fuente === 'coingecko' && (
        <label className="block">
          <span className="text-sm text-gray-400">Id de CoinGecko</span>
          <input type="text" value={config.coingecko_id || ''} onChange={setConfig('coingecko_id')} placeholder="ej: bitcoin, ethereum" className="input-field w-full mt-1" required />
        </label>
      )}
      {fuente === 'tasa_fija' && (
        <label className="block">
          <span className="text-sm text-gray-400">Tasa anual (%)</span>
          <input
            type="text"
            inputMode="decimal"
            value={config.tasa_anual ?? ''}
            onChange={setConfig('tasa_anual')}
            placeholder="ej: 8,5"
            className="input-field w-full mt-1"
            required
          />
        </label>
      )}

      {usaUnidades(fuente) && (
        <label className="block">
          <span className="text-sm text-gray-400">Unidades (cuotapartes, nominales, monedas)</span>
          <input
            type="text"
            inputMode="decimal"
            value={value.unidades}
            onChange={e => onChange({ ...value, unidades: e.target.value })}
            disabled={unidadesDeMovimientos}
            placeholder="ej: 1.250,5"
            className="input-field w-full mt-1 disabled:opacity-60"
          />
          <span className="text-xs text-gray-500">
            {unidadesDeMovimientos
              ? 'Salen de los movimientos que traen unidades (como las cuotapartes importadas de Fima).'
              : 'Opcional si los movimientos traen unidades: en ese caso mandan las de los movimientos.'}
          </span>
        </label>
      )}
    </fieldset>
  )
}

export default PriceSourceFields
