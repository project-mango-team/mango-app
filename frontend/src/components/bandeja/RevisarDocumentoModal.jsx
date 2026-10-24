import { useCallback, useEffect, useState } from 'react'
import Modal from '../Modal'
import TransactionEditor from '../TransactionEditor'
import ControlTotales from './ControlTotales'
import { bandejaService } from '../../services/bandejaService'
import { mensajeError } from '../../utils/format'

const usaDolar = ({ tipo, tipoResumen } = {}) => tipo === 'santander' || (tipo === 'galicia' && tipoResumen === 'tarjeta')

// Revisión de un documento antes de importarlo: el editor de siempre, con los duplicados marcados
const RevisarDocumentoModal = ({ documento, onClose, onImportar }) => {
  const [datos, setDatos] = useState(null)
  const [dolar, setDolar] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await bandejaService.transacciones(documento._id)
      setDatos(res.data)
      setDolar(res.data.documento.parametros?.valorDolar ?? '')
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar las transacciones'))
    } finally {
      setCargando(false)
    }
  }, [documento])

  useEffect(() => {
    if (documento) cargar()
  }, [documento, cargar])

  const recalcular = async () => {
    setCargando(true)
    try {
      await bandejaService.actualizarParametros(documento._id, { valorDolar: Number(dolar) })
      await cargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo recalcular'))
      setCargando(false)
    }
  }

  const parametros = datos?.documento.parametros

  return (
    <Modal
      isOpen={Boolean(documento)}
      onClose={onClose}
      size="xl"
      title={`Revisar · ${documento?.deteccion?.descripcion || documento?.filename || ''}`}
      subtitle={documento?.filename}
    >
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {parametros && usaDolar(parametros) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg bg-gray-900/50 border border-gray-700">
          <label className="block">
            <span className="text-xs text-gray-400">Cotización para los consumos en dólares</span>
            <input
              type="number"
              step="0.01"
              value={dolar}
              onChange={(e) => setDolar(e.target.value)}
              className="input-field w-40 mt-1 !py-1.5"
            />
          </label>
          <button
            onClick={recalcular}
            disabled={cargando || !(Number(dolar) > 0) || Number(dolar) === parametros.valorDolar}
            className="btn-secondary !py-1.5 text-sm disabled:opacity-50"
          >
            Recalcular
          </button>
        </div>
      )}

      {datos && <ControlTotales control={datos.documento.preview?.control} />}

      {cargando && !datos && <p className="text-gray-400">Cargando transacciones...</p>}

      {datos && (
        <div className={cargando ? 'opacity-50 pointer-events-none' : ''}>
          <TransactionEditor
            initialTransactions={datos.transactions}
            archivoYaImportado={datos.documento.archivo_ya_importado}
            limites={datos.limites}
            onSave={(transactions) => onImportar(documento, transactions)}
            onCancel={onClose}
          />
        </div>
      )}
    </Modal>
  )
}

export default RevisarDocumentoModal
