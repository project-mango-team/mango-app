import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useHistorialCargas from '../../../hooks/useHistorialCargas'
import HistorialCargasTable from '../HistorialCargasTable'
import ConfirmModal from '../../ConfirmModal'
import { ETIQUETAS_CANAL } from '../OrigenCarga'
import Paginador from './Paginador'
import DetalleCargaModal from './DetalleCargaModal'
import ModalProgreso from '../../ModalProgreso'

// Historial de cargas (de cualquier origen), paginado: click en una carga para ver qué importó o revertirla
const HistorialCargas = () => {
  const historial = useHistorialCargas()
  const { operaciones, cargando, errorCarga, revertir, canal, cambiarCanal } = historial
  const [seleccionada, setSeleccionada] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const { hash } = useLocation()

  // Entrar por /datos/cargar#historial lleva hasta acá (cuando ya cargó, para que la altura sea la final)
  useEffect(() => {
    if (hash === '#historial' && !cargando) document.getElementById('historial')?.scrollIntoView()
  }, [hash, cargando])

  const confirmar = async () => {
    const operacion = seleccionada
    setSeleccionada(null)
    if (operacion) {
      if (await revertir(operacion)) setDetalle(null)
    }
  }

  return (
    <div className="space-y-6">
      {errorCarga && <p className="text-sm text-red-400">{errorCarga}</p>}

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Historial de cargas</h2>
          <select value={canal} onChange={(e) => cambiarCanal(e.target.value)} className="input-field w-auto py-1 text-sm" aria-label="Filtrar por origen">
            <option value="">Todos los orígenes</option>
            {Object.entries(ETIQUETAS_CANAL).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </div>
        {cargando && operaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Cargando historial...</div>
        ) : operaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{canal ? 'No hay cargas de ese origen' : 'No hay cargas registradas'}</div>
        ) : (
          <>
            <HistorialCargasTable operaciones={operaciones} onRevertir={setSeleccionada} onVerDetalle={setDetalle} />
            <Paginador
              pagina={historial.pagina}
              porPagina={historial.porPagina}
              total={historial.total}
              hayAnterior={historial.hayAnterior}
              haySiguiente={historial.haySiguiente}
              onAnterior={historial.anterior}
              onSiguiente={historial.siguiente}
              deshabilitado={cargando}
            />
          </>
        )}
      </div>

      <DetalleCargaModal operacion={detalle} onClose={() => setDetalle(null)} onRevertir={setSeleccionada} />

      <ModalProgreso progreso={historial.progreso} />

      <ConfirmModal
        isOpen={Boolean(seleccionada)}
        onClose={() => setSeleccionada(null)}
        onConfirm={confirmar}
        title="Revertir carga"
        message={`¿Estás seguro de eliminar todas las transacciones de "${seleccionada?.filename}"? Esta acción no se puede deshacer.`}
        confirmText="Revertir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default HistorialCargas
