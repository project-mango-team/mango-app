import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAvisos from '../../hooks/useAvisos'
import Icono from './Icono'
import ItemAviso from './ItemAviso'

const MAX_EN_PANEL = 8

// Campana de la navbar: contador de no leídas y panel con los últimos avisos.
// Al hacer click en un aviso se marca leído y se va a su link.
const NotificationBell = ({ noLeidas: contador }) => {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const { avisos, noLeidas, error, abrir, marcarTodas } = useAvisos({ activo: abierto })

  useEffect(() => {
    setAbierto(false)
  }, [location.pathname])

  useEffect(() => {
    if (!abierto) return undefined
    const cerrarAfuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const cerrarConEsc = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', cerrarAfuera)
    document.addEventListener('keydown', cerrarConEsc)
    return () => {
      document.removeEventListener('mousedown', cerrarAfuera)
      document.removeEventListener('keydown', cerrarConEsc)
    }
  }, [abierto])

  // Con el panel abierto el contador sale de la lista (se actualiza al instante); cerrado, del hook de la navbar
  const pendientes = abierto && avisos ? noLeidas : contador

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(a => !a)}
        className="relative p-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
        aria-label={pendientes > 0 ? `Notificaciones: ${pendientes} sin leer` : 'Notificaciones'}
        aria-expanded={abierto}
      >
        <Icono nombre="campana" className="w-6 h-6" />
        {pendientes > 0 && (
          <span className="absolute top-0 right-0 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-white text-[10px] font-semibold leading-[1.1rem] text-center">
            {pendientes > 99 ? '99+' : pendientes}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-x-3 top-[4.25rem] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-600 overflow-hidden z-50">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-white">Notificaciones</h2>
            {noLeidas > 0 && (
              <button onClick={marcarTodas} className="text-xs text-primary-light hover:underline">Marcar todas como leídas</button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-700">
            {error ? (
              <p className="p-4 text-sm text-red-400">{error}</p>
            ) : avisos === null ? (
              <p className="p-4 text-sm text-gray-500">Cargando…</p>
            ) : avisos.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No tenés notificaciones.</p>
            ) : (
              avisos.slice(0, MAX_EN_PANEL).map(a => <ItemAviso key={a._id} aviso={a} onAbrir={abrir} compacto />)
            )}
          </div>

          <Link to="/avisos" className="block px-4 py-3 text-center text-sm text-gray-300 hover:bg-gray-700 border-t border-gray-700">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
