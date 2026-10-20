import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../ConfirmModal'
import { tokenService } from '../../services/tokenService'
import { formatFecha, mensajeError } from '../../utils/format'

// Tokens para que integraciones (el script de Gmail) manden resúmenes a la bandeja
const TokensIntegracion = () => {
  const [tokens, setTokens] = useState([])
  const [nombre, setNombre] = useState('')
  const [nuevo, setNuevo] = useState(null) // token recién creado: se muestra una sola vez
  const [copiado, setCopiado] = useState(false)
  const [revocando, setRevocando] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setTokens((await tokenService.listar()).data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los tokens'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await tokenService.crear(nombre)
      setNuevo(res.data.token)
      setCopiado(false)
      setNombre('')
      cargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el token'))
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(nuevo)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Tokens de integración</h2>
        <p className="text-sm text-gray-400 mt-1">
          Permiten que el script de Gmail mande los resúmenes que te llegan por mail a la Bandeja.
          Solo sirven para subir documentos: no dan acceso a tus datos.
        </p>
      </div>

      {nuevo && (
        <div className="p-4 rounded-lg border border-yellow-800 bg-yellow-900/20 space-y-2">
          <p className="text-sm text-yellow-300 font-medium">Copiá el token ahora: no se va a volver a mostrar.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-900 rounded px-3 py-2 text-xs text-gray-100 break-all">{nuevo}</code>
            <button onClick={copiar} className="btn-secondary !py-1.5 text-sm whitespace-nowrap">{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
          <button onClick={() => setNuevo(null)} className="text-xs text-gray-400 hover:text-white">Ya lo guardé, ocultar</button>
        </div>
      )}

      <form onSubmit={crear} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder='Nombre (ej: "Script de Gmail")'
          className="input-field flex-1 min-w-[12rem]"
        />
        <button type="submit" disabled={!nombre.trim()} className="btn-primary disabled:opacity-50">Crear token</button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {tokens.length === 0 ? (
        <p className="text-sm text-gray-500">No tenés tokens activos.</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {tokens.map(t => (
            <li key={t._id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{t.nombre} <code className="text-xs text-gray-500 ml-1">{t.prefijo}</code></p>
                <p className="text-xs text-gray-500">
                  Creado el {formatFecha(t.created_at)} · {t.last_used_at ? `último uso ${formatFecha(t.last_used_at)}` : 'sin usar'}
                </p>
              </div>
              <button onClick={() => setRevocando(t)} className="text-sm text-red-400 hover:text-red-300">Revocar</button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={Boolean(revocando)}
        onClose={() => setRevocando(null)}
        onConfirm={async () => {
          try {
            await tokenService.revocar(revocando._id)
            cargar()
          } catch (err) {
            setError(mensajeError(err, 'No se pudo revocar el token'))
          }
        }}
        type="danger"
        title="Revocar token"
        message={revocando && `El script que use "${revocando.nombre}" va a dejar de poder mandar resúmenes. No se puede deshacer.`}
        confirmText="Revocar"
      />
    </div>
  )
}

export default TokensIntegracion
