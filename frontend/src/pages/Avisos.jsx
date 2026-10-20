import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '../services/notificationService'
import { NOTIFICACIONES_CAMBIO } from '../hooks/useNotificacionesNoLeidas'
import { mensajeError } from '../utils/format'

const PUNTO_NIVEL = {
  info: 'bg-blue-400',
  exito: 'bg-green-400',
  alerta: 'bg-yellow-400',
  error: 'bg-red-400'
}

const formatCuando = (iso) => {
  const fecha = new Date(iso)
  const minutos = Math.round((Date.now() - fecha) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

const avisarCambio = () => window.dispatchEvent(new Event(NOTIFICACIONES_CAMBIO))

// Centro de avisos: resúmenes nuevos, faltantes, errores de sync, valuaciones...
const Avisos = () => {
  const [avisos, setAvisos] = useState(null)
  const [noLeidas, setNoLeidas] = useState(0)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const cargar = useCallback(async () => {
    try {
      const res = await notificationService.listar()
      setAvisos(res.data)
      setNoLeidas(res.noLeidas)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los avisos'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const marcar = async (aviso) => {
    if (!aviso.leida) {
      setAvisos(prev => prev.map(a => (a._id === aviso._id ? { ...a, leida: true } : a)))
      setNoLeidas(n => Math.max(0, n - 1))
      try {
        await notificationService.marcarLeida(aviso._id)
      } catch {
        // si falla, el próximo refresco lo muestra de nuevo sin leer
      }
      avisarCambio()
    }
  }

  const abrir = async (aviso) => {
    await marcar(aviso)
    if (aviso.link) navigate(aviso.link)
  }

  const marcarTodas = async () => {
    setError(null)
    try {
      await notificationService.marcarTodas()
      avisarCambio()
      cargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron marcar los avisos'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white">Avisos</h1>
          <p className="text-gray-400 mt-1">
            {noLeidas > 0 ? `${noLeidas} sin leer` : 'Estás al día'}
          </p>
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodas} className="btn-secondary text-sm">Marcar todos como leídos</button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="card !p-0 overflow-hidden">
        {avisos === null ? (
          <p className="p-6 text-sm text-gray-500">Cargando…</p>
        ) : avisos.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No tenés avisos. Acá van a aparecer los resúmenes que lleguen por mail y lo que Mango haga solo.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {avisos.map(a => (
              <li key={a._id}>
                <button
                  onClick={() => abrir(a)}
                  className={`w-full text-left px-4 md:px-6 py-4 flex gap-3 hover:bg-gray-700/50 transition-colors ${a.leida ? '' : 'bg-gray-700/30'}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${a.leida ? 'bg-gray-600' : PUNTO_NIVEL[a.nivel] || PUNTO_NIVEL.info}`} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm ${a.leida ? 'text-gray-300' : 'text-white font-medium'}`}>{a.titulo}</span>
                    {a.mensaje && <span className="block text-xs text-gray-400 mt-0.5 break-words">{a.mensaje}</span>}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatCuando(a.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Avisos
