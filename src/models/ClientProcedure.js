const mongoose = require('mongoose');

/**
 * Schema per gestire le procedure operative assegnate ai clienti
 * Associa una procedura standard a un cliente specifico e monitora l'avanzamento
 */
const ClientProcedureSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'L\'ID cliente è obbligatorio'],
    index: true
  },
  procedureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Procedure',
    required: [true, 'L\'ID procedura è obbligatorio'],
    index: true
  },
  startDate: {
    type: Date,
    required: [true, 'La data di inizio è obbligatoria'],
    default: Date.now
  },
  expectedEndDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'La data di fine prevista deve essere successiva alla data di inizio'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'completed', 'on_hold'],
      message: 'Lo stato deve essere uno tra: active, completed, on_hold'
    },
    default: 'active',
    required: true,
    index: true
  },
  tasks: [{
    taskId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      required: true
    },
    dueDate: {
      type: Date,
      required: [true, 'La data di scadenza è obbligatoria']
    },
    completedDate: Date,
    notes: {
      type: String,
      trim: true
    },
    attachments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    }]
  }],
  notes: {
    type: String,
    trim: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indici per prestazioni
ClientProcedureSchema.index({ clientId: 1, status: 1 });
ClientProcedureSchema.index({ procedureId: 1 });
ClientProcedureSchema.index({ 'tasks.assignedTo': 1, 'tasks.status': 1 });
ClientProcedureSchema.index({ 'tasks.dueDate': 1, 'tasks.status': 1 });

// Virtuale per calcolare la percentuale di completamento
ClientProcedureSchema.virtual('completionPercentage').get(function() {
  if (!this.tasks.length) return 0;
  
  const completedTasks = this.tasks.filter(task => task.status === 'completed').length;
  return Math.round((completedTasks / this.tasks.length) * 100);
});

// Virtuale per ottenere i task in ritardo
ClientProcedureSchema.virtual('overdueTasks').get(function() {
  const today = new Date();
  return this.tasks.filter(task => 
    task.status !== 'completed' && 
    task.dueDate && 
    new Date(task.dueDate) < today
  );
});

// Middleware pre-save per aggiornare automaticamente stato e date
ClientProcedureSchema.pre('save', function(next) {
  // Aggiorna la data di aggiornamento
  this.updatedAt = new Date();
  
  // Controlla se tutti i task sono completati
  const allTasksCompleted = this.tasks.every(task => task.status === 'completed');
  
  // Aggiorna lo stato della procedura se tutti i task sono completati
  if (allTasksCompleted && this.tasks.length > 0 && this.status === 'active') {
    this.status = 'completed';
  }
  
  // Se la startDate è cambiata, ricalcola la expectedEndDate
  if (this.isModified('startDate') && this.procedureId) {
    // Se esiste informazione sulla procedura e sui suoi task
    if (this._procedureData && this._procedureData.tasks && this._procedureData.tasks.length > 0) {
      // Trova il task con il dueOffset più lungo
      const maxDueOffset = Math.max(...this._procedureData.tasks.map(task => task.dueOffset || 0));
      
      // Imposta la data di fine prevista aggiungendo il massimo offset alla data di inizio
      const endDate = new Date(this.startDate);
      endDate.setDate(endDate.getDate() + maxDueOffset);
      this.expectedEndDate = endDate;
    }
  }
  
  next();
});

// Metodo per aggiornare lo stato di un task
ClientProcedureSchema.methods.updateTaskStatus = function(taskId, newStatus, userId, notes = '') {
  const taskIndex = this.tasks.findIndex(t => t.taskId === taskId);
  if (taskIndex === -1) return false;
  
  const task = this.tasks[taskIndex];
  task.status = newStatus;
  
  if (newStatus === 'completed') {
    task.completedDate = new Date();
  }
  
  if (notes) {
    task.notes = notes;
  }
  
  // Aggiorna il task nell'array
  this.tasks[taskIndex] = task;
  
  return true;
};

// Metodo per aggiungere un allegato a un task
ClientProcedureSchema.methods.addAttachment = function(taskId, documentId) {
  const taskIndex = this.tasks.findIndex(t => t.taskId === taskId);
  if (taskIndex === -1) return false;
  
  const task = this.tasks[taskIndex];
  
  // Verifica se l'allegato esiste già
  if (!task.attachments.includes(documentId)) {
    task.attachments.push(documentId);
    
    // Aggiorna il task nell'array
    this.tasks[taskIndex] = task;
  }
  
  return true;
};

// Metodo per ottenere procedure attive per un determinato cliente
ClientProcedureSchema.statics.findActiveByClient = function(clientId) {
  return this.find({ clientId, status: 'active' })
    .populate('procedureId')
    .sort({ startDate: -1 });
};

// Metodo per ottenere procedure in scadenza
ClientProcedureSchema.statics.findUpcoming = function(days = 7) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  return this.find({
    status: 'active',
    'tasks.status': { $ne: 'completed' },
    'tasks.dueDate': { $gte: today, $lte: futureDate }
  }).sort({ 'tasks.dueDate': 1 });
};

// Metodo per inizializzare i task dalla procedura di riferimento
ClientProcedureSchema.methods.initializeTasksFromProcedure = async function(procedure) {
  if (!procedure) return false;
  
  // Memorizza i dati della procedura per il calcolo della expectedEndDate
  this._procedureData = procedure;
  
  // Imposta la data di fine prevista
  if (procedure.tasks && procedure.tasks.length > 0) {
    // Trova il task con il dueOffset più lungo
    const maxDueOffset = Math.max(...procedure.tasks.map(task => task.dueOffset || 0));
    
    // Imposta la data di fine prevista
    const endDate = new Date(this.startDate);
    endDate.setDate(endDate.getDate() + maxDueOffset);
    this.expectedEndDate = endDate;
    
    // Inizializza i task
    this.tasks = procedure.tasks.map((task, index) => {
      // Calcola la data di scadenza in base al dueOffset
      const dueDate = new Date(this.startDate);
      dueDate.setDate(dueDate.getDate() + (task.dueOffset || 0));
      
      return {
        taskId: `task-${index + 1}`,
        name: task.name,
        status: 'pending',
        dueDate,
        notes: task.description || '',
        attachments: []
      };
    });
  }
  
  return true;
};

// Metodo per verificare e notificare task in scadenza
ClientProcedureSchema.methods.getTasksNeedingReminder = function() {
  const today = new Date();
  const remindableTasks = [];
  
  this.tasks.forEach(task => {
    if (task.status !== 'completed' && task.dueDate) {
      // Calcola i giorni rimanenti
      const daysRemaining = Math.ceil((new Date(task.dueDate) - today) / (1000 * 60 * 60 * 24));
      
      // Verifica se corrisponde a uno dei giorni di promemoria definiti nella procedura
      if (this._procedureData && this._procedureData.tasks) {
        const procedureTask = this._procedureData.tasks.find(t => t.name === task.name);
        if (procedureTask && procedureTask.reminderDays && procedureTask.reminderDays.includes(daysRemaining)) {
          remindableTasks.push({
            task,
            daysRemaining
          });
        }
      }
    }
  });
  
  return remindableTasks;
};

module.exports = mongoose.model('ClientProcedure', ClientProcedureSchema);