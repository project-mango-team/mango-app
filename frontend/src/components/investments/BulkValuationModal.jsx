import { useEffect, useState } from 'react'
import Modal from '../Modal'
import useCotizacionInversion from '../../hooks/useCotizacionInversion'
import { investmentService } from '../../services/investmentService'
import { hoyISO, parseNumeroAR, formatMoney, mensajeError } from '../../utils/format'

// Actualiza el valor de varios activos de una vez, todos con la misma fecha (como completar el Excel)
const BulkValuationModal = ({ isOpen, onClose, activos, onSaved }) => {
  const [fecha, setFecha] = useState(hoyISO())
  const [valores, setValores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const necesitaEuro = activos.some(a => a.moneda === 'EUR')
  const cot = useCotizacionInversion(isOpen ? fecha : null, { necesitaEuro })

  useEffect(() => {
    if (!isOpen) return
    setFecha(hoyISO())
    setValores({})
    setError(null)
  }, [isOpen])

  const cargados = Object.entries(valores).filter(([, v]) => String(v).trim() !== '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const valuaciones = cargados.map(([asset_id, v]) => ({ asset_id, monto: parseNumeroAR(v) }))
    const invalido = valuaciones.find(v => isNaN(v.monto) || v.monto < 0)
    if (invalido) {
      const nombre = activos.find(a => a._id === invalido.asset_id)?.nombre
      setError(`El valor de "${nombre}" no es válido (ej: 1.234,56)`)
      return
    }
    const usd = parseNumeroAR(cot.usd)
    const eur = parseNumeroAR(cot.eur)
    if (!(usd > 0) || (necesitaEuro && !(eur > 0))) {
      setError('Ingresá una cotización válida')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await investmentService.createValuations({
        fecha,
        cotizacion_usd: usd,
        ...(necesitaEuro && { cotizacion_eur: eur }),
        valuaciones
      })
      onSaved()
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron guardar los valores'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Actualizar valores"
      subtitle="Cargá cuánto vale hoy cada activo. Los que dejes vacíos no se tocan."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            type="submit"
            form="bulk-valuation-form"
            disabled={guardando || cot.loading || cargados.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : `Guardar ${cargados.length || ''} valor${cargados.length === 1 ? '' : 'es'}`}
          </button>
        </>
      }
    >
      <form id="bulk-valuation-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-gray-400">Fecha</span>
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={e => setFecha(e.target.value)}
              className="input-field w-full mt-1"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Dólar blue {cot.loading && '· ...'}</span>
            <input
              type="text"
              inputMode="decimal"
              value={cot.usd}
              onChange={e => cot.setUsd(e.target.value)}
              className="input-field w-full mt-1"
            />
          </label>
          {necesitaEuro && (
            <label className="block">
              <span className="text-sm text-gray-400">Euro</span>
              <input
                type="text"
                inputMode="decimal"
                value={cot.eur}
                onChange={e => cot.setEur(e.target.value)}
                className="input-field w-full mt-1"
              />
            </label>
          )}
        </div>
        {cot.error && <p className="text-xs text-yellow-400">{cot.error}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="py-2 font-medium">Activo</th>
              <th className="py-2 font-medium text-right">Valor anterior</th>
              <th className="py-2 pl-4 font-medium w-48">Valor nuevo</th>
            </tr>
          </thead>
          <tbody>
            {activos.map(a => (
              <tr key={a._id} className="border-b border-gray-700/50">
                <td className="py-2">
                  <p className="text-white">{a.nombre}</p>
                  <p className="text-xs text-gray-500">{a.tipo} · {a.moneda}</p>
                </td>
                <td className="py-2 text-right text-gray-400 tabular-nums">{formatMoney(a.resumen.valor_actual, a.moneda)}</td>
                <td className="py-2 pl-4">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valores[a._id] ?? ''}
                    onChange={e => setValores(v => ({ ...v, [a._id]: e.target.value }))}
                    placeholder={a.moneda}
                    className="input-field w-full !py-1.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

export default BulkValuationModal
