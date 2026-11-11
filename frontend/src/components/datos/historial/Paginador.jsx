// "1–20 de 57" con Anterior / Siguiente
const Paginador = ({ pagina, porPagina, total, hayAnterior, haySiguiente, onAnterior, onSiguiente, deshabilitado }) => {
  if (total <= porPagina) return null
  const desde = pagina * porPagina + 1
  const hasta = Math.min(total, (pagina + 1) * porPagina)
  const boton = 'btn-secondary text-sm disabled:opacity-40'
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="text-sm text-gray-400">{desde}–{hasta} de {total}</span>
      <div className="flex gap-2">
        <button onClick={onAnterior} disabled={!hayAnterior || deshabilitado} className={boton}>Anterior</button>
        <button onClick={onSiguiente} disabled={!haySiguiente || deshabilitado} className={boton}>Siguiente</button>
      </div>
    </div>
  )
}

export default Paginador
