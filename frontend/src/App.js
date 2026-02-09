// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { VoiceProvider } from './contexts/VoiceContext';
import CourseProgressView from './pages/CourseProgressView';
import { useAuth } from './contexts/AuthContext';
import VoiceTestiPhone from './pages/VoiceTestiPhone';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './App.css';

// Componentes compartidos
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import VoiceAssistantToggle from './components/VoiceAssistantToggle';

// 🆕 NUEVO: Componente de notificación de sesión expirada
import SessionExpiredNotification from './components/SessionExpiredNotification';

// Páginas
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CourseListPage from './pages/CourseListPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPage from './pages/LessonPage';
import EvaluationPage from './pages/EvaluationPage';
import VoiceTestPage from './pages/VoiceTestPage';
import ProgressPage from './pages/ProgressPage';
import CertificadosPage from './pages/CertificadosPage';
import AdminDashboard from './pages/AdminDashboard';

import DocumentosPage from './pages/DocumentosPage';
import ConsultaAsistentePage from './pages/ConsultaAsistentePage';
import DocumentAnalyticsPage from './pages/DocumentAnalyticsPage';
import ConsultaAsistenteiPhone from './pages/ConsultaAsistenteiPhone';
import deviceDetector from './utils/deviceDetector';

// NUEVA IMPORTACIÓN PARA ANALYTICS
import DocumentAnalytics from './pages/DocumentAnalytics';

import SpeechProgressIndicator from './components/SpeechProgressIndicator';

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Componente interno que usa useLocation
const AppContent = () => {
  const location = useLocation();
  
  // Rutas donde NO queremos mostrar Header ni Footer
  const hideLayoutRoutes = ['/consulta/', '/consultaiphone/'];
  const shouldHideLayout = hideLayoutRoutes.some(route =>
    location.pathname.includes(route)
  );

  return (
    <div className="App">
      {!shouldHideLayout && <Header />}
      
      <main className="main-content">
        <Routes>
          {/* Rutas públicas - login/register ahora son modal overlay sobre la landing */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<HomePage autoAuth="login" />} />
          <Route path="/register" element={<HomePage autoAuth="register" />} />
          <Route path="/voice-test" element={<VoiceTestPage />} />
          
          {/* Rutas protegidas */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/courses" 
            element={
              <ProtectedRoute>
                <CourseListPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/courses/:id" 
            element={
              <ProtectedRoute>
                <CourseProgressView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/courses/:id" 
            element={
              <ProtectedRoute>
                <CourseDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lessons/:id" 
            element={
              <ProtectedRoute>
                <LessonPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/evaluations/:moduleId" 
            element={
              <ProtectedRoute>
                <EvaluationPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/progress" 
            element={
              <ProtectedRoute>
                <ProgressPage />
              </ProtectedRoute>
            } 
          />
          <Route path="/certificados" element={<CertificadosPage />} />
          <Route 
            path="/admin-panel" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/documentos" 
            element={
              <ProtectedRoute>
                <DocumentosPage />
              </ProtectedRoute>
            } 
          />

<Route
  path="/consulta/:documentId"
  element={
    <ProtectedRoute>
      {/* Detección automática de iOS + parámetro forceios para forzar manualmente */}
      {deviceDetector.isIOS() || new URLSearchParams(window.location.search).get('forceios') === '1' ? (
        <ConsultaAsistenteiPhone />
      ) : (
        <ConsultaAsistentePage />
      )}
    </ProtectedRoute>
  }
/>

{/* Ruta directa para forzar vista iOS */}
<Route
  path="/consultaiphone/:documentId"
  element={
    <ProtectedRoute>
      <ConsultaAsistenteiPhone />
    </ProtectedRoute>
  }
/>

          {/* NUEVA RUTA PARA ANALYTICS DEL DOCUMENTO */}
          <Route 
            path="/analytics/:documentId" 
            element={
              <ProtectedRoute>
                <DocumentAnalytics />
              </ProtectedRoute>
            } 
          />

          {/* Redirigir rutas legacy de admin a panel unificado */}
          <Route path="/admin/documentos" element={<Navigate to="/admin-panel" replace />} />
          <Route path="/admin/voice-service" element={<Navigate to="/admin-panel" replace />} />
          <Route path="/analytics/:documentId" element={<DocumentAnalyticsPage />} />
<Route path="/test-voice-iphone" element={<VoiceTestiPhone />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </main>
      
     {/* <VoiceAssistantToggle />
      <SpeechProgressIndicator />*/}
      
      {/* 🆕 NUEVO: Componente de notificación de sesión expirada */}
      <SessionExpiredNotification />
      
      {/* Footer condicional - NO se muestra en rutas de consulta */}
      {!shouldHideLayout && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <VoiceProvider>
          <AppContent />
        </VoiceProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
