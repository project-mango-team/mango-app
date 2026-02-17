import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Datos from './pages/Datos'
import Migracion from './pages/Migracion'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/inicio" replace />} />
          <Route path="inicio" element={<Inicio />} />
          <Route path="datos" element={<Datos />} />
          <Route path="migracion" element={<Migracion />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
