import { formatMoney, formatPercent } from '../../utils/format'

const colorGanancia = (n) => (n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-300')

// Ganancia por activo en el período, incluidos los que ya vendiste
const PerformanceTable = ({ activos, moneda, conRango, onSelect }) => {
  const s = moneda.toLowerCase()
  const ordenados = [...activos].sort((a, b) => b[`ganancia_${s}`] - a[`ganancia_${s}`])

  if (activos.length === 0) {
    return <div className="card text-center py-12 text-gray-400">No hay activos con movimientos en este período.</div>
  }

  return (
    <div className="card !p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="px-4 py-3 font-medium">Activo</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            {conRango && <th className="px-4 py-3 font-medium text-right">Valor al inicio</th>}
            <th className="px-4 py-3 font-medium text-right">Aportado</th>
            <th className="px-4 py-3 font-medium text-right">Retirado</th>
            <th className="px-4 py-3 font-medium text-right">{conRango ? 'Valor al final' : 'Valor actual'}</th>
            <th className="px-4 py-3 font-medium text-right">Ganancia</th>
            <th className="px-4 py-3 font-medium text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map(a => (
            <tr
              key={a._id}
              onClick={() => onSelect(a)}
              className="border-b border-gray-700/50 hover:bg-gray-700/40 cursor-pointer"
            >
              <td className="px-4 py-3">
                <p className="text-white font-medium">{a.nombre}</p>
                <p className="text-xs text-gray-500">{[a.tipo, a.plataforma].filter(Boolean).join(' · ')}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs ${a.cerrado ? 'bg-gray-700 text-gray-300' : 'bg-primary/20 text-orange-300'}`}>
                  {a.cerrado ? 'Cerrado' : 'Abierto'}
                </span>
              </td>
              {conRango && <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{formatMoney(a[`valor_inicio_${s}`], moneda)}</td>}
              <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatMoney(a[`aportado_${s}`], moneda)}</td>
              <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatMoney(a[`retirado_${s}`], moneda)}</td>
              <td className="px-4 py-3 text-right text-white tabular-nums">{formatMoney(a[`valor_fin_${s}`], moneda)}</td>
              <td className={`px-4 py-3 text-right tabular-nums font-medium ${colorGanancia(a[`ganancia_${s}`])}`}>
                {formatMoney(a[`ganancia_${s}`], moneda, { signo: true })}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${colorGanancia(a[`ganancia_${s}`])}`}>
                {formatPercent(a[`rendimiento_${s}`])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PerformanceTable
