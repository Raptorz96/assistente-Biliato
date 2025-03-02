/**
 * Middleware per il logging delle richieste HTTP
 */

/**
 * Middleware che registra i dettagli delle richieste HTTP
 * @param {Object} req - Oggetto richiesta Express
 * @param {Object} res - Oggetto risposta Express
 * @param {Function} next - Funzione next di Express
 */
const logger = (req, res, next) => {
  const start = new Date();
  const { method, originalUrl, ip } = req;
  
  // Log all'inizio della richiesta
  console.log(`[${start.toISOString()}] ${method} ${originalUrl} - IP: ${ip}`);
  
  // Intercetta il termine della richiesta per registrare il tempo di risposta
  res.on('finish', () => {
    const duration = new Date() - start;
    const statusCode = res.statusCode;
    
    // Usa colori diversi in base allo status code
    let logLevel = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }
    
    // Log al termine della richiesta
    console[logLevel](
      `[${new Date().toISOString()}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
    );
  });
  
  next();
};

module.exports = logger;