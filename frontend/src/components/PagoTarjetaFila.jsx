import { formatImporte } from '../utils/format'

const fechaCorta = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '')
const nombreTarjeta = (producto) => ({ visa: 'Visa', mastercard: 'Mastercard' }[producto] || 'de la tarjeta')

// PUL-08: debajo del detalle de un pago de tarjeta en la caja de ahorro. Si el resumen de esa tarjeta ya está
// importado, el pago queda como movimiento interno (sus consumos ya están contados); si no, avisa que se contaría dos veces.
const PagoTarjetaFila = ({ fila }) => {
  const p = fila.pago_tarjeta
  if (!p) return null

  if (p.estado === 'cubierto') {
    const r = p.resumen || {}
    return (
      <p className="mt-1 text-xs text-sky-300">
        Pago del resumen {nombreTarjeta(r.producto)} Galicia{r.cierre ? ` (cierre ${fechaCorta(r.cierre)}` : ' ('}
        {r.total ? `, ${formatImporte(r.total)}` : ''}{r.filename ? `, ${r.filename}` : ''}): ya importado, queda como movimiento interno.
      </p>
    )
  }

  return (
    <p className="mt-1 text-xs text-amber-400">
      Parece el pago de la tarjeta {nombreTarjeta(p.producto)} y ese resumen no está importado: si lo dejás como gasto y después
      importás el resumen, se cuenta dos veces. Importá primero el resumen de la tarjeta.
    </p>
  )
}

export default PagoTarjetaFila
