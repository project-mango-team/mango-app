const SIMBOLOS = { ARS: '$', USD: 'US$', EUR: '€' }

/**
 * Formatea un monto con su moneda en formato argentino (ARS sin decimales)
 */
export const formatMoney = (value, moneda = 'ARS', { signo = false } = {}) => {
  const n = Number(value) || 0
  const decimales = moneda === 'ARS' ? 0 : 2
  const texto = Math.abs(n).toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  })
  const prefijo = n < 0 ? '-' : signo && n > 0 ? '+' : ''
  return `${prefijo}${SIMBOLOS[moneda] || ''} ${texto}`
}

export const formatPercent = (ratio, { signo = true } = {}) => {
  // null = no hay capital contra el cual medir
  if (ratio === null || ratio === undefined) return '—'
  const n = (Number(ratio) || 0) * 100
  const prefijo = signo && n > 0 ? '+' : ''
  return `${prefijo}${n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/**
 * Parsea un número escrito en formato argentino: el punto es separador de miles y la coma decimal
 * ("1.234,56" → 1234.56). Devuelve NaN si no es un número válido.
 */
export const parseNumeroAR = (texto) => {
  if (typeof texto === 'number') return texto
  const limpio = String(texto ?? '').trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '' || !/^-?\d*\.?\d+$/.test(limpio)) return NaN
  return Number(limpio)
}

/**
 * Número a texto editable en formato argentino, sin separador de miles ("1234,56")
 */
export const toInputAR = (n) =>
  n === null || n === undefined || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ',')

/**
 * Fecha de hoy en Argentina como YYYY-MM-DD
 */
export const hoyISO = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

/**
 * Fecha ISO (o Date) a DD/MM/YYYY, sin corrimientos de zona horaria
 */
export const formatFecha = (fecha) => {
  if (!fecha) return ''
  const [y, m, d] = String(fecha instanceof Date ? fecha.toISOString() : fecha).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const mensajeError = (error, fallback = 'Ocurrió un error') =>
  error?.response?.data?.message || error?.message || fallback
