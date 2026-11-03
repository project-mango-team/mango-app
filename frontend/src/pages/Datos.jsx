import { NavLink, Outlet } from 'react-router-dom'
import useBandejaPendientes from '../hooks/useBandejaPendientes'

const PESTANIAS = [
  { nombre: 'Bandeja', ruta: '/datos/bandeja' },
  { nombre: 'Cargar', ruta: '/datos/cargar' },
  { nombre: 'Historial', ruta: '/datos/historial' },
  { nombre: 'Migración', ruta: '/datos/migracion' }
]

// Todas las formas de meter datos: la Bandeja (resúmenes que llegan solos), carga a mano o por archivo,
// el historial de lo cargado y la migración desde Excel. Cada pestaña es una ruta anidada.
const Datos = () => {
  const pendientes = useBandejaPendientes()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Datos</h1>
        <p className="text-gray-400 mt-1">Importá resúmenes, cargá movimientos y revisá lo que ya entró</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-700" aria-label="Secciones de Datos">
        {PESTANIAS.map(({ nombre, ruta }) => (
          <NavLink
            key={ruta}
            to={ruta}
            className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {nombre}
            {nombre === 'Bandeja' && pendientes > 0 && (
              <span className="min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-semibold text-white">{pendientes}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

export default Datos
