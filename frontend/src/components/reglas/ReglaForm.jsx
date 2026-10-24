import { useState } from 'react'
import { mensajeError } from '../../utils/format'
import { ORIGENES, CATEGORIA_INTERNO, accionDeRegla } from './reglaTexto'

const formDesdeRegla = (regla) => {
  const c = regla?.condiciones || {}
  const modo = c.detalle?.modo || 'contiene'
  return {
    modo,
    texto: modo === 'regex' ? (c.detalle?.valores?.[0] || '') : (c.detalle?.valores || []).join(', '),
    origen: c.origen || '',
    tipo: c.tipo || '',
    montoMin: c.montoMin ?? '',
    montoMax: c.montoMax ?? '',
    accion: regla ? accionDeRegla(regla.accion) : 'categoria',
    categoria: regla?.accion?.tipo === 'categoria' ? regla.accion.categoria : '',
    activa: regla?.activa !== false
  }
}

const reglaDesdeForm = (f) => ({
  condiciones: {
    detalle: {
      modo: f.modo,
      valores: f.modo === 'regex' ? [f.texto.trim()].filter(Boolean) : f.texto.split(/[,\n]/).map(v => v.trim()).filter(Boolean)
    },
    origen: f.origen || null,
    tipo: f.tipo || null,
    montoMin: f.montoMin === '' ? null : f.montoMin,
    montoMax: f.montoMax === '' ? null : f.montoMax
  },
  accion: f.accion === 'ignorar'
    ? { tipo: 'ignorar' }
    : { tipo: 'categoria', categoria: f.accion === 'interno' ? CATEGORIA_INTERNO : f.categoria },
  activa: f.activa
})

const Campo = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-medium text-gray-400 mb-1">{label}</span>
    {children}
  </label>
)

// Alta y edición de una regla: condiciones (todas se tienen que cumplir) → una acción
const ReglaForm = ({ regla, categorias, onGuardar, onCancelar }) => {
  const [form, setForm] = useState(() => formDesdeRegla(regla))
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (campo) => (e) => setForm(prev => ({ ...prev, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    try {
      setGuardando(true)
      setError(null)
      await onGuardar(reglaDesdeForm(form))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar la regla'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3 rounded-lg border border-gray-600 bg-gray-900/40 p-4">
      <p className="text-xs font-semibold uppercase text-gray-400">Si se cumple todo esto…</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Campo label="Detalle">
          <select value={form.modo} onChange={set('modo')} className="input-field w-full">
            <option value="contiene">contiene alguno de</option>
            <option value="regex">coincide con la regex</option>
          </select>
        </Campo>
        <Campo label={form.modo === 'regex' ? 'Expresión regular' : 'Textos (separados por coma)'} className="sm:col-span-2">
          <input
            type="text"
            value={form.texto}
            onChange={set('texto')}
            placeholder={form.modo === 'regex' ? '^PAGO TARJETA' : 'LSH BARRA HOTEL, Netflix'}
            className="input-field w-full"
          />
        </Campo>
        <Campo label="Origen">
          <select value={form.origen} onChange={set('origen')} className="input-field w-full">
            <option value="">Cualquiera</option>
            {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo">
          <select value={form.tipo} onChange={set('tipo')} className="input-field w-full">
            <option value="">Cualquiera</option>
            <option value="Gasto">Gasto</option>
            <option value="Ingreso">Ingreso</option>
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Monto desde">
            <input type="number" min="0" step="any" value={form.montoMin} onChange={set('montoMin')} className="input-field w-full" />
          </Campo>
          <Campo label="Monto hasta">
            <input type="number" min="0" step="any" value={form.montoMax} onChange={set('montoMax')} className="input-field w-full" />
          </Campo>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase text-gray-400 pt-1">…entonces</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Campo label="Acción">
          <select value={form.accion} onChange={set('accion')} className="input-field w-full">
            <option value="categoria">Asignar categoría</option>
            <option value="interno">Marcar como movimiento interno</option>
            <option value="ignorar">No importar</option>
          </select>
        </Campo>
        {form.accion === 'categoria' && (
          <Campo label="Categoría">
            <select value={form.categoria} onChange={set('categoria')} className="input-field w-full">
              <option value="">Elegir…</option>
              {categorias.filter(c => c !== CATEGORIA_INTERNO).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="px-3 py-2 text-sm text-gray-300 hover:text-white">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="px-4 py-2 text-sm bg-primary hover:bg-primary/80 text-white rounded disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar regla'}
        </button>
      </div>
    </form>
  )
}

export default ReglaForm
