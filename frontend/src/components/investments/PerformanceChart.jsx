import { useMemo, useState } from 'react'
import {
  ComposedChart, Area, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { formatMoney } from '../../utils/format'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const etiquetaMes = (fecha) => `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(2, 4)}`

const compacto = (moneda) => (v) => {
  const abs = Math.abs(v)
  const pref = moneda === 'USD' ? 'US$' : '$'
  if (abs >= 1e6) return `${pref}${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1e3) return `${pref}${(v / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })}k`
  return `${pref}${Math.round(v)}`
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 },
  labelStyle: { color: '#fff', fontWeight: 600 },
  itemStyle: { color: '#e5e7eb' }
}

// Evolución mensual: valor del portfolio vs capital aportado, o ganancia de cada mes
const PerformanceChart = ({ serie, moneda }) => {
  const [vista, setVista] = useState('evolucion')
  const s = moneda.toLowerCase()

  const data = useMemo(() => serie.map((p, i) => ({
    mes: etiquetaMes(p.fecha),
    valor: p[`valor_${s}`],
    capital: p[`capital_${s}`],
    // Ganancia del mes = cuánto creció la ganancia acumulada respecto del mes anterior
    gananciaMes: p[`ganancia_${s}`] - (i > 0 ? serie[i - 1][`ganancia_${s}`] : 0)
  })), [serie, s])

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Evolución</h2>
          <p className="text-xs text-gray-500">
            {vista === 'evolucion'
              ? 'La distancia entre el valor y lo aportado es la ganancia acumulada'
              : 'Cuánto ganaste o perdiste en cada mes'}
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
          {[['evolucion', 'Valor vs aportado'], ['mensual', 'Ganancia por mes']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setVista(value)}
              className={`px-3 py-1 ${vista === value ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Sin datos en este período</div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {vista === 'evolucion' ? (
              <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="valorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#db681d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#db681d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={compacto(moneda)} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip {...tooltipStyle} formatter={(v, name) => [formatMoney(v, moneda), name]} />
                <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 13 }} />
                <Area type="linear" dataKey="valor" name="Valor del portfolio" stroke="#db681d" strokeWidth={2} fill="url(#valorPortfolio)" />
                <Line type="linear" dataKey="capital" name="Capital aportado" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            ) : (
              <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={compacto(moneda)} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                <ReferenceLine y={0} stroke="#6b7280" />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#37415166' }} formatter={(v) => [formatMoney(v, moneda, { signo: true }), 'Ganancia del mes']} />
                <Bar dataKey="gananciaMes" radius={[3, 3, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.mes} fill={d.gananciaMes >= 0 ? '#4ade80' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default PerformanceChart
