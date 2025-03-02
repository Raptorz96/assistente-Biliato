/**
 * Onboarding Service
 * 
 * Servizio per la gestione del processo di onboarding guidato dei clienti.
 * Gestisce le fasi, i questionari, e la raccolta dati in modo dinamico
 * adattandosi al tipo di cliente e alle risposte fornite.
 */

const mongoose = require('mongoose');
const Client = require('../src/models/Client');
const Procedure = require('../src/models/Procedure');
const ClientProcedure = require('../src/models/ClientProcedure');
const aiService = require('../src/services/aiService');
const { logger } = require('../src/utils/logger');

// Definizione delle fasi di onboarding
const ONBOARDING_PHASES = {
  INITIAL: 'initial',
  PERSONAL_INFO: 'personal_info',
  BUSINESS_INFO: 'business_info',
  FISCAL_DATA: 'fiscal_data',
  DOCUMENTS: 'documents',
  SERVICES: 'services',
  REVIEW: 'review',
  COMPLETED: 'completed'
};

// Definizione dei tipi di cliente
const CLIENT_TYPES = {
  INDIVIDUAL: 'individual', // Persona fisica
  SOLE_PROPRIETOR: 'sole_proprietor', // Ditta individuale
  PARTNERSHIP: 'partnership', // Società di persone (SNC, SAS)
  CORPORATION: 'corporation', // Società di capitali (SRL, SPA)
  NON_PROFIT: 'non_profit' // Associazioni, cooperative, no-profit
};

// Mappatura tipi cliente verso tipi companyType nel modello Client
const CLIENT_TYPE_TO_COMPANY_TYPE = {
  [CLIENT_TYPES.INDIVIDUAL]: 'Altro',
  [CLIENT_TYPES.SOLE_PROPRIETOR]: 'Ditta Individuale',
  [CLIENT_TYPES.PARTNERSHIP]: {
    'SNC': 'SNC',
    'SAS': 'SAS'
  },
  [CLIENT_TYPES.CORPORATION]: {
    'SRL': 'SRL',
    'SPA': 'SPA',
    'SAPA': 'SAPA'
  },
  [CLIENT_TYPES.NON_PROFIT]: {
    'ASSOCIAZIONE': 'Associazione',
    'COOPERATIVA': 'Cooperativa'
  }
};

// Mappatura dei regimi fiscali
const TAX_REGIMES = {
  FORFETTARIO: 'Forfettario',
  SEMPLIFICATO: 'Semplificato',
  ORDINARIO: 'Ordinario'
};

// Definizione delle domande per ogni fase e tipo cliente
const questionsBank = {
  // Fase iniziale - comune a tutti i clienti
  [ONBOARDING_PHASES.INITIAL]: [
    {
      id: 'client_type',
      text: 'Che tipo di cliente sei?',
      type: 'select',
      options: [
        { value: CLIENT_TYPES.INDIVIDUAL, label: 'Persona fisica' },
        { value: CLIENT_TYPES.SOLE_PROPRIETOR, label: 'Ditta individuale' },
        { value: CLIENT_TYPES.PARTNERSHIP, label: 'Società di persone (SNC, SAS)' },
        { value: CLIENT_TYPES.CORPORATION, label: 'Società di capitali (SRL, SPA)' },
        { value: CLIENT_TYPES.NON_PROFIT, label: 'Associazione/No-profit' }
      ],
      required: true
    }
  ],
  
  // Informazioni personali
  [ONBOARDING_PHASES.PERSONAL_INFO]: {
    // Domande comuni a tutti i tipi
    common: [
      {
        id: 'name',
        text: 'Nome completo o ragione sociale',
        type: 'text',
        required: true
      },
      {
        id: 'fiscal_code',
        text: 'Codice fiscale',
        type: 'text',
        required: true,
        validation: 'fiscal_code'
      },
      {
        id: 'email',
        text: 'Email di contatto',
        type: 'email',
        required: true
      },
      {
        id: 'phone',
        text: 'Numero di telefono',
        type: 'tel',
        required: true
      },
      {
        id: 'address',
        text: 'Indirizzo completo',
        type: 'address',
        required: true
      }
    ],
    // Domande specifiche per società
    [CLIENT_TYPES.PARTNERSHIP]: [
      {
        id: 'partnership_type',
        text: 'Tipo di società di persone',
        type: 'select',
        options: [
          { value: 'SNC', label: 'Società in Nome Collettivo (SNC)' },
          { value: 'SAS', label: 'Società in Accomandita Semplice (SAS)' }
        ],
        required: true
      }
    ],
    [CLIENT_TYPES.CORPORATION]: [
      {
        id: 'corporation_type',
        text: 'Tipo di società di capitali',
        type: 'select',
        options: [
          { value: 'SRL', label: 'Società a Responsabilità Limitata (SRL)' },
          { value: 'SPA', label: 'Società per Azioni (SPA)' },
          { value: 'SAPA', label: 'Società in Accomandita per Azioni (SAPA)' }
        ],
        required: true
      }
    ],
    [CLIENT_TYPES.NON_PROFIT]: [
      {
        id: 'non_profit_type',
        text: 'Tipo di organizzazione',
        type: 'select',
        options: [
          { value: 'ASSOCIAZIONE', label: 'Associazione' },
          { value: 'COOPERATIVA', label: 'Cooperativa' },
          { value: 'ONLUS', label: 'ONLUS' },
          { value: 'ALTRO', label: 'Altro' }
        ],
        required: true
      }
    ]
  },
  
  // Informazioni aziendali
  [ONBOARDING_PHASES.BUSINESS_INFO]: {
    // Domande comuni a entità commerciali (non persone fisiche)
    commercial: [
      {
        id: 'vat_number',
        text: 'Partita IVA',
        type: 'text',
        required: true,
        validation: 'vat_number'
      },
      {
        id: 'business_sector',
        text: 'Settore di attività',
        type: 'text',
        required: true
      },
      {
        id: 'foundation_date',
        text: 'Data di fondazione',
        type: 'date',
        required: true
      },
      {
        id: 'employees_count',
        text: 'Numero di dipendenti',
        type: 'number',
        required: true
      },
      {
        id: 'annual_revenue',
        text: 'Fatturato annuo stimato (€)',
        type: 'number',
        required: false
      }
    ],
    // Informazioni su rappresentante legale per entità non individuali
    legal_representative: [
      {
        id: 'legal_rep_first_name',
        text: 'Nome del rappresentante legale',
        type: 'text',
        required: true
      },
      {
        id: 'legal_rep_last_name',
        text: 'Cognome del rappresentante legale',
        type: 'text',
        required: true
      },
      {
        id: 'legal_rep_fiscal_code',
        text: 'Codice fiscale del rappresentante legale',
        type: 'text',
        required: true,
        validation: 'fiscal_code'
      },
      {
        id: 'legal_rep_email',
        text: 'Email del rappresentante legale',
        type: 'email',
        required: false
      },
      {
        id: 'legal_rep_phone',
        text: 'Telefono del rappresentante legale',
        type: 'tel',
        required: false
      }
    ]
  },
  
  // Dati fiscali
  [ONBOARDING_PHASES.FISCAL_DATA]: {
    common: [
      {
        id: 'tax_regime',
        text: 'Regime fiscale',
        type: 'select',
        options: [
          { value: TAX_REGIMES.FORFETTARIO, label: 'Regime forfettario' },
          { value: TAX_REGIMES.SEMPLIFICATO, label: 'Regime semplificato' },
          { value: TAX_REGIMES.ORDINARIO, label: 'Regime ordinario' }
        ],
        required: true
      },
      {
        id: 'has_accountant',
        text: 'Hai già un commercialista?',
        type: 'boolean',
        required: true
      }
    ],
    // Domande specifiche per regime forfettario
    [TAX_REGIMES.FORFETTARIO]: [
      {
        id: 'activity_code',
        text: 'Codice ATECO principale',
        type: 'text',
        required: true
      },
      {
        id: 'forfettario_percentage',
        text: 'Percentuale di redditività',
        type: 'number',
        required: true
      },
      {
        id: 'pension_fund',
        text: 'Iscritto a cassa previdenziale',
        type: 'boolean',
        required: true
      }
    ],
    // Domande specifiche per regime ordinario
    [TAX_REGIMES.ORDINARIO]: [
      {
        id: 'accounting_method',
        text: 'Metodo di contabilità',
        type: 'select',
        options: [
          { value: 'standard', label: 'Contabilità ordinaria standard' },
          { value: 'analytical', label: 'Contabilità analitica' }
        ],
        required: true
      },
      {
        id: 'needs_audit',
        text: 'Necessita revisione legale',
        type: 'boolean',
        required: true
      }
    ]
  },
  
  // Documenti richiesti
  [ONBOARDING_PHASES.DOCUMENTS]: {
    // Documenti comuni per tutti
    common: [
      {
        id: 'id_document',
        text: 'Documento d\'identità',
        type: 'file',
        required: true,
        description: 'Carta d\'identità o passaporto in corso di validità'
      },
      {
        id: 'fiscal_code_card',
        text: 'Tessera codice fiscale/sanitaria',
        type: 'file',
        required: true,
        description: 'Tessera sanitaria o codice fiscale'
      }
    ],
    // Documenti per persone fisiche
    [CLIENT_TYPES.INDIVIDUAL]: [
      {
        id: 'last_tax_return',
        text: 'Ultima dichiarazione dei redditi',
        type: 'file',
        required: true,
        description: 'Modello 730 o Redditi PF dell\'ultimo anno'
      }
    ],
    // Documenti per ditte individuali
    [CLIENT_TYPES.SOLE_PROPRIETOR]: [
      {
        id: 'business_registration',
        text: 'Certificato di apertura partita IVA',
        type: 'file',
        required: true,
        description: 'Certificato di attribuzione partita IVA'
      },
      {
        id: 'chamber_registration',
        text: 'Visura camerale',
        type: 'file',
        required: true,
        description: 'Visura camerale recente (non più vecchia di 3 mesi)'
      },
      {
        id: 'last_tax_return',
        text: 'Ultima dichiarazione dei redditi',
        type: 'file',
        required: true,
        description: 'Modello Redditi PF dell\'ultimo anno'
      }
    ],
    // Documenti per società
    corporate: [
      {
        id: 'company_statute',
        text: 'Statuto societario',
        type: 'file',
        required: true,
        description: 'Statuto aggiornato della società'
      },
      {
        id: 'chamber_registration',
        text: 'Visura camerale',
        type: 'file',
        required: true,
        description: 'Visura camerale recente (non più vecchia di 3 mesi)'
      },
      {
        id: 'last_financial_statement',
        text: 'Ultimo bilancio',
        type: 'file',
        required: true,
        description: 'Ultimo bilancio depositato'
      },
      {
        id: 'vat_registration',
        text: 'Certificato attribuzione P.IVA',
        type: 'file',
        required: true,
        description: 'Certificato di attribuzione della partita IVA'
      }
    ]
  },
  
  // Servizi richiesti
  [ONBOARDING_PHASES.SERVICES]: [
    {
      id: 'required_services',
      text: 'Quali servizi ti interessano?',
      type: 'multiselect',
      options: [
        { value: 'Contabilità Ordinaria', label: 'Contabilità ordinaria' },
        { value: 'Contabilità Semplificata', label: 'Contabilità semplificata' },
        { value: 'Dichiarazione Redditi', label: 'Dichiarazione dei redditi' },
        { value: 'Modello 770', label: 'Modello 770' },
        { value: 'Buste Paga', label: 'Buste paga e gestione personale' },
        { value: 'Consulenza Fiscale', label: 'Consulenza fiscale' },
        { value: 'Consulenza Societaria', label: 'Consulenza societaria' },
        { value: 'Revisione Contabile', label: 'Revisione contabile' }
      ],
      required: true
    },
    {
      id: 'start_date',
      text: 'Da quando vorresti iniziare la collaborazione?',
      type: 'date',
      required: true
    },
    {
      id: 'additional_notes',
      text: 'Note o richieste aggiuntive',
      type: 'textarea',
      required: false
    }
  ]
};

