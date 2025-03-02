const mongoose = require('mongoose');
const logger = require('../src/utils/dbLogger');

// Configura le impostazioni globali di Mongoose
mongoose.set('strictQuery', false); // Per compatibilità con versioni future

// Contatore tentativi di riconnessione
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Configurazione e gestione della connessione MongoDB
 * Supporta diverse modalità (development, production, test)
 * con configurazioni appropriate per ciascuna.
 */
const connectDB = async () => {
  try {
    // Ottieni l'URI di connessione dalla variabile d'ambiente
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/assistente-biliato';
    
    // Ottieni le configurazioni specifiche per l'ambiente
    const envOptions = getEnvironmentOptions();
    
    // Opzioni di connessione
    const options = {
      // Opzioni standard per la maggior parte delle applicazioni
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: process.env.NODE_ENV !== 'production', // Disabilita autoIndex in produzione
      
      // Configurazione ottimizzata per la replica e la sicurezza
      retryWrites: true,
      w: 'majority',
      
      // Configurazione timeout
      connectTimeoutMS: envOptions.connectTimeoutMS,
      socketTimeoutMS: envOptions.socketTimeoutMS,
      serverSelectionTimeoutMS: envOptions.serverSelectionTimeoutMS,
      
      // Configurazione del pool di connessioni
      maxPoolSize: envOptions.maxPoolSize,
      minPoolSize: envOptions.minPoolSize,
      
      // Heartbeat per mantenere connessioni attive
      heartbeatFrequencyMS: 10000,
      
      // Configurazione per gestione degli errori di connessione
      bufferCommands: true,
      bufferMaxEntries: 0 // 0 per fallire immediatamente se MongoDB non è disponibile
    };
    
    // Connessione a MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    // Ripristina contatore tentativi dopo connessione riuscita
    reconnectAttempts = 0;
    
    // Log del successo della connessione
    const dbName = conn.connection.name;
    const host = conn.connection.host;
    const port = conn.connection.port;
    
    logger.info(`MongoDB connesso: ${host}:${port}/${dbName}`);
    console.log(`MongoDB connesso: ${host}:${port}/${dbName} (${process.env.NODE_ENV || 'development'})`);
    
    // Gestione degli eventi di connessione
    setupConnectionHandlers();
    
    return conn;
  } catch (error) {
    // Log degli errori di connessione
    logger.error(`Errore di connessione MongoDB: ${error.message}`);
    console.error(`Errore di connessione MongoDB: ${error.message}`);
    
    // Gestione dei tentativi di riconnessione
    return handleReconnection(error);
  }
};

/**
 * Ottiene le configurazioni specifiche per l'ambiente
 * @returns {Object} Opzioni specifiche per l'ambiente
 */
const getEnvironmentOptions = () => {
  // Ambiente corrente
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Configurazioni per diversi ambienti
  const envConfigs = {
    production: {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 30,
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 5,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 30000,
      reconnectInterval: 5000,
      logLevel: 'info'
    },
    development: {
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      reconnectInterval: 3000,
      logLevel: 'debug'
    },
    test: {
      maxPoolSize: 5,
      minPoolSize: 1,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      serverSelectionTimeoutMS: 3000,
      reconnectInterval: 1000,
      logLevel: 'error'
    }
  };
  
  // Ritorna configurazione per l'ambiente corrente o default
  return envConfigs[nodeEnv] || envConfigs.development;
};

/**
 * Gestisce la logica di riconnessione con backoff esponenziale
 * @param {Error} error - Errore che ha causato la disconnessione
 * @returns {Promise} - Promessa di riconnessione o null
 */
