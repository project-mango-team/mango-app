import { useCallback, useEffect, useState } from 'react'
import { operationsService } from '../services/transactionService'
import { BANDEJA_CAMBIO } from './useBandeja'

// Historial de cargas de todos los orígenes (archivo, manual, Bandeja, mail, API, migración) y su reversión.
// Revertir una carga que vino de la Bandeja deja el documento listo para revisar de nuevo.
const useHistorialCargas = () => {
  const [operaciones, setOperaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      const res = await operationsService.getAll(null, null, 50)
      setOperaciones(res.data)
    } catch (error) {
      console.error('Error loading history:', error)
      setMensaje({ type: 'error', text: 'No se pudo cargar el historial' })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    // Una carga nueva o revertida desde otro lado de la pestaña refresca la lista
    window.addEventListener(BANDEJA_CAMBIO, cargar)
    return () => window.removeEventListener(BANDEJA_CAMBIO, cargar)
  }, [cargar])

  const revertir = async (operacion) => {
    try {
      const res = await operationsService.rollback(operacion.operation_id)
      const vuelveABandeja = ['bandeja', 'mail', 'api'].includes(operacion.canal) && res.data?.reabierto !== false
      setMensaje({
        type: 'success',
        text: vuelveABandeja ? `${res.message}. El documento volvió a la Bandeja para revisar.` : res.message
      })
      // El badge de la Bandeja se actualiza solo
      window.dispatchEvent(new Event(BANDEJA_CAMBIO))
    } catch (error) {
      setMensaje({ type: 'error', text: error.response?.data?.message || 'Error al hacer rollback' })
    } finally {
      cargar()
    }
  }

  return { operaciones, cargando, mensaje, revertir }
}

export default useHistorialCargas
