import { useCallback, useEffect, useState } from 'react'
import { jobService } from '../../services/jobService'
import { mensajeError } from '../../utils/format'

const ESTADOS = {
  ok: { texto: 'OK', clase: 'bg-green-900/40 text-green-300' },
  error: { texto: 'Error', clase: 'bg-red-900/40 text-red-300' },
  corriendo: { texto: 'Corriendo', clase: 'bg-yellow-900/40 text-yellow-300' }
}

const formatFechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const formatDuracion = (ms) => (ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

const formatResultado = (r) =>
  r ? Object.entries(r).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : ''

const EstadoBadge = ({ estado }) => {
  const e = ESTADOS[estado] || { texto: estado, clase: 'bg-gray-700 text-gray-300' }
  return <span className={`text-xs px-2 py-0.5 rounded ${e.clase}`}>{e.texto}</span>
}

const Corrida = ({ c }) => (
  <div className="text-xs text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
    <EstadoBadge estado={c.estado} />
    <span>{formatFechaHora(c.iniciado_at)}</span>
    {c.manual && <span className="text-gray-500">manual</span>}
    {c.intentos > 1 && <span className="text-gray-500">intento {c.intentos}</span>}
    {c.duracion_ms != null && <span className="text-gray-500">{formatDuracion(c.duracion_ms)}</span>}
    {c.estado === 'error' && c.error && <span className="text-red-400 break-all">{c.error}</span>}
    {c.estado === 'ok' && c.resultado && <span className="text-gray-300 break-all">{formatResultado(c.resultado)}</span>}
  </div>
)

const Job = ({ job, onCorrer, corriendo }) => {
  const [abierto, setAbierto] = useState(false)
  const [ultima, ...anteriores] = job.corridas
  return (
    <li className="py-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm">{job.nombre} <span className="text-xs text-gray-500 ml-1">todos los días a las {job.hora}</span></p>
          {job.descripcion && <p className="text-xs text-gray-500">{job.descripcion}</p>}
        </div>
        <button
          onClick={() => onCorrer(job.nombre)}
          disabled={corriendo}
          className="btn-secondary !py-1.5 text-sm whitespace-nowrap disabled:opacity-50"
        >
          {corriendo ? 'Corriendo…' : 'Correr ahora'}
        </button>
      </div>
      {ultima ? <Corrida c={ultima} /> : <p className="text-xs text-gray-500">Todavía no corrió.</p>}
      {anteriores.length > 0 && (
        <>
          <button onClick={() => setAbierto(!abierto)} className="text-xs text-gray-400 hover:text-white">
            {abierto ? 'Ocultar historial' : `Ver ${anteriores.length} corrida${anteriores.length === 1 ? '' : 's'} anterior${anteriores.length === 1 ? '' : 'es'}`}
          </button>
          {abierto && <div className="space-y-1 pl-3 border-l border-gray-700">{anteriores.map(c => <Corrida key={c._id} c={c} />)}</div>}
        </>
      )}
    </li>
  )
}

// Jobs diarios del backend y sus últimas corridas. Solo se muestra a administradores.
const TareasProgramadas = () => {
  const [jobs, setJobs] = useState(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [corriendo, setCorriendo] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setJobs((await jobService.listar()).data)
    } catch (err) {
      if (err.response?.status === 403) setSinPermiso(true)
      else setError(mensajeError(err, 'No se pudieron cargar las tareas'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const correr = async (nombre) => {
    setError(null)
    setCorriendo(nombre)
    try {
      await jobService.correr(nombre)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo correr la tarea'))
    } finally {
      setCorriendo(null)
      cargar()
    }
  }

  if (sinPermiso) return null

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Tareas programadas</h2>
        <p className="text-sm text-gray-400 mt-1">
          Procesos que Mango corre solo una vez por día (hora de Argentina). Si fallan, se reintentan hasta 3 veces.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {jobs === null ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-gray-500">No hay tareas registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {jobs.map(job => <Job key={job.nombre} job={job} onCorrer={correr} corriendo={corriendo === job.nombre} />)}
        </ul>
      )}
    </div>
  )
}

export default TareasProgramadas
