import { useState } from 'react'
import { Link } from 'react-router-dom'
import useDeteccionResumen from '../../hooks/useDeteccionResumen'
import DeteccionResumenBadge from '../DeteccionResumenBadge'
import { uploadService } from '../../services/transactionService'
import TransactionEditor from '../TransactionEditor'
import useCotizacionDolar from '../../hooks/useCotizacionDolar'

const CargarTab = () => {
  // Origen selection
  const [origenDatos, setOrigenDatos] = useState('') // 'manual' or 'resumen'
  
  // File upload states
  const [file, setFile] = useState(null)
  const [tipo, setTipo] = useState('')
  const dolar = useCotizacionDolar()
  const { valorDolar } = dolar
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Santander-specific states
  const [cardType, setCardType] = useState('')
  const [availableCards, setAvailableCards] = useState([])
  const [selectedCards, setSelectedCards] = useState([])
  const [detectingCards, setDetectingCards] = useState(false)
  
  // Galicia-specific states
  const [tipoResumen, setTipoResumen] = useState('')

  // Al elegir un archivo se reconoce el banco, el tipo y las tarjetas; se pueden corregir a mano
  const deteccion = useDeteccionResumen((d) => {
    setTipo(d.tipo)
    setTipoResumen(d.tipoResumen || '')
    setCardType(d.cardType || '')
    setAvailableCards(d.tarjetas || [])
    setSelectedCards(d.tarjetas || [])
  })
  
  // Manual entry key for resetting
  const [manualKey, setManualKey] = useState(0)
  
  // Editor states
  const [previewData, setPreviewData] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleFileChange = async (e) => {
    const newFile = e.target.files[0]
    setFile(newFile)
    setMessage(null)
    if (newFile) {
      await deteccion.detectar(newFile)
      return
    }
    
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
        deteccion.detectar(droppedFile)
        return

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
        tipoResumen: tipo === 'galicia' ? tipoResumen : null,
        sha256: response.data.sha256,
        archivoYaImportado: response.data.archivoYaImportado,
        limites: response.data.limites
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
        previewData.tipoResumen,
        previewData.sha256
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
      deteccion.limpiar()
      setShowEditor(false)
      setPreviewData(null)
      
      // Reset file input if it exists
      const fileInput = document.getElementById('file-upload')
      if (fileInput) fileInput.value = ''
      
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
      
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || error.message || 'Error al guardar transacciones'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Importar transacciones</h2>
        <p className="text-gray-400">Importá extractos bancarios o cargá transacciones manualmente</p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`card ${message.type === 'error' ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
          <p className={message.type === 'error' ? 'text-red-400' : 'text-green-400'}>
            {message.text}
            {message.type !== 'error' && <> <Link to="/datos/historial" className="underline">Ver en el historial</Link></>}
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
              archivoYaImportado={previewData.archivoYaImportado}
              limites={previewData.limites}
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
                      accept=".csv,.xlsx,.pdf,.txt"
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <p className="text-gray-400 mb-2">
                        {file ? file.name : 'Click para seleccionar o arrastra tu archivo aquí'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Formatos: PDF, XLSX, CSV o TXT · el banco y el tipo se reconocen solos
                      </p>
                    </label>
                  </div>
                  <DeteccionResumenBadge deteccion={deteccion.deteccion} detectando={deteccion.detectando} />
                </div>

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
                      <option value="tarjeta">Tarjeta Visa o Mastercard (PDF o TXT)</option>
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
                      Cotización del dólar
                    </label>
                    <input
                      type="number"
                      value={valorDolar}
                      onChange={(e) => dolar.setValorDolar(e.target.value)}
                      className="input-field w-full"
                      step="0.01"
                      placeholder={dolar.loading ? 'Cargando cotización...' : 'Ingresá la cotización'}
                    />
                    {dolar.error && (
                      <p className="text-xs text-red-400 mt-1">{dolar.error}</p>
                    )}
                    {dolar.cotizacion && (
                      <p className="text-xs text-gray-500 mt-1">
                        Dólar oficial venta: ${dolar.cotizacion.venta.toLocaleString('es-AR')} ({dolar.cotizacion.fuente}
                        {dolar.cotizacion.fechaActualizacion && `, ${new Date(dolar.cotizacion.fechaActualizacion).toLocaleDateString('es-AR')}`})
                        {dolar.editado && Number(valorDolar) !== dolar.cotizacion.venta && (
                          <button type="button" onClick={dolar.restablecer} className="ml-2 text-primary hover:underline">
                            Restablecer
                          </button>
                        )}
                      </p>
                    )}
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
                      deteccion.limpiar()
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

    </div>
  )
}

export default CargarTab
