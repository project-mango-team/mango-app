import { useState } from 'react'
import { formatMoney, formatFecha } from '../../utils/format'

// Un deudor con su saldo y, desplegado, el historial de préstamos y devoluciones
const DeudorCard = ({ deudor, moneda, onPrestar, onDevolucion, onEditar, onBorrar }) => {
  const [abierto, setAbierto] = useState(false)
  const saldo = moneda === 'USD' ? deudor.saldo_usd : deudor.saldo_ars

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-700/30"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{deudor.deudor}</p>
          <p className="text-xs text-gray-500">
            Prestado {formatMoney(deudor.prestado_usd, 'USD')} · Devuelto {formatMoney(deudor.devuelto_usd, 'USD')}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${deudor.saldado ? 'text-gray-400' : 'text-white'}`}>
            {deudor.saldado ? 'Saldado' : formatMoney(saldo, moneda)}
          </p>
          <p className="text-xs text-gray-500">{deudor.cantidad_movimientos} movimiento(s)</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="border-t border-gray-700 px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {!deudor.saldado && (
              <button onClick={() => onDevolucion(deudor)} className="btn-primary !py-1.5 text-sm">Registrar devolución</button>
            )}
            <button onClick={() => onPrestar(deudor)} className="btn-secondary !py-1.5 text-sm">Prestar más</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Concepto</th>
                  <th className="py-2 pr-3 font-medium text-right">Monto</th>
                  <th className="py-2 pr-3 font-medium text-right">En USD</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {deudor.movimientos.map(m => (
                  <tr key={m._id} className="border-b border-gray-700/50">
                    <td className="py-2 pr-3 text-gray-300 tabular-nums whitespace-nowrap">{formatFecha(m.fecha)}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${m.tipo === 'Prestamo' ? 'bg-primary/20 text-orange-300' : 'bg-green-900/40 text-green-300'}`}>
                        {m.tipo === 'Prestamo' ? 'Préstamo' : 'Devolución'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-300">{m.concepto}</td>
                    <td className="py-2 pr-3 text-right text-gray-400 tabular-nums whitespace-nowrap">{formatMoney(m.monto, m.moneda)}</td>
                    <td className="py-2 pr-3 text-right text-white tabular-nums whitespace-nowrap">
                      {m.tipo === 'Devolucion' ? '-' : ''}{formatMoney(m.monto_usd, 'USD')}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => onEditar(m)} className="text-gray-400 hover:text-white px-2">Editar</button>
                      <button onClick={() => onBorrar(m)} className="text-red-400 hover:text-red-300 px-2">Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeudorCard
