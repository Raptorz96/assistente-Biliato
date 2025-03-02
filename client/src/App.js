import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Componenti di layout
import Layout from './components/common/Layout';
import LoadingScreen from './components/common/LoadingScreen';

// Pagine auth
import Login from './components/auth/Login';

// Pagine dashboard
import Dashboard from './components/Dashboard';
import ClientsList from './components/clients/ClientsList';
import ClientDetails from './components/clients/ClientDetails';
import ClientForm from './components/clients/ClientForm';
import AssistantChat from './components/assistant/AssistantChat';
import ProceduresList from './components/procedures/ProceduresList';
import ProcedureForm from './components/procedures/ProcedureForm';
import DocumentsList from './components/documents/DocumentsList';
import DocumentGenerator from './components/documents/DocumentGenerator';

// Crea il tema dell'applicazione
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

// Componente per route protette
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          
          {/* Rotte Clienti */}
          <Route path="clients">
            <Route index element={<ClientsList />} />
            <Route path="new" element={<ClientForm />} />
            <Route path=":id" element={<ClientDetails />} />
            <Route path=":id/edit" element={<ClientForm />} />
          </Route>
          
          {/* Rotte Assistente */}
          <Route path="assistant">
            <Route index element={<AssistantChat />} />
          </Route>
          
          {/* Rotte Procedure */}
          <Route path="procedures">
            <Route index element={<ProceduresList />} />
            <Route path="new" element={<ProcedureForm />} />
            <Route path=":id/edit" element={<ProcedureForm />} />
          </Route>
          
          {/* Rotte Documenti */}
          <Route path="documents">
            <Route index element={<DocumentsList />} />
            <Route path="generate" element={<DocumentGenerator />} />
          </Route>
        </Route>
        
        {/* Rotta per gestire URL non trovati */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;