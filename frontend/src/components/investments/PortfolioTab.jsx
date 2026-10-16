import { useMemo, useState } from 'react'
import usePortfolio from '../../hooks/usePortfolio'
import SummaryCards from './SummaryCards'
import PortfolioPieChart from './PortfolioPieChart'
import AssetsTable from './AssetsTable'
import AssetFormModal from './AssetFormModal'
import AssetDetailModal from './AssetDetailModal'
import BulkValuationModal from './BulkValuationModal'
import { formatMoney } from '../../utils/format'

// Lo que tengo hoy: totales, distribución y tabla de activos abiertos
const PortfolioTab = ({ moneda }) => {
  const { portfolio, tipos, setTipos, loading, error, recargar } = usePortfolio()
  const [assetForm, setAssetForm] = useState({ open: false, asset: null })
  const [detalle, setDetalle] = useState({ id: null, conAporte: false })
  const [bulkOpen, setBulkOpen] = useState(false)

  const plataformas = useMemo(
    () => [...new Set((portfolio?.activos || []).map(a => a.plataforma).filter(Boolean))].sort(),
    [portfolio]
  )

  if (loading) return <p className="text-gray-400">Cargando portfolio...</p>
  if (error) {
    return (
      <div className="card border-red-800 text-red-400">
        {error} <button onClick={recargar} className="underline ml-2">Reintentar</button>
      </div>
    )
  }

  const { totales, por_tipo, activos, cotizaciones, cantidad_cerrados } = portfolio

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setAssetForm({ open: true, asset: null })} className="btn-primary">
          Nuevo activo
        </button>
        <button onClick={() => setBulkOpen(true)} disabled={activos.length === 0} className="btn-secondary disabled:opacity-50">
          Actualizar valores
        </button>
        <div className="flex-1" />
        <p className="text-sm text-gray-500">
          Dólar blue {formatMoney(cotizaciones.usd, 'ARS')}
          {cotizaciones.eur && ` · Euro ${formatMoney(cotizaciones.eur, 'ARS')}`}
        </p>
      </div>

      <SummaryCards totales={totales} moneda={moneda} />
      <PortfolioPieChart
        activos={activos}
        porTipo={por_tipo}
        prestamos={{ usd: totales.prestamos_usd, ars: totales.prestamos_ars }}
        moneda={moneda}
      />
      <AssetsTable
        activos={activos}
        totales={totales}
        moneda={moneda}
        onSelect={(a) => setDetalle({ id: a._id, conAporte: false })}
      />
      {cantidad_cerrados > 0 && (
        <p className="text-sm text-gray-500">
          {cantidad_cerrados} activo(s) cerrado(s) no aparecen acá; su ganancia se va a ver en Rendimientos.
        </p>
      )}

      <AssetFormModal
        isOpen={assetForm.open}
        asset={assetForm.asset}
        onClose={() => setAssetForm({ open: false, asset: null })}
        tipos={tipos}
        onTiposChange={setTipos}
        plataformas={plataformas}
        onSaved={(asset, { nuevo }) => {
          setAssetForm({ open: false, asset: null })
          recargar()
          // Recién creado: abrir el detalle con el form del primer aporte
          setDetalle({ id: asset._id, conAporte: nuevo })
        }}
      />

      <AssetDetailModal
        assetId={detalle.id}
        iniciarConAporte={detalle.conAporte}
        moneda={moneda}
        onClose={() => setDetalle({ id: null, conAporte: false })}
        onChanged={recargar}
        onEdit={(asset) => {
          setDetalle({ id: null, conAporte: false })
          setAssetForm({ open: true, asset })
        }}
      />

      <BulkValuationModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        activos={activos}
        onSaved={() => {
          setBulkOpen(false)
          recargar()
        }}
      />
    </div>
  )
}

export default PortfolioTab
