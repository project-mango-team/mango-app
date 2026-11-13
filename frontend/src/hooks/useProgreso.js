import { useCallback, useMemo, useState } from 'react'
import { mensajeError } from '../utils/format'

// Estado para <ModalProgreso>. `ejecutar(titulo, accion, opciones)` muestra "cargando" mientras corre la acción y
// después el resultado. La acción puede devolver un texto (o { mensaje }) para el modal; si devuelve `null` el
// modal se cierra sin mostrar nada. Devuelve lo que devolvió la acción, o `undefined` si falló.
//   opciones: { cargando: 'Texto mientras corre', errorPorDefecto: 'Texto si falla' }
const useProgreso = () => {
  const [estado, setEstado] = useState({ estado: 'cerrado', titulo: '', mensaje: '' })

  const cerrar = useCallback(() => setEstado({ estado: 'cerrado', titulo: '', mensaje: '' }), [])

  const ejecutar = useCallback(async (titulo, accion, { cargando = 'Un momento…', errorPorDefecto = 'No se pudo completar' } = {}) => {
    setEstado({ estado: 'cargando', titulo, mensaje: cargando })
    try {
      const res = await accion()
      const mensaje = typeof res === 'string' ? res : res?.mensaje
      if (res === null) cerrar()
      else setEstado({ estado: 'ok', titulo, mensaje: mensaje || 'Listo' })
      return res
    } catch (err) {
      setEstado({ estado: 'error', titulo, mensaje: mensajeError(err, errorPorDefecto) })
      return undefined
    }
  }, [cerrar])

  // Abre el modal directo en un resultado (por ejemplo para mostrar el "Deshacer" ya hecho)
  const mostrar = useCallback((tipo, titulo, mensaje) => setEstado({ estado: tipo, titulo, mensaje }), [])

  return useMemo(() => ({ ...estado, ejecutar, cerrar, mostrar }), [estado, ejecutar, cerrar, mostrar])
}

export default useProgreso
