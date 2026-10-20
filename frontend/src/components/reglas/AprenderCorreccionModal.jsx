import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { ruleService } from '../../services/ruleService'
import { formatImporte, mensajeError } from '../../utils/format'

// REV-03: después de cambiar la categoría de una transacción, ofrece crear una regla para las
// futuras parecidas y aplicarla a las ya cargadas (con deshacer).
// Pasos: 'regla' → 'cargadas' (si hay coincidencias) → 'listo'
const AprenderCorreccionModal = ({ transaccion, onClose, onCambios }) => {
  const [paso, setPaso] = useState('regla')
  const [texto, setTexto] = useState('')
  const [mismoOrigen, setMismoOrigen] = useState(true)
  const [mismoTipo, setMismoTipo] = useState(true)
  const [regla, setRegla] = useState(null)
  const [coincidencias, setCoincidencias] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  // Inicio se recarga al cerrar: recargar antes desmonta este modal (Inicio muestra "cargando")
  const [huboCambios, setHuboCambios] = useState(false)

  useEffect(() => {
    if (!transaccion) return
    setPaso('regla')
    setRegla(null)
    setCoincidencias(null)
    setResultado(null)
    setError(null)
    setHuboCambios(false)
    setTexto(transaccion.detalle || '')
    ruleService.patron(transaccion.detalle)
      .then(res => res.data.texto && setTexto(res.data.texto))
      .catch(() => {})
  }, [transaccion])

  const ejecutar = async (fn) => {
    try {
      setOcupado(true)
      setError(null)
      await fn()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo completar'))
    } finally {
      setOcupado(false)
    }
  }

  const crearRegla = () => ejecutar(async () => {
    const res = await ruleService.create({
      condiciones: {
        detalle: { modo: 'contiene', valores: [texto.trim()].filter(Boolean) },
        origen: mismoOrigen ? transaccion.origen : null,
        tipo: mismoTipo ? transaccion.tipo : null
      },
      accion: { tipo: 'categoria', categoria: transaccion.categoria },
      creada_por: 'aprendida'
    })
    setRegla(res.data)
    const coinc = await ruleService.coincidencias(res.data._id)
    setCoincidencias(coinc.data)
    setPaso(coinc.data.total > 0 ? 'cargadas' : 'listo')
  })

  const aplicar = () => ejecutar(async () => {
    const res = await ruleService.aplicar(regla._id)
    setResultado(res.data)
    setPaso('listo')
    setHuboCambios(true)
  })

  const deshacer = () => ejecutar(async () => {
    await ruleService.deshacer(resultado.cambios)
    setResultado({ ...resultado, deshecho: true })
  })

  if (!transaccion) return null

  const cerrar = () => {
    onClose()
    if (huboCambios) onCambios?.()
  }

  const botonSec = 'px-4 py-2 text-sm text-gray-300 hover:text-white'
  const botonPri = 'px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded disabled:opacity-50'

  const footer = {
    regla: (
      <>
        <button onClick={cerrar} className={botonSec}>No, solo esta</button>
        <button onClick={crearRegla} disabled={ocupado || !texto.trim()} className={botonPri}>
          {ocupado ? 'Creando…' : 'Crear regla'}
        </button>
      </>
    ),
    cargadas: (
      <>
        <button onClick={cerrar} className={botonSec}>No, solo las futuras</button>
        <button onClick={aplicar} disabled={ocupado} className={botonPri}>
          {ocupado ? 'Actualizando…' : `Cambiar ${coincidencias?.total} a ${transaccion.categoria}`}
        </button>
      </>
    ),
    listo: <button onClick={cerrar} className={botonPri}>Listo</button>
  }[paso]

  return (
    <Modal
      isOpen
      onClose={cerrar}
      title="¿Aplicar a las parecidas?"
      subtitle={<>Cambiaste <span className="text-gray-200">“{transaccion.detalle}”</span> a <span className="text-primary">{transaccion.categoria}</span>.</>}
      footer={<div className="flex justify-end gap-2">{footer}</div>}
    >
      <div className="space-y-4 text-sm">
        {paso === 'regla' && (
          <>
            <p className="text-gray-300">Creá una regla para que las próximas importaciones las categoricen solas.</p>
            <label className="block">
              <span className="block text-xs font-medium text-gray-400 mb-1">El detalle contiene</span>
              <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} className="input-field w-full" />
            </label>
            <div className="flex flex-col gap-2 text-gray-300">
              {transaccion.origen && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={mismoOrigen} onChange={(e) => setMismoOrigen(e.target.checked)} />
                  Solo de {transaccion.origen}
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mismoTipo} onChange={(e) => setMismoTipo(e.target.checked)} />
                Solo si es {transaccion.tipo === 'Ingreso' ? 'ingreso' : 'gasto'}
              </label>
            </div>
          </>
        )}

        {paso === 'cargadas' && coincidencias && (
          <>
            <p className="text-green-400">Regla creada.</p>
            <p className="text-gray-300">
              {coincidencias.total === 1
                ? '¿Y a la otra ya cargada que coincide? Hoy tiene otra categoría:'
                : `¿Y a las ${coincidencias.total} ya cargadas que coinciden? Hoy tienen otra categoría:`}
            </p>
            <ul className="space-y-1 rounded border border-gray-700 bg-gray-900/40 p-3">
              {coincidencias.ejemplos.map(t => (
                <li key={t._id} className="flex justify-between gap-3 text-gray-300">
                  <span className="truncate">{t.fecha} · {t.detalle}</span>
                  <span className="whitespace-nowrap text-gray-400">{t.categoria} · {formatImporte(t.importe)}</span>
                </li>
              ))}
              {coincidencias.total > coincidencias.ejemplos.length && (
                <li className="text-xs text-gray-500">y {coincidencias.total - coincidencias.ejemplos.length} más</li>
              )}
            </ul>
          </>
        )}

        {paso === 'listo' && (
          <>
            <p className="text-green-400">
              {resultado
                ? (resultado.deshecho
                    ? 'Listo, volvieron a su categoría anterior. La regla sigue para las futuras.'
                    : `Regla creada y ${resultado.modificadas === 1 ? '1 transacción pasada' : `${resultado.modificadas} transacciones pasadas`} a ${transaccion.categoria}.`)
                : 'Regla creada. No hay otras ya cargadas que cambiar.'}
            </p>
            {resultado && !resultado.deshecho && resultado.modificadas > 0 && (
              <button onClick={deshacer} disabled={ocupado} className="text-sm text-primary hover:underline disabled:opacity-50">
                Deshacer ese cambio
              </button>
            )}
            <p className="text-xs text-gray-500">La podés editar o borrar en Reglas de categorización (⚙ en Categorías).</p>
          </>
        )}

        {error && <p className="text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}

export default AprenderCorreccionModal
