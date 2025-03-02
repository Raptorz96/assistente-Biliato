const mongoose = require('mongoose');

/**
 * Schema per i modelli di documento (templates)
 * Gestisce i template per la generazione di documenti con supporto per:
 * - Formati multipli (HTML, PDF, DOCX)
 * - Versioning
 * - Placeholder per dati dinamici
 */
const TemplateSchema = new mongoose.Schema({
  // Informazioni di base
  name: {
    type: String,
    required: [true, 'Il nome del template è obbligatorio'],
    trim: true,
    maxlength: [100, 'Il nome non può superare i 100 caratteri'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'La descrizione del template è obbligatoria'],
    trim: true,
    maxlength: [500, 'La descrizione non può superare i 500 caratteri']
  },
  
  // Categorizzazione
  category: {
    type: String,
    required: [true, 'La categoria del template è obbligatoria'],
    enum: {
      values: ['welcome', 'contract', 'report', 'invoice', 'tax', 'legal', 'communication', 'other'],
      message: 'Categoria non valida'
    },
    default: 'other',
    index: true
  },
  
  // Formato del template
  format: {
    type: String,
    required: [true, 'Il formato del template è obbligatorio'],
    enum: {
      values: ['html', 'docx', 'pdf'],
      message: 'Formato non valido'
    },
    default: 'html',
    index: true
  },
  
  // Contenuto del template
  content: {
    type: String,
    required: [true, 'Il contenuto del template è obbligatorio'],
    validate: {
      validator: function(content) {
        // Lunghezza minima per un template valido
        return content && content.length >= 10;
      },
      message: 'Il contenuto deve essere di almeno 10 caratteri'
    }
  },
  
  // Variabili utilizzate nel template
  variables: {
    type: [String],
    validate: {
      validator: function(v) {
        // Verifica che non ci siano duplicati
        return new Set(v).size === v.length;
      },
      message: 'Le variabili del template devono essere uniche'
    }
  },
  
  // Versioning
  version: {
    type: Number,
    required: true,
    min: [1, 'La versione deve essere maggiore o uguale a 1'],
    default: 1
  },
  
  // Stato di attivazione
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Metadati aggiuntivi
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Helper e documentazione
  helpText: {
    type: String,
    trim: true
  },
  
  // Anteprima (opzionale)
  previewImage: {
    type: String,
    validate: {
      validator: function(v) {
        // Validazione base per URL o Base64
        return !v || v.startsWith('http') || v.startsWith('data:image');
      },
      message: 'L\'anteprima deve essere un URL valido o un\'immagine Base64'
    }
  },
  
  // Campi audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  }
}, {
  timestamps: true, // Gestisce automaticamente createdAt e updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indici composti per ottimizzare le query frequenti
TemplateSchema.index({ name: 1, version: -1 });
TemplateSchema.index({ category: 1, isActive: 1 });
TemplateSchema.index({ format: 1, isActive: 1 });

// Virtual per il nome visualizzato (con versione)
TemplateSchema.virtual('displayName').get(function() {
  return `${this.name} (v${this.version})`;
});

// Middleware pre-save per estrarre automaticamente le variabili dal contenuto
TemplateSchema.pre('save', function(next) {
  // Estrae variabili dal template
  if (this.isModified('content')) {
    const variablePattern = /{{([\w\.\-\_]+)}}/g;
    const matches = this.content.match(variablePattern) || [];
    
    this.variables = [...new Set(matches.map(match => 
      match.replace(/{{|}}/g, '').trim()
    ))];
    
    // Se è una modifica a un template esistente, incrementa versione
    if (!this.isNew && !this.isModified('version')) {
      this.version += 1;
    }
  }
  
  // Aggiorna updatedAt
  this.updatedAt = new Date();
  
  next();
});

/**
 * Metodo per compilare il template sostituendo le variabili con i dati forniti
 * 
 * @param {Object} data - Oggetto contenente i valori per le variabili
 * @returns {String} - Il template compilato
 */
TemplateSchema.methods.compile = function(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('I dati per la compilazione devono essere un oggetto');
  }
  
  let compiledContent = this.content;
  
  // Sostituisce ogni variabile con il suo valore da data
  this.variables.forEach(variable => {
    const value = getNestedProperty(data, variable) || '';
    const regex = new RegExp(`{{${variable}}}`, 'g');
    compiledContent = compiledContent.replace(regex, value);
  });
  
  // Funzione helper per accedere a proprietà nidificate (es. "client.name")
  function getNestedProperty(obj, path) {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : '';
    }, obj);
  }
  
  return compiledContent;
};

/**
 * Metodo per creare una nuova versione del template
 * 
 * @param {Object} updates - Modifiche da applicare alla nuova versione
 * @param {ObjectId} userId - ID dell'utente che crea la nuova versione
 * @returns {Promise<Document>} - La nuova versione del template
 */
TemplateSchema.methods.createNewVersion = async function(updates = {}, userId) {
  // Crea copia delle proprietà attuali
  const templateData = this.toObject();
  
  // Elimina campi che non devono essere copiati
  delete templateData._id;
  delete templateData.id;
  delete templateData.createdAt;
  delete templateData.updatedAt;
  
  // Imposta nuova versione e utente
  templateData.version = this.version + 1;
  templateData.createdBy = userId;
  templateData.updatedBy = userId;
  
  // Applica aggiornamenti
  Object.assign(templateData, updates);
  
  // Crea nuovo documento
  const Template = this.constructor;
  const newTemplate = new Template(templateData);
  
  // Disattiva vecchia versione
  this.isActive = false;
  await this.save();
  
  // Salva e restituisce nuova versione
  return newTemplate.save();
};

/**
 * Metodo statico per trovare l'ultima versione attiva di un template
 * 
 * @param {String} name - Nome del template da cercare
 * @returns {Promise<Document>} - L'ultima versione attiva del template
 */
TemplateSchema.statics.findLatestActive = function(name) {
  return this.findOne({ 
    name: name, 
    isActive: true 
  }).sort({ version: -1 });
};

/**
 * Metodo statico per trovare tutti i template attivi per categoria
 * 
 * @param {String} category - Categoria da cercare
 * @returns {Promise<Array>} - Array di template attivi
 */
TemplateSchema.statics.findActiveByCategory = function(category) {
  return this.find({ 
    category: category, 
    isActive: true 
  }).sort({ name: 1, version: -1 });
};

module.exports = mongoose.model('Template', TemplateSchema);