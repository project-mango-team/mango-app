import { useState } from 'react'
import PortfolioTab from '../components/investments/PortfolioTab'

const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'rendimientos', label: 'Rendimientos', pronto: true },
  { id: 'prestamos', label: 'Préstamos', pronto: true }
]

const MONEDA_KEY = 'mango.inversiones.moneda'

const leerMoneda = () => {
  try {
    return localStorage.getItem(MONEDA_KEY) === 'ARS' ? 'ARS' : 'USD'
  } catch {
    return 'USD'
  }
}

const Inversiones = () => {
  const [tab, setTab] = useState('portfolio')
  const [moneda, setMonedaState] = useState(leerMoneda)

  const setMoneda = (m) => {
    setMonedaState(m)
    try {
      localStorage.setItem(MONEDA_KEY, m)
    } catch {
      // Sin storage disponible: el toggle funciona igual, solo no se recuerda
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Inversiones</h1>
          <p className="text-gray-400 mt-1">Lo que tenés, cómo está distribuido y cuánto te rindió</p>
        </div>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          {['USD', 'ARS'].map(m => (
            <button
              key={m}
              onClick={() => setMoneda(m)}
              className={`px-4 py-2 text-sm font-medium ${moneda === m ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-700">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => !t.pronto && setTab(t.id)}
            disabled={t.pronto}
            className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-primary text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed'
            }`}
          >
            {t.label}
            {t.pronto && <span className="ml-2 text-xs text-gray-600">pronto</span>}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && <PortfolioTab moneda={moneda} />}
    </div>
  )
}

export default Inversiones