// Template documenti richiesti in base al tipo cliente
const documentChecklistTemplates = {
  [CLIENT_TYPES.INDIVIDUAL]: [
    { name: 'Documento d\'identità', required: true },
    { name: 'Tessera codice fiscale', required: true },
    { name: 'Ultima dichiarazione dei redditi', required: true },
    { name: 'Modello CU (se lavoratore dipendente)', required: false },
    { name: 'Certificazioni redditi diversi', required: false }
  ],
  [CLIENT_TYPES.SOLE_PROPRIETOR]: [
    { name: 'Documento d\'identità', required: true },
    { name: 'Tessera codice fiscale', required: true },
    { name: 'Certificato apertura Partita IVA', required: true },
    { name: 'Visura camerale', required: true },
    { name: 'Ultima dichiarazione dei redditi', required: true },
    { name: 'Ultima dichiarazione IVA', required: true },
    { name: 'Registri IVA anno corrente', required: true },
    { name: 'F24 versamenti effettuati', required: true }
  ],
  [CLIENT_TYPES.PARTNERSHIP]: [
    { name: 'Statuto e atto costitutivo', required: true },
    { name: 'Visura camerale', required: true },
    { name: 'Documento d\'identità rappresentante legale', required: true },
    { name: 'Certificato attribuzione Partita IVA', required: true },
    { name: 'Ultimo bilancio/situazione contabile', required: true },
    { name: 'Ultima dichiarazione dei redditi', required: true },
    { name: 'Ultima dichiarazione IVA', required: true },
    { name: 'Registri IVA anno corrente', required: true },
    { name: 'F24 versamenti effettuati', required: true }
  ],
  [CLIENT_TYPES.CORPORATION]: [
    { name: 'Statuto e atto costitutivo', required: true },
    { name: 'Visura camerale', required: true },
    { name: 'Documento d\'identità rappresentante legale', required: true },
    { name: 'Certificato attribuzione Partita IVA', required: true },
    { name: 'Ultimo bilancio depositato', required: true },
    { name: 'Dichiarazione dei redditi società', required: true },
    { name: 'Situazione contabile aggiornata', required: true },
    { name: 'Dichiarazione IVA', required: true },
    { name: 'Verbali assemblea', required: true },
    { name: 'F24 versamenti effettuati', required: true }
  ],
  [CLIENT_TYPES.NON_PROFIT]: [
    { name: 'Statuto e atto costitutivo', required: true },
    { name: 'Documento d\'identità rappresentante legale', required: true },
    { name: 'Certificato attribuzione Codice Fiscale/P.IVA', required: true },
    { name: 'Ultimo rendiconto/bilancio', required: true },
    { name: 'Libro soci', required: true },
    { name: 'Verbali assemblee', required: true },
    { name: 'Dichiarazione EAS (se presentata)', required: false },
    { name: 'F24 versamenti effettuati', required: false }
  ]
};

/**
 * Inizia un nuovo processo di onboarding
 * @param {string} clientType - Tipo di cliente
 * @param {Object} initialData - Dati iniziali opzionali
 * @returns {Promise<Object>} - Cliente creato e prima serie di domande
 */
const startOnboarding = async (clientType, initialData = {}) => {
  try {
    // Validazione clientType
    if (!Object.values(CLIENT_TYPES).includes(clientType)) {
      throw new Error(`Tipo cliente non valido: ${clientType}`);
    }
    
    logger.info(`Inizio processo onboarding per cliente tipo: ${clientType}`);
    
    // Crea nuovo record cliente con stato onboarding iniziale
    const client = new Client({
      name: initialData.name || 'Nuovo Cliente',
      fiscalCode: initialData.fiscalCode || '',
      companyType: mapClientTypeToCompanyType(clientType, initialData),
      contactInfo: {
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: {
          street: initialData.street || '',
          city: initialData.city || '',
          province: initialData.province || '',
          postalCode: initialData.postalCode || '',
          country: 'Italia'
        }
      },
      onboarding: {
        status: 'nuovo',
        startDate: new Date(),
        checklist: generateDocumentChecklist(clientType),
        completionPercentage: 0
      }
    });
    
    // Se ci sono dati per il rappresentante legale, aggiungili
    if (initialData.legalRepresentative) {
      client.legalRepresentative = {
        firstName: initialData.legalRepresentative.firstName || '',
        lastName: initialData.legalRepresentative.lastName || '',
        fiscalCode: initialData.legalRepresentative.fiscalCode || '',
        email: initialData.legalRepresentative.email || '',
        phone: initialData.legalRepresentative.phone || ''
      };
    }
    
    // Salva il cliente nel database
    await client.save();
    
    // Ottieni le prime domande basate sul tipo cliente
    const questions = getQuestionsForPhase(ONBOARDING_PHASES.PERSONAL_INFO, clientType);
    
    return {
      success: true,
      clientId: client._id,
      clientType,
      currentPhase: ONBOARDING_PHASES.PERSONAL_INFO,
      questions,
      message: 'Processo di onboarding iniziato con successo'
    };
  } catch (error) {
    logger.error('Errore nell\'avvio dell\'onboarding:', error);
    return {
      success: false,
      error: error.message,
      clientType
    };
  }
};

/**
 * Ottiene le prossime domande basate sulle risposte precedenti
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object>} - Prossima serie di domande
 */
const getNextQuestions = async (clientId) => {
  try {
    // Trova il cliente nel database
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }
    
    // Determina la fase attuale di onboarding
    const currentPhase = determineCurrentPhase(client);
    
    // Se l'onboarding è già completato, non ci sono altre domande
    if (currentPhase === ONBOARDING_PHASES.COMPLETED) {
      return {
        success: true,
        clientId,
        currentPhase,
        completed: true,
        message: 'Processo di onboarding già completato'
      };
    }
    
    // Determina il tipo cliente e il regime fiscale (se disponibile)
    const clientType = mapCompanyTypeToClientType(client.companyType);
    const taxRegime = client.accountingRegime;
    
    // Ottieni le domande per la fase corrente
    const questions = getQuestionsForPhase(currentPhase, clientType, taxRegime);
    
    // Determina la percentuale di completamento
    const completionPercentage = calculateCompletionPercentage(client, currentPhase);
    
    return {
      success: true,
      clientId,
      clientType,
      currentPhase,
      questions,
      completionPercentage,
      message: 'Domande generate con successo'
    };
  } catch (error) {
    logger.error(`Errore nel recupero delle domande per cliente ${clientId}:`, error);
    return {
      success: false,
      clientId,
      error: error.message
    };
  }
};

/**
 * Elabora le risposte e aggiorna il profilo cliente
 * @param {string} clientId - ID del cliente
 * @param {Object} answers - Risposte fornite
 * @returns {Promise<Object>} - Risultato dell'elaborazione
 */
