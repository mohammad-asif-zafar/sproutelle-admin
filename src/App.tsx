import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/Auth/AuthGuard';
import { AppLayout } from './components/Layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadFilesPage } from './pages/UploadFilesPage';
import { AddQuestionPage } from './pages/AddQuestionPage';
import { ViewTablesPage } from './pages/ViewTablesPage';
import { DocsPage } from './pages/DocsPage';

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="upload" element={<UploadFilesPage />} />
            <Route path="questions/new" element={<AddQuestionPage />} />
            <Route path="tables" element={<ViewTablesPage />} />
            <Route path="docs" element={<DocsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
