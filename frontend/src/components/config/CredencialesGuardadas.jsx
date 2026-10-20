import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../ConfirmModal'
import { secretService } from '../../services/secretService'
import { formatFecha, mensajeError } from '../../utils/format'

// Credenciales de terceros (token de Mercado Pago, contraseñas de PDF) que Mango guarda cifradas
const CredencialesGuardadas = () => {
  const [secretos, setSecretos] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setSecretos((await secretService.listar()).data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar las credenciales'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Credenciales guardadas</h2>
        <p className="text-sm text-gray-400 mt-1">
          Tokens y contraseñas de otros servicios que Mango usa por vos. Se guardan cifrados y no se pueden volver a ver: si cambian, cargalos de nuevo.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {secretos === null ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : secretos.length === 0 ? (
        <p className="text-sm text-gray-500">No tenés credenciales guardadas.</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {secretos.map(s => (
            <li key={s.nombre} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">
                  {s.descripcion || s.nombre}
                  {s.pista && <code className="text-xs text-gray-500 ml-1">{s.pista}</code>}
                </p>
                <p className="text-xs text-gray-500">
                  Guardada el {formatFecha(s.updated_at)} · {s.last_used_at ? `último uso ${formatFecha(s.last_used_at)}` : 'sin usar'}
                </p>
              </div>
              <button onClick={() => setBorrando(s)} className="text-sm text-red-400 hover:text-red-300">Borrar</button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={async () => {
          try {
            await secretService.borrar(borrando.nombre)
            cargar()
          } catch (err) {
            setError(mensajeError(err, 'No se pudo borrar la credencial'))
          }
        }}
        type="danger"
        title="Borrar credencial"
        message={borrando && `Mango va a dejar de poder usar "${borrando.descripcion || borrando.nombre}" hasta que la cargues de nuevo.`}
        confirmText="Borrar"
      />
    </div>
  )
}

export default CredencialesGuardadas
