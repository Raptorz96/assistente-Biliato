const mongoose = require('mongoose');
const { isValidFiscalCode, isValidVatNumber, isValidEmail, isValidPhone, isValidPostalCode } = require('../utils/validators');

/**
 * Schema del modello Client per la gestione dei clienti dello studio commercialista.
 * Include dati anagrafici, fiscali, di contatto e relativi all'onboarding.
 */
const ClientSchema = new mongoose.Schema({
  // Dati identificativi azienda/cliente
  name: {
    type: String,
    required: [true, 'Il nome del cliente è obbligatorio'],
    trim: true,
    maxlength: [100, 'Il nome non può superare i 100 caratteri'],
    index: true
  },
  fiscalCode: {
    type: String,
    required: [true, 'Il codice fiscale è obbligatorio'],
    unique: true,
    trim: true,
    validate: {
      validator: isValidFiscalCode,
      message: 'Formato codice fiscale non valido'
    },
    index: true
  },
  vatNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: isValidVatNumber,
      message: 'Formato partita IVA non valido'
    },
    index: true
  },
  // Tipo azienda - utilizzando enum appropriati per tipologie italiane
  companyType: {
    type: String,
    enum: {
      values: ['Ditta Individuale', 'SNC', 'SAS', 'SRL', 'SPA', 'SAPA', 'Cooperativa', 'Associazione', 'Altro'],
      message: 'Tipo di azienda non valido'
    },
    default: 'Ditta Individuale',
    index: true
  },
  // Informazioni di contatto in struttura nidificata
  contactInfo: {
    email: {
      type: String,
      required: [true, 'L\'email è obbligatoria'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: isValidEmail,
        message: 'Email non valida'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: isValidPhone,
        message: 'Formato telefono non valido'
      }
    },
    alternativePhone: {
      type: String,
      trim: true,
      validate: {
        validator: isValidPhone,
        message: 'Formato telefono alternativo non valido'
      }
    },
    address: {
      street: {
        type: String,
        trim: true,
        required: [true, 'L\'indirizzo è obbligatorio']
      },
      city: {
        type: String,
        trim: true,
        required: [true, 'La città è obbligatoria']
      },
      province: {
        type: String,
        trim: true,
        maxlength: [2, 'La sigla provincia deve essere di 2 caratteri'],
        required: [true, 'La provincia è obbligatoria']
      },
      postalCode: {
        type: String,
        trim: true,
        required: [true, 'Il CAP è obbligatorio'],
        validate: {
          validator: isValidPostalCode,
          message: 'Il CAP deve essere di 5 cifre'
        }
      },
      country: { 
        type: String, 
        default: 'Italia',
        trim: true
      }
    }
  },
  // Dati rappresentante legale
  legalRepresentative: {
    firstName: {
      type: String,
      required: [true, 'Il nome del rappresentante legale è obbligatorio'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Il cognome del rappresentante legale è obbligatorio'],
      trim: true
    },
    fiscalCode: {
      type: String,
      required: [true, 'Il codice fiscale del rappresentante legale è obbligatorio'],
      trim: true,
      validate: {
        validator: isValidFiscalCode,
        message: 'Formato codice fiscale rappresentante legale non valido'
      }
    },
    role: {
      type: String,
      trim: true,
      default: 'Legale Rappresentante'
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: isValidEmail,
        message: 'Email rappresentante legale non valida'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: isValidPhone,
        message: 'Formato telefono rappresentante legale non valido'
      }
    }
  },
  // Dati aziendali aggiuntivi
  businessSector: {
    type: String,
    trim: true,
    index: true
  },
  foundingDate: {
    type: Date
  },
  annualRevenue: {
    type: Number,
    min: [0, 'Il fatturato annuale non può essere negativo']
  },
  employees: {
    type: Number,
    min: [0, 'Il numero di dipendenti non può essere negativo']
  },
  accountingRegime: {
    type: String,
    enum: ['Ordinario', 'Semplificato', 'Forfettario', 'Non specificato'],
    default: 'Non specificato',
    index: true
  },
  // Gestione onboarding
  onboarding: {
    status: {
      type: String,
      enum: ['nuovo', 'in_corso', 'completato'],
      default: 'nuovo',
      index: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    completedDate: {
      type: Date
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checklist: [{
      documentId: String,
      name: {
        type: String,
        required: true
      },
      required: {
        type: Boolean,
        default: true
      },
      status: {
        type: String,
        enum: ['in_attesa', 'caricato', 'verificato', 'rifiutato'],
        default: 'in_attesa'
      },
      uploadedAt: Date,
      verifiedAt: Date,
      notes: String
    }],
    notes: String,
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  // Servizi attivati, note e tag
  services: [{
    type: String,
    enum: [
      'Contabilità Ordinaria',
      'Contabilità Semplificata',
      'Dichiarazione Redditi',
      'Modello 770',
      'Buste Paga',
      'Consulenza Fiscale',
      'Consulenza Societaria',
      'Revisione Contabile',
      'Altro'
    ]
  }],
  notes: {
    type: String,
    trim: true
  },
  tags: [String],
  // ID esterni per integrazione con altri sistemi
  externalIds: {
    erpId: String,
    legacyId: String,
    otherSystems: Map
  },
  // Consenso dati GDPR
  dataConsent: {
    marketing: {
      type: Boolean,
      default: false
    },
    thirdParty: {
      type: Boolean,
      default: false
    },
    consentDate: Date,
    consentVersion: String,
    lastUpdated: Date,
    ipAddress: String
  },
  // Documenti caricati
  documents: [{
    name: String,
    path: String,
    type: {
      type: String,
      enum: ['Identità', 'Fiscale', 'Legale', 'Finanziario', 'Contratto', 'Altro'],
      default: 'Altro'
    },
    uploadDate: { 
      type: Date, 
      default: Date.now 
    },
    status: {
      type: String,
      enum: ['in_attesa', 'verificato', 'scaduto'],
      default: 'in_attesa'
    },
    expiryDate: Date
  }],
  // Flag per indicare client attivo/inattivo
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Campi temporali automatici
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastContactDate: {
    type: Date
  }
}, { 
  timestamps: true, // Gestisce automaticamente createdAt e updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indici per migliorare la performance delle query
ClientSchema.index({ name: 1, 'contactInfo.email': 1 });
ClientSchema.index({ 'onboarding.status': 1, 'onboarding.assignedTo': 1 });
ClientSchema.index({ companyType: 1, accountingRegime: 1 });
ClientSchema.index({ isActive: 1, 'onboarding.status': 1 });
ClientSchema.index({ services: 1 });
ClientSchema.index({ tags: 1 });
ClientSchema.index({ createdAt: -1 });

// Virtual per il nome completo del rappresentante legale
ClientSchema.virtual('legalRepresentative.fullName').get(function() {
  if (this.legalRepresentative && this.legalRepresentative.firstName && this.legalRepresentative.lastName) {
    return `${this.legalRepresentative.firstName} ${this.legalRepresentative.lastName}`;
  }
  return '';
});

// Middleware pre-save per aggiornare updatedAt
ClientSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware pre-save per calcolare percentuale completamento onboarding
ClientSchema.pre('save', function(next) {
  if (this.onboarding && this.onboarding.checklist && this.onboarding.checklist.length > 0) {
    const totalItems = this.onboarding.checklist.length;
    const completedItems = this.onboarding.checklist.filter(
      item => item.status === 'verificato'
    ).length;
    
    this.onboarding.completionPercentage = Math.round((completedItems / totalItems) * 100);
    
    // Aggiorna stato onboarding in base alla percentuale
    if (this.onboarding.completionPercentage === 100) {
      this.onboarding.status = 'completato';
      this.onboarding.completedDate = new Date();
    } else if (this.onboarding.completionPercentage > 0) {
      this.onboarding.status = 'in_corso';
    }
  }
  
  next();
});

// Method per verificare se un cliente ha tutti i documenti richiesti
ClientSchema.methods.hasRequiredDocuments = function() {
  if (!this.onboarding || !this.onboarding.checklist) {
    return false;
  }
  
  const requiredDocs = this.onboarding.checklist.filter(doc => doc.required);
  const verifiedRequiredDocs = requiredDocs.filter(doc => doc.status === 'verificato');
  
  return requiredDocs.length === verifiedRequiredDocs.length;
};

// Static per trovare clienti con documenti in scadenza
ClientSchema.statics.findWithExpiringDocuments = function(daysThreshold = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  
  return this.find({
    'documents.expiryDate': {
      $exists: true,
      $ne: null, 
      $lte: thresholdDate,
      $gte: new Date()
    },
    'isActive': true
  });
};

module.exports = mongoose.model('Client', ClientSchema);