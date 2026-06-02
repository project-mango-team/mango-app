import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export const COLORS = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Sky Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Lavender
  '#85C1E2', // Light Blue
  '#F8B739', // Orange
  '#52B788', // Green
  '#E06377', // Rose
  '#5F9EA0'  // Cadet Blue
]

const ExpensesPieChart = ({ data }) => {
  const [hiddenCategories, setHiddenCategories] = useState({})

  useEffect(() => {
    if (!data || data.length === 0) {
      setHiddenCategories({})
      return
    }

    setHiddenCategories((prev) => {
      const next = {}

      for (const item of data) {
        next[item.categoria] = Object.prototype.hasOwnProperty.call(prev, item.categoria)
          ? prev[item.categoria]
          : false
      }

      return next
    })
  }, [data])

  const visibleData = useMemo(() => {
    if (!data) return []
    return data.filter((item) => !hiddenCategories[item.categoria])
  }, [data, hiddenCategories])

  const visibleTotal = useMemo(() => {
    return visibleData.reduce((sum, item) => sum + item.total, 0)
  }, [visibleData])

  const colorIndexByCategory = useMemo(() => {
    return new Map((data || []).map((item, index) => [item.categoria, index]))
  }, [data])

  const allVisible = data && data.length > 0 && visibleData.length === data.length
  const someVisible = data && visibleData.length > 0 && visibleData.length < data.length

  const toggleCategory = (categoria) => {
    setHiddenCategories((prev) => ({
      ...prev,
      [categoria]: !prev[categoria]
    }))
  }

  const showAll = () => {
    const next = {}
    for (const item of data || []) {
      next[item.categoria] = false
    }
    setHiddenCategories(next)
  }

  const hideAll = () => {
    const next = {}
    for (const item of data || []) {
      next[item.categoria] = true
    }
    setHiddenCategories(next)
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay datos de gastos para mostrar
      </div>
    )
  }

  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null // No mostrar labels muy pequeños

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-semibold"
        style={{
          opacity: 0,
          animation: 'fadeInLabel 0.3s ease-in forwards',
          animationDelay: '0.5s'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const percent = visibleTotal > 0 ? ((payload[0].value / visibleTotal) * 100).toFixed(1) : '0.0'

      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-semibold">{payload[0].name}</p>
          <p className="text-primary">
            ${payload[0].value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-gray-400 text-sm">
            {percent}%
          </p>
        </div>
      )
    }
    return null
  }

  if (visibleData.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-400">
        <p>No hay categorías visibles</p>
        <button
          onClick={showAll}
          className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-100 hover:bg-gray-600"
        >
          Mostrar todas
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-400">
          Total visible: <span className="text-white font-semibold">${visibleTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={showAll}
            className="rounded border border-gray-700 px-2 py-1 text-gray-300 hover:bg-gray-800"
            disabled={allVisible}
          >
            Mostrar todas
          </button>
          <button
            onClick={hideAll}
            className="rounded border border-gray-700 px-2 py-1 text-gray-300 hover:bg-gray-800"
            disabled={!someVisible && !allVisible}
          >
            Ocultar todas
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.map((item, index) => {
          const isHidden = hiddenCategories[item.categoria]
          return (
            <button
              key={item.categoria}
              type="button"
              onClick={() => toggleCategory(item.categoria)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                isHidden
                  ? 'border-gray-700 bg-gray-800/40 text-gray-500 line-through'
                  : 'border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              {item.categoria}
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={visibleData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={150}
            fill="#8884d8"
            dataKey="total"
            nameKey="categoria"
          >
            {visibleData.map((entry) => (
              <Cell
                key={`cell-${entry.categoria}`}
                fill={COLORS[(colorIndexByCategory.get(entry.categoria) || 0) % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ExpensesPieChart
