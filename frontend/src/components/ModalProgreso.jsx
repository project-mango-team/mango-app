import { useEffect } from 'react'

// Modal de progreso y resultado: "cargando" mientras corre algo, después tilde verde (o cruz roja) con el mensaje
// y un botón OK. Se maneja con `useProgreso`. `acciones` suma botones extra al resultado (por ejemplo "Deshacer").
const ModalProgreso = ({ progreso, acciones = null }) => {
  const { estado, titulo, mensaje, cerrar } = progreso
  const abierto = estado !== 'cerrado'
  const cargando = estado === 'cargando'

  useEffect(() => {
    if (!abierto || cargando) return undefined
    // En captura y frenando el evento: si hay otro modal debajo, Esc cierra solo este
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.stopPropagation()
      cerrar()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [abierto, cargando, cerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-live="polite">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-gray-700 animate-modal-enter p-6 text-center">
        {cargando ? (
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-gray-600 border-t-primary animate-spin" aria-hidden="true" />
        ) : estado === 'ok' ? (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/40 text-green-400" aria-hidden="true">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 text-red-400" aria-hidden="true">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
        )}

        {titulo && <h3 className="text-lg font-bold text-white">{titulo}</h3>}
        {mensaje && <p className="mt-2 text-sm text-gray-300 break-words">{mensaje}</p>}

        {!cargando && (
          <div className="mt-6 flex justify-center gap-3">
            {acciones}
            <button onClick={cerrar} className="btn-primary px-6" autoFocus>OK</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ModalProgreso
