/**
 * Controller per la gestione dei clienti
 * 
 * Implementa le operazioni CRUD e funzionalità avanzate per i clienti.
 * Include funzioni per ricerca, filtraggio, paginazione e gestione documenti.
 */

const mongoose = require('mongoose');
const Client = require('../models/Client');
const Document = require('../models/Document');
const validationService = require('../services/validationService');
const aiAssistant = require('../services/aiAssistant');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Helper per costruire le query con filtri
const buildQuery = (queryParams) => {
  const query = {};
  
  // Filtri di base
  if (queryParams.name) {
    query.name = { $regex: queryParams.name, $options: 'i' };
  }
  
  if (queryParams.fiscalCode) {
    query.fiscalCode = { $regex: queryParams.fiscalCode, $options: 'i' };
  }
  
  if (queryParams.vatNumber) {
    query.vatNumber = { $regex: queryParams.vatNumber, $options: 'i' };
  }
  
  if (queryParams.companyType) {
    query.companyType = queryParams.companyType;
  }
  
  // Filtri per stato onboarding
  if (queryParams.onboardingStatus) {
    query['onboarding.status'] = queryParams.onboardingStatus;
  }
  
  // Filtri per business sector
  if (queryParams.businessSector) {
    query.businessSector = queryParams.businessSector;
  }
  
  // Filtri per servizi attivi
  if (queryParams.service) {
    query['services.name'] = queryParams.service;
  }
  
  // Filtri per provincia
  if (queryParams.province) {
    query['contactInfo.address.province'] = queryParams.province;
  }
  
  // Filtri per regime contabile
  if (queryParams.accountingRegime) {
    query.accountingRegime = queryParams.accountingRegime;
  }
  
  // Filtro per data di creazione (range)
  if (queryParams.createdFrom || queryParams.createdTo) {
    query.createdAt = {};
    
    if (queryParams.createdFrom) {
      query.createdAt.$gte = new Date(queryParams.createdFrom);
    }
    
    if (queryParams.createdTo) {
      query.createdAt.$lte = new Date(queryParams.createdTo);
    }
  }
  
  return query;
};

/**
 * Ottiene tutti i clienti con supporto per filtri, paginazione e ordinamento
 * GET /api/v1/clients
 */
exports.getAllClients = catchAsync(async (req, res, next) => {
  // Costruisce la query in base ai parametri di ricerca
  const query = buildQuery(req.query);
  
  // Aggiunge filtro per operatore assegnato (se non admin)
  if (req.user.role === 'operator') {
    query.assignedTo = req.user._id;
  }
  
  // Imposta opzioni di paginazione
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  
  // Imposta ordinamento (default: nome cliente, ascendente)
  const sortBy = req.query.sortBy || 'name';
  const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortDirection };
  
  // Esegue la query principale con paginazione e ordinamento
  const clients = await Client.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-__v');
  
  // Conteggio totale dei risultati per la paginazione
  const total = await Client.countDocuments(query);
  
  // Calcola i metadati di paginazione
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  res.status(200).json({
    status: 'success',
    results: clients.length,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage
    },
    data: {
      clients
    }
  });
});

/**
 * Ottiene un singolo cliente tramite ID
 * GET /api/v1/clients/:id
 */
exports.getClient = catchAsync(async (req, res, next) => {
  const client = await Client.findById(req.params.id)
    .populate({
      path: 'documents',
      select: 'filename category status createdAt'
    });
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per visualizzare questo cliente', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      client
    }
  });
});

/**
 * Crea un nuovo cliente
 * POST /api/v1/clients
 */
exports.createClient = catchAsync(async (req, res, next) => {
  // Imposta l'operatore assegnato (se è un operatore che crea il cliente)
  if (req.user.role === 'operator') {
    req.body.assignedTo = req.user._id;
  }
  
  // Imposta data e stato iniziale onboarding
  if (!req.body.onboarding) {
    req.body.onboarding = {
      status: 'pending',
      startDate: new Date()
    };
  }
  
  // Crea il nuovo cliente
  const newClient = await Client.create(req.body);
  
  // Valida i dati del cliente
  const validationResults = validationService.validateClient(newClient);
  
  res.status(201).json({
    status: 'success',
    data: {
      client: newClient,
      validation: validationResults,
      nextSteps: validationResults.missingInformation.length > 0 
        ? 'Completare le informazioni mancanti' 
        : 'Procedere con il caricamento dei documenti'
    }
  });
});

/**
 * Aggiorna un cliente esistente
 * PATCH /api/v1/clients/:id
 */
exports.updateClient = catchAsync(async (req, res, next) => {
  // Trova il cliente esistente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per modificare questo cliente', 403));
  }
  
  // Aggiorna la data dell'ultimo contatto
  req.body.lastContactDate = new Date();
  
  // Aggiorna il cliente
  const updatedClient = await Client.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true, // Restituisce il documento aggiornato
      runValidators: true // Esegue i validatori dello schema
    }
  );
  
  // Valida i dati del cliente aggiornato
  const validationResults = validationService.validateClient(updatedClient);
  
  // Determina se aggiornare lo stato di onboarding
  if (validationResults.dataCompleteness === 100 && 
      client.onboarding && client.onboarding.status === 'pending') {
    updatedClient.onboarding.status = 'in_progress';
    await updatedClient.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      client: updatedClient,
      validation: validationResults,
      onboardingProgress: {
        previousStatus: client.onboarding ? client.onboarding.status : 'n/a',
        currentStatus: updatedClient.onboarding ? updatedClient.onboarding.status : 'n/a',
        dataCompleteness: validationResults.dataCompleteness + '%'
      }
    }
  });
});

