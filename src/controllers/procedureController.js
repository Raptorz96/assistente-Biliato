/**
 * Controller per la gestione delle procedure operative
 */

const Client = require('../models/Client');
const Procedure = require('../models/Procedure');
const procedureGenerator = require('../services/procedureGenerator');

/**
 * Genera una nuova procedura operativa per un cliente
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.createProcedure = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, procedureType } = req.body;
    
    // Verifica che il cliente esista
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cliente non trovato' 
      });
    }
    
    // Genera la procedura operativa utilizzando il generatore
    const procedureResult = await procedureGenerator.generateOperationalProcedure(client);
    
    // Crea un nuovo documento Procedure utilizzando il risultato generato
    const procedure = new Procedure({
      clientId: client._id,
      procedureId: procedureResult.monitoringSystem.procedureId,
      name: name || `Procedura operativa: ${client.name}`,
      procedureType: procedureType || procedureResult.procedureRequirements.procedureType,
      complexityLevel: procedureResult.procedureRequirements.complexityLevel,
      tasks: procedureResult.monitoringSystem.tasks,
      summary: procedureResult.monitoringSystem.summary
    });
    
    // Salva la nuova procedura
    await procedure.save();
    
    // Aggiorna lo stato di onboarding del cliente se necessario
    if (client.onboardingStatus === 'Documents Collected') {
      client.onboardingStatus = 'Procedures Created';
      await client.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'Procedura operativa creata con successo',
      procedure
    });
    
  } catch (error) {
    console.error('Errore nella creazione della procedura:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nella creazione della procedura',
      error: error.message
    });
  }
};

/**
 * Ottiene tutte le procedure con supporto per filtri e paginazione
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.getProcedures = async (req, res) => {
  try {
    const { 
      clientId, 
      status, 
      procedureType, 
      complexityLevel,
      startDate,
      endDate,
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Costruzione della query di filtro
    const filter = {};
    
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (procedureType) filter.procedureType = procedureType;
    if (complexityLevel) filter.complexityLevel = complexityLevel;
    
    // Filtraggio per data di creazione
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Impostazione dell'ordinamento
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Calcolo skip per paginazione
    const skip = (page - 1) * limit;
    
    // Esecuzione della query con conteggio totale
    const [procedures, total] = await Promise.all([
      Procedure.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('clientId', 'name email fiscalCode'),
      Procedure.countDocuments(filter)
    ]);
    
    // Calcolo delle pagine totali
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      count: procedures.length,
      totalResults: total,
      totalPages,
      currentPage: parseInt(page),
      procedures,
      pagination: {
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? parseInt(page) + 1 : null,
        prevPage: page > 1 ? parseInt(page) - 1 : null
      }
    });
    
  } catch (error) {
    console.error('Errore nel recupero delle procedure:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle procedure',
      error: error.message
    });
  }
};

/**
 * Ottiene i dettagli di una procedura specifica
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.getProcedureById = async (req, res) => {
  try {
    const { procedureId } = req.params;
    
    // Trova la procedura e popola i dati del cliente
    const procedure = await Procedure.findById(procedureId)
      .populate('clientId', 'name email fiscalCode companyType businessSector');
    
    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: 'Procedura non trovata' 
      });
    }
    
    res.status(200).json({
      success: true,
      procedure
    });
    
  } catch (error) {
    console.error('Errore nel recupero dei dettagli della procedura:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero dei dettagli della procedura',
      error: error.message
    });
  }
};

/**
 * Aggiorna lo stato di un'attività in una procedura
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const { procedureId, taskId } = req.params;
    const { status, progress, note, assignedTo } = req.body;
    const updatedBy = req.body.updatedBy || req.user?.name || 'system';
    
    // Trova la procedura
    const procedure = await Procedure.findById(procedureId);
    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: 'Procedura non trovata' 
      });
    }
    
    // Verifica che il task esista
    const taskExists = procedure.tasks.some(task => task.id === taskId);
    if (!taskExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attività non trovata nella procedura' 
      });
    }
    
    // Prepara i dati di aggiornamento
    const updateData = { updatedBy };
    if (status) updateData.status = status;
    if (progress !== undefined) updateData.progress = progress;
    if (note) updateData.note = note;
    if (assignedTo) updateData.assignedTo = assignedTo;
    
    // Aggiorna lo stato del task utilizzando il metodo del modello
    const updated = procedure.updateTaskStatus(taskId, updateData);
    
    if (!updated) {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossibile aggiornare l\'attività' 
      });
    }
    
    // Salva le modifiche
    await procedure.save();
    
    // Verifica se tutti i task sono completati e aggiorna lo stato della procedura
    const allTasksCompleted = procedure.tasks.every(task => task.status === 'completed');
    if (allTasksCompleted && procedure.status !== 'completed') {
      procedure.status = 'completed';
      procedure.updatedAt = new Date();
      await procedure.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Stato dell\'attività aggiornato con successo',
      task: procedure.tasks.find(t => t.id === taskId),
      procedure: {
        status: procedure.status,
        completionPercentage: procedure.completionPercentage,
        summary: procedure.summary
      }
    });
    
  } catch (error) {
    console.error('Errore nell\'aggiornamento dello stato dell\'attività:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiornamento dello stato dell\'attività',
      error: error.message
    });
  }
};

/**
 * Aggiunge una nuova attività a una procedura esistente
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.addTask = async (req, res) => {
  try {
    const { procedureId } = req.params;
    const { title, description, priority, deadline, tags } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Il titolo dell\'attività è obbligatorio'
      });
    }
    
    // Trova la procedura
    const procedure = await Procedure.findById(procedureId);
    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: 'Procedura non trovata' 
      });
    }
    
    // Crea il nuovo task
    const newTask = {
      id: `task-${Date.now()}-${procedure.tasks.length + 1}`,
      title,
      description: description || '',
      priority: priority || 'medium',
      status: 'pending',
      progress: 0,
      deadline: deadline || {
        type: 'monthly',
        dayOfMonth: 30,
        description: 'Entro fine mese'
      },
      assignedTo: null,
      tags: tags || [],
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Attività creata',
        updatedBy: req.user?.name || 'system'
      }]
    };
    
    // Calcola la data di scadenza se necessario
    if (deadline && deadline.type) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      switch(deadline.type) {
        case 'monthly':
          const dayOfMonth = deadline.dayOfMonth || 30;
          let targetMonth = currentMonth;
          if (today.getDate() > dayOfMonth) {
            targetMonth = (currentMonth + 1) % 12;
          }
          newTask.dueDate = new Date(
            targetMonth === 11 && currentMonth === 0 ? currentYear - 1 : currentYear,
            targetMonth,
            dayOfMonth
          );
          break;
          
        case 'quarterly':
          const currentQuarter = Math.floor(currentMonth / 3);
          const nextQuarter = (currentQuarter + 1) % 4;
          const nextQuarterMonth = nextQuarter * 3 + 1;
          
          newTask.dueDate = new Date(
            nextQuarter === 0 && currentQuarter === 3 ? currentYear + 1 : currentYear,
            nextQuarterMonth,
            15
          );
          break;
          
        case 'annual':
          newTask.dueDate = new Date(currentYear, 11, 31);
          break;
      }
    }
    
    // Aggiungi il task alla procedura
    procedure.tasks.push(newTask);
    
    // Salva la procedura aggiornata
    await procedure.save();
    
    res.status(201).json({
      success: true,
      message: 'Attività aggiunta con successo',
      task: newTask,
      summary: procedure.summary
    });
    
  } catch (error) {
    console.error('Errore nell\'aggiunta della nuova attività:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiunta della nuova attività',
      error: error.message
    });
  }
};

/**
 * Aggiorna lo stato di una procedura
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.updateProcedureStatus = async (req, res) => {
  try {
    const { procedureId } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Lo stato della procedura è obbligatorio'
      });
    }
    
    // Verifica che lo stato sia valido
    const validStatuses = ['active', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Stato non valido. Gli stati validi sono: active, completed, archived'
      });
    }
    
    // Trova e aggiorna la procedura
    const procedure = await Procedure.findById(procedureId);
    
    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: 'Procedura non trovata' 
      });
    }
    
    // Aggiorna lo stato
    procedure.status = status;
    
    // Aggiorna le note se fornite
    if (notes) {
      procedure.notes = notes;
    }
    
    procedure.updatedAt = new Date();
    
    // Aggiorna anche lo stato dei task se la procedura è completata
    if (status === 'completed') {
      procedure.tasks.forEach(task => {
        if (task.status !== 'completed') {
          task.status = 'completed';
          task.progress = 100;
          task.statusHistory.push({
            status: 'completed',
            timestamp: new Date(),
            note: 'Completato automaticamente (procedura completata)',
            updatedBy: req.user?.name || 'system'
          });
        }
      });
    }
    
    // Salva gli aggiornamenti
    await procedure.save();
    
    res.status(200).json({
      success: true,
      message: `Stato della procedura aggiornato a '${status}'`,
      procedure: {
        id: procedure._id,
        procedureId: procedure.procedureId,
        status: procedure.status,
        updatedAt: procedure.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Errore nell\'aggiornamento dello stato della procedura:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiornamento dello stato della procedura',
      error: error.message
    });
  }
};

/**
 * Genera un report di avanzamento complessivo di tutte le procedure
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.generateDashboardReport = async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    
    // Crea il filtro base
    const filter = { };
    if (clientId) filter.clientId = clientId;
    
    // Filtra per intervallo di date
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Recupera statistiche sulle procedure
    const [
      totalProcedures,
      completedProcedures,
      activeProcedures,
      archivedProcedures,
      recentProcedures,
      clientStats
    ] = await Promise.all([
      Procedure.countDocuments(filter),
      Procedure.countDocuments({ ...filter, status: 'completed' }),
      Procedure.countDocuments({ ...filter, status: 'active' }),
      Procedure.countDocuments({ ...filter, status: 'archived' }),
      Procedure.find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('clientId', 'name'),
      clientId ? null : Procedure.aggregate([
        { $match: filter },
        { $group: {
          _id: '$clientId',
          totalProcedures: { $sum: 1 },
          completedProcedures: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
          },
          avgCompletionPercentage: { $avg: '$completionPercentage' }
        }},
        { $sort: { totalProcedures: -1 } },
        { $limit: 10 },
        { $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'clientInfo'
        }},
        { $unwind: '$clientInfo' },
        { $project: {
          clientId: '$_id',
          clientName: '$clientInfo.name',
          totalProcedures: 1,
          completedProcedures: 1,
          avgCompletionPercentage: 1
        }}
      ])
    ]);
    
    // Calcola la percentuale media di completamento
    const averageCompletionPercentage = await Procedure.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        avgCompletion: { $avg: '$completionPercentage' }
      }}
    ]);
    
    // Calcola le attività in ritardo
    const overdueTasks = await Procedure.aggregate([
      { $match: { ...filter, status: 'active' } },
      { $unwind: '$tasks' },
      { $match: { 
        'tasks.status': { $ne: 'completed' },
        'tasks.dueDate': { $lt: new Date() }
      }},
      { $project: {
        procedureId: 1,
        clientId: 1,
        procedureName: '$name',
        taskId: '$tasks.id',
        taskTitle: '$tasks.title',
        taskPriority: '$tasks.priority',
        dueDate: '$tasks.dueDate',
        daysOverdue: {
          $floor: {
            $divide: [
              { $subtract: [new Date(), '$tasks.dueDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      }},
      { $sort: { daysOverdue: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'clientInfo'
      }},
      { $unwind: '$clientInfo' },
      { $project: {
        procedureId: 1,
        procedureName: 1,
        clientId: 1,
        clientName: '$clientInfo.name',
        taskId: 1,
        taskTitle: 1,
        taskPriority: 1,
        dueDate: 1,
        daysOverdue: 1
      }}
    ]);
    
    // Calcola completamenti per mese (ultimi 6 mesi)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    
    const monthlyCompletion = await Procedure.aggregate([
      { 
        $match: { 
          ...filter, 
          updatedAt: { $gte: sixMonthsAgo },
          status: 'completed'
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { 
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);
    
    // Formatta il report
    const report = {
      summary: {
        totalProcedures,
        completedProcedures,
        activeProcedures,
        archivedProcedures,
        completionRate: totalProcedures > 0 ? 
          (completedProcedures / totalProcedures * 100).toFixed(2) : 0,
        averageCompletionPercentage: averageCompletionPercentage.length > 0 ?
          averageCompletionPercentage[0].avgCompletion.toFixed(2) : 0
      },
      recentProcedures,
      overdueTasks,
      monthlyCompletion,
      clientStats: clientStats || [],
      generatedAt: new Date()
    };
    
    res.status(200).json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Errore nella generazione del report dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nella generazione del report dashboard',
      error: error.message
    });
  }
};

/**
 * Ottiene le attività in ritardo di tutte le procedure
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.getOverdueTasks = async (req, res) => {
  try {
    const { clientId, priority, limit = 20 } = req.query;
    
    // Prepara il filtro base
    const filter = { status: 'active' };
    if (clientId) filter.clientId = clientId;
    
    // Costruisci la pipeline di aggregazione
    const taskFilter = { 
      'tasks.status': { $ne: 'completed' },
      'tasks.dueDate': { $lt: new Date() }
    };
    
    if (priority) {
      taskFilter['tasks.priority'] = priority;
    }
    
    const overdueTasks = await Procedure.aggregate([
      { $match: filter },
      { $unwind: '$tasks' },
      { $match: taskFilter },
      { $project: {
        procedureId: 1,
        procedureName: '$name',
        clientId: 1,
        taskId: '$tasks.id',
        taskTitle: '$tasks.title',
        taskDescription: '$tasks.description',
        taskPriority: '$tasks.priority',
        taskStatus: '$tasks.status',
        taskProgress: '$tasks.progress',
        dueDate: '$tasks.dueDate',
        daysOverdue: {
          $floor: {
            $divide: [
              { $subtract: [new Date(), '$tasks.dueDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        },
        assignedTo: '$tasks.assignedTo'
      }},
      { $sort: { daysOverdue: -1, 'taskPriority': 1 } },
      { $limit: parseInt(limit) },
      { $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'clientInfo'
      }},
      { $unwind: '$clientInfo' },
      { $project: {
        procedureId: 1,
        procedureName: 1,
        clientId: 1,
        clientName: '$clientInfo.name',
        taskId: 1,
        taskTitle: 1,
        taskDescription: 1,
        taskPriority: 1,
        taskStatus: 1,
        taskProgress: 1,
        dueDate: 1,
        daysOverdue: 1,
        assignedTo: 1
      }}
    ]);
    
    res.status(200).json({
      success: true,
      count: overdueTasks.length,
      overdueTasks
    });
    
  } catch (error) {
    console.error('Errore nel recupero delle attività in ritardo:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle attività in ritardo',
      error: error.message
    });
  }
};

/**
 * Elimina una procedura
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.deleteProcedure = async (req, res) => {
  try {
    const { procedureId } = req.params;
    
    // Trova la procedura per verificare che esista
    const procedure = await Procedure.findById(procedureId);
    
    if (!procedure) {
      return res.status(404).json({ 
        success: false, 
        message: 'Procedura non trovata' 
      });
    }
    
    // Elimina la procedura
    await Procedure.findByIdAndDelete(procedureId);
    
    res.status(200).json({
      success: true,
      message: 'Procedura eliminata con successo'
    });
    
  } catch (error) {
    console.error('Errore nell\'eliminazione della procedura:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'eliminazione della procedura',
      error: error.message
    });
  }
};