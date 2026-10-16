import { useEffect, useState } from 'react'
import Modal from '../Modal'
import useCotizacionInversion from '../../hooks/useCotizacionInversion'
import { loanService } from '../../services/loanService'
import { hoyISO, parseNumeroAR, toInputAR, formatMoney, mensajeError } from '../../utils/format'

const TIPOS = [
  { value: 'Prestamo', label: 'Préstamo' },
  { value: 'Devolucion', label: 'Devolución' }
]

/**
 * Alta/edición de un préstamo o devolución.
 * `inicial`: movimiento existente (editar) o valores por defecto ({ tipo, deudor }).
 * `deudores`: [{ deudor, saldo_usd }] para autocompletar y mostrar el saldo pendiente.
 */
const LoanMovementModal = ({ isOpen, onClose, inicial, deudores, onSaved }) => {
  const esEdicion = Boolean(inicial?._id)
  const fechaInicial = inicial?.fecha ? String(inicial.fecha).slice(0, 10) : hoyISO()

  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setForm({
      tipo: inicial?.tipo || 'Prestamo',
      deudor: inicial?.deudor || '',
      concepto: inicial?.concepto || '',
      fecha: fechaInicial,
      moneda: inicial?.moneda || 'USD',
      monto: toInputAR(inicial?.monto)
    })
    setError(null)
  }, [isOpen, inicial, fechaInicial])

  const cot = useCotizacionInversion(isOpen ? form.fecha : null, {
    inicial: esEdicion ? { ...inicial, fecha: fechaInicial } : null
  })

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const deudorActual = deudores.find(d => d.deudor.trim().toLowerCase() === (form.deudor || '').trim().toLowerCase())
  // Al editar una devolución, su propio monto ya está descontado del saldo
  const saldoUsd = (deudorActual?.saldo_usd || 0) + (esEdicion && inicial.tipo === 'Devolucion' ? inicial.monto_usd : 0)
  const montoNum = parseNumeroAR(form.monto)
  const usdNum = parseNumeroAR(cot.usd)

  const devolvioTodo = () => {
    const monto = form.moneda === 'USD' ? saldoUsd : saldoUsd * usdNum
    setForm(f => ({ ...f, monto: toInputAR(monto) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresá un monto válido (ej: 1.234,56)')
      return
    }
    if (!(usdNum > 0)) {
      setError('Ingresá una cotización válida')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const datos = { ...form, monto: montoNum, cotizacion_usd: usdNum }
      if (esEdicion) await loanService.updateMovement(inicial._id, datos)
      else await loanService.createMovement(datos)
      onSaved()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  const titulo = esEdicion ? 'Editar movimiento' : form.tipo === 'Devolucion' ? 'Registrar devolución' : 'Nuevo préstamo'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titulo}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="loan-form" disabled={guardando || cot.loading} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="loan-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 rounded-lg border border-gray-600 overflow-hidden">
          {TIPOS.map(t => (
            <button
              type="button"
              key={t.value}
              onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
              className={`py-2 text-sm font-medium transition-colors ${
                form.tipo === t.value ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-gray-400">{form.tipo === 'Devolucion' ? 'Quién devuelve' : 'A quién'}</span>
            <input
              type="text"
              list="deudores-prestamos"
              value={form.deudor || ''}
              onChange={set('deudor')}
              className="input-field w-full mt-1"
              autoFocus={!form.deudor}
              required
            />
            <datalist id="deudores-prestamos">
              {deudores.map(d => <option key={d.deudor} value={d.deudor} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Concepto</span>
            <input
              type="text"
              value={form.concepto || ''}
              onChange={set('concepto')}
              placeholder="ej: cambio USD, escritura"
              className="input-field w-full mt-1"
            />
          </label>
        </div>

        {form.tipo === 'Devolucion' && form.deudor && (
          <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700">
            <span className="text-gray-400">
              Saldo pendiente: <span className="text-white">{formatMoney(saldoUsd, 'USD')}</span>
            </span>
            {saldoUsd > 0 && usdNum > 0 && (
              <button type="button" onClick={devolvioTodo} className="text-primary hover:underline">
                Devolvió todo
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-gray-400">Fecha</span>
            <input
              type="date"
              value={form.fecha || ''}
              max={hoyISO()}
              onChange={set('fecha')}
              className="input-field w-full mt-1"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Moneda</span>
            <select value={form.moneda || 'USD'} onChange={set('moneda')} className="input-field w-full mt-1">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-sm text-gray-400">Monto</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.monto || ''}
              onChange={set('monto')}
              placeholder="ej: 1.234,56"
              className="input-field w-full mt-1"
              required
            />
            {form.moneda === 'ARS' && montoNum > 0 && usdNum > 0 && (
              <span className="text-xs text-gray-500">≈ {formatMoney(montoNum / usdNum, 'USD')}</span>
            )}
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-400">Dólar blue (promedio) {cot.loading && '· buscando...'}</span>
          <input
            type="text"
            inputMode="decimal"
            value={cot.usd}
            onChange={e => cot.setUsd(e.target.value)}
            className="input-field w-full mt-1"
          />
          <span className="text-xs text-gray-500">
            {form.moneda === 'ARS' ? 'Convierte el monto a USD: el saldo se lleva en dólares.' : 'Queda como referencia del día.'}
          </span>
        </label>
        {cot.error && <p className="text-xs text-yellow-400">{cot.error}</p>}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

export default LoanMovementModal
