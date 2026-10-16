import { useEffect, useMemo, useState } from 'react'
import useRendimientos from '../../hooks/useRendimientos'
import PerformanceChart from './PerformanceChart'
import PerformanceTable from './PerformanceTable'
import AssetDetailModal from './AssetDetailModal'
import AssetFormModal from './AssetFormModal'
import { investmentService } from '../../services/investmentService'
import { formatMoney, formatPercent, formatFecha, hoyISO } from '../../utils/format'

const RANGOS = [
  { id: 'todo', label: 'Todo' },
  { id: 'anio', label: 'Este año' },
  { id: '12m', label: 'Últimos 12 meses' },
  { id: 'custom', label: 'Personalizado' }
]

const restarMeses = (fechaISO, meses) => {
  const d = new Date(`${fechaISO}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - meses)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const colorGanancia = (n) => (n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-white')

const Card = ({ label, value, hint, valueClass = 'text-white' }) => (
  <div className="card !p-5">
    <p className="text-sm text-gray-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
)

// Lo que ganaste a lo largo del tiempo, incluidos los activos que ya vendiste
const RendimientosTab = ({ moneda }) => {
  const hoy = hoyISO()
  const [rango, setRango] = useState('todo')
  const [custom, setCustom] = useState({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy })
  const [detalleId, setDetalleId] = useState(null)
  const [editando, setEditando] = useState(null)
  const [tipos, setTipos] = useState([])

  // Tipos de activo para el form de edición (los cerrados solo se editan desde acá)
  useEffect(() => {
    investmentService.getTypes()
      .then(res => setTipos(res.data))
      .catch(() => setTipos([]))
  }, [])

  const filtro = useMemo(() => {
    if (rango === 'anio') return { desde: `${hoy.slice(0, 4)}-01-01` }
    if (rango === '12m') return { desde: restarMeses(hoy, 12) }
    if (rango === 'custom') return custom
    return {}
  }, [rango, custom, hoy])

  const { data, loading, error, recargar } = useRendimientos(filtro)
  const s = moneda.toLowerCase()
  const t = data?.totales
  const plataformas = useMemo(
    () => [...new Set((data?.activos || []).map(a => a.plataforma).filter(Boolean))].sort(),
    [data]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
          {RANGOS.map(r => (
            <button
              key={r.id}
              onClick={() => setRango(r.id)}
              className={`px-3 py-2 whitespace-nowrap ${rango === r.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {rango === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={custom.desde}
              max={custom.hasta}
              onChange={e => e.target.value && setCustom(c => ({ ...c, desde: e.target.value }))}
              className="input-field !py-1.5"
            />
            <span className="text-gray-500">a</span>
            <input
              type="date"
              value={custom.hasta}
              min={custom.desde}
              max={hoy}
              onChange={e => e.target.value && setCustom(c => ({ ...c, hasta: e.target.value }))}
              className="input-field !py-1.5"
            />
          </div>
        )}
        {data?.desde && (
          <p className="text-sm text-gray-500">
            {formatFecha(data.desde)} → {formatFecha(data.hasta)}
          </p>
        )}
      </div>

      {error && (
        <div className="card border-red-800 text-red-400">
          {error} <button onClick={recargar} className="underline ml-2">Reintentar</button>
        </div>
      )}

      {!data && loading && <p className="text-gray-400">Calculando rendimientos...</p>}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              label="Ganancia total"
              value={formatMoney(t[`ganancia_${s}`], moneda, { signo: true })}
              valueClass={colorGanancia(t[`ganancia_${s}`])}
              hint={`${formatPercent(t[`rendimiento_${s}`])} sobre lo invertido en el período`}
            />
            <Card
              label="Realizada"
              value={formatMoney(t[`realizada_${s}`], moneda, { signo: true })}
              valueClass={colorGanancia(t[`realizada_${s}`])}
              hint="De activos que ya cerraste"
            />
            <Card
              label="No realizada"
              value={formatMoney(t[`no_realizada_${s}`], moneda, { signo: true })}
              valueClass={colorGanancia(t[`no_realizada_${s}`])}
              hint="De activos que todavía tenés"
            />
          </div>

          <PerformanceChart serie={data.serie} moneda={moneda} />

          <PerformanceTable
            activos={data.activos}
            moneda={moneda}
            conRango={rango !== 'todo'}
            onSelect={(a) => setDetalleId(a._id)}
          />
        </div>
      )}

      <AssetDetailModal
        assetId={detalleId}
        moneda={moneda}
        onClose={() => setDetalleId(null)}
        onChanged={recargar}
        onEdit={(asset) => {
          setDetalleId(null)
          setEditando(asset)
        }}
      />

      <AssetFormModal
        isOpen={Boolean(editando)}
        asset={editando}
        onClose={() => setEditando(null)}
        tipos={tipos}
        onTiposChange={setTipos}
        plataformas={plataformas}
        onSaved={(asset) => {
          setEditando(null)
          recargar()
          setDetalleId(asset._id)
        }}
      />
    </div>
  )
}

export default RendimientosTab
