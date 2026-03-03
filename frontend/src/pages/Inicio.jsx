import { useState, useEffect } from 'react'
import { statsService, transactionService, categoryService } from '../services/transactionService'
import ExpensesPieChart, { COLORS } from '../components/charts/ExpensesPieChart'
import MonthlyComparisonChart from '../components/charts/MonthlyComparisonChart'
import BalanceLineChart from '../components/charts/BalanceLineChart'

const Inicio = () => {
  const [stats, setStats] = useState(null)
  const [categoriesData, setCategoriesData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [availableYears, setAvailableYears] = useState([])
  const [selectedYear, setSelectedYear] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartKey, setChartKey] = useState(0)
  
  // Categories management
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [categoryMessage, setCategoryMessage] = useState(null)
  
  // Transaction search states
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    tipo: '',
    categoria: '',
    moneda: '',
    mes: '',
    origen: ''
  })
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearch, setShowSearch] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const pageSize = 20
  
  // Transaction editing states
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  useEffect(() => {
    loadYears()
    loadCategories()
  }, [])

  useEffect(() => {
    loadStats(selectedYear)
  }, [selectedYear])

  useEffect(() => {
    // Load first page of transactions when year changes or on initial mount
    const loadTransactions = async () => {
      try {
        setSearchLoading(true)
        const filters = {
          year: selectedYear,
          limit: pageSize,
          skip: 0
        }
        
        // Remove empty filters
        Object.keys(filters).forEach(key => {
          if (filters[key] === '' || filters[key] === null) {
            delete filters[key]
          }
        })
        
        const response = await transactionService.getAll(filters)
        setSearchResults(response.data)
        setTotalResults(response.total)
        setCurrentPage(1)
      } catch (err) {
        console.error('Error loading transactions:', err)
      } finally {
        setSearchLoading(false)
      }
    }
    
    loadTransactions()
  }, [selectedYear])

  const loadYears = async () => {
    try {
      const response = await statsService.getYears()
      setAvailableYears(response.data)
      // Keep 'all' as default - don't auto-select current year
    } catch (err) {
      console.error('Error loading years:', err)
    }
  }

  const loadStats = async (year) => {
    try {
      setLoading(true)
      const [statsResponse, categoriesResponse, monthlyResponse] = await Promise.all([
        statsService.getStats(year),
        statsService.getByCategory(year),
        statsService.getMonthlySummary(year)
      ])
      
      setStats(statsResponse.data)
      setCategoriesData(categoriesResponse.data)
      setMonthlyData(monthlyResponse.data)
      setChartKey(prev => prev + 1) // Increment to trigger chart re-animation
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await categoryService.getAll()
      setCategories(response.data)
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryMessage({ type: 'error', text: 'El nombre no puede estar vacío' })
      return
    }

    try {
      const response = await categoryService.create(newCategoryName.trim())
      setCategories(response.data)
      setNewCategoryName('')
      setIsAddingCategory(false)
      setCategoryMessage({ type: 'success', text: 'Categoría agregada' })
      setTimeout(() => setCategoryMessage(null), 3000)
    } catch (err) {
      setCategoryMessage({ type: 'error', text: err.response?.data?.message || 'Error al agregar categoría' })
      setTimeout(() => setCategoryMessage(null), 3000)
    }
  }

  const handleEditCategory = async (oldName) => {
    const newName = editingValue
    if (!newName?.trim() || newName === oldName) {
      setEditingCategory(null)
      setEditingValue('')
      return
    }

    try {
      const response = await categoryService.update(oldName, newName.trim())
      setCategories(response.data)
      setEditingCategory(null)
      setEditingValue('')
      setCategoryMessage({ type: 'success', text: 'Categoría actualizada' })
      setTimeout(() => setCategoryMessage(null), 3000)
    } catch (err) {
      setCategoryMessage({ type: 'error', text: err.response?.data?.message || 'Error al actualizar categoría' })
      setTimeout(() => setCategoryMessage(null), 3000)
      setEditingCategory(null)
      setEditingValue('')
    }
  }

  const handleDeleteCategory = async (name) => {
    if (!confirm(`¿Eliminar la categoría "${name}"? Las transacciones con esta categoría no se eliminarán.`)) {
      return
    }

    try {
      const response = await categoryService.delete(name)
      setCategories(response.data)
      setCategoryMessage({ type: 'success', text: 'Categoría eliminada' })
      setTimeout(() => setCategoryMessage(null), 3000)
    } catch (err) {
      setCategoryMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar categoría' })
      setTimeout(() => setCategoryMessage(null), 3000)
    }
  }

  const getCategoryColor = (categoryName) => {
    const index = categoriesData.findIndex(cat => cat.categoria === categoryName)
    if (index === -1) return '#6B7280' // Gray color for categories not in chart
    return COLORS[index % COLORS.length]
  }

  const searchTransactions = async (page = currentPage) => {
    try {
      setSearchLoading(true)
      const filters = {
        ...searchFilters,
        year: selectedYear,
        limit: pageSize,
        skip: (page - 1) * pageSize
      }
      
      // Remove empty filters
      Object.keys(filters).forEach(key => {
        if (filters[key] === '' || filters[key] === null) {
          delete filters[key]
        }
      })
      
      const response = await transactionService.getAll(filters)
      setSearchResults(response.data)
      setTotalResults(response.total)
      setCurrentPage(page)
    } catch (err) {
      console.error('Error searching transactions:', err)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchFilterChange = (key, value) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearSearch = () => {
    setSearchFilters({
      search: '',
      tipo: '',
      categoria: '',
      moneda: '',
      mes: '',
      origen: ''
    })
    setCurrentPage(1)
    searchTransactions(1)
  }

  const handlePageChange = (newPage) => {
    searchTransactions(newPage)
  }

  const handleEditTransaction = (transaction) => {
    setEditingTransaction({...transaction})
    setEditModalOpen(true)
  }

  const handleSaveTransaction = async () => {
    try {
      // Guardar posición del scroll del contenedor main
      const mainElement = document.querySelector('main')
      const scrollPosition = mainElement?.scrollTop || 0
      
      await transactionService.update(editingTransaction._id, editingTransaction)
      setEditModalOpen(false)
      setEditingTransaction(null)
      
      // Recargar datos
      await Promise.all([
        searchTransactions(currentPage),
        loadStats(selectedYear)
      ])
      
      // Restaurar posición del scroll
      setTimeout(() => {
        if (mainElement) {
          mainElement.scrollTop = scrollPosition
        }
      }, 100)
    } catch (err) {
      console.error('Error updating transaction:', err)
      alert(err.response?.data?.message || 'Error al actualizar transacción')
    }
  }

  const handleDeleteTransaction = async (transactionId) => {
    if (!confirm('¿Estás seguro de eliminar esta transacción?')) {
      return
    }

    try {
      // Guardar posición del scroll del contenedor main
      const mainElement = document.querySelector('main')
      const scrollPosition = mainElement?.scrollTop || 0
      
      await transactionService.delete(transactionId)
      
      // Recargar datos
      await Promise.all([
        searchTransactions(currentPage),
        loadStats(selectedYear)
      ])
      
      // Restaurar posición del scroll
      setTimeout(() => {
        if (mainElement) {
          mainElement.scrollTop = scrollPosition
        }
      }, 100)
    } catch (err) {
      console.error('Error deleting transaction:', err)
      alert(err.response?.data?.message || 'Error al eliminar transacción')
    }
  }

  const handleEditFieldChange = (field, value) => {
    setEditingTransaction(prev => ({ ...prev, [field]: value }))
  }

  const totalPages = Math.ceil(totalResults / pageSize)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <img src="/logo.svg" alt="Loading" className="w-16 h-16 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Cargando estadísticas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-900/20 border-red-800">
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }

  const balanceColor = (stats?.balance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Vista general</h1>
        <p className="text-gray-400">Gráficos con métricas y análisis</p>
      </div>

      {/* Filtro de año */}
      <div className="card bg-gray-800/50 border-gray-700">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-300">Filtrar por año:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="input-field w-48"
          >
            <option value="all">Todos los años</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {selectedYear === 'all' ? 'Mostrando todos los datos' : `Mostrando datos de ${selectedYear}`}
          </span>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-400 mb-2">Balance</p>
          <p className={`text-4xl font-bold ${balanceColor}`}>
            ${(stats?.balance ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card">
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1">Total Ingresos</p>
            <p className="text-2xl font-semibold text-green-400">
              ${(stats?.total_ingresos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Gastos</p>
            <p className="text-2xl font-semibold text-red-400">
              ${(stats?.total_gastos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="card">
          <p className="text-sm text-gray-400 mb-2">Transacciones</p>
          <p className="text-3xl font-bold text-primary">
            {(stats?.num_transacciones ?? 0).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="space-y-6">
        {/* Gráfico de torta - Gastos por categoría */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Gastos por Categoría</h2>
          
          <div className="flex gap-6">
            {/* Pie Chart */}
            <div className="flex-1">
              <ExpensesPieChart key={`pie-${chartKey}`} data={categoriesData} />
            </div>
            
            {/* Categories List */}
            <div className="w-72 border-l border-gray-700 pl-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Categorías</h3>
              
              {categoryMessage && (
                <div className={`mb-3 p-2 rounded text-xs ${
                  categoryMessage.type === 'error' 
                    ? 'bg-red-900/20 text-red-400 border border-red-800' 
                    : 'bg-green-900/20 text-green-400 border border-green-800'
                }`}>
                  {categoryMessage.text}
                </div>
              )}
              
              <div 
                className="space-y-1 max-h-96 overflow-y-auto pr-2"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4B5563 transparent'
                }}
              >
                <style dangerouslySetInnerHTML={{__html: `
                  .space-y-1::-webkit-scrollbar {
                    width: 8px;
                  }
                  .space-y-1::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .space-y-1::-webkit-scrollbar-thumb {
                    background-color: #4B5563;
                    border-radius: 4px;
                    border: 2px solid transparent;
                  }
                  .space-y-1::-webkit-scrollbar-thumb:hover {
                    background-color: #6B7280;
                  }
                `}} />
                {loadingCategories ? (
                  <div className="text-sm text-gray-500">Cargando...</div>
                ) : (
                  <>
                    {categories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-800/50 group"
                      >
                        {editingCategory === cat ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingValue}
                              autoFocus
                              onBlur={(e) => {
                                // Pequeño delay para que el click del botón se registre primero
                                setTimeout(() => handleEditCategory(cat), 100)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditCategory(cat)
                                if (e.key === 'Escape') {
                                  setEditingCategory(null)
                                  setEditingValue('')
                                }
                              }}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => handleEditCategory(cat)}
                              onMouseDown={(e) => e.preventDefault()} // Previene el blur del input
                              className="p-1.5 text-green-500 hover:text-green-400 transition-colors"
                              title="Confirmar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-1">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getCategoryColor(cat) }}
                              />
                              <span className="text-sm text-gray-300">{cat}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => {
                                  setEditingCategory(cat)
                                  setEditingValue(cat)
                                }}
                                className="p-1 text-gray-400 hover:text-primary transition-colors"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                title="Eliminar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
              
              {/* Add Category */}
              {isAddingCategory ? (
                <div className="mt-3 p-2 border border-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory()
                        if (e.key === 'Escape') {
                          setIsAddingCategory(false)
                          setNewCategoryName('')
                        }
                      }}
                      placeholder="Nueva categoría"
                      autoFocus
                      className="flex-1 bg-gray-800 border border-gray-600 text-sm text-gray-100 px-2 py-1.5 rounded focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleAddCategory}
                      className="p-1.5 text-green-500 hover:text-green-400 transition-colors"
                      title="Agregar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingCategory(false)
                        setNewCategoryName('')
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                      title="Cancelar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className="mt-3 w-full p-2 text-sm text-gray-400 hover:text-primary hover:bg-gray-800/50 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar categoría
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico de barras - Comparativa mensual */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Comparativa Mensual</h2>
          <MonthlyComparisonChart data={monthlyData} />
        </div>

        {/* Gráfico de línea - Balance mensual */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Evolución del Balance</h2>
          <BalanceLineChart data={monthlyData} />
        </div>
      </div>

      {/* Transaction Search */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Transacciones</h2>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-sm text-primary hover:text-primary/80"
          >
            {showSearch ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showSearch && (
          <>
            {/* Search Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Buscar en detalle
                </label>
                <input
                  type="text"
                  value={searchFilters.search}
                  onChange={(e) => handleSearchFilterChange('search', e.target.value)}
                  placeholder="Ej: Netflix, supermercado..."
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo
                </label>
                <select
                  value={searchFilters.tipo}
                  onChange={(e) => handleSearchFilterChange('tipo', e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  <option value="Gasto">Gasto</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Categoría
                </label>
                <select
                  value={searchFilters.categoria}
                  onChange={(e) => handleSearchFilterChange('categoria', e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todas</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Moneda
                </label>
                <select
                  value={searchFilters.moneda}
                  onChange={(e) => handleSearchFilterChange('moneda', e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todas</option>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mes
                </label>
                <select
                  value={searchFilters.mes}
                  onChange={(e) => handleSearchFilterChange('mes', e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  <option value="Enero">Enero</option>
                  <option value="Febrero">Febrero</option>
                  <option value="Marzo">Marzo</option>
                  <option value="Abril">Abril</option>
                  <option value="Mayo">Mayo</option>
                  <option value="Junio">Junio</option>
                  <option value="Julio">Julio</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Septiembre">Septiembre</option>
                  <option value="Octubre">Octubre</option>
                  <option value="Noviembre">Noviembre</option>
                  <option value="Diciembre">Diciembre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Origen
                </label>
                <select
                  value={searchFilters.origen}
                  onChange={(e) => handleSearchFilterChange('origen', e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Santander">Santander</option>
                  <option value="Excel">Excel</option>
                </select>
              </div>
            </div>

            {/* Search Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => searchTransactions(1)}
                disabled={searchLoading}
                className="btn-primary"
              >
                {searchLoading ? 'Buscando...' : 'Buscar'}
              </button>
              <button
                onClick={clearSearch}
                className="btn-secondary"
              >
                Limpiar
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-300">Fecha</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-300">Mes</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-300">Detalle</th>
                      <th className="text-left py-2 px-2 text-sm font-medium text-gray-300">Categoría</th>
                      <th className="text-right py-2 px-2 text-sm font-medium text-gray-300">Importe</th>
                      <th className="text-center py-2 px-2 text-sm font-medium text-gray-300">Tipo</th>
                      <th className="text-center py-2 px-2 text-sm font-medium text-gray-300">Origen</th>
                      <th className="text-center py-2 px-2 text-sm font-medium text-gray-300">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((transaction) => (
                      <tr key={transaction._id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2 px-2 text-sm text-gray-300">{transaction.fecha}</td>
                        <td className="py-2 px-2 text-sm text-gray-400">{transaction.mes}</td>
                        <td className="py-2 px-2 text-sm text-gray-300">{transaction.detalle}</td>
                        <td className="py-2 px-2 text-sm text-gray-400">{transaction.categoria}</td>
                        <td className="py-2 px-2 text-sm text-right font-mono">
                          <span className={transaction.tipo === 'Gasto' ? 'text-red-400' : 'text-green-400'}>
                            {transaction.tipo === 'Gasto' ? '-' : '+'}${transaction.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-gray-500 text-xs ml-1">{transaction.moneda}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-xs px-2 py-1 rounded ${
                            transaction.tipo === 'Gasto' 
                              ? 'bg-red-900/30 text-red-400' 
                              : 'bg-green-900/30 text-green-400'
                          }`}>
                            {transaction.tipo}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-sm text-gray-400">{transaction.origen}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleEditTransaction(transaction)}
                              className="p-1 text-gray-400 hover:text-primary transition-colors"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(transaction._id)}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalResults)} de {totalResults} resultado{totalResults !== 1 ? 's' : ''}
                  </p>
                  
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      
                      <div className="flex gap-1">
                        {[...Array(totalPages)].map((_, idx) => {
                          const pageNum = idx + 1
                          // Show first, last, current, and pages around current
                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-1 text-sm rounded ${
                                  currentPage === pageNum
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {pageNum}
                              </button>
                            )
                          } else if (
                            pageNum === currentPage - 2 ||
                            pageNum === currentPage + 2
                          ) {
                            return <span key={pageNum} className="px-2 text-gray-500">...</span>
                          }
                          return null
                        })}
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {searchResults.length === 0 && !searchLoading && totalResults === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No se encontraron transacciones.
              </p>
            )}

            {searchLoading && (
              <div className="text-center py-8">
                <div className="text-gray-400">Cargando transacciones...</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editModalOpen && editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-100">Editar Transacción</h3>
              <button
                onClick={() => {
                  setEditModalOpen(false)
                  setEditingTransaction(null)
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fecha</label>
                <input
                  type="text"
                  value={editingTransaction.fecha || ''}
                  onChange={(e) => handleEditFieldChange('fecha', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Detalle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Detalle</label>
                <input
                  type="text"
                  value={editingTransaction.detalle || ''}
                  onChange={(e) => handleEditFieldChange('detalle', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Categoría</label>
                <select
                  value={editingTransaction.categoria || ''}
                  onChange={(e) => handleEditFieldChange('categoria', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Importe */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Importe</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingTransaction.importe || ''}
                  onChange={(e) => handleEditFieldChange('importe', parseFloat(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                <select
                  value={editingTransaction.tipo || ''}
                  onChange={(e) => handleEditFieldChange('tipo', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                >
                  <option value="Gasto">Gasto</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
              </div>

              {/* Moneda */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Moneda</label>
                <select
                  value={editingTransaction.moneda || ''}
                  onChange={(e) => handleEditFieldChange('moneda', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-primary"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveTransaction}
                  className="flex-1 btn-primary"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => {
                    setEditModalOpen(false)
                    setEditingTransaction(null)
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inicio
