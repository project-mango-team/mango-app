import { useState, useEffect } from 'react'
import { categoryService } from '../services/transactionService'

const MONEDAS = ['ARS', 'USD']

const TransactionEditor = ({ initialTransactions, onSave, onCancel, isManualMode = false }) => {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [totals, setTotals] = useState({ gastosARS: 0, gastosUSD: 0, ingresosARS: 0, ingresosUSD: 0 })

  useEffect(() => {
    // Load categories
    const loadCategories = async () => {
      try {
        const response = await categoryService.getAll()
        setCategories(response.data)
      } catch (err) {
        console.error('Error loading categories:', err)
        // Fallback to default categories
        setCategories(['Otros'])
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    // Initialize with a unique id for each transaction for tracking
    const transactionsWithId = initialTransactions.map((t, idx) => ({
      ...t,
      _id: idx
    }))
    setTransactions(transactionsWithId)
  }, [initialTransactions])

  useEffect(() => {
    // Calculate totals whenever transactions change
    const gastos = transactions.filter(t => t.tipo === 'Gasto')
    const ingresos = transactions.filter(t => t.tipo === 'Ingreso')
    
    const gastosARS = gastos.filter(t => t.moneda === 'ARS').reduce((sum, t) => sum + (parseFloat(t.monto_original) || 0), 0)
    const gastosUSD = gastos.filter(t => t.moneda === 'USD').reduce((sum, t) => sum + (parseFloat(t.monto_original) || 0), 0)
    const ingresosARS = ingresos.filter(t => t.moneda === 'ARS').reduce((sum, t) => sum + (parseFloat(t.monto_original) || 0), 0)
    const ingresosUSD = ingresos.filter(t => t.moneda === 'USD').reduce((sum, t) => sum + (parseFloat(t.monto_original) || 0), 0)
    
    setTotals({
      gastosARS,
      gastosUSD,
      ingresosARS,
      ingresosUSD
    })
  }, [transactions])

  const handleCellChange = (id, field, value) => {
    setTransactions(prev => prev.map(t => 
      t._id === id ? { ...t, [field]: value } : t
    ))
  }

  const handleAddRow = () => {
    const newId = Math.max(...transactions.map(t => t._id), 0) + 1
    const newTransaction = {
      _id: newId,
      fecha: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
      categoria: 'Otros',
      detalle: '',
      importe: 0,
      moneda: 'ARS',
      monto_original: 0,
      tipo: 'Gasto',
      origen: 'Manual'
    }
    setTransactions(prev => [...prev, newTransaction])
  }

  const handleDeleteRow = (id) => {
    setTransactions(prev => prev.filter(t => t._id !== id))
  }

  const handleSave = () => {
    // Remove the temporary _id before sending
    const cleanTransactions = transactions.map(({ _id, ...rest }) => rest)
    onSave(cleanTransactions)
  }

  return (
    <div className="space-y-4">
      {!isManualMode && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Verificar y Editar Datos</h3>
            <button
              onClick={handleAddRow}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              + Agregar Fila
            </button>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-xs text-gray-400 mb-1">Gastos en Pesos</p>
              <p className="text-lg font-semibold text-red-400">
                ${totals.gastosARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
        </div>
        <div className="p-3 bg-gray-800/50 rounded">
          <p className="text-xs text-gray-400 mb-1">Gastos en Dólares</p>
          <p className="text-lg font-semibold text-red-400">
            U$S {totals.gastosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 bg-gray-800/50 rounded">
          <p className="text-xs text-gray-400 mb-1">Ingresos en Pesos</p>
          <p className="text-lg font-semibold text-green-400">
            ${totals.ingresosARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 bg-gray-800/50 rounded">
          <p className="text-xs text-gray-400 mb-1">Ingresos en Dólares</p>
          <p className="text-lg font-semibold text-green-400">
            U$S {totals.ingresosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      </>
      )}

      {/* Editable Table */}
      <div className="overflow-x-auto bg-gray-800/20 rounded-lg border border-gray-700/50">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Tipo</th>
              <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Categoría</th>
              <th className="text-left py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Detalle</th>
              <th className="text-right py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Importe</th>
              <th className="text-center py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Moneda</th>
              <th className="text-right py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Monto Original</th>
              <th className="text-center py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide w-16"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t._id} className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={t.fecha}
                    onChange={(e) => handleCellChange(t._id, 'fecha', e.target.value)}
                    className="w-24 bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </td>
                <td className="py-2 px-3">
                  {isManualMode ? (
                    <select
                      value={t.tipo}
                      onChange={(e) => handleCellChange(t._id, 'tipo', e.target.value)}
                      className="w-full bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="Gasto">Gasto</option>
                      <option value="Ingreso">Ingreso</option>
                    </select>
                  ) : (
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      t.tipo === 'Gasto' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
                    }`}>
                      {t.tipo}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <select
                    value={t.categoria}
                    onChange={(e) => handleCellChange(t._id, 'categoria', e.target.value)}
                    className="w-full bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={t.detalle}
                    onChange={(e) => handleCellChange(t._id, 'detalle', e.target.value)}
                    className="w-full min-w-[200px] bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={t.importe}
                    onChange={(e) => handleCellChange(t._id, 'importe', parseFloat(e.target.value) || 0)}
                    className="w-28 text-right bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    step="0.01"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={t.moneda}
                    onChange={(e) => handleCellChange(t._id, 'moneda', e.target.value)}
                    className="w-20 bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors text-center"
                  >
                    {MONEDAS.map(mon => (
                      <option key={mon} value={mon}>{mon}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={t.monto_original}
                    onChange={(e) => handleCellChange(t._id, 'monto_original', parseFloat(e.target.value) || 0)}
                    className="w-28 text-right bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    step="0.01"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => handleDeleteRow(t._id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="Eliminar fila"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {isManualMode && (
              <tr>
                <td colSpan="8" className="py-3 px-3">
                  <button
                    onClick={handleAddRow}
                    className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {transactions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay transacciones. Hace click en "Agregar Fila" para comenzar.
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end pt-4 border-t border-gray-700">
        {!isManualMode && (
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={transactions.length === 0}
        >
          {isManualMode ? 'Guardar Transacciones' : `Guardar ${transactions.length} transacciones`}
        </button>
      </div>
    </div>
  )
}

export default TransactionEditor
