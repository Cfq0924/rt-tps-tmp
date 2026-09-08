import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PatientListPage from './pages/PatientListPage.jsx';
import PatientDetailPage from './pages/PatientDetailPage.jsx';
import StudyViewerPage from './pages/StudyViewerPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { CircularProgress, Box } from '@mui/material';

// Auth gate. The backend's /api/auth/mode reports whether JWT auth is
// enforced (AUTH_DISABLED=false). When enforced, ProtectedRoute verifies
// the session cookie via /api/auth/me and bounces to /login on 401.
function useAuthMode() {
  const [state, setState] = useState({ loading: true, authDisabled: true });
  useEffect(() => {
    fetch('/api/auth/mode', { credentials: 'include' })
      .then(res => res.json())
      .then(d => setState({ loading: false, authDisabled: !!d.authDisabled }))
      .catch(() => setState({ loading: false, authDisabled: true }));
  }, []);
  return state;
}

function ProtectedRoute({ authDisabled, children }) {
  const [status, setStatus] = useState(authDisabled ? 'ok' : 'checking');
  useEffect(() => {
    if (authDisabled) return;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => setStatus(res.ok ? 'ok' : 'unauthorized'))
      .catch(() => setStatus('unauthorized'));
  }, [authDisabled]);

  if (status === 'checking') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const { loading, authDisabled } = useAuthMode();
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/patients"
          element={
            <ProtectedRoute authDisabled={authDisabled}>
              <PatientListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute authDisabled={authDisabled}>
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/viewer/:studyId"
          element={
            <ProtectedRoute authDisabled={authDisabled}>
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
