import useBandeja from '../../hooks/useBandeja'
import useCargaResumen from '../../hooks/useCargaResumen'
import BandejaDropzone from '../bandeja/BandejaDropzone'
import PendientesBandeja from './carga/PendientesBandeja'
import CargaArchivoManual from './carga/CargaArchivoManual'
import MensajeCarga from './carga/MensajeCarga'
import ModalProgreso from '../ModalProgreso'
import HistorialCargas from './historial/HistorialCargas'

// Una sola superficie para cargar datos: soltar archivos (la detección arma la lista de pendientes), los
// pendientes que llegan por mail o API y, abajo, el historial. "Carga manual" abre el flujo con banco,
// tipo y tarjetas a mano.
const CargarTab = () => {
  const bandeja = useBandeja()
  const carga = useCargaResumen()
  const { origenDatos, setOrigenDatos, setMessage, setFile, setTipo, setCardType, setAvailableCards, setSelectedCards, setTipoResumen, handleCancelEditor, deteccion } = carga
  const ocupadoManual = carga.loading || carga.saving || carga.detectingCards || Boolean(deteccion.detectando)
  const enModoManual = origenDatos !== ''
  const listos = bandeja.documentos.filter(d => d.estado === 'listo')

  const elegirOrigen = (origen) => {
    setMessage(null)
    setTipo('')
    setOrigenDatos(origen)
  }

  const volver = () => {
    handleCancelEditor()
    setMessage(null)
    setFile(null)
    setTipo('')
    setCardType('')
    setAvailableCards([])
    setSelectedCards([])
    setTipoResumen('')
    deteccion.limpiar()
    setOrigenDatos('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Cargar</h2>
          <p className="text-gray-400 mt-1">Soltá tus resúmenes, revisá los que llegan por mail e importalos</p>
        </div>
        {!enModoManual && (
          <div className="flex flex-wrap gap-2">
            {listos.length > 0 && (
              <button onClick={bandeja.importarListos} disabled={bandeja.ocupado} className="btn-primary disabled:opacity-50">
                Importar {listos.length} listo{listos.length === 1 ? '' : 's'}
              </button>
            )}
            <button onClick={() => elegirOrigen('manual')} className="btn-secondary">Carga manual</button>
          </div>
        )}
      </div>

      <MensajeCarga mensaje={carga.message} />

      {enModoManual ? (
        <CargaArchivoManual carga={carga} onVolver={volver} deshabilitado={ocupadoManual} />
      ) : (
        <>
          <div>
            <BandejaDropzone onArchivos={bandeja.subir} deshabilitado={bandeja.ocupado} />
            <button onClick={() => elegirOrigen('resumen')} className="mt-2 text-sm text-gray-400 hover:text-white underline">
              Elegir banco, tipo y tarjetas a mano
            </button>
          </div>
          <PendientesBandeja bandeja={bandeja} />
        </>
      )}

      <ModalProgreso progreso={bandeja.progreso} />
      <ModalProgreso progreso={carga.progreso} />

      <section id="historial">
        <HistorialCargas />
      </section>
    </div>
  )
}

export default CargarTab
