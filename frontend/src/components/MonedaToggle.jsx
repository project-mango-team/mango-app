// Toggle USD / ARS
const MonedaToggle = ({ moneda, onChange, opciones = ['ARS', 'USD'] }) => (
  <div className="flex rounded-lg border border-gray-700 overflow-hidden" role="group" aria-label="Moneda">
    {opciones.map(m => (
      <button
        key={m}
        onClick={() => onChange(m)}
        aria-pressed={moneda === m}
        className={`px-4 py-2 text-sm font-medium ${moneda === m ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
      >
        {m}
      </button>
    ))}
  </div>
)

export default MonedaToggle
