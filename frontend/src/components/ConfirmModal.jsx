import { useEffect } from 'react'

const TIPOS = {
  warning: { icono: 'bg-primary/20 text-primary', boton: 'btn-primary', path: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  danger: { icono: 'bg-red-900/40 text-red-400', boton: 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors', path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  info: { icono: 'bg-blue-900/40 text-blue-300', boton: 'btn-primary', path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
}

// Confirmación con el estilo de la app (reemplaza window.confirm). Con `useConfirmar` se usa como una promesa.
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning' // 'warning', 'danger', 'info'
}) => {
  useEffect(() => {
    if (!isOpen) return undefined
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null
  const t = TIPOS[type] || TIPOS.warning

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-gray-700 animate-modal-enter">
        <div className="p-6 flex gap-4">
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${t.icono}`} aria-hidden="true">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.path} /></svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed break-words">{message}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={t.boton}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