const processAnswers = async (clientId, answers) => {
  try {
    // Trova il cliente nel database
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }
    
    // Determina la fase corrente
    const currentPhase = determineCurrentPhase(client);
    
    // Aggiorna lo stato dell'onboarding
    if (client.onboarding.status === 'nuovo') {
      client.onboarding.status = 'in_corso';
    }
    
    // Elabora le risposte in base alla fase
    switch (currentPhase) {
      case ONBOARDING_PHASES.PERSONAL_INFO:
        updatePersonalInfo(client, answers);
        break;
        
      case ONBOARDING_PHASES.BUSINESS_INFO:
        updateBusinessInfo(client, answers);
        break;
        
      case ONBOARDING_PHASES.FISCAL_DATA:
        updateFiscalData(client, answers);
        break;
        
      case ONBOARDING_PHASES.DOCUMENTS:
        await updateDocuments(client, answers);
        break;
        
      case ONBOARDING_PHASES.SERVICES:
        updateServices(client, answers);
        break;
        
      case ONBOARDING_PHASES.REVIEW:
        // La fase di revisione non ha risposte da elaborare
        client.onboarding.status = 'completato';
        client.onboarding.completedDate = new Date();
        break;
        
      default:
        logger.warn(`Fase onboarding non gestita: ${currentPhase}`);
    }
    
    // Calcola la percentuale di completamento
    const newPhase = getNextPhase(currentPhase);
    const completionPercentage = calculateCompletionPercentage(client, newPhase);
    client.onboarding.completionPercentage = completionPercentage;
    
    // Salva le modifiche
    await client.save();
    
    // Verifica se tutte le fasi sono state completate
    const isComplete = completionPercentage >= 100;
    
    // Se l'onboarding è completato, genera procedure consigliate
    let suggestedProcedures = [];
    if (isComplete) {
      suggestedProcedures = await generateSuggestedProcedures(client);
    }
    
    return {
      success: true,
      clientId,
      previousPhase: currentPhase,
      currentPhase: newPhase,
      completionPercentage,
      isComplete,
      suggestedProcedures: isComplete ? suggestedProcedures : [],
      message: isComplete 
        ? 'Processo di onboarding completato con successo'
        : 'Risposte elaborate con successo'
    };
  } catch (error) {
    logger.error(`Errore nell'elaborazione delle risposte per cliente ${clientId}:`, error);
    return {
      success: false,
      clientId,
      error: error.message
    };
  }
};

/**
 * Verifica se tutte le informazioni necessarie sono state raccolte
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object>} - Stato di completezza e eventuali lacune
 */
const checkCompleteness = async (clientId) => {
  try {
    // Trova il cliente nel database
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }
    
    // Determina il tipo cliente
    const clientType = mapCompanyTypeToClientType(client.companyType);
    
    // Verifica i campi obbligatori per ciascuna fase
    const missingFields = [];
    
    // Informazioni personali
    if (!client.name || !client.fiscalCode) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.PERSONAL_INFO, 
        fields: ['name', 'fiscalCode'].filter(f => !client[f])
      });
    }
    
    if (!client.contactInfo?.email || !client.contactInfo?.phone || 
        !client.contactInfo?.address?.street || !client.contactInfo?.address?.city ||
        !client.contactInfo?.address?.province || !client.contactInfo?.address?.postalCode) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.PERSONAL_INFO, 
        fields: ['email', 'phone', 'address'].filter(f => !client.contactInfo?.[f])
      });
    }
    
    // Per entità non individuali, verifica rappresentante legale
    if (clientType !== CLIENT_TYPES.INDIVIDUAL && 
        (!client.legalRepresentative?.firstName || !client.legalRepresentative?.lastName || 
         !client.legalRepresentative?.fiscalCode)) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.PERSONAL_INFO, 
        fields: ['legalRepresentative']
      });
    }
    
    // Per entità commerciali, verifica informazioni aziendali
    if (clientType !== CLIENT_TYPES.INDIVIDUAL && !client.vatNumber) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.BUSINESS_INFO, 
        fields: ['vatNumber']
      });
    }
    
    // Verifica documenti obbligatori
    const missingDocuments = client.onboarding.checklist
      .filter(doc => doc.required && doc.status !== 'verificato')
      .map(doc => doc.name);
      
    if (missingDocuments.length > 0) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.DOCUMENTS, 
        fields: missingDocuments
      });
    }
    
    // Verifica servizi richiesti
    if (!client.services || client.services.length === 0) {
      missingFields.push({ 
        phase: ONBOARDING_PHASES.SERVICES, 
        fields: ['services']
      });
    }
    
    // Calcola percentuale completamento per ciascuna fase
    const phaseCompletionStatus = calculatePhaseCompletionStatus(client);
    
    return {
      success: true,
      clientId,
      completionPercentage: client.onboarding.completionPercentage,
      missingFields,
      phaseCompletionStatus,
      isComplete: missingFields.length === 0,
      message: missingFields.length === 0 
        ? 'Tutte le informazioni necessarie sono state raccolte'
        : 'Informazioni mancanti rilevate'
    };
  } catch (error) {
    logger.error(`Errore nella verifica completezza per cliente ${clientId}:`, error);
    return {
      success: false,
      clientId,
      error: error.message
    };
  }
};

/**
 * Suggerisce procedure in base alle informazioni raccolte
 * @param {string} clientId - ID del cliente
 * @returns {Promise<Object>} - Procedure suggerite
 */
const suggestProcedure = async (clientId) => {
  try {
    // Trova il cliente nel database
    const client = await Client.findById(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }
    
    // Genera procedure suggerite
    const suggestedProcedures = await generateSuggestedProcedures(client);
    
    // Genera checklist di documenti mancanti
    const documentSuggestions = await suggestMissingDocuments(client);
    
    return {
      success: true,
      clientId,
      suggestedProcedures,
      documentSuggestions,
      message: 'Suggerimenti generati con successo'
    };
  } catch (error) {
    logger.error(`Errore nella generazione suggerimenti per cliente ${clientId}:`, error);
    return {
      success: false,
      clientId,
      error: error.message
    };
  }
};

/**
 * Genera una checklist di documenti richiesti in base al tipo cliente
 * @param {string} clientType - Tipo di cliente
 * @returns {Array} - Checklist di documenti
 */
const generateDocumentChecklist = (clientType) => {
  const template = documentChecklistTemplates[clientType] || documentChecklistTemplates[CLIENT_TYPES.INDIVIDUAL];
  
  return template.map(item => ({
    name: item.name,
    required: item.required,
    status: 'in_attesa',
    notes: ''
  }));
};

/**
 * Determina la fase attuale di onboarding
 * @param {Object} client - Oggetto cliente
 * @returns {string} - Fase attuale
 */
