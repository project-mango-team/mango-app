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
import { useState, useEffect, useRef } from 'react'

const BalanceLineChart = ({ data }) => {
  const [animate, setAnimate] = useState(false)
  const [animatedData, setAnimatedData] = useState([])
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

  // Filtrar solo meses con datos
  const dataWithValues = data ? data.filter(d => d.gastos > 0 || d.ingresos > 0) : []

  // Calcular el rango completo para fijar el eje Y
  const maxBalance = dataWithValues.length > 0 ? Math.max(...dataWithValues.map(item => item.balance)) : 0
  const minBalance = dataWithValues.length > 0 ? Math.min(...dataWithValues.map(item => item.balance)) : 0
  
  // Asegurar que el rango siempre incluya el cero y tenga padding apropiado
  const maxValue = Math.max(maxBalance, 0) * 1.1 // 10% padding arriba
  const minValue = Math.min(minBalance, 0) * 1.1 // 10% padding abajo (si es negativo)
  const yAxisDomain = [minValue, maxValue]

  useEffect(() => {
    if (animate) {
      // Inmediatamente iniciamos con todos los puntos en 0 
      const dataAtZero = dataWithValues.map(item => ({
        ...item,
        balance: 0
      }))
      setAnimatedData(dataAtZero)

      // Animar cada punto hacia su valor final
      const animationDuration = 1200 // 1.2 segundos total
      const steps = 60 // 60 frames para animación suave
      const stepDuration = animationDuration / steps

      let currentStep = 0
      const interval = setInterval(() => {
        currentStep++
        const progress = currentStep / steps

        if (progress >= 1) {
          // Animación completa - valores finales
          setAnimatedData(dataWithValues)
          clearInterval(interval)
        } else {
          // Interpolación gradual de 0 hacia el valor final
          const interpolatedData = dataWithValues.map(item => ({
            ...item,
            balance: item.balance * progress
          }))
          setAnimatedData(interpolatedData)
        }
      }, stepDuration)

      return () => clearInterval(interval)
    } else {
      // Sin animación - mantener datos en 0 hasta que se active animación
      const dataAtZero = dataWithValues.map(item => ({
        ...item,
        balance: 0
      }))
      setAnimatedData(dataAtZero)
    }
  }, [animate, dataWithValues.length])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No hay datos de balance para mostrar
      </div>
    )
  }

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
    <div ref={chartRef}>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={animatedData}
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
          domain={yAxisDomain}
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
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}

export default BalanceLineChart
