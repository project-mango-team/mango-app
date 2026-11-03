// Por dónde entró una carga (campo `canal` del historial) y si fue importada sin revisión
export const ETIQUETAS_CANAL = {
  manual: 'Carga manual',
  archivo: 'Archivo',
  bandeja: 'Bandeja',
  mail: 'Mail',
  api: 'Mercado Pago (API)',
  migracion: 'Migración Excel'
}

const OrigenCarga = ({ canal, automatica }) => (
  <span className="inline-flex flex-wrap items-center gap-1">
    <span className="text-xs px-2 py-1 rounded bg-gray-700/60 text-gray-200 border border-gray-600">
      {ETIQUETAS_CANAL[canal] || 'Archivo'}
    </span>
    {automatica && (
      <span className="text-xs px-2 py-1 rounded bg-violet-900/40 text-violet-300 border border-violet-800">automático</span>
    )}
  </span>
)

export default OrigenCarga
