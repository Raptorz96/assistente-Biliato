/**
 * Controller per la gestione delle interazioni con l'assistente AI
 * 
 * Gestisce le richieste relative all'assistente AI, incluse domande, analisi,
 * generazione di procedure e documenti personalizzati.
 */

const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');
const aiService = require('../services/aiService');
const Client = require('../models/Client');
const User = require('../models/User');
const Document = require('../models/Document');
const Template = require('../models/Template');
const ClientProcedure = require('../models/ClientProcedure');
const Conversation = require('../models/Conversation');
const ActivityLog = require('../models/ActivityLog');
const documentGenerator = require('../services/documentGenerator');

/**
 * Registra un'attività di interazione con l'assistente
 * @param {Object} data - Dati dell'interazione
 * @returns {Promise<void>}
 */
const logAssistantInteraction = async (data) => {
  try {
    const {
      userId,
      clientId,
      activityType,
      details,
      result
    } = data;

    await ActivityLog.create({
      user: userId,
      client: clientId,
      activityType: activityType || 'assistant_interaction',
      details: {
        ...details,
        success: result?.success || false,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Errore durante la registrazione dell\'interazione con l\'assistente:', error);
    // Non propagare l'errore per evitare fallimenti dell'endpoint principale
  }
};

/**
 * Recupera o crea una conversazione per un utente e un cliente
 * @param {string} userId - ID dell'utente
 * @param {string} clientId - ID del cliente (opzionale)
 * @returns {Promise<Object>} - Conversazione
 */
const getOrCreateConversation = async (userId, clientId = null) => {
  let conversation;
  
  // Cerca conversazione esistente
  const query = {
    userId,
    isActive: true
  };
  
  if (clientId) {
    query.clientId = clientId;
  }
  
  conversation = await Conversation.findOne(query)
    .sort({ updatedAt: -1 })
    .exec();
  
  // Crea nuova conversazione se non esiste
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      clientId,
      messages: [],
      isActive: true,
      context: {
        clientId,
        startDate: new Date()
      }
    });
  }
  
  return conversation;
};

/**
 * Aggiunge un messaggio alla conversazione
 * @param {Object} conversation - Conversazione
 * @param {string} role - Ruolo (user o assistant)
 * @param {string} content - Contenuto del messaggio
 * @returns {Promise<Object>} - Conversazione aggiornata
 */
const addMessageToConversation = async (conversation, role, content) => {
  conversation.messages.push({
    role,
    content,
    timestamp: new Date()
  });
  
  conversation.updatedAt = new Date();
  
  return conversation.save();
};

/**
 * Risponde a una domanda utilizzando l'assistente AI
 * @route POST /api/v1/assistant/ask
 * @access Private
 */
