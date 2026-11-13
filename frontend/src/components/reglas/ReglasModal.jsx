import { useState } from 'react'
import Modal from '../Modal'
import ReglaForm from './ReglaForm'
import useReglas from '../../hooks/useReglas'
import useActivosInversion from '../../hooks/useActivosInversion'
import { mensajeError } from '../../utils/format'
import useConfirmar from '../../hooks/useConfirmar'
import useProgreso from '../../hooks/useProgreso'
import ModalProgreso from '../ModalProgreso'
import { describirCondiciones, describirAccion } from './reglaTexto'

// PUL-06: las del usuario van antes que las asociaciones anteriores y no se pueden mezclar
const esAnterior = (r) => r?.creada_por === 'keywords'

const BotonIcono = ({ onClick, title, disabled, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    disabled={disabled}
    className={`p-1 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 ${className}`}
  >
    {children}
  </button>
)

// Reglas de categorización: se aplican al importar, en orden, y gana la primera que coincide
const ReglasModal = ({ isOpen, onClose, categorias }) => {
  const { reglas, loading, error, crear, actualizar, eliminar, mover } = useReglas(isOpen)
  const [editando, setEditando] = useState(null) // 'nueva' | id
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState(null)
  const activos = useActivosInversion(isOpen)
  const { confirmar, dialogo } = useConfirmar()
  const progreso = useProgreso()

  const eliminarRegla = async (regla) => {
    const ok = await confirmar({
      title: 'Eliminar regla',
      message: '¿Eliminar esta regla? Las transacciones ya cargadas no cambian.',
      confirmText: 'Eliminar',
      type: 'danger'
    })
    if (ok) await progreso.ejecutar('Eliminar regla', async () => { await eliminar(regla._id); return 'La regla se eliminó.' }, { cargando: 'Eliminando la regla…', errorPorDefecto: 'No se pudo eliminar la regla' })
  }

  const accion = async (fn) => {
    try {
      setAviso(null)
      await fn()
    } catch (err) {
      setAviso(mensajeError(err, 'No se pudo guardar el cambio'))
    }
  }

  const q = busqueda.trim().toLowerCase()
  const visibles = q
    ? reglas.filter(r => `${describirCondiciones(r)} ${describirAccion(r, activos)}`.toLowerCase().includes(q))
    : reglas

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Reglas de categorización"
      subtitle="Se aplican al importar, de arriba hacia abajo: gana la primera que coincide. Tus reglas siempre van antes que las asociaciones anteriores, y una nueva que tape a otra más específica queda después de ella."
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por texto o categoría"
            className="input-field flex-1"
          />
          {editando !== 'nueva' && (
            <button onClick={() => setEditando('nueva')} className="btn-primary whitespace-nowrap">
              + Nueva regla
            </button>
          )}
        </div>

        {editando === 'nueva' && (
          <ReglaForm
            categorias={categorias}
            activos={activos}
            onGuardar={async (datos) => { await crear(datos); setEditando(null) }}
            onCancelar={() => setEditando(null)}
          />
        )}

        {(error || aviso) && <p className="text-sm text-red-400">{error || aviso}</p>}
        {loading && <p className="text-sm text-gray-400">Cargando reglas…</p>}
        {!loading && visibles.length === 0 && (
          <p className="text-sm text-gray-500">{q ? 'Ninguna regla coincide con la búsqueda.' : 'Todavía no hay reglas.'}</p>
        )}

        <ol className="space-y-2">
          {visibles.map((r) => {
            const indice = reglas.indexOf(r)
            if (editando === r._id) {
              return (
                <li key={r._id}>
                  <ReglaForm
                    regla={r}
                    categorias={categorias}
                    activos={activos}
                    onGuardar={async (datos) => { await actualizar(r._id, datos); setEditando(null) }}
                    onCancelar={() => setEditando(null)}
                  />
                </li>
              )
            }
            return (
              <li
                key={r._id}
                className={`flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-900/30 px-3 py-2 ${r.activa ? '' : 'opacity-50'}`}
              >
                <span className="text-xs text-gray-500 w-6 pt-0.5 text-right">{indice + 1}</span>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-gray-200 break-words">Si {describirCondiciones(r)}</p>
                  <p className="text-gray-400">
                    → <span className={r.accion.tipo === 'ignorar' ? 'text-yellow-400' : 'text-primary'}>{describirAccion(r, activos)}</span>
                    {r.creada_por === 'keywords' && <span className="ml-2 text-xs text-gray-500">(asociaciones anteriores)</span>}
                    {!r.activa && <span className="ml-2 text-xs text-gray-500">(pausada)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <BotonIcono title="Subir" disabled={indice === 0 || !!q || esAnterior(reglas[indice - 1]) !== esAnterior(r)} onClick={() => accion(() => mover(r._id, -1))}>↑</BotonIcono>
                  <BotonIcono title="Bajar" disabled={indice === reglas.length - 1 || !!q || esAnterior(reglas[indice + 1]) !== esAnterior(r)} onClick={() => accion(() => mover(r._id, 1))}>↓</BotonIcono>
                  <BotonIcono
                    title={r.activa ? 'Pausar' : 'Activar'}
                    onClick={() => accion(() => actualizar(r._id, { ...r, activa: !r.activa }))}
                    className="text-xs px-2"
                  >
                    {r.activa ? 'Pausar' : 'Activar'}
                  </BotonIcono>
                  <BotonIcono title="Editar" onClick={() => setEditando(r._id)} className="text-xs px-2">Editar</BotonIcono>
                  <BotonIcono
                    title="Eliminar"
                    onClick={() => eliminarRegla(r)}
                    className="text-xs px-2 hover:text-red-400"
                  >
                    Eliminar
                  </BotonIcono>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Modal>
    {dialogo}
    <ModalProgreso progreso={progreso} />
    </>
  )
}

export default ReglasModal
