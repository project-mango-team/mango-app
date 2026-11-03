import { useState } from 'react'
import useHistorialCargas from '../../hooks/useHistorialCargas'
import HistorialCargasTable from './HistorialCargasTable'
import ConfirmModal from '../ConfirmModal'

// Todo lo que se cargó, venga de donde venga, con la opción de revertirlo
const HistorialTab = () => {
  const { operaciones, cargando, mensaje, revertir } = useHistorialCargas()
  const [seleccionada, setSeleccionada] = useState(null)

  const confirmar = async () => {
    const operacion = seleccionada
    setSeleccionada(null)
    if (operacion) await revertir(operacion)
  }

  return (
    <div className="space-y-6">
      {mensaje && (
        <div className={`card ${mensaje.type === 'error' ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
          <p className={mensaje.type === 'error' ? 'text-red-400' : 'text-green-400'}>{mensaje.text}</p>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Historial de cargas</h2>
        {cargando ? (
          <div className="text-center py-8 text-gray-400">Cargando historial...</div>
        ) : operaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No hay cargas registradas</div>
        ) : (
          <HistorialCargasTable operaciones={operaciones} onRevertir={setSeleccionada} />
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(seleccionada)}
        onClose={() => setSeleccionada(null)}
        onConfirm={confirmar}
        title="Confirmar Eliminación"
        message={`¿Estás seguro de eliminar todas las transacciones de "${seleccionada?.filename}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default HistorialTab