/**
 * Elimina un cliente
 * DELETE /api/v1/clients/:id
 */
exports.deleteClient = catchAsync(async (req, res, next) => {
  // Trova il cliente esistente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Solo gli admin possono eliminare i clienti
  if (req.user.role !== 'admin') {
    return next(new AppError('Solo gli amministratori possono eliminare i clienti', 403));
  }
  
  // Elimina tutti i documenti associati al cliente
  const documents = await Document.find({ clientId: req.params.id });
  
  // Elimina i file fisici
  for (const doc of documents) {
    try {
      if (doc.path && fs.existsSync(path.join(process.cwd(), doc.path))) {
        await unlinkAsync(path.join(process.cwd(), doc.path));
      }
    } catch (err) {
      console.error(`Errore nell'eliminazione del file ${doc.path}:`, err);
    }
  }
  
  // Elimina i documenti dal database
  await Document.deleteMany({ clientId: req.params.id });
  
  // Elimina il cliente
  await Client.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Carica un documento per un cliente
 * POST /api/v1/clients/:id/documents
 * Richiede multipart/form-data con il file
 */
exports.uploadDocument = catchAsync(async (req, res, next) => {
  // Il middleware multer dovrebbe aver processato il file e messo in req.file
  if (!req.file) {
    return next(new AppError('Nessun file caricato', 400));
  }
  
  // Verifica che il cliente esista
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per aggiungere documenti a questo cliente', 403));
  }
  
  // Crea un nuovo documento nel database
  const newDocument = await Document.create({
    clientId: req.params.id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
    category: req.body.category || 'uncategorized',
    status: req.body.status || 'pending',
    metadata: {
      title: req.body.title || req.file.originalname,
      description: req.body.description || ''
    },
    accessPermissions: {
      public: false,
      restrictedTo: ['admin', 'operator']
    }
  });
  
  // Aggiorna l'array dei documenti del cliente
  await Client.findByIdAndUpdate(
    req.params.id,
    { $push: { documents: newDocument._id } }
  );
  
  res.status(201).json({
    status: 'success',
    data: {
      document: newDocument
    }
  });
});

/**
 * Aggiorna lo stato di onboarding di un cliente
 * PATCH /api/v1/clients/:id/onboarding
 */
exports.updateOnboardingStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status) {
    return next(new AppError('Stato onboarding mancante', 400));
  }
  
  // Verifica stato valido
  const validStatuses = ['pending', 'in_progress', 'completed', 'rejected', 'on_hold'];
  if (!validStatuses.includes(status)) {
    return next(new AppError('Stato onboarding non valido', 400));
  }
  
  // Trova il cliente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per modificare questo cliente', 403));
  }
  
  // Prepara l'oggetto di aggiornamento
  const updateData = {
    'onboarding.status': status
  };
  
  // Se lo stato diventa 'completed', imposta la data di completamento
  if (status === 'completed') {
    updateData['onboarding.completedDate'] = new Date();
  }
  
  // Aggiorna il cliente
  const updatedClient = await Client.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      onboarding: updatedClient.onboarding
    }
  });
});

/**
 * Ottiene le statistiche aggregate dei clienti
 * GET /api/v1/clients/stats
 */
