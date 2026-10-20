import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import useBandejaPendientes from '../hooks/useBandejaPendientes'

const Layout = () => {
  const location = useLocation()
  const { user, logout, isAuthenticated } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pendientesBandeja = useBandejaPendientes()

  // Cerrar el drawer al navegar
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const navItems = [
    { name: 'Inicio', path: '/inicio' },
    { name: 'Bandeja', path: '/bandeja', badge: pendientesBandeja },
    { name: 'Datos', path: '/datos' },
    { name: 'Inversiones', path: '/inversiones' },
    { name: 'Migración', path: '/migracion' }
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="h-screen flex bg-gray-900 overflow-hidden">
      {/* Overlay del drawer en mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - drawer en mobile, fija en desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-full transform transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Mango" className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-bold text-white">Mango</h1>
              <p className="text-sm text-gray-400">Gestor de Gastos</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="font-medium flex-1">{item.name}</span>
                  {item.badge > 0 && (
                    <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold text-center ${
                      isActive(item.path) ? 'bg-white/20 text-white' : 'bg-primary text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info / Footer */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <img
                  src={user.picture || '/default-avatar.png'}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-700 rounded-lg shadow-lg border border-gray-600 overflow-hidden">
                  <Link
                    to="/configuracion"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configuración
                  </Link>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      logout()
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Mango v1.0.0
            </p>
          )}
        </div>
      </aside>

      {/* Main Content - Scrollable area */}
      <main className="flex-1 min-w-0 overflow-y-auto h-full">
        {/* Barra superior mobile */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-300 hover:bg-gray-700"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/logo.svg" alt="Mango" className="w-8 h-8" />
          <span className="text-lg font-bold text-white">Mango</span>
        </div>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
