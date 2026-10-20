import { formatImporte } from '../../utils/format'

// ING-12: lo leído del archivo contra el total del resumen, con la diferencia explicada
// (saldo anterior sin pagar, impuestos y cargos que no son transacciones)

const cierra = (n) => Math.abs(n || 0) < 1

const hayDolares = (usd) => usd && (usd.resumen || usd.importado)

// Versión corta para la tabla de la bandeja
export const ControlTotalesResumen = ({ control }) => {
  if (!control) return null
  const { ars, usd } = control
  const ok = cierra(ars.sin_explicar) && (!hayDolares(usd) || cierra(usd.sin_explicar))
  return (
    <div className="mt-1 text-xs">
      <p className="text-gray-500 whitespace-nowrap">Resumen {formatImporte(ars.resumen)}</p>
      {ok ? (
        <p className="text-green-400" title="La diferencia son impuestos, cargos o saldo anterior">
          Cierra
          {!cierra(ars.diferencia) && <span className="block text-gray-500 whitespace-nowrap">+{formatImporte(ars.diferencia)} de cargos</span>}
        </p>
      ) : (
        <p className="text-yellow-400">
          Sin explicar {cierra(ars.sin_explicar) ? formatImporte(usd.sin_explicar, 'USD') : formatImporte(ars.sin_explicar)}
        </p>
      )}
    </div>
  )
}

const Fila = ({ label, valor, moneda, clase = 'text-gray-300', detalle }) => (
  <div className="flex justify-between gap-4">
    <span className="text-gray-400">
      {label}
      {detalle && <span className="block text-xs text-gray-500">{detalle}</span>}
    </span>
    <span className={`tabular-nums whitespace-nowrap ${clase}`}>{formatImporte(valor, moneda)}</span>
  </div>
)

const SinExplicar = ({ valor, moneda }) => (
  cierra(valor)
    ? <p className="text-green-400 text-right">Cierra: no falta nada</p>
    : <Fila label="Sin explicar" valor={valor} moneda={moneda} clase="text-yellow-400 font-medium" detalle="Revisá si falta alguna transacción" />
)

// Versión completa para la revisión
const ControlTotales = ({ control }) => {
  if (!control) return null
  const { ars, usd, cargos, pago_minimo } = control
  const noImportados = cargos.filter(c => !c.importado)

  return (
    <div className="mb-4 p-3 rounded-lg bg-gray-900/50 border border-gray-700 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-white font-medium">Control de totales</h3>
        {pago_minimo !== null && <span className="text-xs text-gray-400">Pago mínimo {formatImporte(pago_minimo)}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Fila label="Importado" valor={ars.importado} detalle="Todo lo leído del archivo, también lo ya cargado" />
          <Fila label="Total del resumen" valor={ars.resumen} clase="text-white" />
          <Fila label="Diferencia" valor={ars.diferencia} clase="text-white font-medium" />
          {!cierra(ars.saldo_pendiente) && <Fila label="Saldo anterior sin pagar" valor={ars.saldo_pendiente} />}
          {noImportados.length > 0 && (
            <div>
              <Fila label="Impuestos y cargos (no son transacciones)" valor={ars.cargos_no_importados} />
              <ul className="mt-1 ml-3 space-y-0.5 text-xs text-gray-500">
                {noImportados.map((c, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span className="truncate">{c.detalle}</span>
                    <span className="tabular-nums">{formatImporte(c.importe)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SinExplicar valor={ars.sin_explicar} />
        </div>
        {hayDolares(usd) && (
          <div className="space-y-1">
            <Fila label="Importado en dólares" valor={usd.importado} moneda="USD" />
            <Fila label="Total del resumen en dólares" valor={usd.resumen} moneda="USD" clase="text-white" />
            {!cierra(usd.saldo_pendiente) && <Fila label="Saldo anterior sin pagar" valor={usd.saldo_pendiente} moneda="USD" />}
            <SinExplicar valor={usd.sin_explicar} moneda="USD" />
          </div>
        )}
      </div>
      {cargos.some(c => c.importado) && (
        <p className="mt-2 text-xs text-gray-500">
          Ya importados como transacciones: {cargos.filter(c => c.importado).map(c => c.detalle).join(', ')}
        </p>
      )}
    </div>
  )
}

export default ControlTotales
