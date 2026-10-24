import { useCallback, useEffect, useState } from 'react'
import { calendarioService } from '../services/calendarioService'
import { mensajeError } from '../utils/format'

// Calendario de cierres: estado del último cierre de cada fuente y su configuración.
// `version` cambia cuando se modifica la bandeja, así el checklist se actualiza solo.
const useCalendario = (version) => {
  const [fuentes, setFuentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      const res = await calendarioService.obtener()
      setFuentes(res.data.fuentes)
      setError(null)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el calendario'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar, version])

  const correr = async (accion) => {
    try {
      const res = await accion()
      setFuentes(res.data.fuentes)
      setError(null)
      return true
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar'))
      return false
    }
  }

  return {
    fuentes,
    loading,
    error,
    guardar: (fuente, config) => correr(() => calendarioService.guardarFuente(fuente, config)),
    autoImportar: (fuente, activar) => correr(() => calendarioService.autoImportar(fuente, activar)),
    quitar: (fuente) => correr(() => calendarioService.quitarFuente(fuente))
  }
}

export default useCalendario
