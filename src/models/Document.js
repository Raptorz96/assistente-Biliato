const mongoose = require('mongoose');

/**
 * Schema per i documenti archiviati nel sistema
 * Gestisce documenti caricati o generati per i clienti, con riferimenti
 * al loro storage fisico in MinIO/S3 e metadati estratti.
 */
const DocumentSchema = new mongoose.Schema({
  // Riferimento al cliente associato al documento
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'L\'ID del cliente è obbligatorio'],
    index: true
  },
  
  // Informazioni sul file
  filename: {
    type: String,
    required: [true, 'Il nome del file è obbligatorio'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Il nome originale del file è obbligatorio'],
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'Il tipo MIME è obbligatorio'],
    trim: true
  },
  size: {
    type: Number,
    required: [true, 'La dimensione del file è obbligatoria'],
    min: [0, 'La dimensione del file non può essere negativa']
  },
  path: {
    type: String,
    required: [true, 'Il percorso di archiviazione è obbligatorio'],
    trim: true
  },
  
  // Classificazione documento
  category: {
    type: String,
    required: [true, 'La categoria del documento è obbligatoria'],
    enum: {
      values: ['identity', 'fiscal', 'contract', 'legal', 'accounting', 'communication', 'other'],
      message: 'Categoria documento non valida'
    },
    default: 'other',
    index: true
  },
  
  // Tag per ricerca e classificazione
  tags: [{
    type: String,
    trim: true
  }],
  
  // Metadati estratti dal documento (struttura flessibile)
  metadata: {
    docType: String,
    issueDate: Date,
    expiryDate: Date,
    extractedData: mongoose.Schema.Types.Mixed, // Dati estratti specifici per il tipo di documento
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    extractionDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Stato del documento
  status: {
    type: String,
    enum: {
      values: ['pending', 'processed', 'verified', 'rejected', 'expired', 'archived'],
      message: 'Stato documento non valido'
    },
    default: 'pending',
    index: true
  },
  
  // Risultati dell'elaborazione (OCR, AI, etc.)
  processingResults: {
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    errors: [String],
    processingTime: Number, // tempo in ms
    processingDate: Date,
    processor: String // identificativo del sistema che ha processato il documento
  },
  
  // Informazioni di sicurezza e accesso
  accessPermissions: {
    isPublic: {
      type: Boolean,
      default: false
    },
    restrictedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    publicToken: String,
    publicExpiry: Date
  },
  
  // Informazioni sulla firma digitale
  signature: {
    isSigned: {
      type: Boolean,
      default: false
    },
    signatureType: {
      type: String,
      enum: ['simple', 'qualified', 'digital', 'none'],
      default: 'none'
    },
    signedBy: String,
    signatureDate: Date,
    signatureVerified: {
      type: Boolean,
      default: false
    },
    signatureProvider: String
  },
  
  // Tracciamento invii
  delivery: {
    isSent: {
      type: Boolean,
      default: false
    },
    sentDate: Date,
    sentTo: String,
    sentMethod: {
      type: String,
      enum: ['email', 'pec', 'manual', 'download', 'other'],
      default: 'email'
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending'
    },
    readDate: Date,
    trackingId: String
  },
  
  // Informazioni amministrative
  retention: {
    retentionPeriod: Number, // mesi
    mustRetainUntil: Date,
    retentionCategory: String,
    legalBasis: String
  },
  
  // Note e commenti
  notes: String,
  
  // Campi di audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastAccessed: {
    date: Date,
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true, // Gestisce automaticamente createdAt e updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indici per ottimizzare le query frequenti
DocumentSchema.index({ clientId: 1, category: 1 });
DocumentSchema.index({ clientId: 1, status: 1 });
DocumentSchema.index({ tags: 1 });
DocumentSchema.index({ 'metadata.issueDate': 1 });
DocumentSchema.index({ 'metadata.expiryDate': 1 });
DocumentSchema.index({ createdAt: -1 });

// Virtual per URL completo del documento
DocumentSchema.virtual('fullUrl').get(function() {
  const baseStorageUrl = process.env.STORAGE_BASE_URL || '';
  return `${baseStorageUrl}${this.path}`;
});

// Virtual per determinare se il documento è scaduto
DocumentSchema.virtual('isExpired').get(function() {
  if (!this.metadata.expiryDate) return false;
  return new Date() > this.metadata.expiryDate;
});

// Middleware pre-save per aggiornare lo stato se il documento è scaduto
DocumentSchema.pre('save', function(next) {
  if (this.isModified('metadata.expiryDate') && this.metadata.expiryDate) {
    if (new Date() > this.metadata.expiryDate) {
      this.status = 'expired';
    }
  }
  
  // Aggiorna updatedAt
  this.updatedAt = new Date();
  
  next();
});

// Metodo per verificare se un documento è scaduto
DocumentSchema.methods.checkExpiry = function() {
  if (!this.metadata.expiryDate) return false;
  
  const isExpired = new Date() > this.metadata.expiryDate;
  
  if (isExpired && this.status !== 'expired') {
    this.status = 'expired';
    this.save();
  }
  
  return isExpired;
};

// Metodo per generare un token di accesso pubblico temporaneo
DocumentSchema.methods.generatePublicToken = function(expiryDays = 7) {
  const crypto = require('crypto');
  
  // Genera un token sicuro
  this.accessPermissions.publicToken = crypto.randomBytes(32).toString('hex');
  
  // Imposta data di scadenza
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  this.accessPermissions.publicExpiry = expiryDate;
  
  this.accessPermissions.isPublic = true;
  
  return this.save();
};

// Metodo per registrare l'invio del documento
DocumentSchema.methods.markAsSent = function(recipient, method = 'email') {
  this.delivery = {
    isSent: true,
    sentDate: new Date(),
    sentTo: recipient,
    sentMethod: method,
    deliveryStatus: 'sent'
  };
  
  return this.save();
};

// Metodo statico per trovare documenti per cliente e categoria
DocumentSchema.statics.findByClientAndCategory = function(clientId, category, options = {}) {
  const query = { clientId };
  
  if (category) {
    query.category = category;
  }
  
  // Opzioni predefinite
  const defaultOptions = {
    sort: { createdAt: -1 },
    limit: 50
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  return this.find(query)
    .sort(mergedOptions.sort)
    .limit(mergedOptions.limit);
};

// Metodo statico per trovare documenti in scadenza
DocumentSchema.statics.findExpiringDocuments = function(daysThreshold = 30) {
  const today = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(today.getDate() + daysThreshold);
  
  return this.find({
    'metadata.expiryDate': {
      $exists: true,
      $ne: null,
      $gt: today,
      $lte: thresholdDate
    },
    status: { $ne: 'expired' }
  }).sort({ 'metadata.expiryDate': 1 });
};

// Metodo statico per cercare documenti per contenuto (richiede un indice testuale)
DocumentSchema.statics.searchByContent = function(searchTerm, clientId = null) {
  const query = {
    $text: { $search: searchTerm }
  };
  
  if (clientId) {
    query.clientId = clientId;
  }
  
  return this.find(query)
    .sort({ score: { $meta: 'textScore' } })
    .limit(20);
};

module.exports = mongoose.model('Document', DocumentSchema);