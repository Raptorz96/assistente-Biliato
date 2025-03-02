/**
 * Utility per la gestione degli errori nell'applicazione
 */

/**
 * Wrapper per funzioni asincrone nei controller
 * Cattura automaticamente gli errori e li passa al middleware di gestione errori
 * 
 * @param {Function} fn - Funzione da eseguire
 * @returns {Function} Funzione middleware con gestione errori
 */
exports.catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(err => next(err));
  };
};

/**
 * Classe personalizzata per errori operativi dell'applicazione
 * Estende Error con proprietà aggiuntive per gestione errori HTTP
 */
class AppError extends Error {
  /**
   * Crea un nuovo errore operativo
   * @param {string} message - Messaggio di errore
   * @param {number} statusCode - Codice di stato HTTP
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handler globale per errori in produzione
 * @param {Error} err - Errore
 * @param {Object} res - Oggetto response Express
 */
exports.handleProductionError = (err, res) => {
  // Errori operativi: invia dettagli al client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }
  
  // Errori di programmazione: non inviare dettagli al client
  console.error('ERRORE 💥', err);
  return res.status(500).json({
    status: 'error',
    message: 'Si è verificato un errore interno. Riprova più tardi.'
  });
};

/**
 * Handler globale per errori in sviluppo
 * @param {Error} err - Errore
 * @param {Object} res - Oggetto response Express
 */
exports.handleDevError = (err, res) => {
  return res.status(err.statusCode || 500).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

/**
 * Handler per errori di validazione Mongoose
 * @param {Error} err - Errore di validazione Mongoose
 * @returns {AppError} Errore operativo formattato
 */
exports.handleValidationError = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Dati non validi: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handler per errori di duplicazione MongoDB
 * @param {Error} err - Errore di duplicazione
 * @returns {AppError} Errore operativo formattato
 */
exports.handleDuplicateKeyError = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  
  const message = `Valore duplicato: ${value}. Utilizzare un altro valore.`;
  return new AppError(message, 400);
};

/**
 * Handler per errori di cast MongoDB
 * @param {Error} err - Errore di cast
 * @returns {AppError} Errore operativo formattato
 */
exports.handleCastError = err => {
  const message = `Valore non valido ${err.value} per il campo ${err.path}.`;
  return new AppError(message, 400);
};

/**
 * Handler per errori JWT
 * @returns {AppError} Errore operativo formattato
 */
exports.handleJWTError = () => {
  return new AppError('Token non valido. Effettua nuovamente l\'accesso.', 401);
};

/**
 * Handler per errori JWT scaduti
 * @returns {AppError} Errore operativo formattato
 */
exports.handleJWTExpiredError = () => {
  return new AppError('Il tuo token è scaduto. Effettua nuovamente l\'accesso.', 401);
};

module.exports.AppError = AppError;