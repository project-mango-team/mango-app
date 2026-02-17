import { useState, useEffect } from 'react'
import { migrateService, operationsService } from '../services/transactionService'
import ConfirmModal from '../components/ConfirmModal'

const Migracion = () => {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [message, setMessage] = useState(null)
  const [migrationResult, setMigrationResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [operations, setOperations] = useState([])
  const [loadingOperations, setLoadingOperations] = useState(false)
  const [showRollbackModal, setShowRollbackModal] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState(null)

  useEffect(() => {
    loadOperations()
  }, [])

  const loadOperations = async () => {
    try {
      setLoadingOperations(true)
      const response = await operationsService.getAll('migration', null, 10)
      setOperations(response.data)
    } catch (error) {
      console.error('Error loading operations:', error)
    } finally {
      setLoadingOperations(false)
    }
  }

  const handleRollback = async (operation) => {
    setSelectedOperation(operation)
    setShowRollbackModal(true)
  }

  const confirmRollback = async () => {
    if (!selectedOperation) return

    try {
      const response = await operationsService.rollback(selectedOperation.operation_id)
      setMessage({ 
        type: 'success', 
        text: response.message
      })
      loadOperations()
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al hacer rollback'
      })
    } finally {
      setSelectedOperation(null)
      setShowRollbackModal(false)
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setPreview(null)
    setMessage(null)
    setMigrationResult(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      // Validate file type
      if (droppedFile.name.toLowerCase().endsWith('.xlsx') || droppedFile.name.toLowerCase().endsWith('.xls')) {
        setFile(droppedFile)
        setPreview(null)
        setMessage(null)
        setMigrationResult(null)
      } else {
        setMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel (.xlsx o .xls)' })
      }
    }
  }

  const handlePreview = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel' })
      return
    }

    try {
      setLoading(true)
      setMessage(null)
      const response = await migrateService.preview(file)
      setPreview(response.data.preview)
      setMessage({ 
        type: 'success', 
        text: `Se encontraron ${response.data.preview.totals.total_transacciones} transacciones en ${response.data.preview.totals.sheets_con_datos} hojas`
      })
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al obtener preview del archivo'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMigrate = async () => {
    if (!file || !preview) {
      setMessage({ type: 'error', text: 'Por favor genera el preview primero' })
      return
    }

    setShowConfirmModal(true)
  }

  const confirmMigration = async () => {
    try {
      setMigrating(true)
      setMessage(null)
      const response = await migrateService.migrate(file)
      
      setMigrationResult(response.data)
      setMessage({ 
        type: 'success', 
        text: response.message
      })
      
      // Reset form
      setFile(null)
      setPreview(null)
      document.getElementById('file-upload-migrate').value = ''
      
      // Reload operations
      loadOperations()
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error durante la migración'
      })
    } finally {
      setMigrating(false)
    }
  }

  const formatNumber = (num) => {
    const value = num ?? 0
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const mesesOrden = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Migración de Excel a Mango</h1>
        <p className="text-gray-400">Importá tus archivos Excel históricos completos a la base de datos</p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`card ${message.type === 'error' ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
          <p className={message.type === 'error' ? 'text-red-400' : 'text-green-400'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Migration Result Summary */}
      {migrationResult && (
        <div className="card bg-green-900/20 border-green-800">
          <h3 className="text-xl font-semibold text-green-400 mb-4">✅ Migración Completada</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Transacciones</p>
              <p className="text-2xl font-bold text-white">{migrationResult.transacciones_importadas}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Hojas Procesadas</p>
              <p className="text-2xl font-bold text-white">{migrationResult.hojas_procesadas}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Gastos</p>
              <p className="text-2xl font-bold text-red-400">${formatNumber(migrationResult.total_gastos)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Ingresos</p>
              <p className="text-2xl font-bold text-green-400">${formatNumber(migrationResult.total_ingresos)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="card max-w-2xl">
        <h3 className="text-lg font-semibold mb-4">Seleccionar Archivo</h3>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-4 ${
            isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-gray-600 hover:border-primary'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            onChange={handleFileChange}
            accept=".xlsx,.xls"
            className="hidden"
            id="file-upload-migrate"
          />
          <label htmlFor="file-upload-migrate" className="cursor-pointer">
            <p className="text-gray-400 mb-2">
              {file ? file.name : 'Click para seleccionar o arrastra tu archivo Excel aquí'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Formatos: .xlsx, .xls (Máximo 50MB)
            </p>
          </label>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handlePreview}
            className="btn-primary flex-1"
            disabled={loading || !file}
          >
            {loading ? 'Analizando...' : 'Analizar Excel'}
          </button>
          <button
            onClick={() => {
              setFile(null)
              setPreview(null)
              setMessage(null)
              setMigrationResult(null)
              document.getElementById('file-upload-migrate').value = ''
            }}
            className="btn-secondary"
            disabled={loading || migrating}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {preview && (
        <>
          {/* Summary Stats */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Resumen General</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Hojas con datos</p>
                <p className="text-2xl font-bold text-primary">{preview.totals.sheets_con_datos}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Hojas vacías</p>
                <p className="text-2xl font-bold text-gray-400">{preview.totals.sheets_vacias}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Total transacciones</p>
                <p className="text-2xl font-bold text-white">{preview.totals.total_transacciones}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Balance</p>
                <p className={`text-2xl font-bold ${preview.totals.neto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${formatNumber(preview.totals.neto)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-800">
                <p className="text-sm text-gray-400 mb-1">💸 Total Gastos</p>
                <p className="text-2xl font-bold text-red-400">${formatNumber(preview.totals.importe_gastos)}</p>
                <p className="text-sm text-gray-500 mt-1">{preview.totals.total_gastos} transacciones</p>
              </div>
              <div className="bg-green-900/20 p-4 rounded-lg border border-green-800">
                <p className="text-sm text-gray-400 mb-1">💰 Total Ingresos</p>
                <p className="text-2xl font-bold text-green-400">${formatNumber(preview.totals.importe_ingresos)}</p>
                <p className="text-sm text-gray-500 mt-1">{preview.totals.total_ingresos} transacciones</p>
              </div>
            </div>
          </div>

          {/* Detailed by Month */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Detalle por Mes</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Mes</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Gastos</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Ingresos</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">$ Gastos</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">$ Ingresos</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesOrden.map(mes => {
                    const stats = preview.sheets[mes]
                    if (!stats) {
                      return (
                        <tr key={mes} className="border-b border-gray-700/50">
                          <td className="py-3 px-4 font-medium">{mes}</td>
                          <td colSpan={5} className="text-center text-gray-500 italic">Sin datos</td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={mes} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4 font-medium">{mes}</td>
                        <td className="text-right py-3 px-4 text-gray-300">{stats.gastos}</td>
                        <td className="text-right py-3 px-4 text-gray-300">{stats.ingresos}</td>
                        <td className="text-right py-3 px-4 text-red-400">${formatNumber(stats.importe_gastos)}</td>
                        <td className="text-right py-3 px-4 text-green-400">${formatNumber(stats.importe_ingresos)}</td>
                        <td className={`text-right py-3 px-4 font-semibold ${stats.neto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${formatNumber(stats.neto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm Migration */}
          <div className="card bg-yellow-900/20 border-yellow-800">
            <h3 className="text-xl font-semibold text-yellow-400 mb-4">⚠️ Confirmar Migración</h3>
            <p className="text-gray-300 mb-4">
              Esta acción guardará TODAS las transacciones ({preview.totals.total_transacciones}) en Mango. 
              Asegurate de que no estén duplicadas.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleMigrate}
                className="btn-primary"
                disabled={migrating}
              >
                {migrating ? 'Migrando...' : 'Migrar'}
              </button>
              <button
                onClick={() => {
                  setPreview(null)
                  setMessage(null)
                }}
                className="btn-secondary"
                disabled={migrating}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Operations History */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Historial de Migraciones</h3>
        
        {loadingOperations ? (
          <p className="text-gray-400 text-center py-4">Cargando historial...</p>
        ) : operations.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No hay migraciones registradas</p>
        ) : (
          <div className="space-y-3">
            {operations.map((op) => (
              <div 
                key={op.operation_id} 
                className={`p-4 rounded-lg border transition-colors ${
                  op.status === 'rolled_back' 
                    ? 'bg-gray-700/30 border-gray-600' 
                    : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{op.filename}</h4>
                      {op.status === 'rolled_back' && (
                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 border border-red-800">
                          Revertida
                        </span>
                      )}
                      {op.status === 'completed' && (
                        <span className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400 border border-green-800">
                          Completada
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-gray-400">
                      <span>{op.transactions_count} transacciones</span>
                      <span>Balance: ${formatNumber(op.balance)}</span>
                      <span>{new Date(op.timestamp || op.created_at).toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                  {op.status === 'completed' && (
                    <button
                      onClick={() => handleRollback(op)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50 transition-colors"
                    >
                      Revertir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Migration Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmMigration}
        title="Confirmar Migración"
        message={`¿Estás seguro de migrar ${preview?.totals?.total_transacciones || 0} transacciones a Mango? Esta acción guardará todas las transacciones en la base de datos.`}
        confirmText="Migrar"
        cancelText="Cancelar"
        type="warning"
      />

      {/* Confirm Rollback Modal */}
      <ConfirmModal
        isOpen={showRollbackModal}
        onClose={() => {
          setShowRollbackModal(false)
          setSelectedOperation(null)
        }}
        onConfirm={confirmRollback}
        title="Confirmar Eliminación"
        message={`¿Estás seguro de eliminar la migración "${selectedOperation?.filename}"? Se eliminarán ${selectedOperation?.transactions_count || 0} transacciones.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Migracion
