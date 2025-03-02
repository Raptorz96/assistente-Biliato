/**
 * Utility per il monitoraggio e logging delle operazioni database
 */
const mongoose = require('mongoose');

// Costanti per le soglie di performance
const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 secondo
const VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // 5 secondi

/**
 * Middleware per monitorare le query e tracciare query lente
 * @param {Function} logFn - Funzione di logging (console.log, winston, etc.)
 */
const setupQueryLogger = (logFn = console.log) => {
  mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
    const startTime = Date.now();
    const originalCallback = methodArgs[methodArgs.length - 1];
    
    // Sostituisci il callback con uno personalizzato che misura il tempo
    methodArgs[methodArgs.length - 1] = function(err, result) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Log delle query lente
      if (executionTime >= VERY_SLOW_QUERY_THRESHOLD_MS) {
        logFn(`QUERY MOLTO LENTA (${executionTime}ms): ${collectionName}.${methodName}`, {
          collection: collectionName,
          operation: methodName,
          executionTime,
          query: methodArgs.length > 1 ? methodArgs[0] : null
        });
      } else if (executionTime >= SLOW_QUERY_THRESHOLD_MS) {
        logFn(`QUERY LENTA (${executionTime}ms): ${collectionName}.${methodName}`, {
          collection: collectionName,
          operation: methodName,
          executionTime,
          query: methodArgs.length > 1 ? methodArgs[0] : null
        });
      }
      
      // Chiamata al callback originale
      if (typeof originalCallback === 'function') {
        originalCallback.call(this, err, result);
      }
    };
    
    return;
  });
};

/**
 * Aggancia i listener per gli eventi di connessione MongoDB
 * @param {Function} logFn - Funzione di logging (console.log, winston, etc.)
 */
const setupConnectionListeners = (logFn = console.log) => {
  const connection = mongoose.connection;
  
  // Eventi di connessione
  connection.on('connected', () => {
    logFn('MongoDB connesso');
  });
  
  connection.on('disconnected', () => {
    logFn('MongoDB disconnesso');
  });
  
  connection.on('reconnected', () => {
    logFn('MongoDB riconnesso');
  });
  
  connection.on('error', (err) => {
    logFn('Errore MongoDB:', err);
  });
  
  // Eventi dei modelli
  mongoose.connection.on('all', () => {
    logFn('Tutti i modelli sono stati compilati');
  });
};

/**
 * Ottiene statistiche sullo stato corrente della connessione MongoDB
 * @returns {Object} Statistiche sulla connessione
 */
const getConnectionStats = () => {
  const connection = mongoose.connection;
  
  if (!connection) {
    return { status: 'Non inizializzato' };
  }
  
  return {
    status: connection.readyState === 1 ? 'Connesso' : 'Disconnesso',
    host: connection.host,
    port: connection.port,
    name: connection.name,
    models: Object.keys(connection.models),
    collections: connection.collections ? Object.keys(connection.collections) : [],
    readyState: connection.readyState
  };
};

module.exports = {
  setupQueryLogger,
  setupConnectionListeners,
  getConnectionStats
};