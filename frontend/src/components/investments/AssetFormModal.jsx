import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { investmentService } from '../../services/investmentService'
import { mensajeError, parseNumeroAR } from '../../utils/format'
import PriceSourceFields from './PriceSourceFields'
import { usaUnidades, unidadesAInput } from './valuacion'

const NUEVO_TIPO = '__nuevo__'
const VACIO = { nombre: '', tipo: 'FCI', moneda: 'ARS', renta: 'N/A', plataforma: '', notas: '' }
const VALUACION_VACIA = { fuente_precio: 'manual', precio_config: {}, unidades: '' }

const valuacionDe = (asset) => asset
  ? {
      fuente_precio: asset.fuente_precio || 'manual',
      precio_config: {
        ...asset.precio_config,
        tasa_anual: unidadesAInput(asset.precio_config?.tasa_anual)
      },
      unidades: unidadesAInput(asset.unidades)
    }
  : VALUACION_VACIA

// Arma fuente_precio, precio_config y unidades para la API (los números vienen en formato argentino)
const datosValuacion = ({ fuente_precio, precio_config, unidades }) => {
  const config = { ...precio_config }
  if (fuente_precio === 'tasa_fija') config.tasa_anual = parseNumeroAR(config.tasa_anual)
  const unidadesNum = parseNumeroAR(unidades)
  return {
    fuente_precio,
    precio_config: config,
    unidades: usaUnidades(fuente_precio) && !isNaN(unidadesNum) ? unidadesNum : null
  }
}

// Alta y edición de un activo. Los movimientos se cargan después, desde el detalle.
const AssetFormModal = ({ isOpen, onClose, asset, tipos, onTiposChange, plataformas, onSaved }) => {
  const [form, setForm] = useState(VACIO)
  const [valuacion, setValuacion] = useState(VALUACION_VACIA)
  const [nuevoTipo, setNuevoTipo] = useState({ nombre: '', liquido: true })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(asset ? { ...VACIO, ...asset } : VACIO)
    setValuacion(valuacionDe(asset))
    setNuevoTipo({ nombre: '', liquido: true })
    setError(null)
  }, [isOpen, asset])

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const agregarTipo = async () => {
    const nombre = nuevoTipo.nombre.trim()
    if (!nombre) return
    try {
      const { data } = await investmentService.createType(nombre, nuevoTipo.liquido)
      onTiposChange(data)
      setForm(f => ({ ...f, tipo: nombre }))
      setNuevoTipo({ nombre: '', liquido: true })
      setError(null)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el tipo'))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.tipo === NUEVO_TIPO) {
      setError('Agregá el tipo nuevo o elegí uno de la lista')
      return
    }
    if (valuacion.unidades.trim() && isNaN(parseNumeroAR(valuacion.unidades))) {
      setError('Ingresá unidades válidas (ej: 1.250,5)')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const datos = {
        nombre: form.nombre,
        tipo: form.tipo,
        moneda: form.moneda,
        renta: form.renta,
        plataforma: form.plataforma,
        notas: form.notas,
        ...datosValuacion(valuacion)
      }
      const { data } = asset
        ? await investmentService.updateAsset(asset._id, datos)
        : await investmentService.createAsset(datos)
      onSaved(data, { nuevo: !asset })
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el activo'))
    } finally {
      setGuardando(false)
    }
  }

  const tieneMovimientos = asset?.resumen?.cantidad_movimientos > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={asset ? 'Editar activo' : 'Nuevo activo'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="asset-form" disabled={guardando} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : asset ? 'Guardar' : 'Crear activo'}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-400">Nombre</span>
          <input
            type="text"
            value={form.nombre}
            onChange={set('nombre')}
            placeholder="ej: USDT Nexo, Fima Premium, SPY"
            className="input-field w-full mt-1"
            autoFocus
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-gray-400">Tipo</span>
            <select value={form.tipo} onChange={set('tipo')} className="input-field w-full mt-1">
              {tipos.map(t => (
                <option key={t.nombre} value={t.nombre}>
                  {t.nombre}{t.liquido ? ' · líquido' : ''}
                </option>
              ))}
              <option value={NUEVO_TIPO}>+ Nuevo tipo…</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Moneda</span>
            <select
              value={form.moneda}
              onChange={set('moneda')}
              disabled={tieneMovimientos}
              className="input-field w-full mt-1 disabled:opacity-60"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD / USDT / cripto</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
        {tieneMovimientos && (
          <p className="text-xs text-gray-500 -mt-2">La moneda no se puede cambiar porque el activo ya tiene movimientos.</p>
        )}

        {form.tipo === NUEVO_TIPO && (
          <div className="flex items-end gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700">
            <label className="block flex-1">
              <span className="text-sm text-gray-400">Nombre del tipo</span>
              <input
                type="text"
                value={nuevoTipo.nombre}
                onChange={e => setNuevoTipo(t => ({ ...t, nombre: e.target.value }))}
                className="input-field w-full mt-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
              <input
                type="checkbox"
                checked={nuevoTipo.liquido}
                onChange={e => setNuevoTipo(t => ({ ...t, liquido: e.target.checked }))}
              />
              Líquido
            </label>
            <button type="button" onClick={agregarTipo} className="btn-secondary">Agregar</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-gray-400">Renta</span>
            <select value={form.renta} onChange={set('renta')} className="input-field w-full mt-1">
              <option value="N/A">N/A</option>
              <option value="Fija">Fija</option>
              <option value="Variable">Variable</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">Plataforma</span>
            <input
              type="text"
              list="plataformas-inversion"
              value={form.plataforma}
              onChange={set('plataforma')}
              placeholder="ej: Nexo, Bull Market"
              className="input-field w-full mt-1"
            />
            <datalist id="plataformas-inversion">
              {plataformas.map(p => <option key={p} value={p} />)}
            </datalist>
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-400">Notas (opcional)</span>
          <textarea value={form.notas} onChange={set('notas')} rows={2} className="input-field w-full mt-1" />
        </label>

        <PriceSourceFields value={valuacion} onChange={setValuacion} tenencia={asset?.resumen?.tenencia} />

        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  )
}

export default AssetFormModal
