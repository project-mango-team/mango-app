import { useEffect, useState } from 'react'
import { investmentService } from '../../services/investmentService'
import { formatFecha, mensajeError } from '../../utils/format'
import { formatPrecio } from './valuacion'

const CATEGORIAS = {
  mercadoDinero: 'Money market',
  rentaFija: 'Renta fija',
  rentaVariable: 'Renta variable',
  rentaMixta: 'Renta mixta',
  otros: 'Otros'
}

/**
 * Buscador de FCI en el reporte diario de la CAFCI. Al elegir uno guarda nombre (fondo y clase) y categoría.
 * `value`: { fci_nombre, fci_categoria }
 */
const FciPicker = ({ value, onChange }) => {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = consulta.trim()
    if (q.length < 2) {
      setResultados(null)
      return
    }
    let vigente = true
    const timer = setTimeout(async () => {
      setBuscando(true)
      setError(null)
      try {
        const { data } = await investmentService.searchFci(q)
        if (vigente) setResultados(data)
      } catch (err) {
        if (vigente) setError(mensajeError(err, 'No se pudo buscar en la CAFCI'))
      } finally {
        if (vigente) setBuscando(false)
      }
    }, 350)
    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [consulta])

  const elegir = (fondo) => {
    onChange({ fci_nombre: fondo.nombre, fci_categoria: fondo.categoria })
    setConsulta('')
    setResultados(null)
  }

  return (
    <div className="space-y-2">
      <span className="text-sm text-gray-400">Fondo y clase</span>
      {value.fci_nombre ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600">
          <span className="text-white text-sm">
            {value.fci_nombre}
            <span className="text-gray-500"> · {CATEGORIAS[value.fci_categoria] || value.fci_categoria}</span>
          </span>
          <button type="button" onClick={() => onChange({ fci_nombre: '', fci_categoria: '' })} className="text-xs text-gray-400 hover:text-white">
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={consulta}
            onChange={e => setConsulta(e.target.value)}
            placeholder="Buscá el fondo, ej: fima premium"
            className="input-field w-full"
          />
          {buscando && <p className="text-xs text-gray-500">Buscando...</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {resultados && !buscando && (
            resultados.length === 0 ? (
              <p className="text-xs text-gray-500">No hay fondos con ese nombre.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-700/60">
                {resultados.map(f => (
                  <li key={`${f.categoria}:${f.nombre}`}>
                    <button
                      type="button"
                      onClick={() => elegir(f)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700/60 flex justify-between gap-3"
                    >
                      <span className="text-white">{f.nombre}</span>
                      <span className="text-gray-500 whitespace-nowrap tabular-nums">
                        {CATEGORIAS[f.categoria]} · {formatPrecio(f.precio)} al {formatFecha(f.fecha)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
          <p className="text-xs text-gray-500">Elegí la clase que tenés: cada clase tiene su propio valor de cuotaparte.</p>
        </>
      )}
    </div>
  )
}

export default FciPicker
