import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { notificationService } from '../services/notificationService'

// Evento para que la página de Avisos le diga al menú que cambió el contador
export const NOTIFICACIONES_CAMBIO = 'mango:notificaciones-cambio'

const INTERVALO_MS = 60 * 1000

// Cantidad de avisos sin leer (badge del menú). Se actualiza al navegar, cada minuto y cuando Avisos cambia algo.
const useNotificacionesNoLeidas = () => {
  const [noLeidas, setNoLeidas] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let cancelado = false
    const cargar = () => notificationService.noLeidas()
      .then(res => { if (!cancelado) setNoLeidas(res.data.noLeidas) })
      .catch(() => {})
    cargar()
    const intervalo = setInterval(cargar, INTERVALO_MS)
    window.addEventListener(NOTIFICACIONES_CAMBIO, cargar)
    return () => {
      cancelado = true
      clearInterval(intervalo)
      window.removeEventListener(NOTIFICACIONES_CAMBIO, cargar)
    }
  }, [location.pathname])

  return noLeidas
}

export default useNotificacionesNoLeidas