exports.askQuestion = catchAsync(async (req, res, next) => {
  const { question, clientId, conversationId } = req.body;
  
  if (!question) {
    return next(new AppError('La domanda è obbligatoria', 400));
  }
  
  // Verifica autorizzazioni cliente se clientId è fornito
  let client = null;
  if (clientId) {
    client = await Client.findById(clientId);
    
    if (!client) {
      return next(new AppError('Cliente non trovato', 404));
    }
    
    // Solo admin, operatori assegnati o il cliente stesso possono accedere
    if (
      req.user.role !== 'admin' &&
      (req.user.role === 'operator' && (!client.assignedTo || client.assignedTo.toString() !== req.user.id)) &&
      (req.user.role === 'customer' && (!req.user.clientId || req.user.clientId.toString() !== clientId))
    ) {
      return next(new AppError('Non hai i permessi per accedere a questo cliente', 403));
    }
  }
  
  // Gestione conversazione
  let conversation;
  if (conversationId) {
    // Usa conversazione esistente
    conversation = await Conversation.findById(conversationId);
    
    if (!conversation || conversation.userId.toString() !== req.user.id) {
      return next(new AppError('Conversazione non trovata o non autorizzata', 404));
    }
  } else {
    // Crea nuova conversazione
    conversation = await getOrCreateConversation(req.user.id, clientId);
  }
  
  // Prepara contesto cliente se disponibile
  let clientContext = null;
  if (client) {
    clientContext = {
      id: client._id,
      name: client.name,
      taxRegime: client.accountingRegime,
      businessType: client.companyType,
      sector: client.businessSector,
      additionalInfo: client.notes
    };
  }
  
  try {
    // Aggiungi domanda alla conversazione
    await addMessageToConversation(conversation, 'user', question);
    
    // Chiama il servizio AI per rispondere
    const result = await aiService.answerFiscalQuestion(question, clientContext);
    
    if (!result.success) {
      // Gestione errore dal servizio
      await addMessageToConversation(
        conversation, 
        'assistant', 
        'Mi dispiace, non sono riuscito a elaborare la tua richiesta. Riprova più tardi.'
      );
      
      return next(new AppError(`Errore nella risposta: ${result.error}`, 500));
    }
    
    // Aggiungi risposta alla conversazione
    await addMessageToConversation(conversation, 'assistant', result.answer);
    
    // Registra l'interazione
    await logAssistantInteraction({
      userId: req.user.id,
      clientId: client?._id,
      activityType: 'assistant_question',
      details: {
        question,
        conversationId: conversation._id
      },
      result
    });
    
    // Invia risposta
    res.status(200).json({
      status: 'success',
      data: {
        answer: result.answer,
        conversationId: conversation._id,
        clientId: client?._id,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Errore nella gestione della domanda:', error);
    return next(new AppError('Errore nel processamento della richiesta', 500));
  }
});

/**
 * Restituisce domande guidate basate sul contesto del cliente
 * @route GET /api/v1/assistant/guided-questions/:clientId?
 * @access Private
 */
exports.getGuidedQuestions = catchAsync(async (req, res, next) => {
  const { clientId } = req.params;
  const { category } = req.query;
  
  // Verifica cliente se fornito
  let client = null;
  if (clientId) {
    client = await Client.findById(clientId);
    
    if (!client) {
      return next(new AppError('Cliente non trovato', 404));
    }
    
    // Verifica autorizzazioni
    if (
      req.user.role !== 'admin' &&
      (req.user.role === 'operator' && (!client.assignedTo || client.assignedTo.toString() !== req.user.id)) &&
      (req.user.role === 'customer' && (!req.user.clientId || req.user.clientId.toString() !== clientId))
    ) {
      return next(new AppError('Non hai i permessi per accedere a questo cliente', 403));
    }
  }
  
  // Definizione delle domande per categoria
  const questionCategories = {
    // Domande generali per tutti i tipi di cliente
    general: [
      { id: 'g1', text: 'Quali sono le principali scadenze fiscali per questo mese?' },
      { id: 'g2', text: 'Come posso richiedere una dilazione dei pagamenti?' },
      { id: 'g3', text: 'Quali documenti sono necessari per la prossima dichiarazione?' },
      { id: 'g4', text: 'Come funziona il processo di fatturazione elettronica?' }
    ],
    
    // Domande specifiche per contabilità
    accounting: [
      { id: 'a1', text: 'Come devo registrare le spese di rappresentanza?' },
      { id: 'a2', text: 'Quali sono i limiti di deducibilità per l\'auto aziendale?' },
      { id: 'a3', text: 'Come gestire i rimborsi spese dei dipendenti?' },
      { id: 'a4', text: 'Come funziona l\'ammortamento dei beni strumentali?' }
    ],
    
    // Domande specifiche per fiscalità
    tax: [
      { id: 't1', text: 'Quali sono le aliquote IVA applicabili alla mia attività?' },
      { id: 't2', text: 'Come funziona il credito d\'imposta per R&S?' },
      { id: 't3', text: 'Quali sono i requisiti per il regime forfettario?' },
      { id: 't4', text: 'Come posso calcolare l\'acconto IRES?' }
    ],
    
    // Domande specifiche per pratiche amministrative
    admin: [
      { id: 'ad1', text: 'Come aprire una nuova posizione INPS?' },
      { id: 'ad2', text: 'Quali sono i passi per modificare l\'oggetto sociale?' },
      { id: 'ad3', text: 'Come effettuare una variazione della sede legale?' },
      { id: 'ad4', text: 'Quali documenti servono per assumere un nuovo dipendente?' }
    ]
  };
  
  // Se abbiamo il cliente, personalizza le domande in base al tipo
  let customQuestions = [];
  if (client) {
    // Personalizzazione per tipo azienda
    if (client.companyType === 'Ditta Individuale' || client.accountingRegime === 'Forfettario') {
      customQuestions.push(
        { id: 'c1', text: 'Quali sono i limiti di ricavi per il regime forfettario?' },
        { id: 'c2', text: 'Come calcolare i contributi INPS per il regime forfettario?' }
      );
    } else if (['SRL', 'SPA'].includes(client.companyType)) {
      customQuestions.push(
        { id: 'c3', text: 'Quali sono gli obblighi di nomina dell\'organo di controllo?' },
        { id: 'c4', text: 'Come funziona la distribuzione degli utili ai soci?' }
      );
    } else if (['SNC', 'SAS'].includes(client.companyType)) {
      customQuestions.push(
        { id: 'c5', text: 'Quali sono le responsabilità fiscali dei soci?' },
        { id: 'c6', text: 'Come viene tassato il reddito della società di persone?' }
      );
    }
    
    // Personalizzazione per settore
    if (client.businessSector === 'Commercio') {
      customQuestions.push(
        { id: 's1', text: 'Come gestire fiscalmente i resi e gli omaggi?' },
        { id: 's2', text: 'Quali sono le normative per la vendita online?' }
      );
    } else if (client.businessSector === 'Edilizia') {
      customQuestions.push(
        { id: 's3', text: 'Come funziona la detrazione fiscale per ristrutturazioni?' },
        { id: 's4', text: 'Quali adempimenti sono necessari per il DURC?' }
      );
    } else if (client.businessSector === 'Servizi') {
      customQuestions.push(
        { id: 's5', text: 'Come fatturare prestazioni di servizi all\'estero?' },
        { id: 's6', text: 'Quali sono le regole per la fatturazione di consulenze?' }
      );
    }
  }
  
  // Seleziona la categoria richiesta o tutte
  let selectedQuestions = [];
  if (category && questionCategories[category]) {
    selectedQuestions = questionCategories[category];
  } else {
    // Combina tutte le categorie se non specificata
    Object.values(questionCategories).forEach(questions => {
      selectedQuestions = [...selectedQuestions, ...questions];
    });
  }
  
  // Aggiungi domande personalizzate se abbiamo un cliente
  if (client && customQuestions.length > 0) {
    selectedQuestions = [...selectedQuestions, ...customQuestions];
  }
  
  // Registra l'interazione
  await logAssistantInteraction({
    userId: req.user.id,
    clientId: client?._id,
    activityType: 'guided_questions_request',
    details: {
      category,
      questionsCount: selectedQuestions.length
    },
    result: { success: true }
  });
  
  // Invia risposta
  res.status(200).json({
    status: 'success',
    results: selectedQuestions.length,
    data: {
      questions: selectedQuestions,
      categories: Object.keys(questionCategories),
      clientType: client?.companyType,
      clientSector: client?.businessSector
    }
  });
});

/**
 * Analizza le informazioni del cliente per identificare lacune
 * @route POST /api/v1/assistant/analyze-client/:clientId
 * @access Private
 */
exports.processClientInfo = catchAsync(async (req, res, next) => {
  const { clientId } = req.params;
  
  if (!clientId) {
    return next(new AppError('ID cliente obbligatorio', 400));
  }
  
  // Verifica esistenza cliente
  const client = await Client.findById(clientId);
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica autorizzazioni
  if (req.user.role !== 'admin' && req.user.role !== 'operator') {
    return next(new AppError('Non hai i permessi per questa operazione', 403));
  }
  
  // Se è un operatore, verifica che sia assegnato al cliente
  if (req.user.role === 'operator' && (!client.assignedTo || client.assignedTo.toString() !== req.user.id)) {
    return next(new AppError('Non sei assegnato a questo cliente', 403));
  }
  
  try {
    // Raccogli dati completi del cliente
    const clientData = client.toObject();
    
    // Aggiungi informazioni sui documenti del cliente
    const clientDocuments = await Document.find({ clientId: client._id })
      .select('category status metadata.docType metadata.issueDate metadata.expiryDate filename')
      .lean();
    
    // Aggiungi informazioni sulle procedure attive
    const clientProcedures = await ClientProcedure.find({ clientId: client._id, isActive: true })
      .select('name status startDate endDate tasks')
      .lean();
    
    // Prepara i dati per l'analisi
    const analysisData = {
      clientProfile: {
        ...clientData,
        documents: clientDocuments,
        procedures: clientProcedures
      }
    };
    
    // Usa il servizio AI per analizzare i dati
    const result = await aiService.answerFiscalQuestion(
      `Analizza i dati di questo cliente e identifica eventuali lacune o informazioni mancanti importanti. Fornisci suggerimenti concreti per migliorare il profilo.`,
      {
        id: client._id,
        name: client.name,
        taxRegime: client.accountingRegime,
        businessType: client.companyType,
        sector: client.businessSector,
        additionalInfo: JSON.stringify(analysisData)
      }
    );
    
    if (!result.success) {
      return next(new AppError(`Errore nell'analisi del cliente: ${result.error}`, 500));
    }
    
    // Registra l'interazione
    await logAssistantInteraction({
      userId: req.user.id,
      clientId: client._id,
      activityType: 'client_analysis',
      details: {
        analysisType: 'gap_identification'
      },
      result
    });
    
    // Invia risposta
    res.status(200).json({
      status: 'success',
      data: {
        clientId: client._id,
        clientName: client.name,
        analysis: result.answer,
        analysisDate: new Date().toISOString(),
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Errore nell\'analisi delle informazioni del cliente:', error);
    return next(new AppError('Errore nell\'elaborazione della richiesta', 500));
  }
});

/**
 * Genera una procedura personalizzata per un cliente
 * @route POST /api/v1/assistant/generate-procedure/:clientId
 * @access Private
 */
exports.generateProcedure = catchAsync(async (req, res, next) => {
  const { clientId } = req.params;
  const { title, description, procedureType } = req.body;
  
  if (!clientId) {
    return next(new AppError('ID cliente obbligatorio', 400));
  }
  
  // Verifica esistenza cliente
  const client = await Client.findById(clientId);
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica autorizzazioni
  if (req.user.role !== 'admin' && req.user.role !== 'operator') {
    return next(new AppError('Non hai i permessi per questa operazione', 403));
  }
  
  // Se è un operatore, verifica che sia assegnato al cliente
  if (req.user.role === 'operator' && (!client.assignedTo || client.assignedTo.toString() !== req.user.id)) {
    return next(new AppError('Non sei assegnato a questo cliente', 403));
  }
  
  try {
    // Prepara i dati del cliente per il servizio AI
    const clientProfile = {
      id: client._id,
      name: client.name,
      businessType: client.companyType,
      taxRegime: client.accountingRegime,
      sector: client.businessSector,
      employeesCount: client.employees || 0,
      annualRevenue: client.annualRevenue,
      additionalInfo: description || client.notes || ''
    };
    
    // Genera la procedura
    const result = await aiService.generateCustomProcedure(clientProfile);
    
    if (!result.success) {
      return next(new AppError(`Errore nella generazione della procedura: ${result.error}`, 500));
    }
    
    // Salva la procedura nel database
    const newProcedure = await ClientProcedure.create({
      clientId: client._id,
      name: title || `Procedura ${procedureType || 'personalizzata'} - ${client.name}`,
      description: description || 'Procedura generata automaticamente dall\'assistente AI',
      content: result.procedure,
      status: 'draft',
      procedureType: procedureType || 'custom',
      createdBy: req.user.id,
      isActive: true
    });
    
    // Registra l'interazione
    await logAssistantInteraction({
      userId: req.user.id,
      clientId: client._id,
      activityType: 'procedure_generation',
      details: {
        procedureId: newProcedure._id,
        procedureType: procedureType || 'custom',
        title
      },
      result
    });
    
    // Invia risposta
    res.status(201).json({
      status: 'success',
      data: {
        procedure: newProcedure,
        generatedContent: result.procedure,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Errore nella generazione della procedura:', error);
    return next(new AppError('Errore nell\'elaborazione della richiesta', 500));
  }
});

/**
 * Genera un documento personalizzato a partire da un template
 * @route POST /api/v1/assistant/generate-document/:clientId
 * @access Private
 */
exports.generateDocument = catchAsync(async (req, res, next) => {
  const { clientId } = req.params;
  const { templateId, customFields, documentType, title } = req.body;
  
  if (!clientId || !templateId) {
    return next(new AppError('ID cliente e ID template sono obbligatori', 400));
  }
  
  // Verifica esistenza cliente
  const client = await Client.findById(clientId);
  if (!client) {
    return next(new AppError('Cliente non trovato', 404));
  }
  
  // Verifica esistenza template
  const template = await Template.findById(templateId);
  if (!template) {
    return next(new AppError('Template non trovato', 404));
  }
  
  // Verifica autorizzazioni
  if (req.user.role !== 'admin' && req.user.role !== 'operator') {
    return next(new AppError('Non hai i permessi per questa operazione', 403));
  }
  
  // Se è un operatore, verifica che sia assegnato al cliente
  if (req.user.role === 'operator' && (!client.assignedTo || client.assignedTo.toString() !== req.user.id)) {
    return next(new AppError('Non sei assegnato a questo cliente', 403));
  }
  
  try {
    // Prepara dati cliente
    const clientData = {
      id: client._id,
      name: client.name,
      fiscalCode: client.fiscalCode,
      vatNumber: client.vatNumber || '',
      companyType: client.companyType,
      address: client.contactInfo.address ? 
        `${client.contactInfo.address.street}, ${client.contactInfo.address.postalCode} ${client.contactInfo.address.city} (${client.contactInfo.address.province})` : '',
      email: client.contactInfo.email,
      phone: client.contactInfo.phone || '',
      legalRepresentative: client.legalRepresentative ? 
        `${client.legalRepresentative.firstName} ${client.legalRepresentative.lastName}` : '',
      ...customFields // Campi personalizzati forniti nella richiesta
    };
    
    // Genera documento tramite service
    const generatedDoc = await documentGenerator.generateFromTemplate(
      template,
      clientData,
      {
        documentType: documentType || template.category,
        title: title || `${template.name} - ${client.name}`,
        creator: req.user.id
      }
    );
    
    // Crea record documento nel DB
    const document = await Document.create({
      clientId: client._id,
      filename: generatedDoc.filename,
      originalName: generatedDoc.originalName,
      mimeType: generatedDoc.mimeType,
      size: generatedDoc.size,
      path: generatedDoc.path,
      category: documentType || template.category,
      metadata: {
        docType: 'generated',
        template: templateId,
        templateVersion: template.version,
        issueDate: new Date(),
        generatedBy: req.user.id
      },
      status: 'verified',
      createdBy: req.user.id
    });
    
    // Registra l'interazione
    await logAssistantInteraction({
      userId: req.user.id,
      clientId: client._id,
      activityType: 'document_generation',
      details: {
        documentId: document._id,
        templateId,
        documentType: documentType || template.category
      },
      result: { success: true }
    });
    
    // Invia risposta
    res.status(201).json({
      status: 'success',
      data: {
        document,
        downloadUrl: document.fullUrl, // Virtual definito nel model
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Errore nella generazione del documento:', error);
    return next(new AppError(`Errore nella generazione del documento: ${error.message}`, 500));
  }
});

/**
 * Ottiene la cronologia delle conversazioni con l'assistente
 * @route GET /api/v1/assistant/conversations
 * @access Private
 */
exports.getConversations = catchAsync(async (req, res, next) => {
  const { clientId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Costruisci query
  const query = {
    userId: req.user.id,
    isActive: true
  };
  
  if (clientId) {
    query.clientId = clientId;
  }
  
  // Conta totale
  const total = await Conversation.countDocuments(query);
  
  // Ottieni conversazioni
  const conversations = await Conversation.find(query)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('clientId', 'name fiscalCode companyType')
    .exec();
  
  // Invia risposta
  res.status(200).json({
    status: 'success',
    results: conversations.length,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    data: {
      conversations
    }
  });
});

/**
 * Ottiene i messaggi di una conversazione
 * @route GET /api/v1/assistant/conversations/:id
 * @access Private
 */
exports.getConversationMessages = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Trova conversazione
  const conversation = await Conversation.findById(id)
    .populate('clientId', 'name fiscalCode companyType')
    .exec();
  
  if (!conversation) {
    return next(new AppError('Conversazione non trovata', 404));
  }
  
  // Verifica che l'utente sia autorizzato
  if (conversation.userId.toString() !== req.user.id) {
    return next(new AppError('Non sei autorizzato ad accedere a questa conversazione', 403));
  }
  
  // Aggiorna ultimo accesso
  conversation.lastAccessedAt = new Date();
  await conversation.save();
  
  // Invia risposta
  res.status(200).json({
    status: 'success',
    data: {
      conversation
    }
  });
});