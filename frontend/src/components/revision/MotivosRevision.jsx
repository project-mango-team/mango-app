import { motivosDeRevision, etiquetaMotivo } from '../../utils/revision'

const BotonIcono = ({ onClick, title, clase, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${clase}`}
  >
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={children} />
    </svg>
  </button>
)

// Chips con lo que hay que mirar de la fila (duplicada e interna sugerida tienen su propio aviso).
// Tilde: está bien así. Cruz: no importar esta fila.
const MotivosRevision = ({ t, limites, revisar, revisada, onRevisada, onDescartar }) => {
  if (!revisar) return null
  const motivos = motivosDeRevision(t, limites)
  if (revisada || motivos.length === 0) return <p className="mt-1 text-xs text-green-400">✓ Revisada</p>
  const etiquetas = motivos.map(m => etiquetaMotivo(m, t, limites)).filter(Boolean)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {etiquetas.map(e => (
        <span key={e} className="rounded bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-300">{e}</span>
      ))}
      <BotonIcono onClick={onRevisada} title="Está bien así" clase="border-green-800 text-green-400 hover:bg-green-900/40">M5 13l4 4L19 7</BotonIcono>
      {onDescartar && (
        <BotonIcono onClick={onDescartar} title="No importar esta fila" clase="border-red-800 text-red-400 hover:bg-red-900/40">M6 18L18 6M6 6l12 12</BotonIcono>
      )}
    </div>
  )
}

export default MotivosRevision
