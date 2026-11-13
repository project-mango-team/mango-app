// PUL-06: en la revisión, por qué la fila tiene esa categoría (qué regla la eligió). Solo informa:
// si la categoría ya la cambió el usuario a mano, no se muestra.
const ORIGEN = { keywords: ' (asociación anterior)', aprendida: ' (aprendida)' }

export const textoMotivo = (motivo) => {
  const origen = ORIGEN[motivo.creada_por] || ''
  if (motivo.texto === null || motivo.texto === undefined) return `Regla: por origen, tipo o monto → ${motivo.categoria}${origen}`
  if (motivo.modo === 'regex') return `Regla: coincide con /${motivo.texto}/ → ${motivo.categoria}${origen}`
  return `Regla: contiene "${motivo.texto}" → ${motivo.categoria}${origen}`
}

const MotivoCategoria = ({ fila }) => {
  if (fila.categoria_fija) {
    return <p className="mt-1 text-xs text-gray-500">Categoría fijada por el resumen: las reglas no la cambian.</p>
  }
  const motivo = fila.regla_motivo
  if (!motivo || fila.categoria !== motivo.categoria) return null
  return <p className="mt-1 text-xs text-gray-500">{textoMotivo(motivo)}</p>
}

export default MotivoCategoria
