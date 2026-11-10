import { PUNTO_NIVEL, formatCuando } from '../../utils/avisos'

// Una fila de aviso (campana y página "ver todos"): punto de nivel, título, mensaje y cuándo
const ItemAviso = ({ aviso, onAbrir, compacto = false }) => (
  <button
    onClick={() => onAbrir(aviso)}
    className={`w-full text-left flex gap-3 hover:bg-gray-700/50 transition-colors ${compacto ? 'px-4 py-3' : 'px-4 md:px-6 py-4'} ${aviso.leida ? '' : 'bg-gray-700/30'}`}
  >
    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${aviso.leida ? 'bg-gray-600' : PUNTO_NIVEL[aviso.nivel] || PUNTO_NIVEL.info}`} />
    <span className="flex-1 min-w-0">
      <span className={`block text-sm ${aviso.leida ? 'text-gray-300' : 'text-white font-medium'}`}>{aviso.titulo}</span>
      {aviso.mensaje && <span className={`block text-xs text-gray-400 mt-0.5 break-words ${compacto ? 'line-clamp-2' : ''}`}>{aviso.mensaje}</span>}
    </span>
    <span className="text-xs text-gray-500 whitespace-nowrap">{formatCuando(aviso.created_at)}</span>
  </button>
)

export default ItemAviso
