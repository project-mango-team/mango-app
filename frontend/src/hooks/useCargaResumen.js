import { useState } from 'react'
import useDeteccionResumen from './useDeteccionResumen'
import { uploadService } from '../services/transactionService'
import useCotizacionDolar from './useCotizacionDolar'
import { BANDEJA_CAMBIO } from './useBandeja'

// Estado y acciones de la pestaña Cargar de Datos: elegir origen, subir un resumen (con detección automática
// de banco, tipo y tarjetas), revisar las transacciones en el editor y guardarlas, o cargarlas a mano.
const useCargaResumen = () => {
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
    if (newFile) await deteccion.detectar(newFile)
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

      // Avisa al historial (y al badge) que hay una carga nueva
      window.dispatchEvent(new Event(BANDEJA_CAMBIO))

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

      window.dispatchEvent(new Event(BANDEJA_CAMBIO))

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

  return {
    origenDatos,
    setOrigenDatos,
    file,
    setFile,
    tipo,
    setTipo,
    loading,
    setLoading,
    message,
    setMessage,
    isDragging,
    setIsDragging,
    cardType,
    setCardType,
    availableCards,
    setAvailableCards,
    selectedCards,
    setSelectedCards,
    detectingCards,
    setDetectingCards,
    tipoResumen,
    setTipoResumen,
    manualKey,
    setManualKey,
    previewData,
    setPreviewData,
    showEditor,
    setShowEditor,
    saving,
    setSaving,
    dolar,
    deteccion,
    handleFileChange,
    handleTipoChange,
    handleCardTypeChange,
    detectCards,
    handleCardSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
    handleSaveTransactions,
    handleCancelEditor,
    saveManualTransactions,
    valorDolar
  }
}

export default useCargaResumen
