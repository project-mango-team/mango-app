import { useState } from 'react'
import { ruleService } from '../../services/ruleService'
import { categoryService } from '../../services/transactionService'
import ModalProgreso from '../ModalProgreso'
import useProgreso from '../../hooks/useProgreso'

const NUEVA = '__nueva__'

// Filas que una regla "detalle contiene <texto>" (del mismo tipo y origen que la fila) categorizaría:
// las que siguen en "Otros" o que solo tienen una asociación anterior (PUL-06: la regla nueva del usuario gana).
// Misma lógica que el backend (mayúsculas, sin regex).
export const filasParecidas = (transacciones, fila, texto) => {
  const buscado = texto.trim().toUpperCase()
  if (!buscado) return []
  return transacciones.filter(t =>
    (t.categoria === 'Otros' || (t.regla_motivo?.creada_por === 'keywords' && t.categoria === t.regla_motivo.categoria)) &&
    t.tipo === fila.tipo &&
    (t.origen || null) === (fila.origen || null) &&
    String(t.detalle || '').toUpperCase().includes(buscado))
}

// Revisión de un import: asocia ahí mismo el detalle de una fila "Otros" a una categoría (existente o nueva).
// Crea la regla (REV-02) y avisa al editor para que la aplique a las demás filas parecidas del import.
// El resultado sale en un modal (con "Deshacer", que borra la regla y devuelve las filas a "Otros").
const AsociarDetalleFila = ({ fila, transacciones, categorias, onAplicar, onCategoriasChange }) => {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [nueva, setNueva] = useState('')
  const [hecho, setHecho] = useState(null) // { reglaId, ids } de la última asociación, para poder deshacerla
  const progreso = useProgreso()

  const opciones = categorias.filter(c => c !== 'Otros')
  const esNueva = categoria === NUEVA
  const categoriaFinal = esNueva ? nueva.trim() : categoria
  const coinciden = filasParecidas(transacciones, fila, texto)

  const abrir = async () => {
    setAbierto(true)
    setCategoria(opciones[0] || NUEVA)
    setNueva('')
    setTexto(fila.detalle)
    try {
      const res = await ruleService.patron(fila.detalle)
      if (res.data.texto) setTexto(res.data.texto)
    } catch { /* queda el detalle completo */ }
  }

  const crear = () => progreso.ejecutar('Asociar a una categoría', async () => {
    let nombre = categoriaFinal
    if (esNueva) {
      // Respeta las categorías del usuario: si ya existe (sin importar mayúsculas) se usa esa
      const existente = categorias.find(c => c.toLowerCase() === nombre.toLowerCase())
      if (existente) nombre = existente
      else onCategoriasChange?.((await categoryService.create(nombre)).data)
    }
    const res = await ruleService.create({
      condiciones: {
        detalle: { modo: 'contiene', valores: [texto.trim()] },
        origen: fila.origen || null,
        tipo: fila.tipo || null
      },
      accion: { tipo: 'categoria', categoria: nombre },
      creada_por: 'aprendida'
    })
    // La fila de origen siempre pasa a la categoría, aunque la palabra clave editada no esté en su detalle
    const ids = [...new Set([fila._id, ...coinciden.map(t => t._id)])]
    // Categorías previas, para que Deshacer devuelva cada fila a lo que tenía (PUL-06: no siempre era “Otros”)
    const previas = {}
    ;[fila, ...coinciden].forEach(t => { previas[t._id] ??= t.categoria })
    onAplicar(ids, nombre)
    setHecho({ reglaId: res.data?._id, ids, previas })
    setAbierto(false)
    return `Regla creada: “${texto.trim()}” → ${nombre}. Se aplicó a ${ids.length} ${ids.length === 1 ? 'fila' : 'filas'} de este import y vale para las próximas importaciones.`
  }, { cargando: 'Creando la regla y categorizando las filas…', errorPorDefecto: 'No se pudo crear la regla' })

  const deshacer = () => progreso.ejecutar('Deshacer asociación', async () => {
    if (hecho.reglaId) await ruleService.remove(hecho.reglaId)
    const porCategoria = {}
    hecho.ids.forEach(id => { (porCategoria[hecho.previas?.[id] || 'Otros'] ||= []).push(id) })
    Object.entries(porCategoria).forEach(([cat, ids]) => onAplicar(ids, cat))
    setHecho(null)
    return 'Se borró la regla y las filas volvieron a su categoría anterior.'
  }, { cargando: 'Deshaciendo…', errorPorDefecto: 'No se pudo deshacer' })

  const modal = (
    <ModalProgreso
      progreso={progreso}
      acciones={hecho && progreso.estado === 'ok' ? (
        <button onClick={deshacer} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors">Deshacer</button>
      ) : null}
    />
  )

  // PUL-06: también las filas ya categorizadas por una asociación anterior; no las que tienen un destino propio
  const puedeAsociar = fila.detalle?.trim() && !fila.duplicado && !fila.ignorada && fila.incluir && !fila.categoria_fija && !fila.inversion?.activo_id
  if (!puedeAsociar) return modal

  if (!abierto) {
    return (
      <>
        <button type="button" onClick={abrir} className="mt-1 block text-xs text-primary hover:underline">
          {fila.categoria === 'Otros' ? 'Asociar a una categoría…' : 'Asociar a otra categoría…'}
        </button>
        {modal}
      </>
    )
  }

  return (
    <>
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
            <option value={NUEVA}>＋ Nueva categoría…</option>
          </select>
          {esNueva && (
            <input
              type="text"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva categoría"
              maxLength={40}
              className="input-field min-w-[140px] py-1 text-xs"
              aria-label="Nueva categoría"
              autoFocus
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={crear}
            disabled={!texto.trim() || !categoriaFinal}
            className="rounded bg-primary px-2 py-1 text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {`Crear regla y aplicar${coinciden.length > 1 ? ` a ${coinciden.length} filas` : ''}`}
          </button>
          <button type="button" onClick={() => setAbierto(false)} className="text-gray-400 hover:text-white">Cancelar</button>
          <span className="text-gray-500">Vale también para las próximas importaciones.</span>
        </div>
      </div>
      {modal}
    </>
  )
}

export default AsociarDetalleFila
