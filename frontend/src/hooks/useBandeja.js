import { useCallback, useEffect, useState } from 'react'
import { bandejaService } from '../services/bandejaService'
import { mensajeError } from '../utils/format'

// Avisa a otros componentes (el badge del menú) que la bandeja cambió
export const BANDEJA_CAMBIO = 'mango:bandeja-cambio'
const avisarCambio = () => window.dispatchEvent(new Event(BANDEJA_CAMBIO))

// Documentos de la bandeja y las acciones sobre ellos
const useBandeja = () => {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok' | 'error', texto }

  const recargar = useCallback(async () => {
    try {
      const res = await bandejaService.listar()
      setDocumentos(res.data)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeError(err, 'No se pudo cargar la bandeja') })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  // Corre una acción, muestra su resultado y recarga la lista
  const ejecutar = async (accion, textoOk) => {
    setOcupado(true)
    setMensaje(null)
    try {
      const res = await accion()
      const texto = typeof textoOk === 'function' ? textoOk(res) : textoOk
      if (texto) setMensaje({ tipo: 'ok', texto })
      return res
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeError(err, 'No se pudo completar la acción') })
      return null
    } finally {
      setOcupado(false)
      await recargar()
      avisarCambio()
    }
  }

  const subir = (files) => ejecutar(() => bandejaService.subir(files), (res) => {
    const nuevos = res.data.filter(r => r.ok && !r.existente).length
    const repetidos = res.data.filter(r => r.ok && r.existente).length
    const fallidos = res.data.filter(r => !r.ok)
    return [
      `${nuevos} archivo(s) agregados`,
      repetidos && `${repetidos} ya estaban en la bandeja`,
      fallidos.length && `no se pudieron leer: ${fallidos.map(f => f.filename).join(', ')}`
    ].filter(Boolean).join(' · ')
  })

  return {
    documentos,
    loading,
    ocupado,
    mensaje,
    setMensaje,
    recargar,
    subir,
    importar: (id, transactions) => ejecutar(() => bandejaService.importar(id, transactions), (res) => res.message),
    importarListos: () => ejecutar(() => bandejaService.importarListos(), (res) => res.message),
    descartar: (id) => ejecutar(() => bandejaService.descartar(id), 'Documento descartado'),
    deshacer: (operationId) => ejecutar(() => bandejaService.deshacer(operationId), 'Importación deshecha: el documento volvió a la bandeja'),
    actualizarParametros: (id, parametros) => ejecutar(() => bandejaService.actualizarParametros(id, parametros))
  }
}

export default useBandeja
