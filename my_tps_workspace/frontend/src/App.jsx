import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PatientListPage from './pages/PatientListPage.jsx';
import PatientDetailPage from './pages/PatientDetailPage.jsx';
import StudyViewerPage from './pages/StudyViewerPage.jsx';

// AUTH DISABLED - Always render children without auth check
function ProtectedRoute({ children }) {
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <PatientListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute>
              <PatientDetailPage />
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
