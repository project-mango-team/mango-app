import { useEffect, useState } from 'react'
import { dolarService } from '../services/dolarService'
import { toInputAR } from '../utils/format'

/**
 * Cotizaciones (blue y, si hace falta, euro) para una fecha, editables a mano.
 * Al cambiar la fecha se vuelven a buscar. Si `inicial` trae cotizaciones para esa misma
 * fecha (editar un movimiento), se usan esas sin pedir nada.
 * Los valores son strings en formato argentino para usarlos directo en inputs.
 */
const useCotizacionInversion = (fecha, { necesitaEuro = false, inicial = null } = {}) => {
  const [usd, setUsd] = useState('')
  const [eur, setEur] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fecha) return
    if (inicial && inicial.fecha === fecha) {
      setUsd(toInputAR(inicial.cotizacion_usd))
      setEur(toInputAR(inicial.cotizacion_eur))
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const pedidos = [dolarService.getBlue(fecha)]
    if (necesitaEuro) pedidos.push(dolarService.getEuro(fecha))

    Promise.all(pedidos)
      .then(([blue, euro]) => {
        if (cancelled) return
        setUsd(toInputAR(blue.data.promedio))
        if (euro) setEur(toInputAR(euro.data.promedio))
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo obtener la cotización de esa fecha. Ingresala manualmente.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // inicial solo importa al montar (editar), por eso no está en las dependencias
  }, [fecha, necesitaEuro])

  return { usd, setUsd, eur, setEur, loading, error }
}

export default useCotizacionInversion
