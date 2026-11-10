import { NavLink, Outlet } from 'react-router-dom'
import useBandejaPendientes from '../hooks/useBandejaPendientes'
import ConfiguracionDatos from '../components/datos/ConfiguracionDatos'

const PESTANIAS = [
  { nombre: 'Cargar', ruta: '/datos/cargar' },
  { nombre: 'Migración', ruta: '/datos/migracion' }
]

// Cargar (archivos, resúmenes que llegan solos, carga a mano e historial) y Migración desde Excel.
// Cada pestaña es una ruta anidada.
const Datos = () => {
  const pendientes = useBandejaPendientes()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Datos</h1>
        <p className="text-gray-400 mt-1">Importá resúmenes, cargá movimientos y revisá lo que ya entró</p>
      </div>

      {/* La línea de abajo va en el contenedor: con -mb-px en las solapas el nav se desbordaba 1px y mostraba scroll */}
      <div className="flex items-stretch border-b border-gray-700">
        <nav className="flex flex-1 min-w-0 gap-1 overflow-x-auto" aria-label="Secciones de Datos">
          {PESTANIAS.map(({ nombre, ruta }) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {nombre}
              {nombre === 'Cargar' && pendientes > 0 && (
                <span className="min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-semibold text-white">{pendientes}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <ConfiguracionDatos />
      </div>

      <Outlet />
    </div>
  )
}

export default Datos
