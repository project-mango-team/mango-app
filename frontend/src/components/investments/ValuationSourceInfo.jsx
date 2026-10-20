import { useState } from 'react'
import { investmentService } from '../../services/investmentService'
import { formatFecha, formatMoney, mensajeError } from '../../utils/format'
import { etiquetaFuente, formatPrecio, formatUnidades, tienePrecioAutomatico, usaUnidades } from './valuacion'

const detalleFuente = ({ fuente_precio: fuente, precio_config: c = {} }) => {
  if (fuente === 'cafci') return c.fci_nombre
  if (fuente === 'ticker') return c.ticker
  if (fuente === 'coingecko') return c.coingecko_id
  if (fuente === 'tasa_fija') return `${String(c.tasa_anual).replace('.', ',')}% anual`
  return null
}

// Calcula el valor con el último precio de la fuente y deja guardarlo como valuación
const AutoValuation = ({ asset, onValuated }) => {
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const ejecutar = async (accion) => {
    setCargando(true)
    setError(null)
    try {
      if (accion === 'calcular') {
        const { data } = await investmentService.getAutoValuation(asset._id)
        setPreview(data)
      } else {
        await investmentService.createAutoValuation(asset._id)
        setPreview(null)
        await onValuated()
      }
    } catch (err) {
      setError(mensajeError(err, 'No se pudo calcular el valor'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
      {preview ? (
        <>
          <span className="text-gray-300 tabular-nums">
            {formatUnidades(preview.unidades)} × {formatPrecio(preview.precio, asset.moneda)}
            {' = '}<span className="text-white font-medium">{formatMoney(preview.monto, asset.moneda)}</span>
            <span className="text-gray-500"> · {preview.fuente} al {formatFecha(preview.fecha)}</span>
          </span>
          <button onClick={() => ejecutar('guardar')} disabled={cargando} className="btn-primary !py-1 !px-3 text-sm disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Guardar como valuación'}
          </button>
          <button onClick={() => setPreview(null)} className="text-sm text-gray-400 hover:text-white">Cancelar</button>
        </>
      ) : (
        <button onClick={() => ejecutar('calcular')} disabled={cargando} className="btn-secondary !py-1 !px-3 text-sm disabled:opacity-50">
          {cargando ? 'Buscando precio...' : `Valuar con ${etiquetaFuente(asset.fuente_precio)}`}
        </button>
      )}
      {error && <span className="text-red-400">{error}</span>}
    </div>
  )
}

// Línea del detalle del activo con la fuente de precio y las unidades en tenencia
const ValuationSourceInfo = ({ asset, onValuated }) => {
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
      {tienePrecioAutomatico(fuente) && tenencia?.unidades != null && (
        <AutoValuation asset={asset} onValuated={onValuated} />
      )}
    </div>
  )
}

export default ValuationSourceInfo
