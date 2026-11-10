import TransactionEditor from '../../TransactionEditor'
import FormularioResumen from '../FormularioResumen'

// Carga a mano: un archivo con banco, tipo, cotización y tarjetas elegidos a mano, o transacciones tipeadas.
// Tras elegir el archivo muestra el editor de vista previa; al guardar vuelve a la pantalla principal.
const CargaArchivoManual = ({ carga, onVolver }) => {
  const { previewData, showEditor, saving, handleSaveTransactions, handleCancelEditor } = carga

  return (
    <div className="space-y-4">
      <button onClick={onVolver} className="text-sm text-gray-400 hover:text-white">← Volver a cargar archivos</button>

      {showEditor && previewData ? (
        <div className="card">
          {saving ? (
            <div className="text-center py-8 text-gray-400">Guardando transacciones...</div>
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
      ) : (
        <FormularioResumen carga={carga} />
      )}
    </div>
  )
}

export default CargaArchivoManual
