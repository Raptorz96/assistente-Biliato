import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Crea un'istanza di axios con la configurazione di base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Aggiungi un interceptor per gestire errori globali
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Se la risposta è 401 Unauthorized, potrebbe essere scaduto il token
      if (error.response.status === 401) {
        // Pulisci localStorage e reindirizza a login se necessario
        if (localStorage.getItem('authToken')) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Servizi Clienti
export const clientService = {
  getClients: () => api.get('/clients'),
  getClient: (id) => api.get(`/clients/${id}`),
  createClient: (clientData) => api.post('/clients', clientData),
  updateClient: (id, clientData) => api.put(`/clients/${id}`, clientData),
  deleteClient: (id) => api.delete(`/clients/${id}`)
};

// Servizi Assistente AI
export const assistantService = {
  sendMessage: (message) => api.post('/assistant/chat', { message }),
  getSuggestions: () => api.get('/assistant/suggestions')
};

// Servizi Procedure
export const procedureService = {
  getProcedures: () => api.get('/procedures'),
  getProcedure: (id) => api.get(`/procedures/${id}`),
  createProcedure: (procedureData) => api.post('/procedures', procedureData),
  updateProcedure: (id, procedureData) => api.put(`/procedures/${id}`, procedureData),
  deleteProcedure: (id) => api.delete(`/procedures/${id}`)
};

// Servizi Documenti
export const documentService = {
  getTemplates: () => api.get('/documents/templates'),
  generateDocument: (templateId, data) => api.post('/documents/generate', { templateId, data }),
  getDocuments: () => api.get('/documents'),
  getDocument: (id) => api.get(`/documents/${id}`),
  deleteDocument: (id) => api.delete(`/documents/${id}`)
};

export default api;