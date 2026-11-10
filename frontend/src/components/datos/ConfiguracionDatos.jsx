import { useState } from 'react'
import useCalendario from '../../hooks/useCalendario'
import Modal from '../Modal'
import CalendarioCierres from '../bandeja/CalendarioCierres'
import Icono from '../nav/Icono'

// Engranaje de la fila de solapas de Datos: abre la "Configuración de datos" (calendario de cierres, ING-09).
// Un punto en el engranaje avisa si hay resúmenes que faltan.
const ConfiguracionDatos = () => {
  const [abierto, setAbierto] = useState(false)
  // Al abrir el panel se vuelve a pedir el calendario, así el estado es el de ahora
  const calendario = useCalendario(abierto)

  const faltan = calendario.fuentes.filter(f => f.configurada && f.activa && (f.estado === 'faltante' || f.estado === 'avisado')).length

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="relative flex-shrink-0 self-center p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        aria-label={faltan > 0 ? `Configuración de datos: ${faltan} resúmenes sin archivo` : 'Configuración de datos'}
        title="Configuración de datos"
      >
        <Icono nombre="engranaje" className="w-5 h-5" />
        {faltan > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-gray-900" />}
      </button>

      <Modal
        isOpen={abierto}
        onClose={() => setAbierto(false)}
        title="Configuración de datos"
        subtitle={faltan > 0 ? `${faltan} ${faltan === 1 ? 'resumen sin archivo' : 'resúmenes sin archivo'}` : 'Calendario de cierres'}
        size="lg"
      >
        {calendario.loading ? <p className="text-gray-400">Cargando…</p> : <CalendarioCierres calendario={calendario} />}
      </Modal>
    </>
  )
}

export default ConfiguracionDatos
