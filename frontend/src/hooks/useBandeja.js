import { useCallback, useEffect, useState } from 'react'
import { bandejaService } from '../services/bandejaService'
import useProgreso from './useProgreso'

// Avisa a otros componentes (el badge del menú) que la bandeja cambió
export const BANDEJA_CAMBIO = 'mango:bandeja-cambio'
const avisarCambio = () => window.dispatchEvent(new Event(BANDEJA_CAMBIO))

// Documentos de la bandeja y las acciones sobre ellos
const useBandeja = () => {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const progreso = useProgreso()

  const recargar = useCallback(async () => {
    try {
      const res = await bandejaService.listar()
      setDocumentos(res.data)
    } catch (err) {
      // Se recarga seguido y solo: un error acá no abre ningún cartel
      console.error('Error cargando la bandeja:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
    // Un documento que vuelve a la bandeja (revertir una carga desde el historial) o una carga nueva
    window.addEventListener(BANDEJA_CAMBIO, recargar)
    return () => window.removeEventListener(BANDEJA_CAMBIO, recargar)
  }, [recargar])

  // Corre una acción mostrando el modal de progreso (cargando y después el resultado) y recarga la lista.
  // Sin `textoOk` el modal se cierra solo al terminar. Devuelve lo que devolvió la acción, o null si falló.
  const ejecutar = async (titulo, cargando, accion, textoOk) => {
    setOcupado(true)
    let data = null
    const res = await progreso.ejecutar(titulo, async () => {
      data = await accion()
      const texto = typeof textoOk === 'function' ? textoOk(data) : textoOk
      return texto || null
    }, { cargando, errorPorDefecto: 'No se pudo completar la acción' })
    setOcupado(false)
    // El aviso recarga la lista (acá, el badge y el historial)
    avisarCambio()
    return res === undefined ? null : data
  }

  const subir = (files) => ejecutar('Subir archivos', 'Leyendo y detectando los resúmenes…', () => bandejaService.subir(files), (res) => {
    const nuevos = res.data.filter(r => r.ok && !r.existente).length
    const repetidos = res.data.filter(r => r.ok && r.existente).length
    const fallidos = res.data.filter(r => !r.ok)
    const avisos = res.data.filter(r => r.ok && !r.existente && r.documento?.cierra_aviso).length
    return [
      `${nuevos} archivo(s) agregados`,
      repetidos && `${repetidos} ya estaban en la lista`,
      avisos && `${avisos === 1 ? 'se cerró 1 aviso' : `se cerraron ${avisos} avisos`} de resumen pendiente`,
      fallidos.length && `no se pudieron leer: ${fallidos.map(f => f.filename).join(', ')}`
    ].filter(Boolean).join(' · ')
  })

  return {
    documentos,
    loading,
    ocupado,
    progreso,
    recargar,
    subir,
    importar: (id, transactions) => ejecutar('Importar resumen', 'Importando las transacciones…', () => bandejaService.importar(id, transactions), (res) => res.message),
    importarListos: () => ejecutar('Importar resúmenes listos', 'Importando los resúmenes…', () => bandejaService.importarListos(), (res) => res.message),
    descartar: (id) => ejecutar('Descartar resumen', 'Descartando…', () => bandejaService.descartar(id), 'Documento descartado'),
    deshacer: (operationId) => ejecutar('Deshacer importación', 'Deshaciendo la importación…', () => bandejaService.deshacer(operationId), 'Importación deshecha: el documento volvió a la lista de pendientes'),
    actualizarParametros: (id, parametros) => ejecutar('Actualizar resumen', 'Volviendo a leer el resumen…', () => bandejaService.actualizarParametros(id, parametros))
  }
}

export default useBandeja
