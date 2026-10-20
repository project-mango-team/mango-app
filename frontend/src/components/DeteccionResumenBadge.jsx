import { formatFecha } from '../utils/format'

// Muestra qué resumen se reconoció en el archivo (o por qué no) debajo del selector de archivo
const DeteccionResumenBadge = ({ deteccion, detectando }) => {
  if (detectando) {
    return <p className="text-sm text-gray-400 mt-2">Reconociendo el resumen...</p>
  }
  if (!deteccion) return null

  if (!deteccion.soportado) {
    return (
      <p className="text-sm text-yellow-400 mt-2">
        {deteccion.descripcion ? `${deteccion.descripcion}: ` : ''}{deteccion.motivo}
      </p>
    )
  }

  const periodo = deteccion.cierre
    ? `cierre ${formatFecha(deteccion.cierre)}`
    : deteccion.periodo
      ? `${formatFecha(deteccion.periodo.desde)} al ${formatFecha(deteccion.periodo.hasta)}`
      : null

  return (
    <p className="text-sm text-green-400 mt-2">
      ✓ Detectado: <span className="font-medium">{deteccion.descripcion}</span>
      {periodo && <span className="text-gray-400"> · {periodo}</span>}
      {deteccion.tarjetas?.length > 0 && <span className="text-gray-400"> · {deteccion.tarjetas.length} tarjeta(s)</span>}
      {deteccion.confianza !== 'alta' && <span className="text-gray-400"> · revisá que sea correcto</span>}
    </p>
  )
}

export default DeteccionResumenBadge
