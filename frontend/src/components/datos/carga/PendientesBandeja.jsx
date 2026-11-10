import { useState } from 'react'
import DocumentosTable from '../../bandeja/DocumentosTable'
import RevisarDocumentoModal from '../../bandeja/RevisarDocumentoModal'
import ElegirTipoModal from '../../bandeja/ElegirTipoModal'
import ConfirmModal from '../../ConfirmModal'

// Lista de resúmenes pendientes (llegados por mail, API o subidos acá) con revisar, importar, descartar y deshacer
const PendientesBandeja = ({ bandeja }) => {
  const [revisando, setRevisando] = useState(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(null)
  const [deshaciendo, setDeshaciendo] = useState(null)

  if (bandeja.loading) return <p className="text-gray-400">Cargando pendientes...</p>

  return (
    <>
      <DocumentosTable
        documentos={bandeja.documentos}
        ocupado={bandeja.ocupado}
        onRevisar={setRevisando}
        onImportar={(doc) => bandeja.importar(doc._id)}
        onDescartar={(doc) => bandeja.descartar(doc._id)}
        onElegirTipo={setEligiendoTipo}
        onDeshacer={setDeshaciendo}
      />

      <RevisarDocumentoModal
        documento={revisando}
        onClose={() => setRevisando(null)}
        onImportar={async (doc, transactions) => {
          const res = await bandeja.importar(doc._id, transactions)
          if (res) setRevisando(null)
        }}
      />

      <ElegirTipoModal
        documento={eligiendoTipo}
        onClose={() => setEligiendoTipo(null)}
        onGuardar={async (doc, parametros) => {
          setEligiendoTipo(null)
          await bandeja.actualizarParametros(doc._id, parametros)
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deshaciendo)}
        onClose={() => setDeshaciendo(null)}
        onConfirm={() => bandeja.deshacer(deshaciendo.operation_id)}
        type="danger"
        title="Deshacer importación"
        message={deshaciendo && `Se van a borrar las transacciones importadas de "${deshaciendo.filename}". El documento vuelve a la lista para importarlo de nuevo.`}
        confirmText="Deshacer"
      />
    </>
  )
}

export default PendientesBandeja
