import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { investmentService } from '../../services/investmentService'
import { formatMoney, mensajeError } from '../../utils/format'

const fechaCorta = (iso) => iso.split('-').reverse().slice(0, 2).join('/')

// INV-11: busca entre los extractos ya cargados las transacciones "Inversión" que una regla manda a este
// activo y las carga como aportes o retiros. Muestra qué se cargaría antes de guardar.
const BackfillExtractosModal = ({ asset, isOpen, onClose, onImported }) => {
  const [datos, setDatos] = useState(null)
  const [seleccion, setSeleccion] = useState({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelado = false
    setDatos(null)
    setSeleccion({})
    setError(null)
    setResultado(null)
    setCargando(true)
    investmentService.previewBackfill(asset._id)
      .then(({ data }) => {
        if (cancelado) return
        setDatos(data)
        setSeleccion(Object.fromEntries(data.candidatas.map(c => [c.transaction_id, c.crear])))
      })
      .catch(err => !cancelado && setError(mensajeError(err, 'No se pudo buscar en los extractos')))
      .finally(() => !cancelado && setCargando(false))
    return () => { cancelado = true }
  }, [isOpen, asset?._id])

  const elegidas = useMemo(
    () => (datos?.candidatas || []).filter(c => c.crear && seleccion[c.transaction_id]),
    [datos, seleccion]
  )

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await investmentService.aplicarBackfill(asset._id, elegidas.map(c => c.transaction_id))
      setResultado(res.message)
      onImported()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los movimientos'))
    } finally {
      setCargando(false)
    }
  }

  let footer
  if (resultado || (datos && datos.candidatas.length === 0)) {
    footer = <button onClick={onClose} className="btn-primary">Listo</button>
  } else {
    footer = (
      <>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={cargar} disabled={cargando || elegidas.length === 0} className="btn-primary disabled:opacity-50">
          {cargando ? 'Cargando...' : `Cargar ${elegidas.length} movimiento(s)`}
        </button>
      </>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Buscar en extractos ya cargados · ${asset?.nombre || ''}`}
      subtitle="Transacciones de Inversión que tus reglas mandan a este activo y todavía no están en Inversiones"
      footer={footer}
    >
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {cargando && !datos && <p className="text-sm text-gray-400">Buscando...</p>}

      {resultado && <p className="text-sm text-green-400">{resultado}</p>}

      {!resultado && datos && datos.reglas === 0 && (
        <p className="text-sm text-gray-300">
          Ninguna regla manda transacciones a este activo. Creá una regla "Cargar en una inversión" en Reglas de categorización (Inicio) y volvé a probar.
        </p>
      )}

      {!resultado && datos && datos.reglas > 0 && datos.candidatas.length === 0 && (
        <p className="text-sm text-gray-300">No hay transacciones pendientes: todas las que matchean la regla ya están cargadas en este activo.</p>
      )}

      {!resultado && datos && datos.candidatas.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Las marcadas como "ya cargado" coinciden en tipo y monto con un movimiento existente (±3 días) y no se cargan.
            Los movimientos creados quedan sin cuotapartes: completalas con el importador de Fima.
          </p>
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 pr-3" />
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Detalle</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium text-right">Monto</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {datos.candidatas.map(c => (
                  <tr key={c.transaction_id} className={`border-b border-gray-700/50 ${seleccion[c.transaction_id] && c.crear ? '' : 'opacity-50'}`}>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        disabled={!c.crear}
                        checked={Boolean(c.crear && seleccion[c.transaction_id])}
                        onChange={() => setSeleccion(s => ({ ...s, [c.transaction_id]: !s[c.transaction_id] }))}
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300 tabular-nums">{c.fecha}</td>
                    <td className="py-1.5 pr-3 text-gray-300 truncate max-w-[16rem]">{c.detalle}</td>
                    <td className={`py-1.5 pr-3 ${c.tipo === 'Aporte' ? 'text-green-300' : 'text-red-300'}`}>{c.tipo}</td>
                    <td className="py-1.5 pr-3 text-right text-white tabular-nums">{c.monto != null ? formatMoney(c.monto, asset.moneda) : ''}</td>
                    <td className="py-1.5 text-xs text-gray-500">
                      {c.error || (c.duplicado ? `ya cargado el ${fechaCorta(c.duplicado.fecha)}` : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default BackfillExtractosModal
