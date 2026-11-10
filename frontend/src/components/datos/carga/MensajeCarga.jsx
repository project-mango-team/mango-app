// Mensaje de resultado (ok o error). Acepta {tipo, texto} (bandeja) y {type, text} (carga a mano).
const MensajeCarga = ({ mensaje, children }) => {
  if (!mensaje) return null
  const error = (mensaje.tipo || mensaje.type) === 'error'
  return (
    <div className={`p-3 rounded-lg text-sm border ${error ? 'border-red-800 bg-red-900/20 text-red-300' : 'border-green-800 bg-green-900/20 text-green-300'}`}>
      {mensaje.texto || mensaje.text}
      {!error && children}
    </div>
  )
}

export default MensajeCarga