const handleReconnection = (error) => {
  // Ottieni le configurazioni specifiche per l'ambiente
  const envOptions = getEnvironmentOptions();
  
  // In test, fallisci subito senza riconnessione
  if (process.env.NODE_ENV === 'test') {
    logger.error('Connessione MongoDB fallita in ambiente test, termino');
    process.exit(1);
  }
  
  // In development, riprova un paio di volte
  if (process.env.NODE_ENV === 'development' && reconnectAttempts >= 2) {
    logger.error(`Connessione MongoDB fallita dopo ${reconnectAttempts} tentativi`);
    process.exit(1);
  }
  
  // In production, riprova fino a MAX_RECONNECT_ATTEMPTS con backoff esponenziale
  reconnectAttempts++;
  
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Connessione MongoDB fallita dopo ${MAX_RECONNECT_ATTEMPTS} tentativi, termino`);
    process.exit(1);
  }
  
  // Calcola il tempo di attesa con backoff esponenziale (min: interval, max: 2 minuti)
  const baseInterval = envOptions.reconnectInterval;
  const waitTime = Math.min(baseInterval * Math.pow(1.5, reconnectAttempts - 1), 120000);
  
  logger.warn(`Tentativo di riconnessione ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} tra ${waitTime}ms...`);
  console.warn(`Tentativo di riconnessione ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} tra ${waitTime}ms...`);
  
  return new Promise(resolve => {
    setTimeout(async () => {
      try {
        const conn = await connectDB();
        resolve(conn);
      } catch (err) {
        // Gli errori verranno gestiti all'interno di connectDB
        resolve(null);
      }
    }, waitTime);
  });
};

/**
 * Configura i gestori di eventi per la connessione MongoDB
 * per gestire automaticamente gli scenari di disconnessione
 */
const setupConnectionHandlers = () => {
  // Disconnesso
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnesso');
    console.warn('MongoDB disconnesso');
    
    // Tenta la riconnessione in modalità produzione
    if (process.env.NODE_ENV === 'production') {
      handleReconnection(new Error('Disconnessione imprevista'));
    }
  });
  
  // Errore
  mongoose.connection.on('error', (err) => {
    logger.error(`Errore connessione MongoDB: ${err.message}`);
    console.error(`Errore connessione MongoDB: ${err.message}`);
  });
  
  // Riconnesso
  mongoose.connection.on('reconnected', () => {
    // Ripristina contatore
    reconnectAttempts = 0;
    logger.info('MongoDB riconnesso con successo');
    console.log('MongoDB riconnesso con successo');
  });
  
  // Monitoraggio performance
  if (process.env.NODE_ENV === 'production') {
    mongoose.connection.on('open', () => {
      // Monitora il pool di connessioni
      setInterval(() => {
        const poolStats = mongoose.connection.client.db.admin().serverStatus();
        poolStats.then(stats => {
          if (stats && stats.connections) {
            logger.debug(`MongoDB pool stats - active: ${stats.connections.active}, available: ${stats.connections.available}, pending: ${stats.connections.pending}`);
          }
        }).catch(err => {
          logger.error(`Errore lettura statistiche pool: ${err.message}`);
        });
      }, 300000); // Ogni 5 minuti
    });
  }
  
  // Gestione chiusura applicazione
  process.on('SIGINT', async () => {
    await closeConnection('SIGINT');
  });
  
  process.on('SIGTERM', async () => {
    await closeConnection('SIGTERM');
  });
};

/**
 * Chiude la connessione MongoDB in modo pulito
 * @param {string} signal - Segnale che ha causato la chiusura
 * @returns {Promise<void>}
 */
const closeConnection = async (signal = 'MANUAL') => {
  try {
    if (mongoose.connection.readyState !== 0) {
      logger.info(`Chiusura connessione MongoDB (${signal})...`);
      console.log(`Chiusura connessione MongoDB (${signal})...`);
      
      // Chiudi la connessione
      await mongoose.connection.close(false); // false = chiusura gentile
      
      logger.info(`Connessione MongoDB chiusa con successo (${signal})`);
      console.log(`Connessione MongoDB chiusa con successo (${signal})`);
    }
    
    if (signal !== 'MANUAL') {
      process.exit(0);
    }
  } catch (err) {
    logger.error(`Errore chiusura connessione MongoDB: ${err.message}`);
    console.error(`Errore chiusura connessione MongoDB: ${err.message}`);
    
    if (signal !== 'MANUAL') {
      process.exit(1);
    }
  }
};

/**
 * Funzione per verificare lo stato della connessione
 * Utile per controlli di salute dell'applicazione e API di monitoring
 * @returns {Object} Stato della connessione
 */
const checkConnection = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnesso',
    1: 'connesso',
    2: 'connessione in corso',
    3: 'disconnessione in corso'
  };
  
  // Statistiche aggiuntive se connesso
  let stats = {};
  if (state === 1) {
    try {
      const db = mongoose.connection.db;
      stats = {
        name: db.databaseName,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      };
      
      // In development/production ottieni più dettagli
      if (process.env.NODE_ENV !== 'test') {
        // Colleziona informazioni sulle collezioni
        stats.collections = Object.keys(mongoose.connection.collections).length;
        stats.models = Object.keys(mongoose.models).length;
      }
    } catch (err) {
      logger.error(`Errore lettura statistiche MongoDB: ${err.message}`);
    }
  }
  
  return {
    connected: state === 1,
    status: states[state] || 'sconosciuto',
    reconnectAttempts,
    stats
  };
};

/**
 * Ricarica lo schema degli indici in produzione
 * (usato dopo aggiornamenti che hanno modificato gli indici)
 * @returns {Promise<Object>} Risultato dell'operazione
 */
const rebuildIndexes = async () => {
  if (process.env.NODE_ENV !== 'production') {
    return { rebuilt: false, reason: 'Rebuild indici disponibile solo in produzione' };
  }
  
  try {
    // Ricarica gli indici per tutti i modelli
    const results = {};
    for (const modelName in mongoose.models) {
      const model = mongoose.models[modelName];
      results[modelName] = await model.syncIndexes();
      logger.info(`Indici ricostruiti per il modello ${modelName}`);
    }
    
    return { rebuilt: true, results };
  } catch (error) {
    logger.error(`Errore ricostruzione indici: ${error.message}`);
    return { rebuilt: false, error: error.message };
  }
};

module.exports = {
  connectDB,
  checkConnection,
  closeConnection,
  rebuildIndexes
};