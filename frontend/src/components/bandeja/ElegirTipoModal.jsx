import { useEffect, useState } from 'react'
import Modal from '../Modal'

// Para documentos que no se reconocieron: elegir banco y tipo a mano (como en Datos)
const ElegirTipoModal = ({ documento, onClose, onGuardar }) => {
  const [tipo, setTipo] = useState('')
  const [tipoResumen, setTipoResumen] = useState('cuenta')

  useEffect(() => {
    if (!documento) return
    setTipo(documento.parametros?.tipo || documento.deteccion?.tipo || '')
    setTipoResumen(documento.parametros?.tipoResumen || documento.deteccion?.tipoResumen || 'cuenta')
  }, [documento])

  return (
    <Modal
      isOpen={Boolean(documento)}
      onClose={onClose}
      title="Elegir banco y tipo"
      subtitle={documento?.filename}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onGuardar(documento, { tipo, ...(tipo === 'galicia' && { tipoResumen }) })}
            disabled={!tipo}
            className="btn-primary disabled:opacity-50"
          >
            Procesar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-400">Banco / fuente</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field w-full mt-1">
            <option value="">Seleccionar...</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="santander">Santander</option>
            <option value="galicia">Galicia</option>
          </select>
        </label>
        {tipo === 'galicia' && (
          <label className="block">
            <span className="text-sm text-gray-400">Tipo de resumen</span>
            <select value={tipoResumen} onChange={(e) => setTipoResumen(e.target.value)} className="input-field w-full mt-1">
              <option value="cuenta">Caja de ahorro (XLSX o CSV)</option>
              <option value="tarjeta">Tarjeta Visa o Mastercard (PDF o TXT)</option>
            </select>
          </label>
        )}
      </div>
    </Modal>
  )
}

export default ElegirTipoModal
