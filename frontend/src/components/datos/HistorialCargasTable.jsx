const formatDate = (dateString) => new Date(dateString).toLocaleString('es-AR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

const HistorialCargasTable = ({ operaciones, onRevertir }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Archivo</th>
          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Origen</th>
          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Fecha</th>
          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Estado</th>
          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Transacciones</th>
          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Total</th>
          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-300">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {operaciones.map((op) => (
          <tr key={op.operation_id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${op.status === 'rolled_back' ? 'opacity-60' : ''}`}>
            <td className="py-3 px-4 text-sm text-gray-300">{op.filename}</td>
            <td className="py-3 px-4 text-sm text-gray-400">{op.origen}</td>
            <td className="py-3 px-4 text-sm text-gray-400">{formatDate(op.timestamp || op.created_at)}</td>
            <td className="py-3 px-4 text-sm">
              {op.status === 'rolled_back' ? (
                <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 border border-red-800">Revertida</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400 border border-green-800">Completada</span>
              )}
            </td>
            <td className="py-3 px-4 text-sm text-gray-300 text-right">{op.transactions_count}</td>
            <td className="py-3 px-4 text-sm text-gray-300 text-right">
              ${(op.total_gastos + op.total_ingresos).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="py-3 px-4 text-center">
              {op.status === 'completed' && (
                <button
                  onClick={() => onRevertir(op)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  Eliminar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default HistorialCargasTable
