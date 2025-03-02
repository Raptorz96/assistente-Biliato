/**
 * Route per informazioni e monitoring di sistema
 */
const express = require('express');
const router = express.Router();
const { checkConnection, mongoose } = require('../../config/database');
const os = require('os');
const path = require('path');

/**
 * @route   GET /api/system/health
 * @desc    Verifica lo stato del sistema
 * @access  Private (solo admin)
 */
router.get('/health', (req, res) => {
  try {
    // Verifica lo stato di MongoDB
    const dbStatus = checkConnection();
    
    // Verifica lo stato dell'applicazione
    const systemInfo = {
      appName: 'Assistente Biliato',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      os: {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        freemem: os.freemem(),
        totalmem: os.totalmem(),
        cpus: os.cpus().length
      }
    };
    
    // Componi la risposta
    const healthStatus = {
      status: dbStatus.isConnected ? 'healthy' : 'degraded',
      database: {
        connected: dbStatus.isConnected,
        connectionAttempts: dbStatus.reconnectAttempts
      },
      system: systemInfo
    };
    
    // Se il DB non è connesso, restituisci uno stato 503 (Service Unavailable)
    if (!dbStatus.isConnected) {
      return res.status(503).json(healthStatus);
    }
    
    res.json(healthStatus);
  } catch (error) {
    console.error('Errore durante la verifica dello stato del sistema:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante la verifica dello stato del sistema',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/system/db-stats
 * @desc    Ottiene statistiche dettagliate sul database
 * @access  Private (solo admin)
 */
router.get('/db-stats', async (req, res) => {
  try {
    const dbStatus = checkConnection();
    
    // Se il DB non è connesso, restituisci uno stato 503
    if (!dbStatus.isConnected) {
      return res.status(503).json({
        status: 'error',
        message: 'Database non connesso',
        details: dbStatus
      });
    }
    
    res.json({
      status: 'success',
      data: dbStatus.stats
    });
  } catch (error) {
    console.error('Errore durante il recupero delle statistiche del database:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante il recupero delle statistiche del database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/system/db-version
 * @desc    Ottiene la versione di MongoDB
 * @access  Private (solo admin)
 */
router.get('/db-version', async (req, res) => {
  try {
    const dbStatus = checkConnection();
    
    // Se il DB non è connesso, restituisci uno stato 503
    if (!dbStatus.isConnected) {
      return res.status(503).json({
        status: 'error',
        message: 'Database non connesso',
        details: dbStatus
      });
    }
    
    // Ottieni informazioni sulla versione del database
    const admin = mongoose.connection.db.admin();
    const serverInfo = await admin.serverInfo();
    
    res.json({
      status: 'success',
      version: serverInfo.version,
      versionArray: serverInfo.versionArray,
      modules: serverInfo.modules || [],
      gitVersion: serverInfo.gitVersion,
      openSSLVersion: serverInfo.openSSLVersion,
      buildEnvironment: serverInfo.buildEnvironment
    });
  } catch (error) {
    console.error('Errore durante il recupero della versione del database:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante il recupero della versione del database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/system/test-db-connection
 * @desc    Testa la connessione al database
 * @access  Private (solo admin)
 */
router.post('/test-db-connection', async (req, res) => {
  try {
    // Prova a eseguire un comando semplice sul database
    const result = await mongoose.connection.db.command({ ping: 1 });
    
    if (result && result.ok === 1) {
      res.json({
        status: 'success',
        message: 'Connessione al database funzionante',
        latency: `${Date.now() - req.startTime}ms`, // Richiede un middleware per impostare req.startTime
        result
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Test di connessione fallito',
        result
      });
    }
  } catch (error) {
    console.error('Errore durante il test della connessione al database:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante il test della connessione al database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/system/openai-cache
 * @desc    Ottiene statistiche sulla cache OpenAI
 * @access  Private (solo admin)
 */
router.get('/openai-cache', (req, res) => {
  try {
    const openaiService = require('../services/openaiService');
    
    // Ottieni statistiche sulla cache
    const cacheStats = openaiService.getCacheStats();
    
    res.json({
      status: 'success',
      data: cacheStats
    });
  } catch (error) {
    console.error('Errore durante il recupero delle statistiche della cache OpenAI:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante il recupero delle statistiche della cache OpenAI',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/system/openai-cache/clear
 * @desc    Svuota la cache di OpenAI
 * @access  Private (solo admin)
 */
router.post('/openai-cache/clear', (req, res) => {
  try {
    const openaiService = require('../services/openaiService');
    
    // Svuota la cache
    openaiService.clearCache();
    
    res.json({
      status: 'success',
      message: 'Cache OpenAI svuotata con successo'
    });
  } catch (error) {
    console.error('Errore durante la pulizia della cache OpenAI:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Errore durante la pulizia della cache OpenAI',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/system/monitor
 * @desc    Visualizza la pagina di monitoraggio del sistema
 * @access  Private (solo admin)
 */
router.get('/monitor', (req, res) => {
  try {
    res.render('system', { 
      title: 'Monitoraggio Sistema'
    });
  } catch (error) {
    console.error('Errore durante il caricamento della pagina di monitoraggio:', error);
    res.status(500).render('error', { 
      title: 'Errore', 
      message: process.env.NODE_ENV === 'production' ? 'Si è verificato un errore' : error.message
    });
  }
});

module.exports = router;