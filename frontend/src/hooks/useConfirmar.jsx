import { useCallback, useRef, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'

// Reemplazo de window.confirm: `confirmar({ title, message, confirmText, type })` devuelve una promesa con true/false.
// Hay que renderizar `dialogo` en el componente.
//   const { confirmar, dialogo } = useConfirmar()
//   if (!(await confirmar({ message: '¿Eliminar?', type: 'danger' }))) return
const useConfirmar = () => {
  const [opciones, setOpciones] = useState(null)
  const resolver = useRef(null)

  const confirmar = useCallback((config) => new Promise((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setOpciones(config)
  }), [])

  const terminar = (valor) => {
    resolver.current?.(valor)
    resolver.current = null
    setOpciones(null)
  }

  const dialogo = (
    <ConfirmModal
      isOpen={Boolean(opciones)}
      title={opciones?.title}
      message={opciones?.message}
      confirmText={opciones?.confirmText}
      cancelText={opciones?.cancelText}
      type={opciones?.type}
      // ConfirmModal llama onConfirm y después onClose: el primero que llega decide
      onConfirm={() => terminar(true)}
      onClose={() => terminar(false)}
    />
  )

  return { confirmar, dialogo }
}

export default useConfirmar
