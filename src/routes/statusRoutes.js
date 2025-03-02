const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * @route   GET /status
 * @desc    Restituisce lo stato dell'API
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    // Leggi la versione dal package.json
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageData.version || '1.0.0';

    // Costruisci la risposta
    const response = {
      status: 'success',
      message: 'API funzionante correttamente',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      version
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Errore durante la verifica dello stato dell\'API:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Errore durante la verifica dello stato dell\'API',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;