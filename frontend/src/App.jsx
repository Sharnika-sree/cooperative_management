import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
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
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes - all under /app prefix */}
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardRedirect />} />
            <Route path="farmers" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Farmers /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Inventory /></ProtectedRoute>} />
            <Route path="schemes" element={<Schemes />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="soil-suitability" element={<SoilSuitability />} />
            <Route path="staff-management" element={<ProtectedRoute allowedRoles={['ADMIN']}><StaffManagement /></ProtectedRoute>} />
            <Route path="chatbot-settings" element={<ChatbotSettings />} />
            <Route path="service-requests" element={<ServiceRequests />} />
            <Route path="admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><Dashboard /></ProtectedRoute>} />
            <Route path="farmer" element={<ProtectedRoute allowedRoles={['FARMER']}><Dashboard /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute allowedRoles={['STAFF']}><Dashboard /></ProtectedRoute>} />
            <Route path="staff-dashboard" element={<ProtectedRoute allowedRoles={['STAFF']}><Dashboard /></ProtectedRoute>} />
          </Route>

          {/* Legacy routes for backward compatibility */}
          <Route path="/farmers" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Layout><Farmers /></Layout></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Layout><Inventory /></Layout></ProtectedRoute>} />
          <Route path="/schemes" element={<ProtectedRoute><Layout><Schemes /></Layout></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Layout><Announcements /></Layout></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><Layout><Warehouse /></Layout></ProtectedRoute>} />
          <Route path="/soil-suitability" element={<ProtectedRoute><Layout><SoilSuitability /></Layout></ProtectedRoute>} />
          <Route path="/staff-management" element={<ProtectedRoute allowedRoles={['ADMIN']}><Layout><StaffManagement /></Layout></ProtectedRoute>} />
          <Route path="/chatbot-settings" element={<ProtectedRoute><Layout><ChatbotSettings /></Layout></ProtectedRoute>} />
          <Route path="/service-requests" element={<ProtectedRoute><Layout><ServiceRequests /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/farmer" element={<ProtectedRoute allowedRoles={['FARMER']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute allowedRoles={['STAFF']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/staff-dashboard" element={<ProtectedRoute allowedRoles={['STAFF']}><Layout><Dashboard /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function DashboardRedirect() {
  const { user } = useAuth()
  if (user?.role === 'ADMIN') return <Navigate to="/app/admin" replace />
  if (user?.role === 'STAFF') return <Navigate to="/app/staff" replace />
  if (user?.role === 'FARMER') return <Navigate to="/app/farmer" replace />
  return <Navigate to="/" replace />
}

export default App
