import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Datos from './pages/Datos'
import CargarTab from './components/datos/CargarTab'
import MigracionTab from './components/datos/MigracionTab'
import Inversiones from './pages/Inversiones'
import Configuracion from './pages/Configuracion'
import Avisos from './pages/Avisos'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/inicio" replace />} />
            <Route path="inicio" element={<Inicio />} />
            <Route path="bandeja" element={<Navigate to="/datos/cargar" replace />} />
            <Route path="migracion" element={<Navigate to="/datos/migracion" replace />} />
            <Route path="avisos" element={<Avisos />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="datos" element={<Datos />}>
              <Route index element={<Navigate to="cargar" replace />} />
              <Route path="cargar" element={<CargarTab />} />
              <Route path="bandeja" element={<Navigate to="/datos/cargar" replace />} />
              <Route path="historial" element={<Navigate to={{ pathname: '/datos/cargar', hash: '#historial' }} replace />} />
              <Route path="migracion" element={<MigracionTab />} />
              <Route path="*" element={<Navigate to="/datos/cargar" replace />} />
            </Route>
            <Route path="inversiones" element={<Inversiones />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
