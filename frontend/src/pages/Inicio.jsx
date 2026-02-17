import { useState, useEffect } from 'react'
import { statsService, transactionService } from '../services/transactionService'
import ExpensesPieChart from '../components/charts/ExpensesPieChart'
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

  useEffect(() => {
    loadYears()
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
          <ExpensesPieChart key={`pie-${chartKey}`} data={categoriesData} />
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
                  <option value="Servicios">Servicios</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Comida">Comida</option>
                  <option value="Compras">Compras</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                  <option value="Salud">Salud</option>
                  <option value="Educación">Educación</option>
                  <option value="Otros">Otros</option>
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
    </div>
  )
}

export default Inicio
