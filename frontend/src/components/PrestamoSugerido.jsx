import { formatImporte } from '../utils/format'

const fechaCorta = (iso) => iso.split('-').reverse().slice(0, 2).join('/')

// PUL-07: debajo del detalle de una fila de categoría "Préstamo": se elige a quién (deudor) y se ofrece registrar el
// préstamo (si la plata sale) o la devolución (si entra) en Inversiones → Préstamos al guardar. La transacción
// sigue siendo neutra: no cuenta como gasto ni ingreso.
const PrestamoSugerido = ({ fila, onCambiar }) => {
  if (fila.categoria !== 'Préstamo' || fila.duplicado || fila.ignorada) return null
  const p = fila.prestamo || {}
  const deudor = p.deudor || ''
  const registrar = p.crear ?? Boolean(deudor.trim())

  return (
    <div className="mt-1 space-y-1 text-xs">
      <label className="flex flex-wrap items-center gap-2 text-sky-300">
        <span>{fila.tipo === 'Ingreso' ? 'Te devolvió:' : 'Le prestaste a:'}</span>
        <input
          type="text"
          value={deudor}
          maxLength={80}
          placeholder="Nombre del deudor"
          onChange={(e) => onCambiar({ ...p, deudor: e.target.value, crear: p.crear })}
          className="input-field w-44 py-1 text-xs"
          aria-label="Deudor"
        />
      </label>

      {p.error ? (
        <p className="text-amber-400">No se registra en Préstamos: {p.error}</p>
      ) : p.duplicado ? (
        <p className="text-gray-400">Ya registrado en Préstamos el {fechaCorta(p.duplicado.fecha)}: no se vuelve a cargar.</p>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-sky-300">
          <input
            type="checkbox"
            checked={registrar && Boolean(deudor.trim())}
            disabled={!deudor.trim()}
            onChange={(e) => onCambiar({ ...p, deudor, crear: e.target.checked })}
          />
          Registrar en Préstamos · {fila.tipo === 'Ingreso' ? 'devolución' : 'préstamo'}
          {p.monto ? ` de ${formatImporte(p.monto, fila.moneda)}` : ''}{deudor.trim() ? ` · ${deudor.trim()}` : ''}
        </label>
      )}
    </div>
  )
}

export default PrestamoSugerido
