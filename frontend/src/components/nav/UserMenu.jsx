import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icono from './Icono'

// Avatar con el menú del usuario (Configuración y cerrar sesión)
const UserMenu = ({ user, onLogout }) => {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

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

  const itemClase = 'w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-2'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(a => !a)}
        className="flex items-center p-1 rounded-full hover:bg-gray-700 transition-colors"
        aria-label="Menú del usuario"
        aria-expanded={abierto}
      >
        <img src={user.picture || '/default-avatar.png'} alt={user.name} className="w-8 h-8 rounded-full" />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-gray-700 rounded-lg shadow-lg border border-gray-600 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-600">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <Link to="/configuracion" onClick={() => setAbierto(false)} className={itemClase}>
            <Icono nombre="engranaje" className="w-4 h-4" />
            Configuración
          </Link>
          <button onClick={() => { setAbierto(false); onLogout() }} className={itemClase}>
            <Icono nombre="salir" className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
