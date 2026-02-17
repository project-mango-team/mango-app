import { Outlet, Link, useLocation } from 'react-router-dom'

const Layout = () => {
  const location = useLocation()

  const navItems = [
    { name: 'Inicio', path: '/inicio' },
    { name: 'Datos', path: '/datos' },
    { name: 'Migración', path: '/migracion' }
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen flex bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Mango" className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-bold text-white">Mango</h1>
              <p className="text-sm text-gray-400">Gestor de Gastos</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
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
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Mango v1.0.0 - Node + React
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
