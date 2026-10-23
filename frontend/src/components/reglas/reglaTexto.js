import { formatImporte } from '../../utils/format'

export const CATEGORIA_INTERNO = 'Movimiento interno'

export const ORIGENES = ['Mercado Pago', 'Santander', 'Banco Galicia', 'Banco Galicia Tarjeta', 'Banco Galicia Mastercard']

// Acción tal como se elige en el formulario: "interno" es asignar la categoría Movimiento interno
export const accionDeRegla = (accion) => {
  if (accion?.tipo === 'ignorar') return 'ignorar'
  if (accion?.categoria === CATEGORIA_INTERNO) return 'interno'
  return 'categoria'
}

export const describirCondiciones = ({ condiciones: c = {} }) => {
  const partes = []
  const valores = c.detalle?.valores || []
  if (valores.length) {
    partes.push(c.detalle.modo === 'regex'
      ? `detalle coincide con /${valores[0]}/`
      : `detalle contiene ${valores.map(v => `"${v}"`).join(' o ')}`)
  }
  if (c.origen) partes.push(`origen ${c.origen}`)
  if (c.tipo) partes.push(c.tipo === 'Gasto' ? 'es gasto' : 'es ingreso')
  if (c.montoMin != null && c.montoMax != null) partes.push(`monto entre ${formatImporte(c.montoMin)} y ${formatImporte(c.montoMax)}`)
  else if (c.montoMin != null) partes.push(`monto desde ${formatImporte(c.montoMin)}`)
  else if (c.montoMax != null) partes.push(`monto hasta ${formatImporte(c.montoMax)}`)
  return partes.join(' · ')
}

export const describirAccion = ({ accion }) => {
  const tipo = accionDeRegla(accion)
  if (tipo === 'ignorar') return 'No importar'
  if (tipo === 'interno') return 'Movimiento interno'
  return accion.categoria
}
