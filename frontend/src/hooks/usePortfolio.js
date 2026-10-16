import { useCallback, useEffect, useState } from 'react'
import { investmentService } from '../services/investmentService'
import { mensajeError } from '../utils/format'

// Carga el portfolio (activos abiertos, totales, distribución) y los tipos de activo
const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState(null)
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setError(null)
      const [portfolioRes, tiposRes] = await Promise.all([
        investmentService.getPortfolio(),
        investmentService.getTypes()
      ])
      setPortfolio(portfolioRes.data)
      setTipos(tiposRes.data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el portfolio'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { portfolio, tipos, setTipos, loading, error, recargar }
}

export default usePortfolio
