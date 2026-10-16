import { useState } from 'react'
import usePrestamos from '../../hooks/usePrestamos'
import DeudorCard from './DeudorCard'
import LoanMovementModal from './LoanMovementModal'
import ConfirmModal from '../ConfirmModal'
import { loanService } from '../../services/loanService'
import { formatMoney, formatFecha, mensajeError } from '../../utils/format'

// Plata prestada: saldo por deudor, devoluciones parciales e historial de los ya saldados
const PrestamosTab = ({ moneda }) => {
  const { data, loading, error, recargar } = usePrestamos()
  const [modal, setModal] = useState(null) // null | { inicial }
  const [borrar, setBorrar] = useState(null)
  const [verSaldados, setVerSaldados] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  if (loading) return <p className="text-gray-400">Cargando préstamos...</p>
  if (error) {
    return (
      <div className="card border-red-800 text-red-400">
        {error} <button onClick={recargar} className="underline ml-2">Reintentar</button>
      </div>
    )
  }

  const { pendientes, saldados } = data
  const todos = [...pendientes, ...saldados]
  const total = moneda === 'USD' ? data.total_pendiente_usd : data.total_pendiente_ars

  const confirmarBorrado = async () => {
    try {
      setErrorAccion(null)
      await loanService.deleteMovement(borrar._id)
      recargar()
    } catch (err) {
      setErrorAccion(mensajeError(err, 'No se pudo borrar el movimiento'))
    }
  }

  const handlers = {
    onPrestar: (d) => setModal({ inicial: { tipo: 'Prestamo', deudor: d.deudor } }),
    onDevolucion: (d) => setModal({ inicial: { tipo: 'Devolucion', deudor: d.deudor } }),
    onEditar: (m) => setModal({ inicial: m }),
    onBorrar: (m) => setBorrar(m)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setModal({ inicial: { tipo: 'Prestamo' } })} className="btn-primary">Prestar</button>
        <button
          onClick={() => setModal({ inicial: { tipo: 'Devolucion' } })}
          disabled={pendientes.length === 0}
          className="btn-secondary disabled:opacity-50"
        >
          Registrar devolución
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card !p-5">
          <p className="text-sm text-gray-400">Total pendiente</p>
          <p className="text-2xl font-bold text-white mt-1">{formatMoney(total, moneda)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {moneda === 'ARS' && data.cotizacion_usd
              ? `Al dólar blue de hoy (${formatMoney(data.cotizacion_usd, 'ARS')})`
              : 'Suma al patrimonio, no a la liquidez'}
          </p>
        </div>
        <div className="card !p-5">
          <p className="text-sm text-gray-400">Deudores</p>
          <p className="text-2xl font-bold text-white mt-1">{pendientes.length}</p>
          <p className="text-xs text-gray-500 mt-1">{saldados.length} ya saldado(s)</p>
        </div>
      </div>

      {errorAccion && <p className="text-sm text-red-400">{errorAccion}</p>}

      {pendientes.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Nadie te debe plata. Cuando prestes algo, cargalo con <span className="text-white">Prestar</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {pendientes.map(d => <DeudorCard key={d.deudor} deudor={d} moneda={moneda} {...handlers} />)}
        </div>
      )}

      {saldados.length > 0 && (
        <div className="space-y-3">
          <button onClick={() => setVerSaldados(v => !v)} className="text-sm text-gray-400 hover:text-white flex items-center gap-2">
            <svg className={`w-4 h-4 transition-transform ${verSaldados ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Saldados ({saldados.length})
          </button>
          {verSaldados && saldados.map(d => (
            <div key={d.deudor}>
              <DeudorCard deudor={d} moneda={moneda} {...handlers} />
              <p className="text-xs text-gray-500 mt-1 ml-1">Último movimiento: {formatFecha(d.ultimo_movimiento)}</p>
            </div>
          ))}
        </div>
      )}

      <LoanMovementModal
        isOpen={Boolean(modal)}
        inicial={modal?.inicial}
        deudores={todos}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          recargar()
        }}
      />

      <ConfirmModal
        isOpen={Boolean(borrar)}
        onClose={() => setBorrar(null)}
        onConfirm={confirmarBorrado}
        type="danger"
        title="Borrar movimiento"
        message={borrar && `Se va a borrar ${borrar.tipo === 'Prestamo' ? 'el préstamo' : 'la devolución'} de ${formatMoney(borrar.monto, borrar.moneda)} a ${borrar.deudor}${borrar.concepto ? ` (${borrar.concepto})` : ''}.`}
        confirmText="Borrar"
      />
    </div>
  )
}

export default PrestamosTab
