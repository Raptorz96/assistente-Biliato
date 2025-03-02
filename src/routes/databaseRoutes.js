const express = require('express');
const mongoose = require('mongoose');
const { checkConnection, setOfflineMode } = require('../../config/database');
const router = express.Router();

/**
 * @route   GET /database/status
 * @desc    Verifica lo stato della connessione al database
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    // Ottieni lo stato della connessione usando checkConnection
    const connectionInfo = checkConnection();
    
    // Ottieni lo stato attuale della connessione direttamente da mongoose
    const readyState = mongoose.connection.readyState;
    
    // Mappa dei valori di readyState
    const readyStateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    
    // Usa solo connectionInfo per garantire coerenza dell'interfaccia
    const isConnected = readyState === 1;
    const isOfflineMode = connectionInfo.offlineMode;
    
    // Determina lo stato del database secondo le nuove regole
    let connectionStatus;
    if (isConnected) {
      connectionStatus = 'connected';
    } else if (isOfflineMode) {
      connectionStatus = 'offline';
    } else {
      connectionStatus = 'disconnected';
    }
    
    // Prepara un messaggio basato sullo stato
    let message;
    switch (connectionStatus) {
      case 'connected':
        message = 'Connessione al database attiva';
        break;
      case 'offline':
        message = 'Applicazione in modalità offline (senza database)';
        break;
      case 'disconnected':
        message = 'Connessione al database non disponibile';
        break;
      default:
        message = 'Stato della connessione sconosciuto';
    }
    
    // Determina lo stato HTTP appropriato (200 per connected/offline, 503 per disconnected)
    const httpStatus = (isConnected || isOfflineMode) ? 200 : 503;
    
    // Prepara la risposta completa con interfaccia coerente
    return res.status(httpStatus).json({
      status: (isConnected || isOfflineMode) ? 'success' : 'error',
      message,
      connectionStatus,
      readyState: connectionStatus, // Usa lo stesso valore di connectionStatus per coerenza
      readyStateRaw: readyState,    // Mantieni il valore raw per compatibilità
      isOfflineMode,
      reconnectAttempts: connectionInfo.reconnectionAttempts || 0,
      connectionStats: connectionInfo.stats || {}
    });
  } catch (error) {
    console.error('Errore durante la verifica dello stato del database:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Errore durante la verifica dello stato del database',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/database/offline
 * @desc    Attiva o disattiva la modalità offline
 * @access  Public
 * @body    { offline: boolean }
 */
router.post('/offline', async (req, res) => {
  try {
    // Verifica che il parametro 'offline' sia presente nella richiesta
    const { offline } = req.body;
    
    // Controlla che sia un booleano
    if (typeof offline !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'Il parametro "offline" deve essere un valore booleano (true/false)'
      });
    }
    
    // Imposta la modalità offline attraverso il modulo database
    setOfflineMode(offline);
    
    // Definisci il messaggio appropriato
    const message = offline 
      ? 'Modalità offline attivata. Le operazioni sul database sono disabilitate.' 
      : 'Modalità offline disattivata. L\'applicazione tenterà di connettersi al database.';
      
    console.log(message);
    
    // Ottieni informazioni aggiornate sullo stato della connessione
    const connectionInfo = checkConnection();
    
    // Restituisci lo stato aggiornato con interfaccia coerente
    return res.status(200).json({
      status: 'success',
      message,
      connectionStatus: offline ? 'offline' : (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'),
      isOfflineMode: connectionInfo.offlineMode,
      reconnectionAttempts: connectionInfo.reconnectionAttempts || 0
    });
  } catch (error) {
    console.error('Errore durante la modifica della modalità offline:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Errore durante la modifica della modalità offline',
      error: error.message
    });
  }
});

module.exports = router;