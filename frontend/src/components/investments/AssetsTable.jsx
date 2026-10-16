import { formatMoney, formatPercent } from '../../utils/format'

const colorGanancia = (n) => (n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-300')

// Tabla de activos abiertos, como la hoja Portfolio del Excel
const AssetsTable = ({ activos, totales, moneda, onSelect }) => {
  const s = moneda.toLowerCase()
  const ordenados = [...activos].sort((a, b) => b.resumen.valor_actual_usd - a.resumen.valor_actual_usd)

  if (activos.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        Todavía no cargaste activos. Empezá con <span className="text-white">Nuevo activo</span>.
      </div>
    )
  }

  return (
    <div className="card !p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="px-4 py-3 font-medium">Activo</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium text-right">Valor (moneda orig.)</th>
            <th className="px-4 py-3 font-medium text-right" title="Aportes menos retiros">Aporte neto</th>
            <th className="px-4 py-3 font-medium text-right">Valor actual</th>
            <th className="px-4 py-3 font-medium text-right">Ganancia</th>
            <th className="px-4 py-3 font-medium text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((a) => {
            const r = a.resumen
            return (
              <tr
                key={a._id}
                onClick={() => onSelect(a)}
                className="border-b border-gray-700/50 hover:bg-gray-700/40 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{a.nombre}</p>
                  {a.plataforma && <p className="text-xs text-gray-500">{a.plataforma}</p>}
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {a.tipo}
                  {a.renta !== 'N/A' && <span className="text-xs text-gray-500"> · {a.renta}</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{formatMoney(r.valor_actual, a.moneda)}</td>
                <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatMoney(r[`aporte_neto_${s}`], moneda)}</td>
                <td className="px-4 py-3 text-right text-white tabular-nums">{formatMoney(r[`valor_actual_${s}`], moneda)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${colorGanancia(r[`ganancia_${s}`])}`}>
                  {formatMoney(r[`ganancia_${s}`], moneda, { signo: true })}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${colorGanancia(r[`ganancia_${s}`])}`}>
                  {formatPercent(r[`rendimiento_${s}`])}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="text-white font-semibold">
            <td className="px-4 py-3" colSpan={3}>Total</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totales[`aporte_neto_${s}`], moneda)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totales[`valor_${s}`], moneda)}</td>
            <td className={`px-4 py-3 text-right tabular-nums ${colorGanancia(totales[`ganancia_${s}`])}`}>
              {formatMoney(totales[`ganancia_${s}`], moneda, { signo: true })}
            </td>
            <td className={`px-4 py-3 text-right tabular-nums ${colorGanancia(totales[`ganancia_${s}`])}`}>
              {formatPercent(totales[`rendimiento_${s}`])}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default AssetsTable
