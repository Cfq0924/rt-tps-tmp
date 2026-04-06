import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage.jsx';
import PatientListPage from './pages/PatientListPage.jsx';
import StudyViewerPage from './pages/StudyViewerPage.jsx';

function ProtectedRoute({ children }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setIsAuthenticated(true); setAuthChecked(true); })
      .catch(() => { setIsAuthenticated(false); setAuthChecked(true); });
  }, []);

  if (!authChecked) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <PatientListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/viewer/:studyId"
          element={
            <ProtectedRoute>
              <StudyViewerPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/patients" replace />} />
        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
