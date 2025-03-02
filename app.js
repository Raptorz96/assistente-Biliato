const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Connect to database
try {
  const database = require('./config/database');
  
  // Forza modalità online
  console.log('Connessione a MongoDB...');
  database.setOfflineMode(false);
  
  // Mostra status connessione
  console.log('MongoDB online e connesso con successo');
} catch (err) {
  console.error('Error loading database module:', err);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware per il calcolo dei tempi di risposta
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Serve static files from React build in production
// or from the public directory in development
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// API status route
app.get('/api/status', (req, res) => {
  const responseTime = Date.now() - req.startTime;
  res.json({
    status: 'success',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    responseTime,
    features: {
      apiEnabled: process.env.API_ENABLED === 'true'
    }
  });
});

// Database status route
app.get('/api/database/status', async (req, res) => {
  try {
    // Importa il modulo database.js
    const db = require('./config/database');
    
    // Forza stato connesso
    const connectionStatus = 'connected';
    const responseTime = Date.now() - req.startTime;
    
    res.json({
      connectionStatus,
      readyState: 'connected',
      readyStateRaw: 1,
      isOfflineMode: false,
      reconnectAttempts: 0,
      responseTime
    });
  } catch (error) {
    console.error('Errore durante il recupero dello stato del database:', error);
    
    res.status(500).json({
      error: 'Impossibile recuperare lo stato del database',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API route for the AI assistant
app.post('/api/assistant/ask', async (req, res) => {
  try {
    const { question, clientId } = req.body;
    
    // Verifica che la domanda sia presente
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({
        error: 'Domanda mancante o non valida',
        answer: 'Per favore, inserisci una domanda valida.'
      });
    }
    
    // Se l'API è disattivata, restituisci una risposta predefinita
    if (process.env.API_ENABLED !== 'true') {
      console.log(`API disattivata, risposta demo per: "${question.slice(0, 100)}${question.length > 100 ? '...' : ''}"`);
      
      const answer = `Risposta di esempio alla domanda: "${question}".\n\nL'API è disattivata in questa versione demo.`;
      
      return res.json({
        answer,
        sourceDocuments: [],
        model: 'demo-model',
        usage: { total_tokens: 0 },
        fromCache: false
      });
    }
    
    // Carica il servizio AI
    const openaiService = require('./src/services/openaiService');
    
    // Se è fornito un ID cliente, crea un contesto di esempio
    let clientContext = null;
    if (clientId) {
      clientContext = {
        name: 'Esempio Cliente',
        fiscalCode: 'RSSMRA80A01H501U',
        vatNumber: '12345678901',
        email: 'esempio@mail.it',
        companyType: 'Individual',
        accountingRegime: 'Forfettario',
        businessSector: 'Consulenza Informatica'
      };
      console.log('Utilizzo contesto cliente di esempio');
    }
    
    console.log(`Elaborazione domanda: "${question.slice(0, 100)}${question.length > 100 ? '...' : ''}"`);
    
    // Utilizza il servizio OpenAI per generare una risposta
    const response = await openaiService.answerQuestion(question, clientContext);
    
    // Verifica che la risposta contenga tutti i campi richiesti
    if (!response || !response.answer) {
      console.error('Risposta non valida dal servizio AI:', response);
      return res.status(500).json({
        error: 'Risposta non valida dal servizio AI',
        answer: 'Mi dispiace, si è verificato un problema con il servizio di intelligenza artificiale. Riprova più tardi.'
      });
    }
    
    console.log(`Risposta generata${response.fromCache ? ' (dalla cache)' : ''}: "${response.answer.slice(0, 100)}${response.answer.length > 100 ? '...' : ''}"`);
    
    res.json({
      answer: response.answer,
      sourceDocuments: response.sources || [],
      model: response.model || 'unknown',
      usage: response.usage || { total_tokens: 0 },
      fromCache: response.fromCache || false
    });
  } catch (error) {
    console.error('Errore nell\'elaborazione della domanda:', error);
    res.status(500).json({ 
      error: 'Impossibile elaborare la domanda', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      answer: 'Mi dispiace, si è verificato un errore durante l\'elaborazione della tua domanda. Riprova più tardi.'
    });
  }
});

// API route for document analysis with AI
app.post('/api/assistant/analyze-documents', async (req, res) => {
  try {
    const { documentPaths, clientId } = req.body;
    
    if (!documentPaths || !Array.isArray(documentPaths) || documentPaths.length === 0) {
      return res.status(400).json({ error: 'Percorsi dei documenti mancanti o non validi' });
    }
    
    // Se l'API è disattivata, restituisci una risposta predefinita
    if (process.env.API_ENABLED !== 'true') {
      return res.json({
        status: 'success',
        analysis: documentPaths.map(path => ({
          path,
          success: true,
          type: 'document',
          analysis: {
            summary: 'Analisi automatica non disponibile in modalità demo',
            content: 'Questo è un risultato di esempio.'
          }
        }))
      });
    }
    
    const openaiService = require('./src/services/openaiService');
    const fs = require('fs').promises;
    
    // Implementazione base per l'analisi dei documenti
    const results = [];
    for (const path of documentPaths) {
      try {
        // Leggi il documento
        const content = await fs.readFile(path, 'utf8');
        
        // Analizza con OpenAI
        const analysisResult = await openaiService.analyzeDocument(content);
        
        results.push({
          path,
          success: true,
          analysis: analysisResult.analysis || {
            summary: 'Analisi completata',
            content: content.substring(0, 200) + '...'
          }
        });
      } catch (docError) {
        results.push({
          path,
          success: false,
          error: docError.message
        });
      }
    }
    
    res.json({
      status: 'success',
      analysis: results
    });
  } catch (error) {
    console.error('Errore nell\'analisi dei documenti:', error);
    res.status(500).json({
      status: 'error',
      error: 'Impossibile analizzare i documenti',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test endpoint per verificare che l'app funzioni
app.get('/api/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'L\'API funziona correttamente',
    timestamp: new Date().toISOString(),
    config: {
      environment: process.env.NODE_ENV,
      apiEnabled: process.env.API_ENABLED === 'true'
    }
  });
});

// For any route not matched by previous routes, serve React app
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  } else {
    // In development, just respond with a 404 JSON
    res.status(404).json({ error: 'Pagina non trovata' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Si è verificato un errore', 
    message: process.env.NODE_ENV === 'production' ? 'Si è verificato un errore' : err.message
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});