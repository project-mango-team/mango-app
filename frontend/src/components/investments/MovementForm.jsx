import { useState } from 'react'
import useCotizacionInversion from '../../hooks/useCotizacionInversion'
import { hoyISO, parseNumeroAR, toInputAR, formatMoney } from '../../utils/format'
import { usaUnidades, unidadesAInput } from './valuacion'

const TIPOS = [
  { value: 'Aporte', label: 'Aporte', ayuda: 'Plata que pusiste: compra, depósito, suscripción.' },
  { value: 'Retiro', label: 'Retiro', ayuda: 'Plata que sacaste: venta, rescate, dividendo cobrado.' },
  { value: 'Valuacion', label: 'Valuación', ayuda: 'Cuánto vale el activo en total a esa fecha.' }
]

/**
 * Form de alta/edición de un movimiento.
 * `inicial` puede ser un movimiento existente (editar) o valores por defecto ({ tipo, monto }).
 */
const MovementForm = ({ asset, inicial = null, onSubmit, onCancel, submitLabel = 'Guardar' }) => {
  const esEdicion = Boolean(inicial?._id)
  const fechaInicial = inicial?.fecha ? String(inicial.fecha).slice(0, 10) : hoyISO()

  const [tipo, setTipo] = useState(inicial?.tipo || 'Aporte')
  const [fecha, setFecha] = useState(fechaInicial)
  const [monto, setMonto] = useState(toInputAR(inicial?.monto))
  const [notas, setNotas] = useState(inicial?.notas || '')
  const [unidades, setUnidades] = useState(unidadesAInput(inicial?.unidades))
  const conUnidades = usaUnidades(asset.fuente_precio) || inicial?.unidades != null
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const necesitaEuro = asset.moneda === 'EUR'
  const cot = useCotizacionInversion(fecha, {
    necesitaEuro,
    inicial: esEdicion ? { ...inicial, fecha: fechaInicial } : null
  })

  const montoNum = parseNumeroAR(monto)
  const usdNum = parseNumeroAR(cot.usd)
  const eurNum = parseNumeroAR(cot.eur)
  const equivalente = !isNaN(montoNum) && usdNum > 0
    ? asset.moneda === 'ARS'
      ? formatMoney(montoNum / usdNum, 'USD')
      : formatMoney(montoNum * (asset.moneda === 'EUR' ? eurNum : usdNum), 'ARS')
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isNaN(montoNum) || montoNum < 0) {
      setError('Ingresá un monto válido (ej: 1.234,56)')
      return
    }
    if (!(usdNum > 0) || (necesitaEuro && !(eurNum > 0))) {
      setError('Ingresá una cotización válida')
      return
    }
    const unidadesNum = unidades.trim() ? parseNumeroAR(unidades) : null
    if (unidadesNum !== null && (isNaN(unidadesNum) || unidadesNum < 0)) {
      setError('Ingresá unidades válidas (ej: 208,4)')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await onSubmit({
        tipo,
        fecha,
        monto: montoNum,
        cotizacion_usd: usdNum,
        ...(necesitaEuro && { cotizacion_eur: eurNum }),
        ...(conUnidades && { unidades: unidadesNum }),
        notas
      })
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo guardar el movimiento')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="grid grid-cols-3 rounded-lg border border-gray-600 overflow-hidden">
          {TIPOS.map(t => (
            <button
              type="button"
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={`py-2 text-sm font-medium transition-colors ${
                tipo === t.value ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">{TIPOS.find(t => t.value === tipo).ayuda}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <span className="text-sm text-gray-400">Monto ({asset.moneda})</span>
          <input
            type="text"
            inputMode="decimal"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="ej: 1.234,56"
            className="input-field w-full mt-1"
            autoFocus
            required
          />
          {equivalente && <span className="text-xs text-gray-500">≈ {equivalente}</span>}
        </label>
      </div>

      <div className={`grid gap-3 ${necesitaEuro ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <label className="block">
          <span className="text-sm text-gray-400">Dólar blue (promedio) {cot.loading && '· buscando...'}</span>
          <input
            type="text"
            inputMode="decimal"
            value={cot.usd}
            onChange={e => cot.setUsd(e.target.value)}
            className="input-field w-full mt-1"
            required
          />
        </label>
        {necesitaEuro && (
          <label className="block">
            <span className="text-sm text-gray-400">Euro (promedio)</span>
            <input
              type="text"
              inputMode="decimal"
              value={cot.eur}
              onChange={e => cot.setEur(e.target.value)}
              className="input-field w-full mt-1"
              required
            />
          </label>
        )}
      </div>
      {cot.error && <p className="text-xs text-yellow-400">{cot.error}</p>}

      <div className={`grid gap-3 ${conUnidades ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
        {conUnidades && (
          <label className="block">
            <span className="text-sm text-gray-400">Unidades (opcional)</span>
            <input
              type="text"
              inputMode="decimal"
              value={unidades}
              onChange={e => setUnidades(e.target.value)}
              placeholder={tipo === 'Valuacion' ? 'tenencia total' : 'ej: 208,4'}
              className="input-field w-full mt-1"
            />
          </label>
        )}
        <label className={`block ${conUnidades ? 'sm:col-span-2' : ''}`}>
          <span className="text-sm text-gray-400">Notas (opcional)</span>
          <input
            type="text"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            className="input-field w-full mt-1"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        )}
        <button type="submit" disabled={guardando || cot.loading} className="btn-primary disabled:opacity-50">
          {guardando ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default MovementForm
