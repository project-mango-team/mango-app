import Modal from '../../Modal'
import useDetalleCarga from '../../../hooks/useDetalleCarga'
import { formatImporte } from '../../../utils/format'

// Qué ítems importó una carga: fecha, detalle, categoría, importe y tipo. Desde acá también se revierte.
const DetalleCargaModal = ({ operacion, onClose, onRevertir }) => {
  const { transacciones, total, hasMore, cargando, error, verMas } = useDetalleCarga(operacion)
  const revertida = operacion?.status === 'rolled_back'

  return (
    <Modal
      isOpen={Boolean(operacion)}
      onClose={onClose}
      size="xl"
      title={operacion?.filename || 'Carga'}
      subtitle={operacion && `${operacion.origen || ''} · ${operacion.transactions_count} transacciones`}
      footer={operacion?.status === 'completed' && (
        <>
          <button onClick={() => onRevertir(operacion)} className="btn-secondary text-red-400">Revertir carga</button>
          <button onClick={onClose} className="btn-primary">Cerrar</button>
        </>
      )}
    >
      {revertida ? (
        <p className="py-6 text-center text-gray-400">Esta carga fue revertida: sus movimientos se borraron.</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : transacciones.length === 0 && !cargando ? (
        <p className="py-6 text-center text-gray-400">Esta carga no tiene transacciones guardadas.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-gray-300">
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Detalle</th>
                  <th className="py-2 pr-3 font-semibold">Categoría</th>
                  <th className="py-2 pr-3 font-semibold text-right">Importe</th>
                  <th className="py-2 font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map(t => (
                  <tr key={t._id} className="border-b border-gray-700/50">
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-400">{t.fecha}</td>
                    <td className="py-2 pr-3 text-gray-200 break-words">{t.detalle}</td>
                    <td className="py-2 pr-3 text-gray-300">{t.categoria}</td>
                    <td className={`py-2 pr-3 text-right whitespace-nowrap ${t.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                      {formatImporte(t.importe, t.moneda)}
                    </td>
                    <td className="py-2 text-gray-400">{t.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-400">
            <span>{cargando ? 'Cargando…' : `${transacciones.length} de ${total}`}</span>
            {hasMore && !cargando && <button onClick={verMas} className="btn-secondary text-sm">Ver más</button>}
          </div>
        </>
      )}
    </Modal>
  )
}

export default DetalleCargaModal