const determineCurrentPhase = (client) => {
  // Se l'onboarding è completato, restituisci la fase completata
  if (client.onboarding.status === 'completato') {
    return ONBOARDING_PHASES.COMPLETED;
  }
  
  // Verifica le fasi in ordine
  if (!client.name || !client.fiscalCode || 
      !client.contactInfo?.email || !client.contactInfo?.phone) {
    return ONBOARDING_PHASES.PERSONAL_INFO;
  }
  
  // Per entità commerciali (non persone fisiche)
  const clientType = mapCompanyTypeToClientType(client.companyType);
  if (clientType !== CLIENT_TYPES.INDIVIDUAL && !client.vatNumber) {
    return ONBOARDING_PHASES.BUSINESS_INFO;
  }
  
  // Verifica dati fiscali
  if (!client.accountingRegime) {
    return ONBOARDING_PHASES.FISCAL_DATA;
  }
  
  // Verifica documenti caricati
  const requiredDocs = client.onboarding.checklist.filter(doc => doc.required);
  const completedDocs = requiredDocs.filter(doc => doc.status === 'verificato' || doc.status === 'caricato');
  if (completedDocs.length < requiredDocs.length) {
    return ONBOARDING_PHASES.DOCUMENTS;
  }
  
  // Verifica servizi richiesti
  if (!client.services || client.services.length ===.0) {
    return ONBOARDING_PHASES.SERVICES;
  }
  
  // Se tutte le fasi sono completate, ma l'onboarding non è ancora completato
  return ONBOARDING_PHASES.REVIEW;
};

/**
 * Ottiene la fase successiva in base alla fase corrente
 * @param {string} currentPhase - Fase corrente
 * @returns {string} - Fase successiva
 */
const getNextPhase = (currentPhase) => {
  switch (currentPhase) {
    case ONBOARDING_PHASES.INITIAL:
      return ONBOARDING_PHASES.PERSONAL_INFO;
    case ONBOARDING_PHASES.PERSONAL_INFO:
      return ONBOARDING_PHASES.BUSINESS_INFO;
    case ONBOARDING_PHASES.BUSINESS_INFO:
      return ONBOARDING_PHASES.FISCAL_DATA;
    case ONBOARDING_PHASES.FISCAL_DATA:
      return ONBOARDING_PHASES.DOCUMENTS;
    case ONBOARDING_PHASES.DOCUMENTS:
      return ONBOARDING_PHASES.SERVICES;
    case ONBOARDING_PHASES.SERVICES:
      return ONBOARDING_PHASES.REVIEW;
    case ONBOARDING_PHASES.REVIEW:
      return ONBOARDING_PHASES.COMPLETED;
    case ONBOARDING_PHASES.COMPLETED:
      return ONBOARDING_PHASES.COMPLETED;
    default:
      return ONBOARDING_PHASES.PERSONAL_INFO;
  }
};

/**
 * Ottiene le domande per una specifica fase
 * @param {string} phase - Fase di onboarding
 * @param {string} clientType - Tipo di cliente
 * @param {string} taxRegime - Regime fiscale (opzionale)
 * @returns {Array} - Domande per la fase
 */
const getQuestionsForPhase = (phase, clientType, taxRegime = null) => {
  if (!phase || !questionsBank[phase]) {
    return [];
  }
  
  // Se la fase ha domande dirette (non suddivise per tipo)
  if (Array.isArray(questionsBank[phase])) {
    return questionsBank[phase];
  }
  
  // Raccogli domande comuni per la fase
  let questions = [...(questionsBank[phase].common || [])];
  
  // Aggiungi domande specifiche per il tipo cliente
  if (clientType && questionsBank[phase][clientType]) {
    questions = [...questions, ...questionsBank[phase][clientType]];
  }
  
  // Per alcune fasi, aggiungi domande commerciali a tutti i tipi tranne persona fisica
  if (phase === ONBOARDING_PHASES.BUSINESS_INFO && 
      clientType !== CLIENT_TYPES.INDIVIDUAL && 
      questionsBank[phase].commercial) {
    questions = [...questions, ...questionsBank[phase].commercial];
    questions = [...questions, ...questionsBank[phase].legal_representative];
  }
  
  // Per fase fiscale, aggiungi domande specifiche per il regime
  if (phase === ONBOARDING_PHASES.FISCAL_DATA && 
      taxRegime && questionsBank[phase][taxRegime]) {
    questions = [...questions, ...questionsBank[phase][taxRegime]];
  }
  
  // Per fase documenti, aggiusta in base al tipo cliente
  if (phase === ONBOARDING_PHASES.DOCUMENTS) {
    if (clientType === CLIENT_TYPES.INDIVIDUAL) {
      questions = [...questions, ...questionsBank[phase][CLIENT_TYPES.INDIVIDUAL]];
    } else if (clientType === CLIENT_TYPES.SOLE_PROPRIETOR) {
      questions = [...questions, ...questionsBank[phase][CLIENT_TYPES.SOLE_PROPRIETOR]];
    } else {
      // Per tutti i tipi di società, aggiungi i documenti corporate
      questions = [...questions, ...(questionsBank[phase].corporate || [])];
    }
  }
  
  return questions;
};

/**
 * Mappatura da tipo cliente a tipo azienda in DB
 * @param {string} clientType - Tipo cliente da UI
 * @param {Object} data - Dati aggiuntivi che possono contenere sottotipi
 * @returns {string} - Tipo azienda per il DB
 */
const mapClientTypeToCompanyType = (clientType, data = {}) => {
  switch (clientType) {
    case CLIENT_TYPES.INDIVIDUAL:
      return CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.INDIVIDUAL];
      
    case CLIENT_TYPES.SOLE_PROPRIETOR:
      return CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.SOLE_PROPRIETOR];
      
    case CLIENT_TYPES.PARTNERSHIP:
      // Se è specificato il sottotipo, usalo
      if (data.partnershipType && CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.PARTNERSHIP][data.partnershipType]) {
        return CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.PARTNERSHIP][data.partnershipType];
      }
      return 'SNC'; // Default
      
    case CLIENT_TYPES.CORPORATION:
      // Se è specificato il sottotipo, usalo
      if (data.corporationType && CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.CORPORATION][data.corporationType]) {
        return CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.CORPORATION][data.corporationType];
      }
      return 'SRL'; // Default
      
    case CLIENT_TYPES.NON_PROFIT:
      // Se è specificato il sottotipo, usalo
      if (data.nonProfitType && CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.NON_PROFIT][data.nonProfitType]) {
        return CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.NON_PROFIT][data.nonProfitType];
      }
      return 'Associazione'; // Default
      
    default:
      return 'Altro';
  }
};

/**
 * Mappatura da tipo azienda in DB a tipo cliente
 * @param {string} companyType - Tipo azienda dal DB
 * @returns {string} - Tipo cliente
 */
