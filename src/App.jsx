import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css';
import Layout from './components/Layout'
import Home from './pages/Home'
import MapView from './pages/MapView'
import SOS from './pages/SOS'
import Reports from './pages/Reports'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Login />} />
                    <Route path="/login" element={<Login />} />

                    {/* Protected Private Routes */}
                    <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route index element={<Home />} />
                        <Route path="map" element={<MapView />} />
                        <Route path="sos" element={<SOS />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="onboarding" element={<Onboarding />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
