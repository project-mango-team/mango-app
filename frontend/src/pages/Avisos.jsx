import useAvisos from '../hooks/useAvisos'
import ItemAviso from '../components/nav/ItemAviso'

// "Ver todas" las notificaciones: resúmenes nuevos, faltantes, errores de sync, valuaciones...
const Avisos = () => {
  const { avisos, noLeidas, error, abrir, marcarTodas } = useAvisos()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white">Notificaciones</h1>
          <p className="text-gray-400 mt-1">
            {noLeidas > 0 ? `${noLeidas} sin leer` : 'Estás al día'}
          </p>
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodas} className="btn-secondary text-sm">Marcar todas como leídas</button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="card !p-0 overflow-hidden">
        {avisos === null ? (
          <p className="p-6 text-sm text-gray-500">Cargando…</p>
        ) : avisos.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No tenés notificaciones. Acá van a aparecer los resúmenes que lleguen por mail y lo que Mango haga solo.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {avisos.map(a => <li key={a._id}><ItemAviso aviso={a} onAbrir={abrir} /></li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Avisos
