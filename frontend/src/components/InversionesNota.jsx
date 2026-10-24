import { Link } from 'react-router-dom'
import { formatImporte } from '../utils/format'


const describir = (grupo, moneda) => {
  const partes = []
  if (grupo?.enviado > 0) partes.push(`${formatImporte(grupo.enviado, moneda)} enviados`)
  if (grupo?.recibido > 0) partes.push(`${formatImporte(grupo.recibido, moneda)} recibidos`)
  return partes.join(' · ')
}

// Aclara que los movimientos de Inversión y Movimiento interno no cuentan como gasto ni ingreso
const InversionesNota = ({ inversiones, internos, moneda = 'ARS' }) => {
  const deInversion = describir(inversiones, moneda)
  const deInternos = describir(internos, moneda)
  if (!deInversion && !deInternos) return null

  return (
    <div className="text-xs text-gray-500 mt-3 space-y-1">
      {deInversion && (
        <p>
          Sin contar movimientos de inversión ({deInversion}).{' '}
          <Link to="/inversiones" className="text-primary hover:underline">Ver inversiones</Link>
        </p>
      )}
      {deInternos && (
        <p>Sin contar movimientos internos entre tus cuentas ({deInternos}).</p>
      )}
    </div>
  )
}

export default InversionesNota
