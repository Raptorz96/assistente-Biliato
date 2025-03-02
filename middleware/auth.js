/**
 * Middleware di autenticazione e autorizzazione
 * 
 * Gestisce la verifica dei token JWT, i controlli di autorizzazione,
 * e la protezione contro attacchi di tipo brute force.
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const LoginAttempt = require('../src/models/LoginAttempt');

// Durata dei token
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || 1; // 1 giorno

/**
 * Genera un token JWT
 * @param {String} id - ID dell'utente
 * @param {String} secret - Secret JWT da utilizzare
 * @param {String} expiresIn - Durata del token
 * @returns {String} token JWT
 */
const signToken = (id, secret = process.env.JWT_SECRET, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(
    { id },
    secret,
    { expiresIn }
  );
};

/**
 * Salva i token nei cookie con opzioni di sicurezza appropriate
 * @param {Object} res - Oggetto response
 * @param {String} accessToken - Token di accesso
 * @param {String} refreshToken - Token di refresh
 */
const setTokenCookies = (res, accessToken, refreshToken = null) => {
  // Opzioni di sicurezza comuni per i cookie
  const cookieOptions = {
    httpOnly: true, // Il cookie è accessibile solo dal server
    secure: process.env.NODE_ENV === 'production', // HTTPS solo in produzione
    sameSite: 'strict', // Protegge da attacchi CSRF
    path: '/' // Disponibile in tutta l'applicazione
  };

  // Cookie con token di accesso (breve durata)
  res.cookie('jwt', accessToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000)
  });

  // Cookie con token di refresh (lunga durata)
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
      path: '/api/v1/auth/refresh' // Disponibile solo per il refresh
    });
  }
};

/**
 * Middleware per proteggere le route autenticate
 * Verifica il token JWT e popola req.user con i dati dell'utente
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Verifica se il token è presente
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Accesso non autorizzato. Effettua il login per accedere a questa risorsa.'
      });
    }

    // 2) Verifica la validità del token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Verifica se l'utente esiste ancora
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'L\'utente associato a questo token non esiste più.'
      });
    }

    // 4) Verifica se l'utente ha cambiato password dopo l'emissione del token
    if (currentUser.passwordChangedAfter && 
        currentUser.passwordChangedAfter.getTime() > decoded.iat * 1000) {
      return res.status(401).json({
        status: 'error',
        message: 'La password è stata modificata. Effettua nuovamente il login.'
      });
    }

    // 5) Verifica se l'account è bloccato per troppi tentativi di accesso
    if (currentUser.accountLocked && currentUser.lockUntil > Date.now()) {
      const remainingTimeMinutes = Math.ceil((currentUser.lockUntil - Date.now()) / (1000 * 60));
      return res.status(403).json({
        status: 'error',
        message: `Account temporaneamente bloccato per motivi di sicurezza. Riprova tra ${remainingTimeMinutes} minuti.`
      });
    }

    // 6) Verifica se l'utente è attivo
    if (currentUser.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'Il tuo account non è attivo. Contatta l\'amministratore.'
      });
    }

    // Accesso consentito, salva utente in req
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token non valido. Effettua nuovamente il login.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'La sessione è scaduta. Effettua nuovamente il login.'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Si è verificato un errore durante l\'autenticazione.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware per l'autorizzazione basata su ruoli
 * @param  {...string} roles - Ruoli autorizzati
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Verifica che l'utente sia stato autenticato
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Accesso non autorizzato.'
      });
    }

    // Verifica se il ruolo dell'utente è incluso nei ruoli consentiti
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Non hai i permessi necessari per eseguire questa azione.'
      });
    }

    next();
  };
};

/**
 * Middleware per l'autorizzazione basata su permessi specifici
 * @param  {...string} requiredPermissions - Permessi richiesti
 */
exports.requirePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    // Verifica che l'utente sia stato autenticato
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Accesso non autorizzato.'
      });
    }

    // Gli amministratori hanno tutti i permessi
    if (req.user.role === 'admin') {
      return next();
    }

    // Verifica se l'utente ha i permessi richiesti
    const userPermissions = req.user.permissions || [];
    
    // Verifica se tutti i permessi richiesti sono posseduti dall'utente
    const hasAllPermissions = requiredPermissions.every(permission => {
      return userPermissions.includes(permission);
    });

    if (!hasAllPermissions) {
      return res.status(403).json({
        status: 'error',
        message: 'Non hai i permessi necessari per eseguire questa azione.',
        requiredPermissions
      });
    }

    next();
  };
};

