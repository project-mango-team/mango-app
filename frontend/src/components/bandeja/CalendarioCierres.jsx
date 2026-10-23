import { useState } from 'react'
import useCalendario from '../../hooks/useCalendario'
import { formatFecha } from '../../utils/format'

const ESTADOS = {
  recibido: { texto: 'Recibido', clase: 'bg-green-900/40 text-green-300' },
  avisado: { texto: 'Avisado, falta el archivo', clase: 'bg-yellow-900/40 text-yellow-300' },
  esperando: { texto: 'Esperando', clase: 'bg-gray-700 text-gray-300' },
  faltante: { texto: 'Falta', clase: 'bg-red-900/40 text-red-300' }
}

const LLEGADAS = {
  adjunto: 'Llega por mail con el archivo',
  aviso: 'Llega un aviso, lo bajo yo',
  manual: 'Lo descargo yo'
}

const FormularioFuente = ({ fuente, onGuardar, onQuitar, onCancelar }) => {
  const [dia, setDia] = useState(fuente.dia_cierre ?? 15)
  const [llegada, setLlegada] = useState(fuente.llegada ?? 'adjunto')
  const [activa, setActiva] = useState(fuente.configurada ? fuente.activa : true)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    const ok = await onGuardar(fuente.fuente, { dia_cierre: Number(dia), llegada, activa })
    setGuardando(false)
    if (ok) onCancelar()
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs text-gray-400">
        Día de cierre
        <input type="number" min="1" max="31" value={dia} onChange={e => setDia(e.target.value)} className="input-field mt-1 w-24" />
      </label>
      <label className="text-xs text-gray-400">
        Cómo llega
        <select value={llegada} onChange={e => setLlegada(e.target.value)} className="input-field mt-1">
          {Object.entries(LLEGADAS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
        <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
        Controlar
      </label>
      <div className="flex gap-2 pb-1">
        <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">Guardar</button>
        <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
        {fuente.configurada && (
          <button onClick={async () => { if (await onQuitar(fuente.fuente)) onCancelar() }} className="text-sm text-red-400 hover:text-red-300">
            Quitar
          </button>
        )}
      </div>
    </div>
  )
}

// Checklist del mes: por fuente, si el último resumen esperado llegó. Se configura el día de cierre de cada una.
const CalendarioCierres = ({ version }) => {
  const { fuentes, loading, error, guardar, quitar, autoImportar } = useCalendario(version)
  const [editando, setEditando] = useState(null)
  const [abierto, setAbierto] = useState(false)

  if (loading) return null

  const controladas = fuentes.filter(f => f.configurada && f.activa)
  const faltan = controladas.filter(f => f.estado === 'faltante' || f.estado === 'avisado').length
  // Sin nada configurado se muestra abierto, para que se vea que existe
  const visible = abierto || controladas.length === 0

  return (
    <div className="card">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between text-left">
        <div>
          <h2 className="text-lg font-semibold text-white">Calendario de cierres</h2>
          <p className="text-sm text-gray-400">
            {error && fuentes.length === 0 ? 'No se pudo cargar el calendario'
              : controladas.length === 0
              ? 'Configurá el día de cierre de cada resumen y te avisamos si alguno no llega'
              : faltan === 0 ? 'Llegaron todos los resúmenes esperados' : (faltan === 1 ? '1 resumen sin archivo' : `${faltan} resúmenes sin archivo`)}
          </p>
        </div>
        {controladas.length > 0 && <span className="text-gray-400 text-sm">{visible ? 'Ocultar' : 'Ver'}</span>}
      </button>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {visible && (
        <ul className="mt-4 divide-y divide-gray-700">
          {fuentes.map(f => {
            const estado = f.configurada && f.activa ? ESTADOS[f.estado] : null
            return (
              <li key={f.fuente} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-white">{f.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {!f.configurada ? 'Sin configurar'
                        : !f.activa ? 'Pausada'
                          : `Cierra el ${f.dia_cierre} · último cierre ${formatFecha(f.cierre)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {estado && <span className={`px-2 py-0.5 rounded text-xs ${estado.clase}`}>{estado.texto}</span>}
                    <button onClick={() => setEditando(editando === f.fuente ? null : f.fuente)} className="text-sm text-gray-300 hover:text-white">
                      {f.configurada ? 'Editar' : 'Configurar'}
                    </button>
                  </div>
                </div>
                {(
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-400" title="Solo aplica a lo que llega por mail: si pasa todos los controles se importa solo y podés deshacerlo desde la lista">
                    <input type="checkbox" checked={f.auto_importar} onChange={e => autoImportar(f.fuente, e.target.checked)} />
                    Importar solo si todo está en orden (sin duplicados, todo categorizado y el total cierra, si el resumen lo trae)
                  </label>
                )}
                {editando === f.fuente && (
                  <FormularioFuente fuente={f} onGuardar={guardar} onQuitar={quitar} onCancelar={() => setEditando(null)} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default CalendarioCierres
