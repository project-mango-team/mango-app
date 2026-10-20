import { useState } from 'react'
import useBandeja from '../hooks/useBandeja'
import BandejaDropzone from '../components/bandeja/BandejaDropzone'
import DocumentosTable from '../components/bandeja/DocumentosTable'
import RevisarDocumentoModal from '../components/bandeja/RevisarDocumentoModal'
import ElegirTipoModal from '../components/bandeja/ElegirTipoModal'
import ConfirmModal from '../components/ConfirmModal'

// Bandeja de resúmenes: soltar todos los archivos del mes, revisar e importar
const Bandeja = () => {
  const bandeja = useBandeja()
  const [revisando, setRevisando] = useState(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(null)
  const [deshaciendo, setDeshaciendo] = useState(null)

  const listos = bandeja.documentos.filter(d => d.estado === 'listo')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Bandeja</h1>
          <p className="text-gray-400 mt-1">Los resúmenes que entran quedan acá para revisar e importar</p>
        </div>
        {listos.length > 0 && (
          <button onClick={bandeja.importarListos} disabled={bandeja.ocupado} className="btn-primary disabled:opacity-50">
            Importar {listos.length} listo{listos.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <BandejaDropzone onArchivos={bandeja.subir} deshabilitado={bandeja.ocupado} />

      {bandeja.mensaje && (
        <div className={`p-3 rounded-lg text-sm border ${
          bandeja.mensaje.tipo === 'error' ? 'border-red-800 bg-red-900/20 text-red-300' : 'border-green-800 bg-green-900/20 text-green-300'
        }`}>
          {bandeja.mensaje.texto}
        </div>
      )}

      {bandeja.loading ? (
        <p className="text-gray-400">Cargando bandeja...</p>
      ) : (
        <DocumentosTable
          documentos={bandeja.documentos}
          ocupado={bandeja.ocupado}
          onRevisar={setRevisando}
          onImportar={(doc) => bandeja.importar(doc._id)}
          onDescartar={(doc) => bandeja.descartar(doc._id)}
          onElegirTipo={setEligiendoTipo}
          onDeshacer={setDeshaciendo}
        />
      )}

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
        message={deshaciendo && `Se van a borrar las transacciones importadas de "${deshaciendo.filename}". El documento vuelve a la bandeja para importarlo de nuevo.`}
        confirmText="Deshacer"
      />
    </div>
  )
}

export default Bandeja
