import { useState } from 'react'
import PortfolioTab from '../components/investments/PortfolioTab'
import RendimientosTab from '../components/investments/RendimientosTab'
import PrestamosTab from '../components/loans/PrestamosTab'
import MonedaToggle from '../components/MonedaToggle'
import useMonedaPreferida from '../hooks/useMonedaPreferida'

const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'rendimientos', label: 'Rendimientos' },
  { id: 'prestamos', label: 'Préstamos' }
]


const Inversiones = () => {
  const [tab, setTab] = useState('portfolio')
  const [moneda, setMoneda] = useMonedaPreferida('mango.inversiones.moneda', 'USD')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Inversiones</h1>
          <p className="text-gray-400 mt-1">Lo que tenés, cómo está distribuido y cuánto te rindió</p>
        </div>
        <MonedaToggle moneda={moneda} onChange={setMoneda} opciones={['USD', 'ARS']} />
      </div>

      <div className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_#374151]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => !t.pronto && setTab(t.id)}
            disabled={t.pronto}
            className={`px-3 sm:px-4 py-2 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-primary text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed'
            }`}
          >
            {t.label}
            {t.pronto && <span className="ml-1 sm:ml-2 text-xs text-gray-600">pronto</span>}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && <PortfolioTab moneda={moneda} />}
      {tab === 'rendimientos' && <RendimientosTab moneda={moneda} />}
      {tab === 'prestamos' && <PrestamosTab moneda={moneda} />}
    </div>
  )
}

export default Inversiones
