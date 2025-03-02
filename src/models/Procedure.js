const mongoose = require('mongoose');

/**
 * Schema per la gestione delle procedure operative standard
 * Definisce il template di una procedura che può essere assegnata a più clienti
 */
const ProcedureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Il nome della procedura è obbligatorio'],
    trim: true,
    maxlength: [100, 'Il nome non può superare i 100 caratteri']
  },
  description: {
    type: String,
    required: [true, 'La descrizione della procedura è obbligatoria'],
    trim: true
  },
  clientType: {
    type: String,
    required: [true, 'Il tipo di cliente target è obbligatorio'],
    enum: {
      values: ['individual', 'partnership', 'corporation', 'llc', 'any'],
      message: 'Il tipo di cliente deve essere uno tra: individual, partnership, corporation, llc, any'
    },
    default: 'any'
  },
  tasks: [{
    name: {
      type: String,
      required: [true, 'Il nome del task è obbligatorio'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    dueOffset: {
      type: Number,
      required: [true, 'I giorni di scadenza dal inizio procedura sono obbligatori'],
      min: [0, 'Il numero di giorni deve essere positivo']
    },
    assignedRole: {
      type: String,
      required: [true, 'Il ruolo assegnato è obbligatorio'],
      enum: {
        values: ['admin', 'operator', 'accountant', 'manager', 'any'],
        message: 'Il ruolo deve essere uno tra: admin, operator, accountant, manager, any'
      },
      default: 'accountant'
    },
    requiredDocuments: {
      type: [String],
      default: []
    },
    reminderDays: {
      type: [Number],
      validate: {
        validator: function(v) {
          return v.every(day => day > 0);
        },
        message: 'I giorni di promemoria devono essere positivi'
      },
      default: [1, 3, 7]
    },
    steps: {
      type: [String],
      default: []
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indice per ricerche per tipo cliente
ProcedureSchema.index({ clientType: 1, isActive: 1 });

// Indice per ricerche per nome
ProcedureSchema.index({ name: 1 });

// Middleware pre-save per aggiornare la data di aggiornamento
ProcedureSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Metodo per ottenere procedure attive per tipo di cliente
ProcedureSchema.statics.findActiveByClientType = function(clientType) {
  return this.find({
    $or: [
      { clientType: clientType, isActive: true },
      { clientType: 'any', isActive: true }
    ]
  });
};

// Metodo per disattivare una procedura
ProcedureSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

module.exports = mongoose.model('Procedure', ProcedureSchema);