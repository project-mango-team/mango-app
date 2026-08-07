import { useState, useEffect } from 'react'
import { uploadService, operationsService } from '../services/transactionService'
import ConfirmModal from '../components/ConfirmModal'
import TransactionEditor from '../components/TransactionEditor'

const Datos = () => {
  // Origen selection
  const [origenDatos, setOrigenDatos] = useState('') // 'manual' or 'resumen'
  
  // File upload states
  const [file, setFile] = useState(null)
  const [tipo, setTipo] = useState('')
  const [valorDolar, setValorDolar] = useState(1400)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState(null)
  
  // Santander-specific states
  const [cardType, setCardType] = useState('')
  const [availableCards, setAvailableCards] = useState([])
  const [selectedCards, setSelectedCards] = useState([])
  const [detectingCards, setDetectingCards] = useState(false)
  
  // Galicia-specific states
  const [tipoResumen, setTipoResumen] = useState('')
  
  // Manual entry key for resetting
  const [manualKey, setManualKey] = useState(0)
  
  // Editor states
  const [previewData, setPreviewData] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await operationsService.getAll('upload', null, 20)
      setHistory(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleFileChange = async (e) => {
    const newFile = e.target.files[0]
    setFile(newFile)
    setMessage(null)
    
    // If Santander and cardType already selected, detect cards
    if (newFile && tipo === 'santander' && cardType) {
      await detectCards(cardType, newFile)
    } else {
      // Reset card selection when file changes
      setAvailableCards([])
      setSelectedCards([])
    }
  }

  const handleTipoChange = (newTipo) => {
    setTipo(newTipo)
    // Reset Santander-specific fields when changing tipo
    setCardType('')
    setAvailableCards([])
    setSelectedCards([])
  }

  const handleCardTypeChange = async (newCardType) => {
    setCardType(newCardType)
    setSelectedCards([])
    setAvailableCards([])
    
    // If file already loaded, detect cards
    if (newCardType && file && tipo === 'santander') {
      await detectCards(newCardType, file)
    }
  }

  const detectCards = async (cardTypeToDetect, fileToDetect = file) => {
    try {
      setDetectingCards(true)
      setMessage(null)
      
      const response = await uploadService.detectCards(fileToDetect, cardTypeToDetect)
      
      if (response.data.cards && response.data.cards.length > 0) {
        setAvailableCards(response.data.cards)
        // Pre-select all cards by default
        setSelectedCards(response.data.cards)
      } else {
        setAvailableCards([])
        setSelectedCards([])
        setMessage({ type: 'error', text: 'No se encontraron tarjetas en el archivo' })
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al detectar tarjetas'
      })
      setAvailableCards([])
      setSelectedCards([])
    } finally {
      setDetectingCards(false)
    }
  }

  const handleCardSelection = (card) => {
    setSelectedCards(prev => {
      if (prev.includes(card)) {
        return prev.filter(c => c !== card)
      } else {
        return [...prev, card]
      }
    })
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
      const fileName = droppedFile.name.toLowerCase()
      if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.pdf') || fileName.endsWith('.txt')) {
        setFile(droppedFile)
        setMessage(null)

        if (tipo === 'santander' && cardType) {
          detectCards(cardType, droppedFile)
        } else {
          setAvailableCards([])
          setSelectedCards([])
        }
      } else {
        setMessage({ type: 'error', text: 'Por favor selecciona un archivo CSV, XLSX, PDF o TXT' })
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file || !tipo) {
      setMessage({ type: 'error', text: 'Por favor selecciona un archivo y el tipo de origen' })
      return
    }

    // Validate Santander-specific fields
    if (tipo === 'santander') {
      if (!cardType) {
        setMessage({ type: 'error', text: 'Por favor selecciona el tipo de tarjeta' })
        return
      }
      if (!selectedCards || selectedCards.length === 0) {
        setMessage({ type: 'error', text: 'Por favor selecciona al menos una tarjeta' })
        return
      }
    }

    // Validate Galicia-specific fields
    if (tipo === 'galicia') {
      if (!tipoResumen) {
        setMessage({ type: 'error', text: 'Por favor selecciona el tipo de resumen' })
        return
      }
    }

    try {
      setLoading(true)
      setMessage(null)
      
      // Get preview data instead of uploading directly
      const response = await uploadService.previewFile(
        file, 
        tipo, 
        valorDolar,
        tipo === 'santander' ? cardType : null,
        tipo === 'santander' ? selectedCards : null,
        tipo === 'galicia' ? tipoResumen : null
      )
      
      setPreviewData({
        transactions: response.data.transactions,
        filename: response.data.filename,
        tipo: response.data.tipo,
        cardType: response.data.cardType,
        selectedCards: response.data.selectedCards,
        tipoResumen: tipo === 'galicia' ? tipoResumen : null
      })
      setShowEditor(true)
      
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || error.message || 'Error al procesar archivo'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTransactions = async (editedTransactions) => {
    try {
      setSaving(true)
      setMessage(null)
      
      const response = await uploadService.saveTransactions(
        editedTransactions, 
        previewData.tipo, 
        previewData.filename,
        previewData.cardType,
        previewData.selectedCards,
        previewData.tipoResumen
      )
      
      setMessage({ 
        type: 'success', 
        text: response.message 
      })
      
      // Reset form and editor
      setFile(null)
      setTipo('')
      setCardType('')
      setAvailableCards([])
      setSelectedCards([])
      setTipoResumen('')
      setShowEditor(false)
      setPreviewData(null)
      
      // Reset file input if it exists
      const fileInput = document.getElementById('file-upload')
      if (fileInput) fileInput.value = ''
      
      // Reload history
      loadHistory()
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || error.message || 'Error al guardar transacciones'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEditor = () => {
    setShowEditor(false)
    setPreviewData(null)
  }

  const saveManualTransactions = async (formattedTransactions) => {
    // Validate transactions
    const validTransactions = formattedTransactions.filter(t => 
      t.fecha && t.detalle && t.importe && parseFloat(t.importe) > 0
    )

    if (validTransactions.length === 0) {
      setMessage({ type: 'error', text: 'Por favor completa al menos una transacción válida' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)
      
      const response = await uploadService.saveTransactions(
        validTransactions,
        'manual',
        'Carga Manual'
      )
      
      setMessage({ 
        type: 'success', 
        text: response.message 
      })
      
      // Reset manual transactions by changing key
      setManualKey(prev => prev + 1)
      
      // Reload history
      loadHistory()
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || error.message || 'Error al guardar transacciones'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRollback = async (operation) => {
    setSelectedOperation(operation)
    setShowConfirmModal(true)
  }

  const confirmRollback = async () => {
    if (!selectedOperation) return

    try {
      const response = await operationsService.rollback(selectedOperation.operation_id)
      setMessage({ 
        type: 'success', 
        text: response.message 
      })
      
      // Reload history
      loadHistory()
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error al hacer rollback'
      })
    } finally {
      setSelectedOperation(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Importar Transacciones</h1>
        <p className="text-gray-400">Importá extractos bancarios o cargá transacciones manualmente</p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`card ${message.type === 'error' ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
          <p className={message.type === 'error' ? 'text-red-400' : 'text-green-400'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Transaction Editor */}
      {showEditor && previewData && (
        <div className="card">
          {saving ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Guardando transacciones...</div>
            </div>
          ) : (
            <TransactionEditor
              initialTransactions={previewData.transactions}
              onSave={handleSaveTransactions}
              onCancel={handleCancelEditor}
            />
          )}
        </div>
      )}

      {/* Upload Form - only show when editor is not active */}
      {!showEditor && (
        <div className={`card ${origenDatos === 'manual' ? '' : 'max-w-2xl'}`}>
          <div className="space-y-6">
            {/* Origen de datos */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Origen de datos
              </label>
              <select
                value={origenDatos}
                onChange={(e) => {
                  setOrigenDatos(e.target.value)
                  setTipo('')
                  setMessage(null)
                }}
                className="input-field w-full"
              >
                <option value="">Seleccionar...</option>
                <option value="manual">Carga manual</option>
                <option value="resumen">Resumen de cuenta</option>
              </select>
            </div>

            {/* Resumen de cuenta form */}
            {origenDatos === 'resumen' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Banco/Fuente */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Banco / Fuente
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => handleTipoChange(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="mercadopago">Mercado Pago</option>
                    <option value="santander">Santander</option>
                    <option value="galicia">Galicia</option>
                  </select>
                </div>

                {/* Tipo de tarjeta (solo para Santander) */}
                {tipo === 'santander' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de tarjeta
                    </label>
                    <select
                      value={cardType}
                      onChange={(e) => handleCardTypeChange(e.target.value)}
                      className="input-field w-full"
                      disabled={!file}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="visa">Visa</option>
                      <option value="amex" disabled>Amex (próximamente)</option>
                    </select>
                  </div>
                )}

                {/* Tipo de resumen (solo para Galicia) */}
                {tipo === 'galicia' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de resumen
                    </label>
                    <select
                      value={tipoResumen}
                      onChange={(e) => setTipoResumen(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="cuenta">Movimientos en Caja de Ahorro (XLSX o CSV)</option>
                      <option value="tarjeta">Tarjeta Visa (PDF o TXT)</option>
                    </select>
                  </div>
                )}

                {/* Tarjetas detectadas (solo para Santander) */}
                {tipo === 'santander' && cardType && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tarjetas a importar
                    </label>
                    {detectingCards ? (
                      <div className="text-sm text-gray-400">Detectando tarjetas...</div>
                    ) : availableCards.length > 0 ? (
                      <div className="space-y-2">
                        {availableCards.map(card => (
                          <label key={card} className="flex items-center p-2 rounded hover:bg-gray-700/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCards.includes(card)}
                              onChange={() => handleCardSelection(card)}
                              className="mr-3 w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary focus:ring-2"
                            />
                            <span className="text-sm text-gray-300">{card}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No se detectaron tarjetas</p>
                    )}
                  </div>
                )}

                {/* Valor dólar (solo para Santander y Galicia Tarjeta) */}
                {(tipo === 'santander' || (tipo === 'galicia' && tipoResumen === 'tarjeta')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Dólar Tarjeta
                    </label>
                    <input
                      type="number"
                      value={valorDolar}
                      onChange={(e) => setValorDolar(e.target.value)}
                      className="input-field w-full"
                      step="0.01"
                    />
                  </div>
                )}

                {/* Ayuda para Galicia Tarjeta */}
                {tipo === 'galicia' && tipoResumen === 'tarjeta' && (
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Cómo importar resumen Galicia</h4>
                    <p className="text-sm text-gray-300">
                      Podés subir directamente el archivo <strong>.pdf</strong> descargado de Home Banking o un <strong>.txt</strong> si copiaste el texto del resumen.
                    </p>
                  </div>
                )}

                {/* File upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Archivo
                  </label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
                      accept={tipo === 'galicia' && tipoResumen === 'tarjeta' ? '.txt,.pdf' : '.csv,.xlsx,.pdf'}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <p className="text-gray-400 mb-2">
                        {file ? file.name : 'Click para seleccionar o arrastra tu archivo aquí'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {tipo === 'galicia' && tipoResumen === 'tarjeta' ? 'Formatos: PDF o TXT' : 'Formatos: XLSX o CSV'}
                      </p>
                    </label>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    className="btn-primary flex-1"
                    disabled={loading || !file}
                  >
                    {loading ? 'Analizando...' : 'Analizar Datos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setTipo('')
                      setCardType('')
                      setAvailableCards([])
                      setSelectedCards([])
                      setTipoResumen('')
                      setMessage(null)
                      const fileInput = document.getElementById('file-upload')
                      if (fileInput) fileInput.value = ''
                    }}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Limpiar
                  </button>
                </div>
              </form>
            )}

            {/* Carga manual form */}
            {origenDatos === 'manual' && (
              <TransactionEditor
                key={manualKey}
                initialTransactions={[
                  {
                    fecha: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
                    categoria: 'Otros',
                    detalle: '',
                    importe: 0,
                    moneda: 'ARS',
                    monto_original: 0,
                    tipo: 'Gasto',
                    origen: 'Carga Manual'
                  }
                ]}
                onSave={saveManualTransactions}
                isManualMode={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Historial de Cargas</h2>
        
        {loadingHistory ? (
          <div className="text-center py-8 text-gray-400">
            Cargando historial...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No hay cargas registradas
          </div>
        ) : (
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
                {history.map((op) => (
                  <tr key={op.operation_id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${op.status === 'rolled_back' ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4 text-sm text-gray-300">{op.filename}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{op.origen}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{formatDate(op.timestamp || op.created_at)}</td>
                    <td className="py-3 px-4 text-sm">
                      {op.status === 'rolled_back' ? (
                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 border border-red-800">
                          Revertida
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400 border border-green-800">
                          Completada
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300 text-right">{op.transactions_count}</td>
                    <td className="py-3 px-4 text-sm text-gray-300 text-right">
                      ${(op.total_gastos + op.total_ingresos).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {op.status === 'completed' && (
                        <button
                          onClick={() => handleRollback(op)}
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
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setSelectedOperation(null)
        }}
        onConfirm={confirmRollback}
        title="Confirmar Eliminación"
        message={`¿Estás seguro de eliminar todas las transacciones del archivo "${selectedOperation?.filename}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Datos
