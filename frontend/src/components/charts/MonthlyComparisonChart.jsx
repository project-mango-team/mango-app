import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useState, useEffect, useRef } from 'react'

const MonthlyComparisonChart = ({ data }) => {
  const [animate, setAnimate] = useState(false)
  const chartRef = useRef()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animate) {
          setAnimate(true)
        }
      },
      { threshold: 0.3 }
    )

    const currentRef = chartRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay datos mensuales para mostrar
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

  // Función para formatear números grandes
  const formatLargeNumber = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(0)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    } else {
      return `$${value}`
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-semibold mb-2">{label}</p>
          <p className="text-green-400">
            Ingresos: ${payload[1]?.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-red-400">
            Gastos: ${payload[0]?.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-primary mt-1 pt-1 border-t border-gray-600">
            Balance: ${(payload[1]?.value - payload[0]?.value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div ref={chartRef}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={animate ? dataWithValues : []}
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
            tickFormatter={formatLargeNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => (
              <span className="text-gray-300">
                {value === 'gastos' ? 'Gastos' : 'Ingresos'}
              </span>
            )}
          />
          <Bar 
            dataKey="gastos" 
            fill="#e74c3c" 
            radius={[8, 8, 0, 0]}
            animationBegin={0}
            animationDuration={800}
          />
          <Bar 
            dataKey="ingresos" 
            fill="#2ecc71" 
            radius={[8, 8, 0, 0]}
            animationBegin={400}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MonthlyComparisonChart