exports.getClientStats = catchAsync(async (req, res, next) => {
  // Filtra per operatore assegnato se non è admin
  const matchStage = req.user.role === 'operator' 
    ? { assignedTo: mongoose.Types.ObjectId(req.user._id) }
    : {};
  
  // Pipeline di aggregazione
  const stats = await Client.aggregate([
    { $match: matchStage },
    {
      $facet: {
        // Conteggio per tipo di società
        byCompanyType: [
          { $group: { _id: '$companyType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        
        // Conteggio per stato onboarding
        byOnboardingStatus: [
          { $group: { _id: '$onboarding.status', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        
        // Conteggio per settore
        byBusinessSector: [
          { $group: { _id: '$businessSector', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        
        // Conteggio per regime contabile
        byAccountingRegime: [
          { $group: { _id: '$accountingRegime', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        
        // Conteggio clienti per provincia
        byProvince: [
          { 
            $group: { 
              _id: '$contactInfo.address.province', 
              count: { $sum: 1 } 
            } 
          },
          { $sort: { count: -1 } }
        ],
        
        // Clienti più recenti
        recentClients: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          { 
            $project: { 
              name: 1, 
              companyType: 1, 
              createdAt: 1,
              'onboarding.status': 1
            } 
          }
        ],
        
        // Totali generali
        totals: [
          {
            $group: {
              _id: null,
              totalClients: { $sum: 1 },
              totalCompanies: { 
                $sum: { 
                  $cond: [
                    { $ne: ['$companyType', 'Persona Fisica'] },
                    1,
                    0
                  ]
                } 
              },
              totalIndividuals: { 
                $sum: { 
                  $cond: [
                    { $eq: ['$companyType', 'Persona Fisica'] },
                    1,
                    0
                  ]
                } 
              }
            }
          }
        ]
      }
    }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0]
    }
  });
});

/**
 * Aggiunge o aggiorna un servizio per un cliente
 * PATCH /api/v1/clients/:id/services
 */
exports.updateClientService = catchAsync(async (req, res, next) => {
  const { name, active, startDate, notes } = req.body;
  
  if (!name) {
    return next(new AppError('Nome del servizio mancante', 400));
  }
  
  // Trova il cliente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per modificare questo cliente', 403));
  }
  
  // Controlla se il servizio esiste già
  const existingServiceIndex = client.services.findIndex(s => s.name === name);
  
  // Prepara il nuovo servizio
  const serviceData = {
    name,
    active: active !== undefined ? active : true,
    startDate: startDate || new Date(),
    notes: notes || ''
  };
  
  let updatedClient;
  
  if (existingServiceIndex >= 0) {
    // Aggiorna il servizio esistente
    client.services[existingServiceIndex] = {
      ...client.services[existingServiceIndex].toObject(),
      ...serviceData
    };
    
    client.markModified('services');
    updatedClient = await client.save();
  } else {
    // Aggiungi un nuovo servizio
    updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      { $push: { services: serviceData } },
      { new: true, runValidators: true }
    );
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      services: updatedClient.services
    }
  });
});

/**
 * Rimuove un servizio da un cliente
 * DELETE /api/v1/clients/:id/services/:serviceName
 */
exports.removeClientService = catchAsync(async (req, res, next) => {
  const { serviceName } = req.params;
  
  // Trova il cliente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per modificare questo cliente', 403));
  }
  
  // Rimuovi il servizio
  const updatedClient = await Client.findByIdAndUpdate(
    req.params.id,
    { $pull: { services: { name: serviceName } } },
    { new: true }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      services: updatedClient.services
    }
  });
});

/**
 * Cerca clienti per testo (ricerca globale)
 * GET /api/v1/clients/search
 */
exports.searchClients = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  
  if (!query) {
    return next(new AppError('Termine di ricerca mancante', 400));
  }
  
  // Crea la query di ricerca su più campi
  let searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { fiscalCode: { $regex: query, $options: 'i' } },
      { vatNumber: { $regex: query, $options: 'i' } },
      { 'contactInfo.email': { $regex: query, $options: 'i' } },
      { 'contactInfo.phone': { $regex: query, $options: 'i' } },
      { 'contactInfo.address.city': { $regex: query, $options: 'i' } },
      { 'legalRepresentative.firstName': { $regex: query, $options: 'i' } },
      { 'legalRepresentative.lastName': { $regex: query, $options: 'i' } }
    ]
  };
  
  // Aggiungi filtro per operatore assegnato (se non admin)
  if (req.user.role === 'operator') {
    searchQuery.assignedTo = req.user._id;
  }
  
  // Esegui la ricerca
  const clients = await Client.find(searchQuery)
    .limit(20)
    .select('name fiscalCode vatNumber companyType contactInfo.email');
  
  res.status(200).json({
    status: 'success',
    results: clients.length,
    data: {
      clients
    }
  });
});

/**
 * Valida i dati di un cliente e fornisce suggerimenti
 * GET /api/v1/clients/:id/validate
 */
exports.validateClientData = catchAsync(async (req, res, next) => {
  // Trova il cliente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per accedere a questo cliente', 403));
  }
  
  // Valida i dati del cliente
  const validationResults = validationService.validateClient(client);
  
  res.status(200).json({
    status: 'success',
    data: {
      clientId: client._id,
      validation: validationResults,
      suggestions: validationResults.suggestions
    }
  });
});

/**
 * Genera domande per completare le informazioni mancanti (usando AI)
 * GET /api/v1/clients/:id/questions
 */
exports.getClientQuestions = catchAsync(async (req, res, next) => {
  // Trova il cliente
  const client = await Client.findById(req.params.id);
  
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica accesso per operatori (solo clienti assegnati)
  if (req.user.role === 'operator' && 
      client.assignedTo && client.assignedTo.toString() !== req.user._id.toString()) {
    return next(new AppError('Non hai i permessi per accedere a questo cliente', 403));
  }
  
  // Valida i dati del cliente per identificare informazioni mancanti
  const validationResults = validationService.validateClient(client);
  
  // Se non mancano informazioni, non serve generare domande
  if (validationResults.missingInformation.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        clientId: client._id,
        message: 'Tutte le informazioni necessarie sono già presenti',
        questions: []
      }
    });
  }
  
  // Genera domande usando l'assistente AI
  const questions = await aiAssistant.generateClientQuestions(
    client, 
    validationResults.missingInformation
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      clientId: client._id,
      missingInformation: validationResults.missingInformation,
      questions
    }
  });
});