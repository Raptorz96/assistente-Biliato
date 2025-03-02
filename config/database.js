/**
 * Configurazione del database MongoDB
 * 
 * Questo modulo gestisce la connessione a MongoDB, tracciando lo stato della connessione,
 * implementando la riconnessione automatica e supportando una modalità offline.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Gestione del caricamento condizionale per evitare errori in produzione
let dbLogger;
try {
  dbLogger = require('../src/utils/dbLogger');
} catch (error) {
  // Fallback se il modulo non è disponibile
  dbLogger = {
    setupQueryLogger: () => {},
    setupConnectionListeners: () => {},
    getConnectionStats: () => ({ status: 'Logger non disponibile' })
  };
}

// Ottieni le variabili di configurazione dall'ambiente
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/assistente-biliato';
const DB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  autoIndex: true,
};

// Configurazione della riconnessione
let reconnectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000; // 5 secondi

// Configurazione della modalità offline
let isOfflineMode = false;

// Flag per tracciare se gli event listeners sono già stati configurati
let eventsConfigured = false;

/**
 * Gestione degli eventi di connessione MongoDB
 * 
 * Configura eventi per monitorare lo stato della connessione e 
 * gestire tentativi di riconnessione automatica.
 */
function setupConnectionEvents() {
  // Evita di aggiungere duplicati di event listeners
  if (eventsConfigured) {
    return;
  }
  
  // Rimuovi eventuali listeners esistenti
  mongoose.connection.removeAllListeners('connected');
  mongoose.connection.removeAllListeners('error');
  mongoose.connection.removeAllListeners('disconnected');
  
  // Aumenta il limite di listeners per evitare warning
  mongoose.connection.setMaxListeners(15);
  process.setMaxListeners(15);
  
  mongoose.connection.on('connected', () => {
    reconnectionAttempts = 0;
    console.log('MongoDB connesso con successo');
  });
  
  mongoose.connection.on('error', (err) => {
    console.error(`Errore MongoDB: ${err.message}`);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnesso');
    
    // Tentativo di riconnessione solo se non in modalità offline
    if (!isOfflineMode && reconnectionAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectionAttempts++;
      console.log(`Tentativo di riconnessione a MongoDB (${reconnectionAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(connectDB, RECONNECT_INTERVAL);
    } else if (reconnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Raggiunto il numero massimo di tentativi di riconnessione. Riavviare manualmente.');
    }
  });
  
  // Gestisci eventi di processo una sola volta
  if (!process.listeners('SIGINT').some(listener => listener.name === 'mongodbCleanup')) {
    const sigintHandler = async function mongodbCleanup() {
      await mongoose.connection.close();
      console.log('Connessione MongoDB chiusa (SIGINT)');
      process.exit(0);
    };
    
    process.on('SIGINT', sigintHandler);
  }
  
  if (!process.listeners('SIGTERM').some(listener => listener.name === 'mongodbCleanup')) {
    const sigtermHandler = async function mongodbCleanup() {
      await mongoose.connection.close();
      console.log('Connessione MongoDB chiusa (SIGTERM)');
      process.exit(0);
    };
    
    process.on('SIGTERM', sigtermHandler);
  }
  
  // Configurazione del debug logger per monitorare query lente solo in ambiente di sviluppo
  if (process.env.NODE_ENV === 'development') {
    dbLogger.setupQueryLogger();
    dbLogger.setupConnectionListeners();
  }
  
  // Segna gli eventi come configurati
  eventsConfigured = true;
}

/**
 * Connessione al database MongoDB
 * 
 * Tenta di stabilire una connessione a MongoDB se non esiste già.
 * Gestisce la modalità offline e configura gli eventi di connessione.
 * 
 * @returns {Connection|null} L'oggetto connessione se disponibile, altrimenti null
 */
const connectDB = async () => {
  // Configura gli eventi di connessione all'inizio per garantire che siano sempre impostati
  setupConnectionEvents();
  
  // Se già connesso, restituisci la connessione esistente
  if (mongoose.connection.readyState === 1) {
    console.log('MongoDB è già connesso');
    return mongoose.connection;
  }

  // Controlla se siamo in modalità offline
  if (isOfflineMode) {
    console.log('Modalità offline attiva. Connessione a MongoDB non tentata.');
    return null;
  }
  
  // Verifica che l'URI del database sia valido
  if (!DB_URI || DB_URI.trim() === '') {
    console.error('ERROR: MongoDB URI non configurato. Impostare MONGODB_URI in .env');
    setOfflineMode(true);
    return null;
  }

  try {
    console.log('Tentativo di connessione a MongoDB...');
    console.log(`URI MongoDB: ${DB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@')}`);
    
    // Chiudi connessioni esistenti prima di tentare una nuova connessione
    if (mongoose.connection.readyState !== 0) {
      console.log('Chiusura della connessione esistente...');
      await mongoose.connection.close();
    }
    
    // Tenta la connessione con timeout più lungo per diagnostica
    const connection = await mongoose.connect(DB_URI, {
      ...DB_OPTIONS,
      serverSelectionTimeoutMS: 10000 // Aumenta il timeout a 10 secondi per dare più tempo
    });
    
    console.log(`MongoDB connesso: ${connection.connection.host || 'localhost'}`);
    return connection;
  } catch (error) {
    console.error(`Errore di connessione MongoDB: ${error.message}`);
    console.error('Dettaglio errore:', error);
    
    // Verifica se l'errore è dovuto a problemi di autenticazione o server non disponibile
    if (error.message.includes('Authentication failed') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('getaddrinfo')) {
      console.error('Problema di connessione: verificare che MongoDB sia in esecuzione e che le credenziali siano corrette');
      console.error('Suggerimento: crea un file .env con MONGODB_URI valido');
    }
    
    // La gestione della riconnessione è delegata all'evento 'disconnected'
    // che verrà attivato automaticamente dopo un errore di connessione
    
    return null;
  }
};

/**
 * Utility per verificare lo stato della connessione
 * 
 * @returns {Object} Oggetto con informazioni sullo stato della connessione
 */
const checkConnection = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    uri: DB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@'), // Nasconde credenziali
    stats: dbLogger.getConnectionStats(),
    reconnectionAttempts,
    offlineMode: isOfflineMode
  };
};

module.exports = {
  connectDB,
  checkConnection,
  mongoose,
  // Espone anche la gestione della modalità offline
  setOfflineMode: (mode) => { isOfflineMode = mode; }
};