/**
 * Funzione per validare permessi specifici sul modello resource:action
 * @param {string} resource - Risorsa (client, document, ecc.)
 * @param {string} action - Azione (create, read, update, delete)
 */
exports.hasPermission = (resource, action) => {
  return (req, res, next) => {
    // Verifica che l'utente sia stato autenticato
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Accesso non autorizzato.'
      });
    }

    // Gli amministratori hanno tutti i permessi
    if (req.user.role === 'admin') {
      return next();
    }

    const permissionString = `${resource}:${action}`;
    const wildCardPermission = `${resource}:*`;
    const userPermissions = req.user.permissions || [];

    // Verifica se l'utente ha il permesso specifico, il permesso wildcard, 
    // o un permesso generale di gestione
    if (
      userPermissions.includes(permissionString) || 
      userPermissions.includes(wildCardPermission) ||
      userPermissions.includes(`manage_${resource}s`)
    ) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: `Non hai il permesso di ${action} questo ${resource}.`
    });
  };
};

/**
 * Funzione per verificare la proprietà di una risorsa
 * Usato per verificare se un utente può modificare solo le proprie risorse
 * @param {Function} getResourceOwner - Funzione per ottenere l'ID del proprietario
 */
exports.isOwner = (getResourceOwner) => {
  return async (req, res, next) => {
    try {
      // Verifica che l'utente sia stato autenticato
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Accesso non autorizzato.'
        });
      }

      // Gli amministratori possono fare tutto
      if (req.user.role === 'admin') {
        return next();
      }

      // Ottieni l'ID del proprietario della risorsa
      const ownerId = await getResourceOwner(req);

      // Verifica se l'utente è il proprietario
      if (ownerId && ownerId.toString() === req.user._id.toString()) {
        return next();
      }

      return res.status(403).json({
        status: 'error',
        message: 'Puoi modificare solo le tue risorse.'
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Si è verificato un errore durante la verifica della proprietà.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Rate limiter per le richieste di login
 * Protegge dalle richieste brute force limitando i tentativi di login
 */
exports.loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // limita ogni IP a 5 richieste per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.'
  },
  skipSuccessfulRequests: true // non conta le richieste riuscite
});

/**
 * Rate limiter per le API generali
 * Protegge da attacchi DoS limitando il numero di richieste
 */
exports.apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // limita ogni IP a 100 richieste per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Troppe richieste. Riprova più tardi.'
  }
});

/**
 * Verifica il token per la reimpostazione della password
 */
exports.verifyResetToken = async (token) => {
  try {
    // Verifica il token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_RESET_SECRET);
    
    // Trova l'utente associato al token
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return {
        valid: false,
        message: 'Il token non è valido o è scaduto.'
      };
    }

    return {
      valid: true,
      userId: user._id
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Errore nella verifica del token.',
      error: error.message
    };
  }
};

/**
 * Middleware per verificare l'accesso ai dati di un cliente specifico
 * @param {String} idParamName - Nome del parametro che contiene l'ID del cliente
 */