const mapCompanyTypeToClientType = (companyType) => {
  if (!companyType) return CLIENT_TYPES.INDIVIDUAL;
  
  if (companyType === 'Ditta Individuale') {
    return CLIENT_TYPES.SOLE_PROPRIETOR;
  }
  
  if (['SNC', 'SAS'].includes(companyType)) {
    return CLIENT_TYPES.PARTNERSHIP;
  }
  
  if (['SRL', 'SPA', 'SAPA'].includes(companyType)) {
    return CLIENT_TYPES.CORPORATION;
  }
  
  if (['Associazione', 'Cooperativa'].includes(companyType)) {
    return CLIENT_TYPES.NON_PROFIT;
  }
  
  return CLIENT_TYPES.INDIVIDUAL;
};

/**
 * Aggiorna le informazioni personali del cliente
 * @param {Object} client - Oggetto cliente
 * @param {Object} answers - Risposte fornite
 */
const updatePersonalInfo = (client, answers) => {
  // Aggiorna i campi di base
  if (answers.name) client.name = answers.name;
  if (answers.fiscal_code) client.fiscalCode = answers.fiscal_code;
  
  // Aggiorna sottotipo società se specificato
  const clientType = mapCompanyTypeToClientType(client.companyType);
  
  if (clientType === CLIENT_TYPES.PARTNERSHIP && answers.partnership_type) {
    client.companyType = CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.PARTNERSHIP][answers.partnership_type];
  } else if (clientType === CLIENT_TYPES.CORPORATION && answers.corporation_type) {
    client.companyType = CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.CORPORATION][answers.corporation_type];
  } else if (clientType === CLIENT_TYPES.NON_PROFIT && answers.non_profit_type) {
    client.companyType = CLIENT_TYPE_TO_COMPANY_TYPE[CLIENT_TYPES.NON_PROFIT][answers.non_profit_type];
  }
  
  // Aggiorna info di contatto
  if (!client.contactInfo) client.contactInfo = {};
  
  if (answers.email) client.contactInfo.email = answers.email;
  if (answers.phone) client.contactInfo.phone = answers.phone;
  if (answers.alternative_phone) client.contactInfo.alternativePhone = answers.alternative_phone;
  
  // Aggiorna indirizzo
  if (!client.contactInfo.address) client.contactInfo.address = {};
  
  if (answers.street) client.contactInfo.address.street = answers.street;
  if (answers.city) client.contactInfo.address.city = answers.city;
  if (answers.province) client.contactInfo.address.province = answers.province;
  if (answers.postal_code) client.contactInfo.address.postalCode = answers.postal_code;
  if (answers.country) client.contactInfo.address.country = answers.country;
  
  // Gestisci casi specifici per indirizzi strutturati
  if (answers.address && typeof answers.address === 'object') {
    if (answers.address.street) client.contactInfo.address.street = answers.address.street;
    if (answers.address.city) client.contactInfo.address.city = answers.address.city;
    if (answers.address.province) client.contactInfo.address.province = answers.address.province;
    if (answers.address.postalCode) client.contactInfo.address.postalCode = answers.address.postalCode;
    if (answers.address.country) client.contactInfo.address.country = answers.address.country;
  }
  
  // Aggiorna rappresentante legale
  if (answers.legal_rep_first_name || answers.legal_rep_last_name || answers.legal_rep_fiscal_code) {
    if (!client.legalRepresentative) client.legalRepresentative = {};
    
    if (answers.legal_rep_first_name) client.legalRepresentative.firstName = answers.legal_rep_first_name;
    if (answers.legal_rep_last_name) client.legalRepresentative.lastName = answers.legal_rep_last_name;
    if (answers.legal_rep_fiscal_code) client.legalRepresentative.fiscalCode = answers.legal_rep_fiscal_code;
    if (answers.legal_rep_email) client.legalRepresentative.email = answers.legal_rep_email;
    if (answers.legal_rep_phone) client.legalRepresentative.phone = answers.legal_rep_phone;
  }
};

/**
 * Aggiorna le informazioni aziendali del cliente
 * @param {Object} client - Oggetto cliente
 * @param {Object} answers - Risposte fornite
 */
const updateBusinessInfo = (client, answers) => {
  // Aggiorna campi aziendali
  if (answers.vat_number) client.vatNumber = answers.vat_number;
  if (answers.business_sector) client.businessSector = answers.business_sector;
  if (answers.foundation_date) client.foundingDate = new Date(answers.foundation_date);
  if (answers.employees_count !== undefined) client.employees = parseInt(answers.employees_count);
  if (answers.annual_revenue !== undefined) client.annualRevenue = parseFloat(answers.annual_revenue);
  
  // Caso edge: rappresentante legale mancante dalle risposte personali
  if (answers.legal_rep_first_name || answers.legal_rep_last_name || answers.legal_rep_fiscal_code) {
    if (!client.legalRepresentative) client.legalRepresentative = {};
    
    if (answers.legal_rep_first_name) client.legalRepresentative.firstName = answers.legal_rep_first_name;
    if (answers.legal_rep_last_name) client.legalRepresentative.lastName = answers.legal_rep_last_name;
    if (answers.legal_rep_fiscal_code) client.legalRepresentative.fiscalCode = answers.legal_rep_fiscal_code;
    if (answers.legal_rep_email) client.legalRepresentative.email = answers.legal_rep_email;
    if (answers.legal_rep_phone) client.legalRepresentative.phone = answers.legal_rep_phone;
  }
};

/**
 * Aggiorna le informazioni fiscali del cliente
 * @param {Object} client - Oggetto cliente
 * @param {Object} answers - Risposte fornite
 */
const updateFiscalData = (client, answers) => {
  // Aggiorna regime fiscale
  if (answers.tax_regime) {
    client.accountingRegime = answers.tax_regime;
  }
  
  // Aggiorna note con informazioni aggiuntive
  let notes = client.notes || '';
  
  // Gestisci campi specifici per diversi regimi
  if (answers.tax_regime === TAX_REGIMES.FORFETTARIO) {
    if (answers.activity_code) {
      notes += `\nCodice ATECO: ${answers.activity_code}`;
    }
    if (answers.forfettario_percentage) {
      notes += `\nPercentuale redditività forfettaria: ${answers.forfettario_percentage}%`;
    }
    if (answers.pension_fund !== undefined) {
      notes += `\nIscritto cassa previdenziale: ${answers.pension_fund ? 'Sì' : 'No'}`;
    }
  } else if (answers.tax_regime === TAX_REGIMES.ORDINARIO) {
    if (answers.accounting_method) {
      notes += `\nMetodo contabilità: ${answers.accounting_method === 'standard' ? 'Ordinaria standard' : 'Analitica'}`;
    }
    if (answers.needs_audit !== undefined) {
      notes += `\nNecessita revisione legale: ${answers.needs_audit ? 'Sì' : 'No'}`;
    }
  }
  
  // Altre informazioni fiscali
  if (answers.has_accountant !== undefined) {
    notes += `\nGià assistito da altro commercialista: ${answers.has_accountant ? 'Sì' : 'No'}`;
  }
  
  client.notes = notes.trim();
};

