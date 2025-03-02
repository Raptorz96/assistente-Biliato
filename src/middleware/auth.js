/**
 * Middleware di autenticazione per proteggere le rotte
 */
const jwt = require('jsonwebtoken');

/**
 * Middleware che verifica il token JWT nelle richieste
 * @param {Object} req - Oggetto richiesta Express
 * @param {Object} res - Oggetto risposta Express
 * @param {Function} next - Funzione next di Express
 */
const auth = (req, res, next) => {
  try {
    // Ottieni il token dall'header Authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }
    
    // Verifica il token con il secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Aggiungi l'utente alla richiesta
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Errore di autenticazione:', error.message);
    res.status(401).json({ error: 'Token non valido' });
  }
};

module.exports = auth;