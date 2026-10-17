import { useState } from 'react'

const leer = (key, porDefecto) => {
  try {
    const guardada = localStorage.getItem(key)
    return guardada === 'USD' || guardada === 'ARS' ? guardada : porDefecto
  } catch {
    return porDefecto
  }
}

// Moneda elegida en un toggle USD/ARS, recordada por página en este navegador
const useMonedaPreferida = (key, porDefecto = 'ARS') => {
  const [moneda, setMonedaState] = useState(() => leer(key, porDefecto))

  const setMoneda = (m) => {
    setMonedaState(m)
    try {
      localStorage.setItem(key, m)
    } catch {
      // Sin storage disponible: el toggle funciona igual, solo no se recuerda
    }
  }

  return [moneda, setMoneda]
}

export default useMonedaPreferida
