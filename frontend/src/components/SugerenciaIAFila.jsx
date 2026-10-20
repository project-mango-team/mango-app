import { useState } from 'react'
import { mensajeError } from '../utils/format'

// REV-06: la sugerencia de la IA para una fila "Otros", con "Usar" y "Usar y crear regla"
const SugerenciaIAFila = ({ sugerencia, fila, onUsar, crearRegla }) => {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  if (!sugerencia || fila.categoria !== 'Otros') return null

  const usarConRegla = async () => {
    try {
      setOcupado(true)
      setError(null)
      await crearRegla(fila, sugerencia.categoria)
      onUsar(sugerencia.categoria)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear la regla'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-violet-300">
      <span>IA: {sugerencia.categoria} · {Math.round(sugerencia.confianza * 100)}%</span>
      <button type="button" onClick={() => onUsar(sugerencia.categoria)} className="underline hover:text-white">Usar</button>
      <button type="button" onClick={usarConRegla} disabled={ocupado} className="underline hover:text-white disabled:opacity-50">
        Usar y crear regla
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  )
}

export default SugerenciaIAFila
