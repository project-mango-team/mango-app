import { useCallback, useEffect, useState } from 'react'
import { operationsService } from '../services/transactionService'
import { BANDEJA_CAMBIO } from './useBandeja'
import useProgreso from './useProgreso'

export const POR_PAGINA = 20

// Historial de cargas de todos los orígenes (archivo, manual, Bandeja, mail, API, migración), paginado en el
// servidor, y su reversión. Revertir una carga que vino de la Bandeja deja el documento listo para revisar de nuevo.
const useHistorialCargas = () => {
  const [operaciones, setOperaciones] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [canal, setCanalState] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const progreso = useProgreso()

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      const res = await operationsService.listar({ limit: POR_PAGINA, skip: pagina * POR_PAGINA, canal })
      // Si se vació la última página (por ejemplo tras revertir), vuelve a la anterior
      if (res.data.length === 0 && pagina > 0) {
        setPagina(p => p - 1)
        return
      }
      setErrorCarga(null)
      setOperaciones(res.data)
      setTotal(res.total)
    } catch (error) {
      console.error('Error loading history:', error)
      setErrorCarga('No se pudo cargar el historial')
    } finally {
      setCargando(false)
    }
  }, [pagina, canal])

  useEffect(() => {
    cargar()
    // Una carga nueva o revertida desde otro lado de la pestaña refresca la lista
    window.addEventListener(BANDEJA_CAMBIO, cargar)
    return () => window.removeEventListener(BANDEJA_CAMBIO, cargar)
  }, [cargar])

  const cambiarCanal = (nuevo) => {
    setCanalState(nuevo)
    setPagina(0)
  }

  // Revierte una carga con el modal de progreso. Devuelve true si salió bien.
  const revertir = async (operacion) => {
    const res = await progreso.ejecutar('Revertir carga', async () => {
      const r = await operationsService.rollback(operacion.operation_id)
      const vuelveABandeja = ['bandeja', 'mail', 'api'].includes(operacion.canal) && r.data?.reabierto !== false
      // Actualiza el badge y la lista de pendientes (y recarga este historial)
      window.dispatchEvent(new Event(BANDEJA_CAMBIO))
      return vuelveABandeja ? `${r.message}. El documento volvió a la lista de pendientes para revisar.` : r.message
    }, { cargando: 'Revirtiendo la carga y restaurando lo que había antes…', errorPorDefecto: 'Error al revertir la carga' })
    return res !== undefined
  }

  return {
    operaciones,
    total,
    pagina,
    porPagina: POR_PAGINA,
    hayAnterior: pagina > 0,
    haySiguiente: (pagina + 1) * POR_PAGINA < total,
    anterior: () => setPagina(p => Math.max(0, p - 1)),
    siguiente: () => setPagina(p => p + 1),
    canal,
    cambiarCanal,
    cargando,
    errorCarga,
    progreso,
    revertir
  }
}

export default useHistorialCargas