/**
 * Aggiorna i documenti del cliente
 * @param {Object} client - Oggetto cliente
 * @param {Object} answers - Risposte fornite con file
 * @returns {Promise<void>}
 */
const updateDocuments = async (client, answers) => {
  // Per ogni documento caricato
  for (const [key, fileInfo] of Object.entries(answers)) {
    if (!fileInfo || !fileInfo.filename) continue;
    
    // Trova il documento nella checklist se esiste
    const checklistItem = client.onboarding.checklist.find(
      item => item.name.toLowerCase() === key.replace('_', ' ').toLowerCase() ||
              item.name.toLowerCase().includes(key.replace('_', ' ').toLowerCase())
    );
    
    // Se il documento è nella checklist, aggiorna il suo stato
    if (checklistItem) {
      checklistItem.status = 'caricato';
      checklistItem.uploadedAt = new Date();
      checklistItem.documentId = fileInfo.id || fileInfo.documentId;
    }
    
    // Aggiungi il documento alla lista documenti
    client.documents.push({
      name: fileInfo.filename,
      path: fileInfo.path || fileInfo.url || fileInfo.id,
      type: mapDocumentType(key),
      uploadDate: new Date(),
      status: 'in_attesa'
    });
  }
  
  // Calcola automaticamente la percentuale completamento onboarding
  calculateCompletionPercentage(client, ONBOARDING_PHASES.DOCUMENTS);
};

/**
 * Aggiorna i servizi richiesti dal cliente
 * @param {Object} client - Oggetto cliente
 * @param {Object} answers - Risposte fornite
 */
const updateServices = (client, answers) => {
  // Aggiorna servizi richiesti
  if (answers.required_services) {
    // Normalizza input (può essere array o stringa separata da virgole)
    let services = answers.required_services;
    if (typeof services === 'string') {
      services = services.split(',').map(s => s.trim());
    }
    
    client.services = services;
  }
  
  // Aggiungi note se presenti
  if (answers.additional_notes) {
    client.notes = client.notes 
      ? `${client.notes}\n\nNote aggiuntive: ${answers.additional_notes}` 
      : `Note aggiuntive: ${answers.additional_notes}`;
  }
  
  // Aggiorna data ultimo contatto
  client.lastContactDate = new Date();
};

/**
 * Mappa tipi documento ai valori dell'enum nel modello
 * @param {string} documentKey - Chiave del documento
 * @returns {string} - Tipo documento per il DB
 */
const mapDocumentType = (documentKey) => {
  const key = documentKey.toLowerCase();
  
  if (key.includes('id') || key.includes('identit') || key.includes('passport')) {
    return 'Identità';
  }
  
  if (key.includes('fiscal') || key.includes('tax') || key.includes('dichiar')) {
    return 'Fiscale';
  }
  
  if (key.includes('statut') || key.includes('atto') || key.includes('visura')) {
    return 'Legale';
  }
  
  if (key.includes('bilanc') || key.includes('finan') || key.includes('conta')) {
    return 'Finanziario';
  }
  
  return 'Altro';
};

/**
 * Calcola la percentuale di completamento dell'onboarding
 * @param {Object} client - Oggetto cliente
 * @param {string} currentPhase - Fase corrente
 * @returns {number} - Percentuale completamento
 */
const calculateCompletionPercentage = (client, currentPhase) => {
  // Pesi relativi per ogni fase (totale 100%)
  const phaseWeights = {
    [ONBOARDING_PHASES.INITIAL]: 0,
    [ONBOARDING_PHASES.PERSONAL_INFO]: 20,
    [ONBOARDING_PHASES.BUSINESS_INFO]: 15,
    [ONBOARDING_PHASES.FISCAL_DATA]: 15,
    [ONBOARDING_PHASES.DOCUMENTS]: 25,
    [ONBOARDING_PHASES.SERVICES]: 15,
    [ONBOARDING_PHASES.REVIEW]: 10,
    [ONBOARDING_PHASES.COMPLETED]: 100
  };
  
  // Fase corrente determina il completamento
  const phaseOrder = Object.keys(phaseWeights);
  const currentPhaseIndex = phaseOrder.indexOf(currentPhase);
  
  // Somma i pesi delle fasi completate
  let completionPercentage = 0;
  for (let i = 0; i < currentPhaseIndex; i++) {
    completionPercentage += phaseWeights[phaseOrder[i]];
  }
  
  // Aggiunge anche una parte del peso della fase corrente
  // Consideriamo la fase corrente come al 50% se non è l'ultima
  if (currentPhase !== ONBOARDING_PHASES.COMPLETED && currentPhaseIndex > 0) {
    completionPercentage += phaseWeights[currentPhase] * 0.5;
  }
  
  // Per la fase documenti, calcola in base ai documenti effettivamente caricati
  if (currentPhase === ONBOARDING_PHASES.DOCUMENTS) {
    const requiredDocs = client.onboarding.checklist.filter(item => item.required);
    if (requiredDocs.length > 0) {
      const uploadedDocs = requiredDocs.filter(
        item => item.status === 'caricato' || item.status === 'verificato'
      );
      
      const docsPercentage = (uploadedDocs.length / requiredDocs.length) * phaseWeights[ONBOARDING_PHASES.DOCUMENTS];
      
      // Sostituisci la percentuale standard della fase documenti con quella calcolata
      completionPercentage = completionPercentage - (phaseWeights[ONBOARDING_PHASES.DOCUMENTS] * 0.5) + docsPercentage;
    }
  }
  
  return Math.min(100, Math.round(completionPercentage));
};

/**
 * Calcola lo stato di completamento per ciascuna fase
 * @param {Object} client - Oggetto cliente
 * @returns {Object} - Stato di completamento per fase
 */
