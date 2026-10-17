import { Link } from 'react-router-dom'
import { formatImporte } from '../utils/format'


// Aclara que los movimientos con categoría Inversión no cuentan como gasto ni ingreso
const InversionesNota = ({ inversiones, moneda = 'ARS' }) => {
  const enviado = inversiones?.enviado || 0
  const recibido = inversiones?.recibido || 0
  if (enviado === 0 && recibido === 0) return null

  const partes = []
  if (enviado > 0) partes.push(`${formatImporte(enviado, moneda)} enviados`)
  if (recibido > 0) partes.push(`${formatImporte(recibido, moneda)} recibidos`)

  return (
    <p className="text-xs text-gray-500 mt-3">
      Sin contar movimientos de inversión ({partes.join(' · ')}).{' '}
      <Link to="/inversiones" className="text-primary hover:underline">Ver inversiones</Link>
    </p>
  )
}

export default InversionesNota
