/**
 * Middleware per gestire gli errori dell'applicazione
 */

/**
 * Middleware per gestire errori globali
 * @param {Error} err - Oggetto errore
 * @param {Object} req - Oggetto richiesta Express
 * @param {Object} res - Oggetto risposta Express
 * @param {Function} next - Funzione next di Express
 */
const errorHandler = (err, req, res, next) => {
  // Determina lo statusCode dell'errore (default 500)
  const statusCode = err.statusCode || 500;
  
  console.error(`[ERROR] ${err.message}`);
  
  // Se l'errore è di validazione, formatta la risposta appropriatamente
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Errore di validazione',
      details: formatValidationError(err)
    });
  }
  
  // In produzione, non inviare dettagli dell'errore al client
  const response = {
    error: err.message,
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack
  };
  
  res.status(statusCode).json(response);
};

/**
 * Formatta gli errori di validazione di Mongoose
 * @param {Error} err - Errore di validazione
 * @returns {Object} - Errori formattati
 */
const formatValidationError = (err) => {
  const errors = {};
  
  Object.keys(err.errors).forEach((key) => {
    errors[key] = err.errors[key].message;
  });
  
  return errors;
};

module.exports = errorHandler;