const calculatePhaseCompletionStatus = (client) => {
  const results = {};
  
  // Fase informazioni personali
  results[ONBOARDING_PHASES.PERSONAL_INFO] = {
    complete: !!(client.name && client.fiscalCode && 
                 client.contactInfo?.email && client.contactInfo?.phone &&
                 client.contactInfo?.address?.street),
    missingFields: []
  };
  
  if (!client.name) results[ONBOARDING_PHASES.PERSONAL_INFO].missingFields.push('name');
  if (!client.fiscalCode) results[ONBOARDING_PHASES.PERSONAL_INFO].missingFields.push('fiscalCode');
  if (!client.contactInfo?.email) results[ONBOARDING_PHASES.PERSONAL_INFO].missingFields.push('email');
  if (!client.contactInfo?.phone) results[ONBOARDING_PHASES.PERSONAL_INFO].missingFields.push('phone');
  if (!client.contactInfo?.address?.street) results[ONBOARDING_PHASES.PERSONAL_INFO].missingFields.push('address');
  
  // Fase informazioni aziendali
  const clientType = mapCompanyTypeToClientType(client.companyType);
  const isCompany = clientType !== CLIENT_TYPES.INDIVIDUAL;
  
  results[ONBOARDING_PHASES.BUSINESS_INFO] = {
    complete: !isCompany || !!(client.vatNumber && client.businessSector),
    missingFields: []
  };
  
  if (isCompany) {
    if (!client.vatNumber) results[ONBOARDING_PHASES.BUSINESS_INFO].missingFields.push('vatNumber');
    if (!client.businessSector) results[ONBOARDING_PHASES.BUSINESS_INFO].missingFields.push('businessSector');
    if (!client.legalRepresentative?.fiscalCode) {
      results[ONBOARDING_PHASES.BUSINESS_INFO].missingFields.push('legalRepresentative');
    }
  }
  
  // Fase dati fiscali
  results[ONBOARDING_PHASES.FISCAL_DATA] = {
    complete: !!client.accountingRegime,
    missingFields: []
  };
  
  if (!client.accountingRegime) {
    results[ONBOARDING_PHASES.FISCAL_DATA].missingFields.push('accountingRegime');
  }
  
  // Fase documenti
  const requiredDocs = client.onboarding.checklist.filter(item => item.required);
  const uploadedDocs = requiredDocs.filter(
    item => item.status === 'caricato' || item.status === 'verificato'
  );
  
  results[ONBOARDING_PHASES.DOCUMENTS] = {
    complete: uploadedDocs.length === requiredDocs.length,
    missingFields: requiredDocs
      .filter(item => item.status !== 'caricato' && item.status !== 'verificato')
      .map(item => item.name)
  };
  
  // Fase servizi
  results[ONBOARDING_PHASES.SERVICES] = {
    complete: !!(client.services && client.services.length > 0),
    missingFields: []
  };
  
  if (!client.services || client.services.length === 0) {
    results[ONBOARDING_PHASES.SERVICES].missingFields.push('services');
  }
  
  return results;
};

/**
 * Genera procedure suggerite per il cliente
 * @param {Object} client - Oggetto cliente
 * @returns {Promise<Array>} - Procedure suggerite
 */
const generateSuggestedProcedures = async (client) => {
  try {
    const clientType = mapCompanyTypeToClientType(client.companyType);
    const dbClientType = clientType === CLIENT_TYPES.INDIVIDUAL ? 'individual' :
                          clientType === CLIENT_TYPES.SOLE_PROPRIETOR ? 'individual' :
                          clientType === CLIENT_TYPES.PARTNERSHIP ? 'partnership' :
                          clientType === CLIENT_TYPES.CORPORATION ? 'corporation' : 'any';
    
    // Trova procedure attive dal database adatte per questo tipo cliente
    const procedures = await Procedure.findActiveByClientType(dbClientType);
    
    // Se non ci sono procedure predefinite, genera procedura con AI
    if (!procedures || procedures.length === 0) {
      // Prepara profilo cliente per l'AI
      const clientProfile = {
        id: client._id.toString(),
        name: client.name,
        businessType: client.companyType,
        taxRegime: client.accountingRegime,
        sector: client.businessSector,
        annualRevenue: client.annualRevenue,
        employeesCount: client.employees,
        additionalInfo: client.notes
      };
      
      // Genera procedura personalizzata con AI
      const generatedProcedure = await aiService.generateCustomProcedure(clientProfile);
      
      if (generatedProcedure.success) {
        return [{
          title: `Procedura personalizzata per ${client.name}`,
          description: 'Procedura generata automaticamente in base al profilo cliente',
          content: generatedProcedure.procedure,
          isAIGenerated: true
        }];
      }
      
      return [];
    }
    
    // Prepara le procedure predefinite 
    return procedures.map(procedure => ({
      id: procedure._id.toString(),
      title: procedure.name,
      description: procedure.description,
      tasks: procedure.tasks.map(task => ({
        name: task.name,
        description: task.description,
        dueOffset: task.dueOffset,
        documents: task.requiredDocuments
      })),
      isAIGenerated: false
    }));
  } catch (error) {
    logger.error('Errore nella generazione delle procedure:', error);
    return [];
  }
};

/**
 * Suggerisce documenti mancanti utilizzando AI
 * @param {Object} client - Oggetto cliente
 * @returns {Promise<Object>} - Suggerimenti per documenti
 */
const suggestMissingDocuments = async (client) => {
  try {
    // Prepara i dati cliente per l'AI
    const clientData = {
      name: client.name,
      companyType: client.companyType,
      taxRegime: client.accountingRegime,
      fiscalCode: client.fiscalCode,
      vatNumber: client.vatNumber,
      businessSector: client.businessSector,
      services: client.services
    };
    
    // Prepara la checklist attuale
    const currentChecklist = client.onboarding.checklist.map(item => ({
      title: item.name,
      completed: item.status === 'verificato' || item.status === 'caricato',
      notes: item.notes
    }));
    
    // Genera suggerimenti con AI
    const checklistSuggestions = await aiService.suggestChecklistCompletion(clientData, currentChecklist);
    
    if (checklistSuggestions.success) {
      return {
        suggestions: checklistSuggestions.suggestions,
        completionPercentage: client.onboarding.completionPercentage
      };
    }
    
    return {
      suggestions: "Consigliato completare tutti i documenti nella checklist per procedere.",
      completionPercentage: client.onboarding.completionPercentage
    };
  } catch (error) {
    logger.error('Errore nella generazione suggerimenti documenti:', error);
    return {
      suggestions: "Si è verificato un errore nel generare suggerimenti personalizzati.",
      completionPercentage: client.onboarding.completionPercentage
    };
  }
};

module.exports = {
  startOnboarding,
  getNextQuestions,
  processAnswers,
  checkCompleteness,
  suggestProcedure,
  // Esporta anche funzioni di utilità per test
  ONBOARDING_PHASES,
  CLIENT_TYPES,
  TAX_REGIMES
};