import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import useBandejaPendientes from '../hooks/useBandejaPendientes'
import useNotificacionesNoLeidas from '../hooks/useNotificacionesNoLeidas'
import Icono from './nav/Icono'
import UserMenu from './nav/UserMenu'

// Las rutas anidadas (/datos/historial) también dejan marcada la solapa
const estaActivo = (pathname, path) => pathname === path || pathname.startsWith(path + '/')

const Insignia = ({ cantidad, activo }) => (
  <span className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs font-semibold text-center ${
    activo ? 'bg-white/20 text-white' : 'bg-primary text-white'
  }`}>
    {cantidad}
  </span>
)

const Layout = () => {
  const location = useLocation()
  const { user, logout, isAuthenticated } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const pendientesBandeja = useBandejaPendientes()
  const avisosNoLeidos = useNotificacionesNoLeidas()

  // Cerrar el menú del celular al navegar
  useEffect(() => {
    setMenuAbierto(false)
  }, [location.pathname])

  const navItems = [
    { name: 'Inicio', path: '/inicio', icon: 'inicio' },
    { name: 'Avisos', path: '/avisos', icon: 'campana', badge: avisosNoLeidos },
    { name: 'Datos', path: '/datos', icon: 'datos', badge: pendientesBandeja },
    { name: 'Inversiones', path: '/inversiones', icon: 'inversiones' }
  ]

  const itemClase = (activo) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    activo ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
  }`

  const renderItem = (item) => {
    const activo = estaActivo(location.pathname, item.path)
    return (
      <Link key={item.path} to={item.path} className={itemClase(activo)} aria-current={activo ? 'page' : undefined}>
        <Icono nombre={item.icon} className="w-5 h-5 flex-shrink-0" />
        <span>{item.name}</span>
        {item.badge > 0 && <Insignia cantidad={item.badge} activo={activo} />}
      </Link>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      <header className="relative z-40 flex-shrink-0 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 px-4 md:px-8 h-16">
          <Link to="/inicio" className="flex items-center gap-3 mr-auto min-w-0">
            <img src="/logo.svg" alt="" className="w-9 h-9 flex-shrink-0" />
            <span className="text-xl font-bold text-white">Mango</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
            {navItems.map(renderItem)}
          </nav>

          {isAuthenticated && user && <UserMenu user={user} onLogout={logout} />}

          <button
            onClick={() => setMenuAbierto(a => !a)}
            className="md:hidden p-2 -mr-2 rounded-lg text-gray-300 hover:bg-gray-700"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
          >
            <Icono nombre={menuAbierto ? 'cerrar' : 'menu'} className="w-6 h-6" />
          </button>
        </div>

        {/* Menú desplegable en celular */}
        {menuAbierto && (
          <nav className="md:hidden absolute inset-x-0 top-full bg-gray-800 border-b border-gray-700 shadow-lg p-3 flex flex-col gap-1" aria-label="Principal">
            {navItems.map(renderItem)}
          </nav>
        )}
      </header>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
