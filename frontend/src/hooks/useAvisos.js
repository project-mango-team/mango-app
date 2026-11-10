import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '../services/notificationService'
import { avisarCambio } from '../utils/avisos'
import { mensajeError } from '../utils/format'

// Lista de avisos (notificaciones) con marcar leído y abrir el link. La usan la campana y la página "ver todos".
// `activo` permite cargar solo cuando el panel está abierto.
const useAvisos = ({ activo = true } = {}) => {
  const [avisos, setAvisos] = useState(null)
  const [noLeidas, setNoLeidas] = useState(0)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const cargar = useCallback(async () => {
    try {
      const res = await notificationService.listar()
      setAvisos(res.data)
      setNoLeidas(res.noLeidas)
      setError(null)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los avisos'))
    }
  }, [])

  useEffect(() => {
    if (activo) cargar()
  }, [activo, cargar])

  const marcar = async (aviso) => {
    if (aviso.leida) return
    setAvisos(prev => prev.map(a => (a._id === aviso._id ? { ...a, leida: true } : a)))
    setNoLeidas(n => Math.max(0, n - 1))
    try {
      await notificationService.marcarLeida(aviso._id)
    } catch {
      // si falla, el próximo refresco lo muestra de nuevo sin leer
    }
    avisarCambio()
  }

  // Marca leído y lleva a donde corresponde el aviso. Devuelve true si navegó.
  const abrir = async (aviso) => {
    await marcar(aviso)
    if (aviso.link) {
      navigate(aviso.link)
      return true
    }
    return false
  }

  const marcarTodas = async () => {
    setError(null)
    try {
      await notificationService.marcarTodas()
      avisarCambio()
      cargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron marcar los avisos'))
    }
  }

  return { avisos, noLeidas, error, abrir, marcarTodas }
}

export default useAvisos
