/**
 * Classe personalizzata per gli errori dell'applicazione
 * Estende Error con proprietà aggiuntive per la gestione degli errori HTTP
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

module.exports = AppError;