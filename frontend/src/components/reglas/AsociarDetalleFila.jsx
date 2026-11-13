import { useState } from 'react'
import { ruleService } from '../../services/ruleService'
import { mensajeError } from '../../utils/format'

// Filas que una regla "detalle contiene <texto>" (del mismo tipo y origen que la fila) categorizaría:
// las que siguen en "Otros" o que solo tienen una asociación anterior (PUL-06: la regla nueva del usuario gana).
// Misma lógica que el backend (mayúsculas, sin regex).
export const filasParecidas = (transacciones, fila, texto) => {
  const buscado = texto.trim().toUpperCase()
  if (!buscado) return []
  return transacciones.filter(t =>
    (t.categoria === 'Otros' || t.regla_motivo?.creada_por === 'keywords') &&
    t.tipo === fila.tipo &&
    (t.origen || null) === (fila.origen || null) &&
    String(t.detalle || '').toUpperCase().includes(buscado))
}

// Revisión de un import: asocia ahí mismo el detalle de una fila "Otros" a una categoría.
// Crea la regla (REV-02) y avisa al editor para que la aplique a las demás filas parecidas del import.
const AsociarDetalleFila = ({ fila, transacciones, categorias, onAplicar }) => {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [hecho, setHecho] = useState(null)

  if (!fila.detalle?.trim()) return null
  // Las filas excluidas (duplicadas, ignoradas por una regla) y las que ya tienen un destino propio (inversión,
  // categoría fijada por el resumen) no se categorizan acá. PUL-06: una fila con categoría también se puede cambiar.
  if (!hecho && (fila.duplicado || fila.ignorada || !fila.incluir || fila.categoria_fija || fila.inversion?.activo_id)) return null

  if (hecho) {
    return (
      <div className="mt-1 text-xs text-green-400">
        Regla creada: “{hecho.texto}” → {hecho.categoria}
        {hecho.cantidad > 1 ? ` (aplicada a ${hecho.cantidad} filas de este import)` : ''}. La podés editar en Reglas de categorización.
      </div>
    )
  }

  const opciones = categorias.filter(c => c !== 'Otros')
  const coinciden = filasParecidas(transacciones, fila, texto)

  const abrir = async () => {
    setAbierto(true)
    setCategoria(opciones[0] || '')
    setTexto(fila.detalle)
    try {
      const res = await ruleService.patron(fila.detalle)
      if (res.data.texto) setTexto(res.data.texto)
    } catch { /* queda el detalle completo */ }
  }

  const crear = async () => {
    try {
      setOcupado(true)
      setError(null)
      await ruleService.create({
        condiciones: {
          detalle: { modo: 'contiene', valores: [texto.trim()] },
          origen: fila.origen || null,
          tipo: fila.tipo || null
        },
        accion: { tipo: 'categoria', categoria },
        creada_por: 'aprendida'
      })
      // La fila de origen siempre pasa a la categoría, aunque la palabra clave editada no esté en su detalle
      const ids = [...new Set([fila._id, ...coinciden.map(t => t._id)])]
      onAplicar(ids, categoria)
      setHecho({ texto: texto.trim(), categoria, cantidad: ids.length })
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear la regla'))
    } finally {
      setOcupado(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={abrir} className="mt-1 block text-xs text-primary hover:underline">
        {fila.categoria === 'Otros' ? 'Asociar a una categoría…' : 'Asociar a otra categoría…'}
      </button>
    )
  }

  return (
    <div className="mt-1 space-y-2 rounded border border-gray-700 bg-gray-900/40 p-2 text-xs text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        <span>Si el detalle contiene</span>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="input-field min-w-[140px] flex-1 py-1 text-xs"
          aria-label="Palabra clave"
        />
        <span>→</span>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input-field py-1 text-xs" aria-label="Categoría">
          {opciones.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={crear}
          disabled={ocupado || !texto.trim() || !categoria}
          className="rounded bg-primary px-2 py-1 text-white hover:bg-primary/80 disabled:opacity-50"
        >
          {ocupado ? 'Creando…' : `Crear regla y aplicar${coinciden.length > 1 ? ` a ${coinciden.length} filas` : ''}`}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-gray-400 hover:text-white">Cancelar</button>
        <span className="text-gray-500">Vale también para las próximas importaciones.</span>
      </div>
      {error && <p className="text-red-400">{error}</p>}
    </div>
  )
}

export default AsociarDetalleFila
