import { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../ConfirmModal'
import { mercadoPagoService } from '../../services/mercadoPagoService'
import { formatFecha, mensajeError } from '../../utils/format'

const TUS_INTEGRACIONES = 'https://www.mercadopago.com.ar/developers/panel/app'

// Conexión con Mercado Pago por API (MP-02): el access token se guarda cifrado y nunca se vuelve a mostrar
const CuentaMercadoPago = () => {
  const [estado, setEstado] = useState(null)
  const [token, setToken] = useState('')
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [desconectando, setDesconectando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setEstado((await mercadoPagoService.estado()).data)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la cuenta de Mercado Pago'))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const conectadoComo = (cuenta) => (cuenta?.nickname ? `Conectada como ${cuenta.nickname}` : 'Conexión OK')

  const conectar = async (e) => {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    setMensaje(null)
    try {
      const { data } = await mercadoPagoService.conectar(token)
      setToken('')
      setEditando(false)
      setMensaje(conectadoComo(data.cuenta))
      await cargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo conectar la cuenta'))
    } finally {
      setOcupado(false)
    }
  }

  const probar = async () => {
    setOcupado(true)
    setError(null)
    setMensaje(null)
    try {
      setMensaje(conectadoComo((await mercadoPagoService.probar()).data.cuenta))
    } catch (err) {
      setError(mensajeError(err, 'No se pudo probar la conexión'))
    } finally {
      setOcupado(false)
    }
  }

  const conectado = estado?.conectado
  const credencial = estado?.credencial

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Mercado Pago</h2>
        <p className="text-sm text-gray-400 mt-1">
          Con tu access token, Mango trae los movimientos de tu cuenta todos los días y los deja en la Bandeja, sin bajar el CSV a mano. Solo los lee.
        </p>
      </div>

      {estado === null && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      {conectado && !editando && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[12rem]">
            <p className="text-white text-sm">
              Cuenta conectada
              {credencial?.pista && <code className="text-xs text-gray-500 ml-1">…{credencial.pista}</code>}
            </p>
            <p className="text-xs text-gray-500">
              Token guardado el {formatFecha(credencial?.updated_at)} · {credencial?.last_used_at ? `último uso ${formatFecha(credencial.last_used_at)}` : 'sin usar'}
            </p>
          </div>
          <button onClick={probar} disabled={ocupado} className="btn-secondary !py-1.5 text-sm disabled:opacity-50">Probar conexión</button>
          <button onClick={() => { setEditando(true); setMensaje(null) }} className="btn-secondary !py-1.5 text-sm">Cambiar token</button>
          <button onClick={() => setDesconectando(true)} className="text-sm text-red-400 hover:text-red-300">Desconectar</button>
        </div>
      )}

      {estado && (!conectado || editando) && (
        <div className="space-y-3">
          <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
            <li>
              Entrá a{' '}
              <a href={TUS_INTEGRACIONES} target="_blank" rel="noreferrer" className="text-primary hover:underline">Tus integraciones</a>
              {' '}con tu cuenta de Mercado Pago y creá una aplicación (por ejemplo, "Mango").
            </li>
            <li>En la aplicación, abrí <strong>Credenciales de producción</strong> y activalas (como sitio web podés poner https://projectmango.app).</li>
            <li>Copiá el <strong>Access Token</strong> (empieza con APP_USR-) y pegalo acá.</li>
          </ol>
          <form onSubmit={conectar} className="flex flex-wrap gap-2">
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="APP_USR-…"
              autoComplete="off"
              className="input-field flex-1 min-w-[12rem]"
            />
            <button type="submit" disabled={!token.trim() || ocupado} className="btn-primary disabled:opacity-50">
              {ocupado ? 'Probando…' : 'Conectar'}
            </button>
            {editando && (
              <button type="button" onClick={() => { setEditando(false); setToken('') }} className="btn-secondary">Cancelar</button>
            )}
          </form>
          <p className="text-xs text-gray-500">Antes de guardarlo, Mango prueba el token contra Mercado Pago. Se guarda cifrado y no se puede volver a ver.</p>
        </div>
      )}

      {mensaje && <p className="text-sm text-green-400">{mensaje}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <ConfirmModal
        isOpen={desconectando}
        onClose={() => setDesconectando(false)}
        onConfirm={async () => {
          try {
            await mercadoPagoService.desconectar()
            setMensaje(null)
            await cargar()
          } catch (err) {
            setError(mensajeError(err, 'No se pudo desconectar la cuenta'))
          }
        }}
        type="danger"
        title="Desconectar Mercado Pago"
        message="Mango borra el token y deja de traer los movimientos. Lo ya importado queda como está. Para cortar el acceso del todo, borrá también la aplicación en Tus integraciones."
        confirmText="Desconectar"
      />
    </div>
  )
}

export default CuentaMercadoPago
