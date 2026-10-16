import { formatMoney, formatPercent } from '../../utils/format'

const suf = (moneda) => moneda.toLowerCase()

const Card = ({ label, value, hint, valueClass = 'text-white' }) => (
  <div className="card !p-5">
    <p className="text-sm text-gray-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
)

// Totales del portfolio en la moneda elegida (USD o ARS)
const SummaryCards = ({ totales, moneda }) => {
  const s = suf(moneda)
  const valor = totales[`valor_${s}`]
  const liquidez = totales[`liquidez_${s}`]
  const ganancia = totales[`ganancia_${s}`]
  const rendimiento = totales[`rendimiento_${s}`]
  const prestamos = totales[`prestamos_${s}`] || 0
  const patrimonio = totales[`patrimonio_${s}`] ?? valor

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card
        label="Patrimonio"
        value={formatMoney(patrimonio, moneda)}
        hint={prestamos > 0
          ? `${formatMoney(valor, moneda)} invertido + ${formatMoney(prestamos, moneda)} prestado`
          : 'Valor actual de los activos abiertos'}
      />
      <Card
        label="Liquidez"
        value={formatMoney(liquidez, moneda)}
        hint={patrimonio > 0 ? `${formatPercent(liquidez / patrimonio, { signo: false })} del patrimonio` : 'Según el tipo de cada activo'}
      />
      <Card label="Capital aportado" value={formatMoney(totales[`aportado_${s}`], moneda)} hint="Aportes de los activos abiertos" />
      <Card
        label="Ganancia"
        value={formatMoney(ganancia, moneda, { signo: true })}
        valueClass={ganancia > 0 ? 'text-green-400' : ganancia < 0 ? 'text-red-400' : 'text-white'}
        hint={`${formatPercent(rendimiento)} sobre lo aportado`}
      />
    </div>
  )
}

export default SummaryCards