exports.verifyClientAccess = (idParamName = 'clientId') => {
  return async (req, res, next) => {
    try {
      const clientId = req.params[idParamName];
      
      if (!clientId) {
        return res.status(400).json({
          status: 'error',
          message: 'ID cliente mancante.'
        });
      }

      // Amministratori hanno accesso a tutti i clienti
      if (req.user.role === 'admin') {
        return next();
      }

      // Operatori possono accedere ai clienti loro assegnati
      if (req.user.role === 'operator') {
        // Cerca nel modello ClientAssignment se l'operatore è assegnato al cliente
        const Client = mongoose.model('Client');
        const client = await Client.findById(clientId);
        
        if (!client) {
          return res.status(404).json({
            status: 'error',
            message: 'Cliente non trovato.'
          });
        }
        
        // Verifica se l'utente è assegnato al cliente
        const isAssigned = client.assignedTo && 
          client.assignedTo.toString() === req.user._id.toString();
        
        if (isAssigned) {
          // Salva il cliente in req per uso successivo
          req.client = client;
          return next();
        }
      }
      
      // Se il cliente è l'utente stesso (per accesso clienti ai propri dati)
      if (req.user.role === 'customer' && req.user.clientId && 
          req.user.clientId.toString() === clientId) {
        return next();
      }

      return res.status(403).json({
        status: 'error',
        message: 'Non hai i permessi per accedere ai dati di questo cliente.'
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Errore durante la verifica dell\'accesso al cliente.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Traccia i tentativi di accesso falliti e gestisce il blocco dell'account
 * @param {String} username - Nome utente
 * @param {String} ipAddress - Indirizzo IP
 * @param {Boolean} successful - Se il tentativo è riuscito
 */
exports.trackLoginAttempt = async (username, ipAddress, successful) => {
  try {
    // Crea nuovo tentativo di login
    await LoginAttempt.create({
      username,
      ipAddress,
      successful,
      date: new Date()
    });

    if (!successful) {
      // Conta i tentativi falliti nelle ultime 24 ore
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedAttempts = await LoginAttempt.countDocuments({
        username,
        successful: false,
        date: { $gte: oneDayAgo }
      });

      // Se ci sono troppi tentativi falliti, blocca l'account
      if (failedAttempts >= 5) {
        const user = await User.findOne({ username });
        
        if (user) {
          // Blocca l'account per 30 minuti
          user.accountLocked = true;
          user.loginAttempts = failedAttempts;
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
          await user.save();
          
          // Registra evento di sicurezza
          console.warn(`Account ${username} bloccato per troppi tentativi di accesso falliti.`);
          
          return {
            locked: true,
            message: 'Account temporaneamente bloccato per troppi tentativi falliti.'
          };
        }
      }
    } else {
      // Se il login è riuscito, resetta il contatore dei tentativi
      const user = await User.findOne({ username });
      if (user && (user.loginAttempts > 0 || user.accountLocked)) {
        user.loginAttempts = 0;
        user.accountLocked = false;
        user.lockUntil = undefined;
        await user.save();
      }
    }

    return { locked: false };
  } catch (error) {
    console.error('Errore nel tracciamento dei tentativi di login:', error);
    return { error: error.message };
  }
};

/**
 * Genera un nuovo token refresh
 * @param {String} userId - ID dell'utente
 * @returns {Object} - Token di accesso e refresh
 */
exports.generateRefreshToken = async (userId) => {
  // Genera token di refresh
  const refreshToken = signToken(
    userId, 
    process.env.JWT_REFRESH_SECRET, 
    JWT_REFRESH_EXPIRES_IN
  );
  
  // Genera token di accesso
  const accessToken = signToken(userId);
  
  // Salva il refresh token nel database (opzionale per sicurezza aggiuntiva)
  try {
    await User.findByIdAndUpdate(userId, {
      refreshToken: crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex'),
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 giorni
    });
  } catch (error) {
    console.error('Errore nel salvataggio del refresh token:', error);
  }
  
  return {
    accessToken,
    refreshToken
  };
};

/**
 * Verifica e utilizza un token di refresh per generare un nuovo token di accesso
 * @param {String} refreshToken - Token di refresh
 * @returns {Object} - Nuovo token di accesso o errore
 */
exports.refreshAuth = async (refreshToken) => {
  try {
    if (!refreshToken) {
      return {
        status: 'error',
        message: 'Token di refresh mancante.'
      };
    }
    
    // Verifica il token di refresh
    const decoded = await promisify(jwt.verify)(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET
    );
    
    // Hash del token per il confronto con quello memorizzato
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    
    // Trova l'utente associato al token
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: hashedToken,
      refreshTokenExpiresAt: { $gt: Date.now() }
    });
    
    if (!user) {
      return {
        status: 'error',
        message: 'Token di refresh non valido o scaduto.'
      };
    }
    
    // Genera nuovo token di accesso (non un nuovo refresh token)
    const accessToken = signToken(user._id);
    
    return {
      status: 'success',
      accessToken
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Errore durante il refresh del token.',
      error: error.message
    };
  }
};

/**
 * Configura i cookie per l'autenticazione
 * @param {Object} res - Oggetto response
 * @param {String} accessToken - Token di accesso
 * @param {String} refreshToken - Token di refresh
 */
exports.sendTokens = (res, accessToken, refreshToken = null) => {
  setTokenCookies(res, accessToken, refreshToken);
  
  return {
    status: 'success',
    accessToken,
    refreshToken
  };
};

/**
 * Elimina i cookie di autenticazione
 * @param {Object} res - Oggetto response
 */
exports.clearAuthCookies = (res) => {
  res.cookie('jwt', 'logged-out', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.cookie('refreshToken', 'logged-out', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    path: '/api/v1/auth/refresh'
  });
};