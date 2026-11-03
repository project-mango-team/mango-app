import { useEffect, useState } from 'react'
import { investmentService } from '../services/investmentService'

// Inversiones del usuario (id, nombre y moneda), para elegir en cuál cargar los movimientos de un extracto
const useActivosInversion = (activo = true) => {
  const [activos, setActivos] = useState([])

  useEffect(() => {
    if (!activo) return undefined
    let cancelado = false
    investmentService.getAssets('todos')
      .then(res => {
        if (!cancelado) setActivos((res.data || []).map(({ _id, nombre, moneda }) => ({ _id: String(_id), nombre, moneda })))
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [activo])

  return activos
}

export default useActivosInversion
