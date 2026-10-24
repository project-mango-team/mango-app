import { useEffect, useState } from 'react'
import { iaService } from '../../services/iaService'
import { mensajeError } from '../../utils/format'

// REV-06: opt-in para mandar los movimientos sin categoría a Claude y recibir sugerencias
const SugerenciasIA = () => {
  const [estado, setEstado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    iaService.estado()
      .then(res => setEstado(res.data))
      .catch(err => setError(mensajeError(err, 'No se pudo cargar la configuración')))
  }, [])

  const cambiar = async (activo) => {
    try {
      setGuardando(true)
      setError(null)
      setEstado((await iaService.cambiar(activo)).data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white">Sugerencias con IA</h2>
        <p className="text-sm text-gray-400 mt-1">
          Al revisar una importación, Mango puede pedirle a Claude (Anthropic) una categoría para los movimientos
          que ninguna regla cubrió. Se envían el detalle, el monto, el tipo y el origen de esos movimientos, y como
          ejemplos los comercios de tu historial con su categoría. No se envía tu nombre ni tu email.
        </p>
      </div>

      {estado && !estado.configurado && (
        <p className="text-sm text-yellow-400">El servidor no tiene configurada la clave de la API de Anthropic (ANTHROPIC_API_KEY).</p>
      )}

      {estado && (
        <label className="flex items-center gap-3 text-sm text-gray-200">
          <input
            type="checkbox"
            checked={estado.activo}
            disabled={guardando}
            onChange={(e) => cambiar(e.target.checked)}
          />
          Acepto mandar esos datos a Anthropic para recibir sugerencias
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

export default SugerenciasIA
