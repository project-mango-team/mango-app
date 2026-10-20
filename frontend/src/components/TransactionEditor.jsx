import { useState, useEffect, useRef } from 'react'
import { categoryService } from '../services/transactionService'
import { motivosDeRevision, etiquetaMotivo } from '../utils/revision'

const MONEDAS = ['ARS', 'USD']
const INTERNO = 'Movimiento interno'

// Transacciones con `duplicado: true` (ya cargadas) o `ignorada: true` (una regla dice no importarlas) arrancan
// excluidas: se ven atenuadas y no se guardan salvo que se tilden.
// REV-05: arranca mostrando solo las que vale la pena mirar (`limites` = monto alto por categoría)
const TransactionEditor = ({ initialTransactions, onSave, onCancel, isManualMode = false, archivoYaImportado = null, limites = {} }) => {
  const [transactions, setTransactions] = useState([])
  const [paraRevisar, setParaRevisar] = useState(new Set())
  const [soloRevisar, setSoloRevisar] = useState(false)
  const [revisadas, setRevisadas] = useState(new Set())
  const [categories, setCategories] = useState([])
  const [totals, setTotals] = useState({ gastosARS: 0, gastosUSD: 0, ingresosARS: 0, ingresosUSD: 0 })
  const [undoState, setUndoState] = useState(null)
  const [showUndo, setShowUndo] = useState(false)
  const undoTimeoutRef = useRef(null)

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
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Initialize with a unique id for each transaction for tracking
    const transactionsWithId = initialTransactions.map((t, idx) => ({
      ...t,
      _id: idx,
      incluir: !t.duplicado && !t.ignorada
    }))
    setTransactions(transactionsWithId)
    // Las que arrancan dudosas siguen en el filtro aunque se corrijan (no desaparecen mientras se editan)
    const dudosas = new Set(transactionsWithId.filter(t => motivosDeRevision(t, limites).length > 0).map(t => t._id))
    setParaRevisar(dudosas)
    setRevisadas(new Set())
    setSoloRevisar(!isManualMode && dudosas.size > 0)
    setShowUndo(false)
    setUndoState(null)
  }, [initialTransactions])

  useEffect(() => {
    // Calculate totals whenever transactions change
    const incluidas = transactions.filter(t => t.incluir)
    const gastos = incluidas.filter(t => t.tipo === 'Gasto')
    const ingresos = incluidas.filter(t => t.tipo === 'Ingreso')
    
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
    setTransactions(prev => prev.map(t => {
      if (t._id !== id) return t

      if (field === 'importe') {
        return {
          ...t,
          importe: value,
          monto_original: value
        }
      }

      return { ...t, [field]: value }
    }))
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
      origen: 'Manual',
      incluir: true
    }
    setTransactions(prev => [...prev, newTransaction])
  }

  const handleDeleteRow = (id) => {
    setTransactions(prev => {
      const index = prev.findIndex(t => t._id === id)
      if (index === -1) return prev

      const deletedRow = prev[index]
      setUndoState({ row: deletedRow, index })
      setShowUndo(true)

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current)
      }

      undoTimeoutRef.current = setTimeout(() => {
        setShowUndo(false)
        setUndoState(null)
      }, 5000)

      return prev.filter(t => t._id !== id)
    })
  }

  const handleUndoDelete = () => {
    if (!undoState) return

    setTransactions(prev => {
      const next = [...prev]
      const insertIndex = Math.min(Math.max(undoState.index, 0), next.length)
      next.splice(insertIndex, 0, undoState.row)
      return next
    })

    setShowUndo(false)
    setUndoState(null)

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
    }
  }

  const handleSave = () => {
    // Solo las incluidas, sin los campos de la vista previa
    const cleanTransactions = transactions
      .filter(t => t.incluir)
      .map(({ _id, incluir, duplicado, ignorada, regla, interno_sugerido, ...rest }) => ({
        ...rest,
        // REV-04: al guardarla como interna, la contraparte ya cargada también pasa a interna
        ...(rest.categoria === INTERNO && interno_sugerido?.con?._id && { interno_con: interno_sugerido.con._id })
      }))
    onSave(cleanTransactions)
  }

  const cantidadIncluidas = transactions.filter(t => t.incluir).length
  const cantidadDuplicadas = transactions.filter(t => t.duplicado).length
  const cantidadIgnoradas = transactions.filter(t => t.ignorada && !t.duplicado).length
  const internosPendientes = transactions.filter(t => t.interno_sugerido && t.incluir && t.categoria !== INTERNO)
  const pendientesRevision = transactions.filter(t => paraRevisar.has(t._id) && !revisadas.has(t._id) && motivosDeRevision(t, limites).length > 0).length
  const marcarRevisada = (id) => setRevisadas(prev => new Set(prev).add(id))
  // Las filas agregadas a mano (_id fuera de las iniciales) se ven siempre
  const visibles = soloRevisar
    ? transactions.filter(t => paraRevisar.has(t._id) || t._id >= initialTransactions.length)
    : transactions
  const marcarInternos = () => setTransactions(prev => prev.map(t => (internosPendientes.includes(t) ? { ...t, categoria: INTERNO } : t)))

  return (
    <div className="space-y-4">
      {archivoYaImportado && (
        <div className="p-3 rounded-lg border border-yellow-800 bg-yellow-900/20 text-sm text-yellow-300">
          Este mismo archivo ya se importó el {new Date(archivoYaImportado.fecha).toLocaleDateString('es-AR')} ({archivoYaImportado.filename}).
        </div>
      )}
      {cantidadDuplicadas > 0 && (
        <div className="p-3 rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-300">
          {cantidadDuplicadas} transaccion(es) ya estaban cargadas: quedan sin incluir. Si alguna es realmente nueva, tildala.
        </div>
      )}
      {internosPendientes.length > 0 && (
        <div className="p-3 rounded-lg border border-sky-800 bg-sky-900/20 text-sm text-sky-200 flex flex-wrap items-center gap-2">
          <span>{internosPendientes.length} transaccion(es) parecen transferencias entre tus cuentas (mismo monto en otra cuenta, ±2 días).</span>
          <button type="button" onClick={marcarInternos} className="underline hover:text-white">Marcarlas como movimiento interno</button>
        </div>
      )}
      {cantidadIgnoradas > 0 && (
        <div className="p-3 rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-300">
          {cantidadIgnoradas} transaccion(es) quedan sin incluir por una regla de “No importar”. Si querés alguna, tildala.
        </div>
      )}
      {!isManualMode && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Verificar y Editar Datos</h3>
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

      {!isManualMode && paraRevisar.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setSoloRevisar(true)}
              className={`px-3 py-1.5 ${soloRevisar ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              Para revisar ({paraRevisar.size})
            </button>
            <button
              type="button"
              onClick={() => setSoloRevisar(false)}
              className={`px-3 py-1.5 ${!soloRevisar ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              Todas ({transactions.length})
            </button>
          </div>
          <span className="text-gray-400">
            {pendientesRevision > 0
              ? `${pendientesRevision} sin resolver: sin categoría, comercios nuevos, posibles duplicadas o internas y montos altos.`
              : 'Todo revisado.'}
          </span>
        </div>
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
              <th className="text-right py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide" title="Siempre en pesos: los consumos en dólares se pesifican con la cotización del resumen">Importe ($)</th>
              <th className="text-center py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Moneda</th>
              <th className="text-right py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide" title="En la moneda del consumo (US$ si la moneda es USD)">Monto original</th>
              <th className="text-center py-3 px-3 text-gray-400 font-medium text-xs uppercase tracking-wide w-16"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => (
              <tr key={t._id} className={`border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors ${t.incluir ? '' : 'opacity-40'}`}>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={t.fecha}
                    onChange={(e) => handleCellChange(t._id, 'fecha', e.target.value)}
                    className="w-24 bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={t.tipo}
                    onChange={(e) => handleCellChange(t._id, 'tipo', e.target.value)}
                    className="w-full bg-gray-800/50 border-0 border-b border-gray-700 text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="Gasto">Gasto</option>
                    <option value="Ingreso">Ingreso</option>
                  </select>
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
                  <MotivosRevision
                    t={t}
                    limites={limites}
                    revisar={paraRevisar.has(t._id)}
                    revisada={revisadas.has(t._id)}
                    onRevisada={() => marcarRevisada(t._id)}
                  />
                  {t.duplicado && (
                    <label className="mt-1 flex items-center gap-2 text-xs text-yellow-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.incluir}
                        onChange={(e) => handleCellChange(t._id, 'incluir', e.target.checked)}
                      />
                      Ya cargada · incluir igual
                    </label>
                  )}
                  {t.ignorada && !t.duplicado && (
                    <label className="mt-1 flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.incluir}
                        onChange={(e) => handleCellChange(t._id, 'incluir', e.target.checked)}
                      />
                      Ignorada por una regla · incluir igual
                    </label>
                  )}
                  {t.interno_sugerido && !t.duplicado && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-sky-300">
                      <span>
                        ¿Entre tus cuentas? {t.tipo === 'Gasto' ? 'Entró' : 'Salió'} el mismo monto en {t.interno_sugerido.con.origen} el {t.interno_sugerido.con.fecha}
                      </span>
                      {t.categoria === INTERNO
                        ? <span className="text-gray-400">· interno{t.interno_sugerido.con._id && t.interno_sugerido.con.categoria !== INTERNO ? ' (la otra también pasa a interno)' : ''}</span>
                        : <button type="button" onClick={() => handleCellChange(t._id, 'categoria', INTERNO)} className="underline hover:text-white">Marcar interno</button>}
                    </div>
                  )}
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
          disabled={cantidadIncluidas === 0}
        >
          {isManualMode ? 'Guardar Transacciones' : `Guardar ${cantidadIncluidas} transacciones`}
        </button>
      </div>

      {showUndo && undoState && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/90 px-3 py-2 text-xs text-gray-200 shadow-lg hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7H5m0 0l4-4M5 7l4 4m-4 4a7 7 0 101.93-4.96" />
            </svg>
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}

// Chips con lo que hay que mirar de la fila (duplicada e interna sugerida tienen su propio aviso)
const MotivosRevision = ({ t, limites, revisar, revisada, onRevisada }) => {
  if (!revisar) return null
  const motivos = motivosDeRevision(t, limites)
  if (revisada || motivos.length === 0) return <p className="mt-1 text-xs text-green-400">✓ Revisada</p>
  const etiquetas = motivos.map(m => etiquetaMotivo(m, t, limites)).filter(Boolean)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {etiquetas.map(e => (
        <span key={e} className="rounded bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-300">{e}</span>
      ))}
      <button type="button" onClick={onRevisada} className="text-xs text-gray-400 hover:text-white underline" title="Está bien así">
        OK
      </button>
    </div>
  )
}

export default TransactionEditor
