import { useState, useEffect } from 'react'
import { dolarService } from '../services/dolarService'

// Loads the default dollar rate (oficial venta) and keeps it editable
const useCotizacionDolar = () => {
  const [valorDolar, setValorDolarState] = useState('')
  const [cotizacion, setCotizacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editado, setEditado] = useState(false)

  useEffect(() => {
    let cancelled = false
    dolarService.getCotizacion()
      .then(({ data }) => {
        if (cancelled) return
        setCotizacion(data)
        setValorDolarState(prev => (prev === '' ? data.venta : prev))
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo obtener la cotización del dólar. Ingresala manualmente.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const setValorDolar = (value) => {
    setEditado(true)
    setValorDolarState(value)
  }

  const restablecer = () => {
    if (!cotizacion) return
    setEditado(false)
    setValorDolarState(cotizacion.venta)
  }

  return { valorDolar, setValorDolar, cotizacion, loading, error, editado, restablecer }
}

export default useCotizacionDolar
