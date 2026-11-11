import { useCallback, useEffect, useRef, useState } from 'react'
import { operationsService } from '../services/transactionService'
import { mensajeError } from '../utils/format'

const LOTE = 100

// Transacciones que importó una carga, de a 100. Se reinicia al cambiar de carga.
const useDetalleCarga = (operacion) => {
  const [transacciones, setTransacciones] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const id = operacion?.operation_id
  const idActual = useRef(id)
  idActual.current = id

  const pedir = useCallback(async (skip) => {
    setCargando(true)
    setError(null)
    try {
      const res = await operationsService.transacciones(id, { limit: LOTE, skip })
      // Descarta la respuesta si mientras tanto se abrió otra carga
      if (idActual.current !== id) return
      setTransacciones(prev => (skip === 0 ? res.data.transactions : [...prev, ...res.data.transactions]))
      setTotal(res.data.total)
      setHasMore(res.data.hasMore)
    } catch (err) {
      if (idActual.current !== id) return
      setError(mensajeError(err, 'No se pudo cargar el detalle'))
    } finally {
      if (idActual.current === id) setCargando(false)
    }
  }, [id])

  useEffect(() => {
    setTransacciones([])
    setTotal(0)
    setHasMore(false)
    if (id) pedir(0)
  }, [id, pedir])

  return { transacciones, total, hasMore, cargando, error, verMas: () => pedir(transacciones.length) }
}

export default useDetalleCarga
