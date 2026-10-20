import { useRef, useState } from 'react'

const EXTENSIONES = ['.pdf', '.xlsx', '.xls', '.csv', '.txt']

// Zona para soltar varios resúmenes a la vez (o elegirlos con el selector)
const BandejaDropzone = ({ onArchivos, deshabilitado }) => {
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef(null)

  const entregar = (lista) => {
    const archivos = [...lista].filter(f => EXTENSIONES.some(ext => f.name.toLowerCase().endsWith(ext)))
    if (archivos.length) onArchivos(archivos)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
      onDragLeave={(e) => { e.preventDefault(); setArrastrando(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setArrastrando(false)
        if (!deshabilitado) entregar(e.dataTransfer.files)
      }}
      onClick={() => !deshabilitado && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        arrastrando ? 'border-primary bg-primary/10' : 'border-gray-600 hover:border-primary'
      } ${deshabilitado ? 'opacity-50 cursor-wait' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={EXTENSIONES.join(',')}
        className="hidden"
        onChange={(e) => {
          entregar(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="text-gray-200 font-medium">
        {deshabilitado ? 'Procesando archivos...' : 'Soltá acá todos los resúmenes del mes'}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        PDF, XLSX, CSV o TXT · Mango reconoce el banco, el tipo y las tarjetas de cada uno
      </p>
    </div>
  )
}

export default BandejaDropzone
