import { formatFecha, formatImporte } from '../../utils/format'

const ESTADOS = {
  listo: { texto: 'Listo para importar', clase: 'bg-primary/20 text-orange-300' },
  importado: { texto: 'Importado', clase: 'bg-green-900/40 text-green-300' },
  no_reconocido: { texto: 'No reconocido', clase: 'bg-yellow-900/40 text-yellow-300' },
  error: { texto: 'Error', clase: 'bg-red-900/40 text-red-300' },
  recibido: { texto: 'Procesando', clase: 'bg-gray-700 text-gray-300' },
  pendiente_descarga: { texto: 'Falta el archivo', clase: 'bg-yellow-900/40 text-yellow-300' },
  descartado: { texto: 'Descartado', clase: 'bg-gray-700 text-gray-400' }
}

const periodoDe = (doc) => {
  const d = doc.deteccion
  if (d?.cierre) return `Cierre ${formatFecha(d.cierre)}`
  const p = d?.periodo || (doc.preview?.desde && doc.preview)
  return p ? `${formatFecha(p.desde)} al ${formatFecha(p.hasta)}` : '—'
}

const Boton = ({ children, onClick, variante = 'secundario', disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
      variante === 'primario' ? 'bg-primary hover:bg-primary-dark text-white'
        : variante === 'peligro' ? 'text-red-400 hover:text-red-300'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
    }`}
  >
    {children}
  </button>
)

// Documentos de la bandeja con su detección, vista previa y acciones según el estado
const DocumentosTable = ({ documentos, ocupado, onRevisar, onImportar, onDescartar, onElegirTipo, onDeshacer }) => {
  if (documentos.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-400">
        La bandeja está vacía. Soltá los resúmenes del mes arriba.
      </div>
    )
  }

  return (
    <div className="card !p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="px-4 py-3 font-medium">Resumen</th>
            <th className="px-4 py-3 font-medium">Período</th>
            <th className="px-4 py-3 font-medium text-right">Transacciones</th>
            <th className="px-4 py-3 font-medium text-right">Gastos nuevos</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {documentos.map(doc => {
            const estado = ESTADOS[doc.estado] || ESTADOS.recibido
            const p = doc.preview
            return (
              <tr key={doc._id} className="border-b border-gray-700/50 align-top">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">
                    {doc.deteccion?.descripcion || (doc.estado === 'pendiente_descarga' ? doc.email?.subject || 'Aviso de resumen' : 'Sin reconocer')}
                  </p>
                  {doc.email?.from && <p className="text-xs text-gray-500">Por mail · {doc.email.from}</p>}
                  <p className="text-xs text-gray-500 truncate max-w-[18rem]" title={doc.filename}>{doc.filename}</p>
                  {doc.archivo_ya_importado && doc.estado !== 'importado' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      Este archivo ya se importó el {formatFecha(doc.archivo_ya_importado.fecha)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{periodoDe(doc)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p ? (
                    <>
                      <span className="text-white">{p.cantidad}</span>
                      {p.duplicados > 0 && <p className="text-xs text-gray-500">{p.duplicados} ya cargadas</p>}
                    </>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-300">{p ? formatImporte(p.gastos) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${estado.clase}`}>{estado.texto}</span>
                  {doc.error && <p className="text-xs text-gray-400 mt-1 max-w-[16rem]">{doc.error}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {doc.estado === 'listo' && (
                      <>
                        <Boton onClick={() => onRevisar(doc)} disabled={ocupado}>Revisar</Boton>
                        <Boton variante="primario" onClick={() => onImportar(doc)} disabled={ocupado || p?.cantidad === p?.duplicados}>
                          Importar
                        </Boton>
                      </>
                    )}
                    {['no_reconocido', 'error'].includes(doc.estado) && (
                      <Boton onClick={() => onElegirTipo(doc)} disabled={ocupado}>Elegir banco</Boton>
                    )}
                    {doc.estado === 'importado' && (
                      <Boton onClick={() => onDeshacer(doc)} disabled={ocupado}>Deshacer</Boton>
                    )}
                    {doc.estado !== 'importado' && (
                      <Boton variante="peligro" onClick={() => onDescartar(doc)} disabled={ocupado}>Descartar</Boton>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DocumentosTable
