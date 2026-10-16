import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Modal from '../Modal'
import ConfirmModal from '../ConfirmModal'
import MovementForm from './MovementForm'
import ImportMovementsModal from './ImportMovementsModal'
import { investmentService } from '../../services/investmentService'
import { formatMoney, formatPercent, formatFecha, mensajeError } from '../../utils/format'

const ETIQUETA_TIPO = { Aporte: 'Aporte', Retiro: 'Retiro', Valuacion: 'Valuación' }
const COLOR_TIPO = {
  Aporte: 'bg-green-900/40 text-green-300',
  Retiro: 'bg-red-900/40 text-red-300',
  Valuacion: 'bg-blue-900/40 text-blue-300'
}

// Valor del activo (moneda original) después de cada movimiento, en orden cronológico
const serieValor = (movimientosDesc) => {
  let valor = 0
  return [...movimientosDesc].reverse().map(m => {
    if (m.tipo === 'Valuacion') valor = m.monto
    else if (m.tipo === 'Aporte') valor += m.monto
    else valor -= m.monto
    return { fecha: formatFecha(m.fecha), valor }
  })
}

const Stat = ({ label, value, hint, className = 'text-white' }) => (
  <div>
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`text-lg font-semibold tabular-nums ${className}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
)

// Detalle de un activo: resumen, gráfico de valor y movimientos (alta, edición, borrado)
const AssetDetailModal = ({ assetId, onClose, onChanged, onEdit, moneda, iniciarConAporte = false }) => {
  const [asset, setAsset] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null) // null | { inicial, titulo }
  const [confirmar, setConfirmar] = useState(null) // null | { tipo: 'mov' | 'activo', mov? }
  const [importando, setImportando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const { data } = await investmentService.getAsset(assetId)
      setAsset(data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el activo'))
    }
  }, [assetId])

  useEffect(() => {
    if (!assetId) return
    setAsset(null)
    setError(null)
    setForm(iniciarConAporte ? { inicial: { tipo: 'Aporte' }, titulo: 'Primer aporte' } : null)
    cargar()
  }, [assetId, iniciarConAporte, cargar])

  const serie = useMemo(() => (asset ? serieValor(asset.movimientos) : []), [asset])

  const guardarMovimiento = async (datos) => {
    if (form.inicial?._id) {
      await investmentService.updateMovement(asset._id, form.inicial._id, datos)
    } else {
      await investmentService.createMovement(asset._id, datos)
    }
    setForm(null)
    await cargar()
    onChanged()
  }

  const borrar = async () => {
    try {
      if (confirmar.tipo === 'mov') {
        await investmentService.deleteMovement(asset._id, confirmar.mov._id)
        await cargar()
        onChanged()
      } else {
        await investmentService.deleteAsset(asset._id)
        onChanged()
        onClose()
      }
    } catch (err) {
      setError(mensajeError(err, 'No se pudo borrar'))
    }
  }

  const s = moneda.toLowerCase()
  const r = asset?.resumen

  return (
    <>
      <Modal
        isOpen={Boolean(assetId)}
        onClose={onClose}
        size="xl"
        title={asset?.nombre || 'Cargando...'}
        subtitle={asset && [asset.tipo, asset.renta !== 'N/A' && asset.renta, asset.plataforma, asset.moneda].filter(Boolean).join(' · ')}
      >
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {!asset ? (
          !error && <p className="text-gray-400">Cargando...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label={`Valor actual (${asset.moneda})`} value={formatMoney(r.valor_actual, asset.moneda)} />
              <Stat
                label="Aporte neto"
                value={formatMoney(r[`aporte_neto_${s}`], moneda)}
                hint={`Aportes ${formatMoney(r[`aportado_${s}`], moneda)} · Retiros ${formatMoney(r[`retirado_${s}`], moneda)}`}
              />
              <Stat
                label="Capital promedio"
                value={formatMoney(r[`capital_promedio_${s}`], moneda)}
                hint="Plata invertida en promedio; base del %"
              />
              <Stat
                label="Ganancia"
                value={`${formatMoney(r[`ganancia_${s}`], moneda, { signo: true })} (${formatPercent(r[`rendimiento_${s}`])})`}
                className={r[`ganancia_${s}`] > 0 ? 'text-green-400' : r[`ganancia_${s}`] < 0 ? 'text-red-400' : 'text-white'}
              />
            </div>

            {serie.length >= 2 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="valorActivo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#db681d" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#db681d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="fecha" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [formatMoney(v, asset.moneda), 'Valor']}
                    />
                    <Area type="linear" dataKey="valor" stroke="#db681d" strokeWidth={2} fill="url(#valorActivo)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {form ? (
              <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <h4 className="text-white font-semibold mb-3">{form.titulo}</h4>
                <MovementForm
                  key={form.inicial?._id || form.titulo}
                  asset={asset}
                  inicial={form.inicial}
                  onSubmit={guardarMovimiento}
                  onCancel={() => setForm(null)}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setForm({ inicial: null, titulo: 'Nuevo movimiento' })} className="btn-primary">
                  Nuevo movimiento
                </button>
                <button
                  onClick={() => setForm({ inicial: { tipo: 'Valuacion', monto: r.valor_actual }, titulo: 'Actualizar valor' })}
                  className="btn-secondary"
                >
                  Actualizar valor
                </button>
                <button onClick={() => setImportando(true)} className="btn-secondary">
                  Importar
                </button>
                {!r.cerrado && r.valor_actual > 0 && (
                  <button
                    onClick={() => setForm({ inicial: { tipo: 'Retiro', monto: r.valor_actual }, titulo: 'Cerrar activo (retiro total)' })}
                    className="btn-secondary"
                  >
                    Cerrar activo
                  </button>
                )}
                <div className="flex-1" />
                {onEdit && (
                  <button onClick={() => onEdit(asset)} className="px-3 py-2 text-sm text-gray-300 hover:text-white">
                    Editar datos
                  </button>
                )}
                <button onClick={() => setConfirmar({ tipo: 'activo' })} className="px-3 py-2 text-sm text-red-400 hover:text-red-300">
                  Borrar activo
                </button>
              </div>
            )}

            <div>
              <h4 className="text-white font-semibold mb-2">Movimientos</h4>
              {asset.movimientos.length === 0 ? (
                <p className="text-sm text-gray-400">Sin movimientos todavía.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="py-2 pr-3 font-medium">Fecha</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 pr-3 font-medium text-right">Monto</th>
                        <th className="py-2 pr-3 font-medium text-right">Dólar</th>
                        <th className="py-2 pr-3 font-medium text-right">En {moneda}</th>
                        <th className="py-2 pr-3 font-medium">Notas</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {asset.movimientos.map(m => (
                        <tr key={m._id} className="border-b border-gray-700/50">
                          <td className="py-2 pr-3 text-gray-300 tabular-nums">{formatFecha(m.fecha)}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${COLOR_TIPO[m.tipo]}`}>{ETIQUETA_TIPO[m.tipo]}</span>
                          </td>
                          <td className="py-2 pr-3 text-right text-white tabular-nums">{formatMoney(m.monto, asset.moneda)}</td>
                          <td className="py-2 pr-3 text-right text-gray-400 tabular-nums">{formatMoney(m.cotizacion_usd, 'ARS')}</td>
                          <td className="py-2 pr-3 text-right text-gray-300 tabular-nums">{formatMoney(m[`monto_${s}`], moneda)}</td>
                          <td className="py-2 pr-3 text-gray-400 truncate max-w-[12rem]">{m.notas}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => setForm({ inicial: m, titulo: 'Editar movimiento' })}
                              className="text-gray-400 hover:text-white px-2"
                            >
                              Editar
                            </button>
                            <button onClick={() => setConfirmar({ tipo: 'mov', mov: m })} className="text-red-400 hover:text-red-300 px-2">
                              Borrar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ImportMovementsModal
        asset={asset}
        isOpen={importando}
        onClose={() => setImportando(false)}
        onImported={() => {
          cargar()
          onChanged()
        }}
      />

      <ConfirmModal
        isOpen={Boolean(confirmar)}
        onClose={() => setConfirmar(null)}
        onConfirm={borrar}
        type="danger"
        title={confirmar?.tipo === 'activo' ? 'Borrar activo' : 'Borrar movimiento'}
        message={
          confirmar?.tipo === 'activo'
            ? `Se va a borrar "${asset?.nombre}" junto con sus ${asset?.movimientos.length} movimiento(s). Su ganancia deja de aparecer en Rendimientos. Si lo vendiste, mejor usá "Cerrar activo".`
            : 'Se va a borrar este movimiento y se recalcula el valor del activo.'
        }
        confirmText="Borrar"
      />
    </>
  )
}

export default AssetDetailModal
