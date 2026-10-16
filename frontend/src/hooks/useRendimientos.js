import { useCallback, useEffect, useState } from 'react'
import { investmentService } from '../services/investmentService'
import { mensajeError } from '../utils/format'

// Ganancias por activo, totales y serie mensual para un rango (desde/hasta YYYY-MM-DD, opcionales)
const useRendimientos = ({ desde, hasta }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await investmentService.getPerformance({ desde, hasta })
      setData(res.data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los rendimientos'))
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { data, loading, error, recargar }
}

export default useRendimientos
