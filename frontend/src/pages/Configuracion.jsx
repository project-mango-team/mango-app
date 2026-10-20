import TokensIntegracion from '../components/config/TokensIntegracion'
import TareasProgramadas from '../components/config/TareasProgramadas'

const Configuracion = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold text-white">Configuración</h1>
      <p className="text-gray-400 mt-1">Integraciones y preferencias</p>
    </div>
    <TokensIntegracion />
    <TareasProgramadas />
  </div>
)

export default Configuracion
