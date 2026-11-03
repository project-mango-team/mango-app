import DeteccionResumenBadge from '../DeteccionResumenBadge'
import TransactionEditor from '../TransactionEditor'

// Formulario de la pestaña Cargar: origen de datos, archivo de resumen y carga manual
const FormularioResumen = ({ carga }) => {
  const {
    origenDatos,
    setOrigenDatos,
    file,
    setFile,
    tipo,
    setTipo,
    loading,
    setMessage,
    isDragging,
    cardType,
    setCardType,
    availableCards,
    setAvailableCards,
    selectedCards,
    setSelectedCards,
    detectingCards,
    tipoResumen,
    setTipoResumen,
    manualKey,
    dolar,
    deteccion,
    handleFileChange,
    handleTipoChange,
    handleCardTypeChange,
    handleCardSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
    saveManualTransactions,
    valorDolar
  } = carga

  return (
    <div className={`card ${origenDatos === 'manual' ? '' : 'max-w-2xl'}`}>
      <div className="space-y-6">
        {/* Origen de datos */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Origen de datos
          </label>
          <select
            value={origenDatos}
            onChange={(e) => {
              setOrigenDatos(e.target.value)
              setTipo('')
              setMessage(null)
            }}
            className="input-field w-full"
          >
            <option value="">Seleccionar...</option>
            <option value="manual">Carga manual</option>
            <option value="resumen">Resumen de cuenta</option>
          </select>
        </div>

        {/* Resumen de cuenta form */}
        {origenDatos === 'resumen' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Archivo
              </label>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/10' 
                    : 'border-gray-600 hover:border-primary'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.pdf,.txt"
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <p className="text-gray-400 mb-2">
                    {file ? file.name : 'Click para seleccionar o arrastra tu archivo aquí'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Formatos: PDF, XLSX, CSV o TXT · el banco y el tipo se reconocen solos
                  </p>
                </label>
              </div>
              <DeteccionResumenBadge deteccion={deteccion.deteccion} detectando={deteccion.detectando} />
            </div>

            {/* Banco/Fuente */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Banco / Fuente
              </label>
              <select
                value={tipo}
                onChange={(e) => handleTipoChange(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Seleccionar...</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="santander">Santander</option>
                <option value="galicia">Galicia</option>
              </select>
            </div>

            {/* Tipo de tarjeta (solo para Santander) */}
            {tipo === 'santander' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de tarjeta
                </label>
                <select
                  value={cardType}
                  onChange={(e) => handleCardTypeChange(e.target.value)}
                  className="input-field w-full"
                  disabled={!file}
                >
                  <option value="">Seleccionar...</option>
                  <option value="visa">Visa</option>
                  <option value="amex" disabled>Amex (próximamente)</option>
                </select>
              </div>
            )}

            {/* Tipo de resumen (solo para Galicia) */}
            {tipo === 'galicia' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de resumen
                </label>
                <select
                  value={tipoResumen}
                  onChange={(e) => setTipoResumen(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Seleccionar...</option>
                  <option value="cuenta">Movimientos en Caja de Ahorro (XLSX o CSV)</option>
                  <option value="tarjeta">Tarjeta Visa o Mastercard (PDF o TXT)</option>
                </select>
              </div>
            )}

            {/* Tarjetas detectadas (solo para Santander) */}
            {tipo === 'santander' && cardType && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tarjetas a importar
                </label>
                {detectingCards ? (
                  <div className="text-sm text-gray-400">Detectando tarjetas...</div>
                ) : availableCards.length > 0 ? (
                  <div className="space-y-2">
                    {availableCards.map(card => (
                      <label key={card} className="flex items-center p-2 rounded hover:bg-gray-700/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCards.includes(card)}
                          onChange={() => handleCardSelection(card)}
                          className="mr-3 w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary focus:ring-2"
                        />
                        <span className="text-sm text-gray-300">{card}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No se detectaron tarjetas</p>
                )}
              </div>
            )}

            {/* Valor dólar (solo para Santander y Galicia Tarjeta) */}
            {(tipo === 'santander' || (tipo === 'galicia' && tipoResumen === 'tarjeta')) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cotización del dólar
                </label>
                <input
                  type="number"
                  value={valorDolar}
                  onChange={(e) => dolar.setValorDolar(e.target.value)}
                  className="input-field w-full"
                  step="0.01"
                  placeholder={dolar.loading ? 'Cargando cotización...' : 'Ingresá la cotización'}
                />
                {dolar.error && (
                  <p className="text-xs text-red-400 mt-1">{dolar.error}</p>
                )}
                {dolar.cotizacion && (
                  <p className="text-xs text-gray-500 mt-1">
                    Dólar oficial venta: ${dolar.cotizacion.venta.toLocaleString('es-AR')} ({dolar.cotizacion.fuente}
                    {dolar.cotizacion.fechaActualizacion && `, ${new Date(dolar.cotizacion.fechaActualizacion).toLocaleDateString('es-AR')}`})
                    {dolar.editado && Number(valorDolar) !== dolar.cotizacion.venta && (
                      <button type="button" onClick={dolar.restablecer} className="ml-2 text-primary hover:underline">
                        Restablecer
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Ayuda para Galicia Tarjeta */}
            {tipo === 'galicia' && tipoResumen === 'tarjeta' && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Cómo importar resumen Galicia</h4>
                <p className="text-sm text-gray-300">
                  Podés subir directamente el archivo <strong>.pdf</strong> descargado de Home Banking o un <strong>.txt</strong> si copiaste el texto del resumen.
                </p>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-4">
              <button 
                type="submit" 
                className="btn-primary flex-1"
                disabled={loading || !file}
              >
                {loading ? 'Analizando...' : 'Analizar Datos'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setTipo('')
                  setCardType('')
                  setAvailableCards([])
                  setSelectedCards([])
                  setTipoResumen('')
                  deteccion.limpiar()
                  setMessage(null)
                  const fileInput = document.getElementById('file-upload')
                  if (fileInput) fileInput.value = ''
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Limpiar
              </button>
            </div>
          </form>
        )}

        {/* Carga manual form */}
        {origenDatos === 'manual' && (
          <TransactionEditor
            key={manualKey}
            initialTransactions={[
              {
                fecha: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
                categoria: 'Otros',
                detalle: '',
                importe: 0,
                moneda: 'ARS',
                monto_original: 0,
                tipo: 'Gasto',
                origen: 'Carga Manual'
              }
            ]}
            onSave={saveManualTransactions}
            isManualMode={true}
          />
        )}
      </div>
    </div>
  )
}

export default FormularioResumen
