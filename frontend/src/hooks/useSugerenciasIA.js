import { useEffect, useState } from 'react'
import { iaService } from '../services/iaService'
import { ruleService } from '../services/ruleService'
import { mensajeError } from '../utils/format'

// REV-06: sugerencias de categoría con IA para las filas "Otros" del editor de importación.
// `disponible` solo si el usuario lo activó en Configuración y el servidor tiene la clave.
const useSugerenciasIA = (activo = true) => {
  const [disponible, setDisponible] = useState(false)
  const [sugerencias, setSugerencias] = useState(new Map())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!activo) return
    iaService.estado()
      .then(res => setDisponible(res.data.activo && res.data.configurado))
      .catch(() => setDisponible(false))
  }, [activo])

  // filas: [{ _id, detalle, importe, tipo, origen }] (el _id es el de la fila en el editor)
  const pedir = async (filas) => {
    try {
      setCargando(true)
      setError(null)
      const res = await iaService.sugerir(filas.map(t => ({
        id: t._id, detalle: t.detalle, importe: Number(t.importe) || 0, tipo: t.tipo, origen: t.origen
      })))
      setSugerencias(prev => {
        const siguiente = new Map(prev)
        for (const s of res.data) siguiente.set(s.id, s)
        return siguiente
      })
      if (res.data.length === 0) setError('La IA no encontró una categoría probable para estos movimientos.')
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron pedir sugerencias'))
    } finally {
      setCargando(false)
    }
  }

  // "Usar y crear regla" (REV-03): la regla cubre las próximas importaciones del mismo comercio
  const crearRegla = async (fila, categoria) => {
    const { data } = await ruleService.patron(fila.detalle)
    await ruleService.create({
      condiciones: {
        detalle: { modo: 'contiene', valores: [data.texto || fila.detalle] },
        origen: fila.origen || null,
        tipo: fila.tipo || null
      },
      accion: { tipo: 'categoria', categoria },
      creada_por: 'aprendida'
    })
  }

  return { disponible, sugerencias, cargando, error, pedir, crearRegla }
}

export default useSugerenciasIA
