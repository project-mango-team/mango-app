import { etiquetaFuente, formatUnidades, usaUnidades } from './valuacion'

const detalleFuente = ({ fuente_precio: fuente, precio_config: c = {} }) => {
  if (fuente === 'cafci') return c.fci_nombre
  if (fuente === 'ticker') return c.ticker
  if (fuente === 'coingecko') return c.coingecko_id
  if (fuente === 'tasa_fija') return `${String(c.tasa_anual).replace('.', ',')}% anual`
  return null
}

// Línea del detalle del activo con la fuente de precio y las unidades en tenencia
const ValuationSourceInfo = ({ asset }) => {
  const fuente = asset.fuente_precio || 'manual'
  const tenencia = asset.resumen.tenencia
  if (fuente === 'manual' && tenencia?.unidades == null) return null

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700">
      <span className="text-gray-400">
        Precio: <span className="text-white">{etiquetaFuente(fuente)}</span>
        {detalleFuente(asset) && <span className="text-gray-300"> · {detalleFuente(asset)}</span>}
      </span>
      {(tenencia?.unidades != null || usaUnidades(fuente)) && (
        <span className="text-gray-400">
          Unidades: <span className="text-white tabular-nums">{formatUnidades(tenencia?.unidades)}</span>
          {tenencia?.origen === 'manual' && <span className="text-gray-500"> (cargadas a mano)</span>}
        </span>
      )}
      {tenencia?.incompletas && (
        <span className="text-yellow-400">Hay aportes o retiros sin unidades: la tenencia puede estar mal.</span>
      )}
      {usaUnidades(fuente) && tenencia?.unidades == null && (
        <span className="text-yellow-400">Faltan las unidades para valuar automáticamente.</span>
      )}
    </div>
  )
}

export default ValuationSourceInfo
