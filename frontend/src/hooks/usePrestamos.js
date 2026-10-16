import { useCallback, useEffect, useState } from 'react'
import { loanService } from '../services/loanService'
import { mensajeError } from '../utils/format'

// Préstamos agrupados por deudor (pendientes y saldados)
const usePrestamos = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setError(null)
      const res = await loanService.getLoans()
      setData(res.data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los préstamos'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { data, loading, error, recargar }
}

export default usePrestamos
