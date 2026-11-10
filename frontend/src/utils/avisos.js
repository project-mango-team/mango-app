import { NOTIFICACIONES_CAMBIO } from '../hooks/useNotificacionesNoLeidas'

export const PUNTO_NIVEL = {
  info: 'bg-blue-400',
  exito: 'bg-green-400',
  alerta: 'bg-yellow-400',
  error: 'bg-red-400'
}

// "hace 5 min", "hace 3 h" o la fecha corta
export const formatCuando = (iso) => {
  const fecha = new Date(iso)
  const minutos = Math.round((Date.now() - fecha) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

// Le avisa a la navbar que cambió el contador de no leídas
export const avisarCambio = () => window.dispatchEvent(new Event(NOTIFICACIONES_CAMBIO))
