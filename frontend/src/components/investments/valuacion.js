// Fuentes de precio y unidades de la valuación automática (VAL)

export const FUENTES_PRECIO = [
  { value: 'manual', label: 'Manual', ayuda: 'Cargás el valor vos con "Actualizar valor".' },
  { value: 'cafci', label: 'FCI (CAFCI)', ayuda: 'Cuotapartes × valor de la cuotaparte que publica la CAFCI.' },
  { value: 'ticker', label: 'Ticker (ETF, CEDEAR, acción)', ayuda: 'Cantidad × precio del ticker.' },
  { value: 'coingecko', label: 'Cripto (CoinGecko)', ayuda: 'Cantidad × precio de la moneda.' },
  { value: 'tasa_fija', label: 'Tasa fija', ayuda: 'Devenga el interés con la tasa anual, sin unidades.' }
]

export const etiquetaFuente = (fuente) => FUENTES_PRECIO.find(f => f.value === fuente)?.label || 'Manual'

// Las fuentes que valúan cantidad × precio necesitan unidades
export const usaUnidades = (fuente) => ['cafci', 'ticker', 'coingecko'].includes(fuente)

/**
 * Unidades en formato argentino con hasta 8 decimales ("1.229,75", "0,00123456")
 */
export const formatUnidades = (n) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 8 })

/**
 * Unidades a texto editable, sin separador de miles y sin redondear a 2 decimales
 */
export const unidadesAInput = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

// Fuentes que ya valúan solas (tickers y cripto llegan con VAL-04 y VAL-05)
export const tienePrecioAutomatico = (fuente) => ['cafci', 'tasa_fija'].includes(fuente)

const SIMBOLOS = { ARS: '$', USD: 'US$', EUR: '€' }

/**
 * Precio unitario con hasta 4 decimales ("$ 86,0214"): las cuotapartes valen poco y los centavos no alcanzan
 */
export const formatPrecio = (n, moneda = 'ARS') =>
  `${SIMBOLOS[moneda] || ''} ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
