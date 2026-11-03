import { formatImporte } from '../utils/format'

const fechaCorta = (iso) => iso.split('-').reverse().slice(0, 2).join('/')

// INV-06: debajo del detalle de una fila con una regla de "Cargar en una inversión": ofrece crear el aporte o
// retiro en Inversiones al guardar, avisa si ya estaba cargado y explica por qué no se puede
const InversionSugerida = ({ fila, onCambiar }) => {
  const inv = fila.inversion
  if (!inv?.activo_id) return null
  // Si la fila dejó de ser una Inversión (el usuario le cambió la categoría) ya no se ofrece cargarla
  if (fila.categoria !== 'Inversión') return null

  if (inv.error) {
    return <p className="mt-1 text-xs text-amber-400">No se carga en Inversiones: {inv.error}</p>
  }

  if (inv.duplicado) {
    return (
      <p className="mt-1 text-xs text-gray-400">
        Ya cargado en {inv.activo_nombre} el {fechaCorta(inv.duplicado.fecha)}: no se vuelve a cargar.
      </p>
    )
  }

  return (
    <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-sky-300">
      <input
        type="checkbox"
        checked={Boolean(inv.crear)}
        disabled={fila.duplicado || fila.ignorada}
        onChange={(e) => onCambiar(e.target.checked)}
      />
      Cargar en Inversiones · {inv.tipo === 'Retiro' ? 'retiro' : 'aporte'} de {formatImporte(inv.monto, fila.moneda)} en {inv.activo_nombre}
    </label>
  )
}

export default InversionSugerida
