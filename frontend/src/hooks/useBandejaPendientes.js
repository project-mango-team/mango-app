import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { bandejaService } from '../services/bandejaService'
import { BANDEJA_CAMBIO } from './useBandeja'

// Cantidad de documentos de la bandeja esperando revisión (badge del menú).
// Se actualiza al navegar y cuando la bandeja avisa que cambió.
const useBandejaPendientes = () => {
  const [pendientes, setPendientes] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let cancelado = false
    const cargar = () => bandejaService.pendientes()
      .then(res => { if (!cancelado) setPendientes(res.data.pendientes) })
      .catch(() => {})
    cargar()
    window.addEventListener(BANDEJA_CAMBIO, cargar)
    return () => {
      cancelado = true
      window.removeEventListener(BANDEJA_CAMBIO, cargar)
    }
  }, [location.pathname])

  return pendientes
}

export default useBandejaPendientes
