import { useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import { investmentService } from '../../services/investmentService'
import { formatMoney, formatFecha, mensajeError } from '../../utils/format'
import { formatUnidades } from './valuacion'

const COLOR_ESTADO = {
  Realizada: 'bg-green-900/40 text-green-300',
  'En proceso': 'bg-yellow-900/40 text-yellow-300',
  Anulada: 'bg-gray-700 text-gray-400'
}

// Importa aportes y retiros pegando el listado de operaciones de la app de Fima
const ImportMovementsModal = ({ asset, isOpen, onClose, onImported }) => {
  const [texto, setTexto] = useState('')
  const [operaciones, setOperaciones] = useState(null)
  const [erroresParseo, setErroresParseo] = useState([])
  const [seleccion, setSeleccion] = useState({})
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setTexto('')
    setOperaciones(null)
    setErroresParseo([])
    setSeleccion({})
    setError(null)
    setResultado(null)
  }, [isOpen])

  const leerArchivo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setTexto(String(reader.result))
    reader.readAsText(file)
  }

  const previsualizar = async () => {
    setCargando(true)
    setError(null)
    try {
      const { data } = await investmentService.previewImport(asset._id, texto)
      setOperaciones(data.operaciones)
      setErroresParseo(data.errores)
      // Por defecto: todo lo nuevo que no esté anulado
      setSeleccion(Object.fromEntries(data.operaciones.map((op, i) => [i, !op.duplicado && op.estado !== 'Anulada'])))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo leer el texto'))
    } finally {
      setCargando(false)
    }
  }

  const elegidas = useMemo(
    () => (operaciones || []).filter((_, i) => seleccion[i]),
    [operaciones, seleccion]
  )
  const totales = useMemo(() => elegidas.reduce(
    (acc, op) => ({ ...acc, [op.tipo]: acc[op.tipo] + op.monto }),
    { Aporte: 0, Retiro: 0 }
  ), [elegidas])
  const primeraFecha = elegidas.length ? elegidas.map(op => op.fecha).sort()[0] : null
  // Ya cargadas sin cuotapartes: se completan siempre, no hace falta tildarlas
  const aCompletar = useMemo(() => (operaciones || []).filter(op => op.completa_unidades), [operaciones])

  const importar = async () => {
    setCargando(true)
    setError(null)
    try {
      const movimientos = elegidas.map(op => ({
        fecha: op.fecha,
        tipo: op.tipo,
        monto: op.monto,
        unidades: op.cuotapartes,
        notas: 'Importado de Fima'
      }))
      const completar = aCompletar.map(op => ({ fecha: op.fecha, tipo: op.tipo, monto: op.monto, unidades: op.cuotapartes }))
      const res = await investmentService.importMovements(asset._id, movimientos, completar)
      setResultado({ cantidad: res.count, completados: res.completados || 0, primeraFecha })
      onImported()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron importar los movimientos'))
    } finally {
      setCargando(false)
    }
  }

  const todas = operaciones?.length > 0 && operaciones.every((_, i) => seleccion[i])
  const alternarTodas = () => setSeleccion(Object.fromEntries(operaciones.map((_, i) => [i, !todas])))

  let footer
  if (resultado) {
    footer = <button onClick={onClose} className="btn-primary">Listo</button>
  } else if (operaciones) {
    footer = (
      <>
        <button onClick={() => setOperaciones(null)} className="btn-secondary">Volver</button>
        <button
          onClick={importar}
          disabled={cargando || (elegidas.length === 0 && aCompletar.length === 0)}
          className="btn-primary disabled:opacity-50"
        >
          {cargando
            ? 'Importando...'
            : elegidas.length === 0 && aCompletar.length > 0
              ? `Completar cuotapartes de ${aCompletar.length}`
              : `Importar ${elegidas.length} movimiento(s)`}
        </button>
      </>
    )
  } else {
    footer = (
      <>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={previsualizar} disabled={cargando || !texto.trim()} className="btn-primary disabled:opacity-50">
          {cargando ? 'Leyendo...' : 'Previsualizar'}
        </button>
      </>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Importar movimientos · ${asset?.nombre || ''}`}
      subtitle="Pegá el listado de operaciones de la app de Fima o subí el .txt"
      footer={footer}
    >
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {resultado ? (
        <div className="space-y-3 text-sm text-gray-300">
          <p className="text-green-400 font-medium">Se importaron {resultado.cantidad} movimiento(s).</p>
          {resultado.completados > 0 && (
            <p>Se completaron las cuotapartes de {resultado.completados} movimiento(s) que ya estaban cargados.</p>
          )}
          <p>Para que el rendimiento salga bien te falta:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Una <span className="text-white">Valuación</span> con el saldo de hoy (botón "Actualizar valor").</li>
            {resultado.primeraFecha && (
              <li>
                Si ya tenías plata en el fondo antes del {formatFecha(resultado.primeraFecha)}, un{' '}
                <span className="text-white">Aporte</span> o una <span className="text-white">Valuación</span> con ese saldo, fechado el día anterior.
              </li>
            )}
          </ul>
        </div>
      ) : !operaciones ? (
        <div className="space-y-3">
          <input type="file" accept=".txt,text/plain" onChange={leerArchivo} className="text-sm text-gray-300" />
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={12}
            placeholder={'2026/10/01\nCuenta Fima\nRetirar\nRealizada\n208,40\n$85,409772\n$17.800,00\n...'}
            className="input-field w-full font-mono text-xs"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="card !p-3">
              <p className="text-gray-400 text-xs">Aportes</p>
              <p className="text-white font-semibold">{formatMoney(totales.Aporte, asset.moneda)}</p>
            </div>
            <div className="card !p-3">
              <p className="text-gray-400 text-xs">Retiros</p>
              <p className="text-white font-semibold">{formatMoney(totales.Retiro, asset.moneda)}</p>
            </div>
            <div className="card !p-3">
              <p className="text-gray-400 text-xs">Neto</p>
              <p className="text-white font-semibold">{formatMoney(totales.Aporte - totales.Retiro, asset.moneda, { signo: true })}</p>
            </div>
          </div>

          {erroresParseo.length > 0 && (
            <p className="text-xs text-yellow-400">No se pudieron leer {erroresParseo.length} bloque(s): {erroresParseo.join(', ')}</p>
          )}
          {operaciones.some(op => op.duplicado) && (
            <p className="text-xs text-gray-400">
              Las marcadas como "ya cargada" coinciden en fecha, tipo y monto con un movimiento existente y quedan sin tildar.
              {aCompletar.length > 0 && ` A ${aCompletar.length} de ellas les faltan las cuotapartes: se completan al importar.`}
            </p>
          )}

          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 pr-3">
                    <input type="checkbox" checked={todas} onChange={alternarTodas} aria-label="Elegir todas" />
                  </th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Cuotapartes</th>
                  <th className="py-2 pr-3 font-medium text-right">Monto</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {operaciones.map((op, i) => (
                  <tr key={i} className={`border-b border-gray-700/50 ${seleccion[i] ? '' : 'opacity-50'}`}>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        checked={Boolean(seleccion[i])}
                        onChange={() => setSeleccion(s => ({ ...s, [i]: !s[i] }))}
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-gray-300 tabular-nums">{formatFecha(op.fecha)}</td>
                    <td className={`py-1.5 pr-3 ${op.tipo === 'Aporte' ? 'text-green-300' : 'text-red-300'}`}>{op.tipo}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${COLOR_ESTADO[op.estado]}`}>{op.estado}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums">{op.cuotapartes ? formatUnidades(op.cuotapartes) : ''}</td>
                    <td className="py-1.5 pr-3 text-right text-white tabular-nums">{formatMoney(op.monto, asset.moneda)}</td>
                    <td className="py-1.5 text-xs text-gray-500">
                      {op.duplicado && (op.completa_unidades ? 'ya cargada · completa cuotapartes' : 'ya cargada')}
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

export default ImportMovementsModal
