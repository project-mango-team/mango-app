import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

const BalanceLineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay datos de balance para mostrar
      </div>
    )
  }

  // Filtrar solo meses con datos
  const dataWithValues = data.filter(d => d.gastos > 0 || d.ingresos > 0)

  if (dataWithValues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay transacciones en este período
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const balance = payload[0].value
      const balanceColor = balance >= 0 ? 'text-green-400' : 'text-red-400'
      
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-semibold mb-1">{label}</p>
          <p className={`${balanceColor} text-lg font-bold`}>
            ${balance.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={dataWithValues}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="mes"
          stroke="#9CA3AF"
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fill: '#9CA3AF' }}
        />
        <YAxis
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#F7DC6F"
          strokeWidth={3}
          dot={{ fill: '#F7DC6F', r: 6 }}
          activeDot={{ r: 8 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default BalanceLineChart
