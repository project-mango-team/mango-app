import { useEffect } from 'react'

const SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

// Modal genérico: backdrop, título, contenido scrolleable y footer opcional
const Modal = ({ isOpen, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!isOpen) return
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative bg-gray-800 rounded-lg shadow-2xl w-full ${SIZES[size]} max-h-[90vh] flex flex-col border border-gray-700 animate-modal-enter`}>
        <div className="px-6 py-4 border-b border-gray-700 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            {subtitle && <div className="text-sm text-gray-400 mt-1">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">{footer}</div>
        )}
      </div>
    </div>
  )
}

export default Modal
