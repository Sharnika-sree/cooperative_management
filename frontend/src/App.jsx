import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Farmers from './pages/Farmers'
import Inventory from './pages/Inventory'
import Schemes from './pages/Schemes'
import Announcements from './pages/Announcements'
import Warehouse from './pages/Warehouse'
import StaffManagement from './pages/StaffManagement'
import ChatbotSettings from './pages/ChatbotSettings'
import ServiceRequests from './pages/ServiceRequests'
import SoilSuitability from './pages/SoilSuitability'
import Layout from './components/Layout'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading application...</div>
  }
  
  if (!user) {
    return <Navigate to="/login" />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />
  }
  
  return children
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            
            <Route path="farmers" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                <Farmers />
              </ProtectedRoute>
            } />
            
            <Route path="inventory" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                <Inventory />
              </ProtectedRoute>
            } />

            <Route path="schemes" element={<Schemes />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="soil-suitability" element={<SoilSuitability />} />
            
            <Route path="staff" element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <StaffManagement />
              </ProtectedRoute>
            } />

            <Route path="chatbot-settings" element={<ChatbotSettings />} />

            <Route path="service-requests" element={<ServiceRequests />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
