import { formatImporte } from './format'

// Revisión enfocada (REV-05). Misma lógica que backend/src/utils/reviewFocus.js (motivosDeRevision),
// recalculada en vivo para que el motivo se vaya cuando se corrige la fila.
const INTERNO = 'Movimiento interno'

export const motivosDeRevision = (t, limites = {}) => {
  if (t.ignorada && !t.duplicado) return []
  const motivos = []
  if (t.categoria === 'Otros') motivos.push('otros')
  if (t.comercio_nuevo) motivos.push('nuevo')
  if (t.duplicado) motivos.push('duplicado')
  if (t.interno_sugerido && t.categoria !== INTERNO) motivos.push('interno')
  const limite = limites?.[t.categoria]
  if (t.tipo === 'Gasto' && limite && Number(t.importe) > limite) motivos.push('monto')
  return motivos
}

// Etiquetas de los motivos que no tienen ya su propio aviso en la fila (duplicado e interno sí lo tienen)
export const etiquetaMotivo = (motivo, t, limites = {}) => ({
  otros: 'Sin categoría',
  nuevo: 'Comercio nuevo',
  monto: `Monto alto para ${t.categoria} (suele ser hasta ${formatImporte(limites?.[t.categoria])})`
}[motivo] || null)
