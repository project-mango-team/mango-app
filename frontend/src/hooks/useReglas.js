import { useCallback, useEffect, useState } from 'react'
import { ruleService } from '../services/ruleService'
import { mensajeError } from '../utils/format'

// Reglas de categorización del usuario, en orden de evaluación. Las acciones tiran el error
// del servidor (para mostrarlo en el formulario) y recargan la lista.
const useReglas = (activo = true) => {
  const [reglas, setReglas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setError(null)
      const res = await ruleService.getAll()
      setReglas(res.data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar las reglas'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activo) recargar()
  }, [activo, recargar])

  const conRecarga = (fn) => async (...args) => {
    const res = await fn(...args)
    await recargar()
    return res
  }

  const mover = async (id, delta) => {
    const ids = reglas.map(r => r._id)
    const i = ids.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    const res = await ruleService.reorder(ids)
    setReglas(res.data)
  }

  return {
    reglas,
    loading,
    error,
    recargar,
    crear: conRecarga(ruleService.create),
    actualizar: conRecarga(ruleService.update),
    eliminar: conRecarga(ruleService.remove),
    mover
  }
}

export default useReglas
