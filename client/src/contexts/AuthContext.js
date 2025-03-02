import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Controlla se l'utente è già loggato
    const token = localStorage.getItem('authToken');
    if (token) {
      checkAuthStatus(token);
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuthStatus = async (token) => {
    try {
      // Aggiungi token all'header di default per tutte le richieste axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Qui si potrebbe fare una chiamata API per verificare la validità del token
      // Per ora, parliamo solo di una semplice verifica locale
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Errore nel controllo dello stato di autenticazione:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      // In un'app reale, fare una chiamata API per l'autenticazione
      // Per ora simuliamo il login
      if (email === 'admin@example.com' && password === 'password') {
        const mockUser = { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' };
        const mockToken = 'mock-jwt-token';
        
        // Salva le info utente e token
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('user', JSON.stringify(mockUser));
        
        // Imposta l'header di autorizzazione per le future richieste
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        
        setCurrentUser(mockUser);
        return true;
      } else {
        throw new Error('Credenziali non valide');
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};