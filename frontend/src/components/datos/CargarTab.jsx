import { Link } from 'react-router-dom'
import useCargaResumen from '../../hooks/useCargaResumen'
import TransactionEditor from '../TransactionEditor'
import FormularioResumen from './FormularioResumen'

const CargarTab = () => {
  const carga = useCargaResumen()
  const {
    message,
    previewData,
    showEditor,
    saving,
    handleSaveTransactions,
    handleCancelEditor
  } = carga

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

      {!showEditor && <FormularioResumen carga={carga} />}
    </div>
  )
}

export default CargarTab
