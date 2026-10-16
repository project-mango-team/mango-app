import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { COLORS } from '../charts/ExpensesPieChart'
import { formatMoney, formatPercent } from '../../utils/format'

// Distribución del portfolio, por activo o por tipo, en la moneda elegida
const PortfolioPieChart = ({ activos, porTipo, moneda }) => {
  const [agrupar, setAgrupar] = useState('activo')
  const s = moneda.toLowerCase()

  const data = useMemo(() => {
    const items = agrupar === 'activo'
      ? activos.map(a => ({ nombre: a.nombre, valor: a.resumen[`valor_actual_${s}`] }))
      : porTipo.map(t => ({ nombre: t.tipo, valor: t[`valor_${s}`] }))
    return items.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor)
  }, [agrupar, activos, porTipo, s])

  const total = data.reduce((sum, i) => sum + i.valor, 0)

  const TooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { nombre, valor } = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
        <p className="text-white font-semibold">{nombre}</p>
        <p className="text-primary">{formatMoney(valor, moneda)}</p>
        <p className="text-gray-400 text-sm">{formatPercent(valor / total, { signo: false })}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Distribución</h2>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
          {[['activo', 'Por activo'], ['tipo', 'Por tipo']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setAgrupar(value)}
              className={`px-3 py-1 ${agrupar === value ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Todavía no hay activos con valor
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="w-full lg:w-1/2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="valor" nameKey="nombre" innerRadius="55%" outerRadius="90%" paddingAngle={1} stroke="none">
                  {data.map((item, i) => (
                    <Cell key={item.nombre} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full lg:w-1/2 space-y-2">
            {data.map((item, i) => (
              <li key={item.nombre} className="flex items-center gap-3 text-sm">
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-200 flex-1 truncate">{item.nombre}</span>
                <span className="text-gray-400 tabular-nums">{formatPercent(item.valor / total, { signo: false })}</span>
                <span className="text-white tabular-nums w-32 text-right">{formatMoney(item.valor, moneda)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PortfolioPieChart
