import { useState } from 'react'
import { uploadService } from '../services/transactionService'

/**
 * Detecta banco, tipo de resumen y tarjetas de un archivo al elegirlo.
 * `alDetectar(deteccion)` se llama solo si el formato es soportado, para completar el formulario.
 */
const useDeteccionResumen = (alDetectar) => {
  const [deteccion, setDeteccion] = useState(null)
  const [detectando, setDetectando] = useState(false)

  const detectar = async (file) => {
    setDeteccion(null)
    if (!file) return
    setDetectando(true)
    try {
      const { data } = await uploadService.detect(file)
      setDeteccion(data)
      if (data.soportado) alDetectar(data)
    } catch {
      // Si la detección falla, se sigue con la selección manual de siempre
      setDeteccion(null)
    } finally {
      setDetectando(false)
    }
  }

  return { deteccion, detectando, detectar, limpiar: () => setDeteccion(null) }
}

export default useDeteccionResumen
