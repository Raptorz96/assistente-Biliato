const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Validazione email
const emailValidator = function(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Il nome utente è obbligatorio'],
    unique: true,
    trim: true,
    minlength: [3, 'Il nome utente deve avere almeno 3 caratteri'],
    maxlength: [50, 'Il nome utente non può superare i 50 caratteri']
  },
  email: {
    type: String,
    required: [true, 'L\'indirizzo email è obbligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [emailValidator, 'Formato email non valido']
  },
  passwordHash: {
    type: String,
    required: [true, 'La password è obbligatoria'],
    minlength: [8, 'La password deve avere almeno 8 caratteri'],
    select: false // Esclude il campo dalle query per default
  },
  firstName: {
    type: String,
    required: [true, 'Il nome è obbligatorio'],
    trim: true,
    maxlength: [50, 'Il nome non può superare i 50 caratteri']
  },
  lastName: {
    type: String,
    required: [true, 'Il cognome è obbligatorio'],
    trim: true,
    maxlength: [50, 'Il cognome non può superare i 50 caratteri']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'operator', 'customer'],
      message: 'Ruolo non valido'
    },
    default: 'customer'
  },
  permissions: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: 'Stato non valido'
    },
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true, // Aggiunge automaticamente createdAt e updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuale per il nome completo
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indicizzazione per migliorare le performance di ricerca
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });

// Middleware pre-save per hashare la password
UserSchema.pre('save', async function(next) {
  // Esegue solo se la password è modificata o è un nuovo utente
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    // Genera un salt
    const salt = await bcrypt.genSalt(10);
    // Hash della password con il salt
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Metodo per confrontare password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.passwordHash);
  } catch (error) {
    throw new Error('Errore durante la verifica della password');
  }
};

// Metodo per generare JWT token
UserSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      username: this.username,
      role: this.role,
      permissions: this.permissions
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// Metodo statico per cercare un utente per nome utente o email
UserSchema.statics.findByCredentials = async function(usernameOrEmail) {
  // Cerca per username o email
  return this.findOne({
    $or: [
      { username: usernameOrEmail },
      { email: usernameOrEmail.toLowerCase() }
    ]
  }).select('+passwordHash'); // Include il campo passwordHash nella query
};

// Metodo per aggiornare l'ultimo accesso
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = Date.now();
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', UserSchema);