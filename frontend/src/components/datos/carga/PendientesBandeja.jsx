import { useState } from 'react'
import DocumentosTable from '../../bandeja/DocumentosTable'
import RevisarDocumentoModal from '../../bandeja/RevisarDocumentoModal'
import ElegirTipoModal from '../../bandeja/ElegirTipoModal'

// Resúmenes pendientes (llegados por mail, API o subidos acá): revisar, importar o descartar.
// Lo ya importado no se repite acá: vive en el historial de cargas.
const ESTADOS_CERRADOS = ['importado', 'resuelto', 'descartado']

const PendientesBandeja = ({ bandeja }) => {
  const [revisando, setRevisando] = useState(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(null)

  if (bandeja.loading) return <p className="text-gray-400">Cargando pendientes...</p>

  return (
    <>
      <DocumentosTable
        documentos={bandeja.documentos.filter(d => !ESTADOS_CERRADOS.includes(d.estado))}
        ocupado={bandeja.ocupado}
        onRevisar={setRevisando}
        onImportar={(doc) => bandeja.importar(doc._id)}
        onDescartar={(doc) => bandeja.descartar(doc._id)}
        onElegirTipo={setEligiendoTipo}
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
    </>
  )
}

export default PendientesBandeja
