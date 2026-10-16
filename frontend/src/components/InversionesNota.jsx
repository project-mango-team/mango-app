import { Link } from 'react-router-dom'

const formatPesos = (n) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Aclara que los movimientos con categoría Inversión no cuentan como gasto ni ingreso
const InversionesNota = ({ inversiones }) => {
  const enviado = inversiones?.enviado || 0
  const recibido = inversiones?.recibido || 0
  if (enviado === 0 && recibido === 0) return null

  const partes = []
  if (enviado > 0) partes.push(`${formatPesos(enviado)} enviados`)
  if (recibido > 0) partes.push(`${formatPesos(recibido)} recibidos`)

  return (
    <p className="text-xs text-gray-500 mt-3">
      Sin contar movimientos de inversión ({partes.join(' · ')}).{' '}
      <Link to="/inversiones" className="text-primary hover:underline">Ver inversiones</Link>
    </p>
  )
}

export default InversionesNota
