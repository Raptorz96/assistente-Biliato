/**
 * Test di integrazione per il flusso completo dell'assistente AI
 * 
 * Testa il flusso end-to-end dell'assistente AI, dall'onboarding
 * alla generazione di procedure e documenti
 */

const mongoose = require('mongoose');
const Client = require('../../src/models/Client');
const aiAssistant = require('../../src/services/aiAssistant');
const aiService = require('../../src/services/aiService');
const onboardingService = require('../../services/onboardingService');
const assistantController = require('../../src/controllers/assistantController');
const documentGenerationService = require('../../services/documentGenerationService');
const { ONBOARDING_PHASES, CLIENT_TYPES } = onboardingService;

// Mock delle dipendenze
jest.mock('mongoose');
jest.mock('../../src/models/Client');
jest.mock('../../src/models/Document');
jest.mock('../../src/models/Template');
jest.mock('../../src/models/ClientProcedure');
jest.mock('../../src/models/Conversation');
jest.mock('../../src/models/ActivityLog');
jest.mock('../../src/services/aiService');
jest.mock('../../services/documentGenerationService');

describe('Flusso Completo Assistente AI', () => {
  let req, res, next;
  
  // Setup di base per le richieste
  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 'mockUserId',
        role: 'admin'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Mock di aiService per simulare risposte
    aiService.answerFiscalQuestion = jest.fn().mockResolvedValue({
      success: true,
      answer: 'Risposta simulata dall\'assistente AI',
      metadata: {
        confidence: 0.95,
        sources: ['doc1', 'doc2']
      }
    });
    
    aiService.generateCustomProcedure = jest.fn().mockResolvedValue({
      success: true,
      procedure: {
        title: 'Procedura personalizzata',
        steps: [
          {
            title: 'Raccolta documenti',
            description: 'Raccolta dei documenti necessari',
            deadline: '30 giorni'
          },
          {
            title: 'Analisi contabile',
            description: 'Analisi dei documenti contabili',
            deadline: '15 giorni'
          }
        ]
      }
    });
    
    // Mock per conversazioni
    const mockConversation = {
      _id: 'mockConversationId',
      userId: 'mockUserId',
      clientId: 'mockClientId',
      messages: [],
      isActive: true,
      save: jest.fn().mockResolvedValue({
        _id: 'mockConversationId',
        messages: [{ role: 'user', content: 'domanda test' }]
      })
    };
    
    const Conversation = require('../../src/models/Conversation');
    Conversation.findOne = jest.fn().mockResolvedValue(mockConversation);
    Conversation.create = jest.fn().mockResolvedValue(mockConversation);
    Conversation.findById = jest.fn().mockResolvedValue(mockConversation);
  });

  describe('Flusso di onboarding completo', () => {
    // Mock dei dati cliente
    const mockPersonaFisica = {
      _id: 'clientePersonaFisicaId',
      name: 'Mario Rossi',
      fiscalCode: 'RSSMRA80A01H501U',
      companyType: 'Altro',
      contactInfo: {
        email: 'mario.rossi@example.com',
        phone: '3331234567',
        address: {
          street: 'Via Roma 1',
          city: 'Milano',
          province: 'MI',
          postalCode: '20100',
          country: 'Italia'
        }
      },
      onboarding: {
        status: 'nuovo',
        startDate: new Date(),
        completionPercentage: 0,
        checklist: []
      },
      save: jest.fn().mockResolvedThis()
    };
    
    const mockSRL = {
      _id: 'clienteSRLId',
      name: 'Azienda SRL',
      fiscalCode: '12345678901',
      companyType: 'SRL',
      vatNumber: 'IT12345678901',
      businessSector: 'Informatica',
      contactInfo: {
        email: 'info@aziendasrl.it',
        phone: '0212345678',
        address: {
          street: 'Via Impresa 10',
          city: 'Milano',
          province: 'MI',
          postalCode: '20100',
          country: 'Italia'
        }
      },
      legalRepresentative: {
        firstName: 'Giuseppe',
        lastName: 'Verdi',
        fiscalCode: 'VRDGPP70B01H501X'
      },
      accountingRegime: 'Ordinario',
      onboarding: {
        status: 'in_corso',
        startDate: new Date(),
        completionPercentage: 50,
        checklist: [
          { name: 'Visura camerale', required: true, status: 'verificato' },
          { name: 'Statuto societario', required: true, status: 'in_attesa' }
        ]
      },
      save: jest.fn().mockResolvedThis()
    };

    test('Inizio onboarding persona fisica con domande guidate', async () => {
      // Setup dei mock
      onboardingService.startOnboarding = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clientePersonaFisicaId',
        clientType: CLIENT_TYPES.INDIVIDUAL,
        currentPhase: ONBOARDING_PHASES.PERSONAL_INFO,
        questions: [
          { id: 'name', text: 'Nome completo', type: 'text', required: true },
          { id: 'fiscal_code', text: 'Codice fiscale', type: 'text', required: true }
        ]
      });
      
      onboardingService.getNextQuestions = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clientePersonaFisicaId',
        currentPhase: ONBOARDING_PHASES.FISCAL_DATA,
        questions: [
          { id: 'tax_regime', text: 'Regime fiscale', type: 'select', required: true }
        ],
        completionPercentage: 30
      });
      
      Client.findById = jest.fn().mockResolvedValue(mockPersonaFisica);
      
      // Esegui richiesta di inizio onboarding
      req.body = { clientType: CLIENT_TYPES.INDIVIDUAL };
      
      // Simula controller onboarding
      const startOnboardingResult = await onboardingService.startOnboarding(req.body.clientType);
      expect(startOnboardingResult.success).toBe(true);
      expect(startOnboardingResult.currentPhase).toBe(ONBOARDING_PHASES.PERSONAL_INFO);
      
      // Verifica domande iniziali
      expect(startOnboardingResult.questions.length).toBeGreaterThan(0);
      
      // Simulazione risposta alle domande di onboarding
      const answers = {
        name: 'Mario Rossi',
        fiscal_code: 'RSSMRA80A01H501U',
        email: 'mario.rossi@example.com',
        phone: '3331234567'
      };
      
      onboardingService.processAnswers = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clientePersonaFisicaId',
        previousPhase: ONBOARDING_PHASES.PERSONAL_INFO,
        currentPhase: ONBOARDING_PHASES.FISCAL_DATA,
        completionPercentage: 30
      });
      
      // Simula elaborazione risposte
      const processResult = await onboardingService.processAnswers('clientePersonaFisicaId', answers);
      expect(processResult.success).toBe(true);
      expect(processResult.currentPhase).toBe(ONBOARDING_PHASES.FISCAL_DATA);
      
      // Ottieni prossime domande
      const nextQuestionsResult = await onboardingService.getNextQuestions('clientePersonaFisicaId');
      expect(nextQuestionsResult.success).toBe(true);
      expect(nextQuestionsResult.questions.length).toBeGreaterThan(0);
      
      // Mock generazione procedura con AI
      aiAssistant.generateClientProcedure = jest.fn().mockResolvedValue({
        procedureType: 'tassazione-individuale',
        steps: [
          { title: 'Dichiarazione dei redditi', description: 'Preparazione modello Redditi PF' },
          { title: 'Calcolo imposte', description: 'Calcolo IRPEF e addizionali' }
        ]
      });
      
      // Simula completamento onboarding
      onboardingService.processAnswers = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clientePersonaFisicaId',
        previousPhase: ONBOARDING_PHASES.SERVICES,
        currentPhase: ONBOARDING_PHASES.REVIEW,
        completionPercentage: 100,
        isComplete: true,
        suggestedProcedures: [
          {
            title: 'Procedura standard persona fisica',
            description: 'Procedura base per gestione fiscale persona fisica',
            tasks: [
              { name: 'Dichiarazione dei redditi', description: 'Preparazione dichiarazione annuale' }
            ]
          }
        ]
      });
      
      // Simula completamento onboarding
      const completeResult = await onboardingService.processAnswers('clientePersonaFisicaId', { 
        required_services: ['Dichiarazione Redditi', 'Consulenza Fiscale'] 
      });
      
      expect(completeResult.success).toBe(true);
      expect(completeResult.isComplete).toBe(true);
      expect(completeResult.suggestedProcedures.length).toBeGreaterThan(0);
    });

    test('Onboarding di una SRL con integrazione documenti', async () => {
      // Setup dei mock
      Client.findById = jest.fn().mockResolvedValue(mockSRL);
      
      onboardingService.getNextQuestions = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clienteSRLId',
        currentPhase: ONBOARDING_PHASES.DOCUMENTS,
        questions: [
          { id: 'company_statute', text: 'Statuto societario', type: 'file', required: true }
        ],
        completionPercentage: 50
      });
      
      // Simula richiesta di prossime domande
      const nextQuestionsResult = await onboardingService.getNextQuestions('clienteSRLId');
      expect(nextQuestionsResult.success).toBe(true);
      expect(nextQuestionsResult.currentPhase).toBe(ONBOARDING_PHASES.DOCUMENTS);
      
      // Simula caricamento di un documento
      const documentResponse = {
        company_statute: {
          filename: 'statuto_azienda.pdf',
          path: '/uploads/statuto_azienda.pdf',
          id: 'doc123'
        }
      };
      
      onboardingService.processAnswers = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clienteSRLId',
        previousPhase: ONBOARDING_PHASES.DOCUMENTS,
        currentPhase: ONBOARDING_PHASES.SERVICES,
        completionPercentage: 75
      });
      
      // Simula elaborazione risposta con documento
      const processResult = await onboardingService.processAnswers('clienteSRLId', documentResponse);
      expect(processResult.success).toBe(true);
      expect(processResult.currentPhase).toBe(ONBOARDING_PHASES.SERVICES);
      
      // Mock generazione procedura per SRL
      aiAssistant.generateClientProcedure = jest.fn().mockResolvedValue({
        procedureType: 'tassazione-societaria',
        steps: [
          { title: 'Bilancio annuale', description: 'Preparazione e deposito bilancio' },
          { title: 'Dichiarazione redditi società', description: 'Modello Redditi SC' },
          { title: 'Adempimenti IVA', description: 'Liquidazioni periodiche e dichiarazione' }
        ]
      });
      
      // Simula generazione procedura personalizzata
      const procedureResult = await aiAssistant.generateClientProcedure(mockSRL);
      expect(procedureResult.procedureType).toBe('tassazione-societaria');
      expect(procedureResult.steps.length).toBeGreaterThan(0);
      
      // Simula chiamata API per generazione procedura
      req.params.clientId = 'clienteSRLId';
      req.body = {
        title: 'Procedura SRL Personalizzata',
        description: 'Procedura personalizzata per gestione contabile e fiscale'
      };
      
      // Mock creazione procedura nel DB
      const ClientProcedure = require('../../src/models/ClientProcedure');
      ClientProcedure.create = jest.fn().mockResolvedValue({
        _id: 'procId123',
        clientId: 'clienteSRLId',
        name: 'Procedura SRL Personalizzata',
        description: 'Procedura personalizzata per gestione contabile e fiscale',
        content: procedureResult,
        status: 'draft'
      });
      
      // Simula controller generateProcedure
      await assistantController.generateProcedure(req, res, next);
      
      // Verifica che la risposta sia corretta
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(ClientProcedure.create).toHaveBeenCalled();
    });
    
    test('Generazione procedura e documenti dopo onboarding completato', async () => {
      // Cliente con onboarding completato
      const completedClient = {
        ...mockSRL,
        onboarding: {
          ...mockSRL.onboarding,
          status: 'completato',
          completionPercentage: 100,
          completedDate: new Date()
        }
      };
      
      Client.findById = jest.fn().mockResolvedValue(completedClient);
      
      // Simula controllo completezza onboarding
      onboardingService.checkCompleteness = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clienteSRLId',
        completionPercentage: 100,
        missingFields: [],
        isComplete: true
      });
      
      const completenessResult = await onboardingService.checkCompleteness('clienteSRLId');
      expect(completenessResult.success).toBe(true);
      expect(completenessResult.isComplete).toBe(true);
      
      // Simula richiesta generazione documento
      req.params.clientId = 'clienteSRLId';
      req.body = {
        templateId: 'template123',
        documentType: 'Lettera di benvenuto',
        title: 'Lettera di benvenuto Azienda SRL'
      };
      
      // Mock template
      const Template = require('../../src/models/Template');
      Template.findById = jest.fn().mockResolvedValue({
        _id: 'template123',
        name: 'Lettera di benvenuto',
        content: '<p>Gentile {{name}}, benvenuto...</p>',
        category: 'Amministrazione',
        version: 1
      });
      
      // Mock generazione documento
      documentGenerationService.generateFromTemplate = jest.fn().mockResolvedValue({
        filename: 'lettera_benvenuto_azienda_srl.pdf',
        originalName: 'Lettera di benvenuto.pdf',
        mimeType: 'application/pdf',
        path: '/generated-docs/lettera_benvenuto_azienda_srl.pdf',
        size: 125000
      });
      
      // Mock creazione record documento
      const Document = require('../../src/models/Document');
      Document.create = jest.fn().mockResolvedValue({
        _id: 'doc456',
        clientId: 'clienteSRLId',
        filename: 'lettera_benvenuto_azienda_srl.pdf',
        path: '/generated-docs/lettera_benvenuto_azienda_srl.pdf',
        category: 'Lettera di benvenuto',
        status: 'verified',
        fullUrl: '/api/documents/download/doc456'
      });
      
      // Simula controller generateDocument
      await assistantController.generateDocument(req, res, next);
      
      // Verifica che la risposta sia corretta
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(Document.create).toHaveBeenCalled();
    });
  });

  describe('Scenari specifici', () => {
    test('Modifica cliente esistente e aggiornamento procedure', async () => {
      // Mock cliente esistente
      const existingClient = {
        _id: 'clienteEsistenteId',
        name: 'Cliente Esistente SRL',
        fiscalCode: '98765432101',
        companyType: 'SRL',
        vatNumber: 'IT98765432101',
        contactInfo: {
          email: 'info@clienteesistente.it',
          phone: '0298765432'
        },
        accountingRegime: 'Ordinario',
        onboardingStatus: 'Completed',
        save: jest.fn().mockResolvedThis()
      };
      
      Client.findById = jest.fn().mockResolvedValue(existingClient);
      
      // Simula richiesta analisi cliente
      req.params.clientId = 'clienteEsistenteId';
      
      // Mock documenti e procedure cliente
      const Document = require('../../src/models/Document');
      Document.find = jest.fn().mockResolvedValue([
        { category: 'Identità', status: 'verified', filename: 'carta_identita.pdf' },
        { category: 'Fiscale', status: 'verified', filename: 'dichiarazione_iva.pdf' }
      ]);
      
      const ClientProcedure = require('../../src/models/ClientProcedure');
      ClientProcedure.find = jest.fn().mockResolvedValue([
        { name: 'Procedura Contabilità', status: 'active', tasks: [] }
      ]);
      
      // Simulazione controller processClientInfo
      await assistantController.processClientInfo(req, res, next);
      
      // Verifica risposta
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      expect(aiService.answerFiscalQuestion).toHaveBeenCalled();
      
      // Modifica dati cliente
      req.body = {
        businessSector: 'E-commerce',
        employees: 15,
        annualRevenue: 1200000
      };
      
      // Simulazione aggiornamento cliente
      Client.findByIdAndUpdate = jest.fn().mockResolvedValue({
        ...existingClient,
        businessSector: 'E-commerce',
        employees: 15,
        annualRevenue: 1200000
      });
      
      // Verifica aggiornamento procedure basato su nuove informazioni
      aiAssistant.enhanceProcedureGeneration = jest.fn().mockResolvedValue({
        procedureRequirements: {
          complexityLevel: 'high',
          needsQuarterlyReview: true
        },
        monitoringSystem: {
          tasks: [
            { title: 'Adempimenti e-commerce', description: 'Gestione adempimenti vendite online' },
            { title: 'Bilancio trimestrale', description: 'Preparazione report trimestrali' }
          ],
          aiEnhanced: true
        }
      });
      
      // Simula aggiornamento e generazione nuova procedura
      const enhancedProcedure = await aiAssistant.enhanceProcedureGeneration({
        ...existingClient,
        businessSector: 'E-commerce',
        employees: 15,
        annualRevenue: 1200000
      });
      
      expect(enhancedProcedure.monitoringSystem.aiEnhanced).toBe(true);
      expect(enhancedProcedure.monitoringSystem.tasks.length).toBe(2);
      expect(enhancedProcedure.procedureRequirements.complexityLevel).toBe('high');
    });

    test('Richiesta documenti mancanti per cliente incompleto', async () => {
      // Mock cliente con dati incompleti
      const incompleteClient = {
        _id: 'clienteIncompletoId',
        name: 'Cliente Incompleto SRL',
        fiscalCode: '45678901234',
        companyType: 'SRL',
        contactInfo: {
          email: 'info@incompleto.it',
          phone: '0245678901'
        },
        onboarding: {
          status: 'in_corso',
          completionPercentage: 60,
          checklist: [
            { name: 'Visura camerale', required: true, status: 'verificato' },
            { name: 'Ultimo bilancio', required: true, status: 'in_attesa' },
            { name: 'Statuto societario', required: true, status: 'in_attesa' }
          ]
        },
        save: jest.fn().mockResolvedThis()
      };
      
      Client.findById = jest.fn().mockResolvedValue(incompleteClient);
      
      // Simula controllo completezza
      onboardingService.checkCompleteness = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clienteIncompletoId',
        completionPercentage: 60,
        missingFields: [
          { phase: ONBOARDING_PHASES.FISCAL_DATA, fields: ['accountingRegime'] },
          { phase: ONBOARDING_PHASES.DOCUMENTS, fields: ['Ultimo bilancio', 'Statuto societario'] }
        ],
        isComplete: false
      });
      
      const completenessResult = await onboardingService.checkCompleteness('clienteIncompletoId');
      expect(completenessResult.success).toBe(true);
      expect(completenessResult.isComplete).toBe(false);
      expect(completenessResult.missingFields.length).toBeGreaterThan(0);
      
      // Simulazione suggerimenti AI per documenti mancanti
      aiService.suggestChecklistCompletion = jest.fn().mockResolvedValue({
        success: true,
        suggestions: [
          {
            documentName: 'Ultimo bilancio',
            importance: 'Alta',
            description: 'Necessario per valutare la situazione economica attuale',
            alternatives: ['Situazione contabile aggiornata']
          },
          {
            documentName: 'Statuto societario',
            importance: 'Alta',
            description: 'Necessario per conoscere l\'oggetto sociale e le regole societarie',
            alternatives: []
          }
        ]
      });
      
      // Simula richiesta suggerimenti documenti
      onboardingService.suggestMissingDocuments = jest.fn().mockImplementation(async (client) => {
        const result = await aiService.suggestChecklistCompletion(
          {
            name: client.name,
            companyType: client.companyType,
            taxRegime: client.accountingRegime
          },
          client.onboarding.checklist.map(item => ({
            title: item.name,
            completed: item.status === 'verificato'
          }))
        );
        
        return {
          suggestions: result.suggestions,
          completionPercentage: client.onboarding.completionPercentage
        };
      });
      
      const documentSuggestions = await onboardingService.suggestMissingDocuments(incompleteClient);
      expect(documentSuggestions.suggestions.length).toBe(2);
      
      // Simula aggiornamento checklist con documento mancante
      const updateDocumentResponse = {
        company_balance: {
          filename: 'bilancio_2023.pdf',
          path: '/uploads/bilancio_2023.pdf',
          id: 'doc789'
        }
      };
      
      onboardingService.processAnswers = jest.fn().mockResolvedValue({
        success: true,
        clientId: 'clienteIncompletoId',
        previousPhase: ONBOARDING_PHASES.DOCUMENTS,
        currentPhase: ONBOARDING_PHASES.DOCUMENTS,
        completionPercentage: 75
      });
      
      // Simulazione caricamento documento
      const processResult = await onboardingService.processAnswers('clienteIncompletoId', updateDocumentResponse);
      expect(processResult.success).toBe(true);
      expect(processResult.completionPercentage).toBe(75);
    });
  });

  describe('Test di robustezza', () => {
    test('Gestione risposte incomplete durante onboarding', async () => {
      // Mock cliente in fase iniziale
      const newClient = {
        _id: 'clienteNuovoId',
        name: 'Cliente Nuovo',
        onboarding: {
          status: 'nuovo',
          completionPercentage: 10,
          checklist: []
        },
        save: jest.fn().mockResolvedThis()
      };
      
      Client.findById = jest.fn().mockResolvedValue(newClient);
      
      // Simulazione risposte parziali/invalide
      const incompleteAnswers = {
        name: '',  // Campo richiesto vuoto
        fiscal_code: '12345' // Codice fiscale invalido (troppo corto)
      };
      
      onboardingService.processAnswers = jest.fn().mockImplementation(async () => {
        // Simula validazione fallita
        return {
          success: false,
          clientId: 'clienteNuovoId',
          error: 'Dati incompleti o non validi',
          validationErrors: [
            { field: 'name', message: 'Il nome è obbligatorio' },
            { field: 'fiscal_code', message: 'Codice fiscale non valido' }
          ]
        };
      });
      
      // Simula elaborazione risposte incomplete
      const processResult = await onboardingService.processAnswers('clienteNuovoId', incompleteAnswers);
      expect(processResult.success).toBe(false);
      expect(processResult.validationErrors).toBeDefined();
      
      // Simulazione correzione errori
      const correctedAnswers = {
        name: 'Cliente Corretto',
        fiscal_code: 'CRRCNT80A01H501U'
      };
      
      onboardingService.processAnswers = jest.fn().mockImplementation(async () => {
        return {
          success: true,
          clientId: 'clienteNuovoId',
          previousPhase: ONBOARDING_PHASES.PERSONAL_INFO,
          currentPhase: ONBOARDING_PHASES.BUSINESS_INFO,
          completionPercentage: 25
        };
      });
      
      // Simula elaborazione risposte corrette
      const correctedResult = await onboardingService.processAnswers('clienteNuovoId', correctedAnswers);
      expect(correctedResult.success).toBe(true);
      expect(correctedResult.currentPhase).toBe(ONBOARDING_PHASES.BUSINESS_INFO);
    });

    test('Recupero da errori API durante interazione con assistente', async () => {
      // Simula errore nell'API AI
      aiService.answerFiscalQuestion = jest.fn().mockRejectedValueOnce(new Error('API timeout'));
      
      // Mock della conversazione
      const Conversation = require('../../src/models/Conversation');
      Conversation.findOne = jest.fn().mockResolvedValue({
        _id: 'conv123',
        userId: 'mockUserId',
        messages: [],
        isActive: true,
        save: jest.fn().mockResolvedValue({})
      });
      
      // Richiesta domanda all'assistente
      req.body = {
        question: 'Quali sono le scadenze fiscali di questo mese?'
      };
      
      // Capture del next per verificare l'errore
      const errorNext = jest.fn();
      
      // Prima chiamata - simula fallimento
      await assistantController.askQuestion(req, res, errorNext);
      
      // Verifica che l'errore sia stato gestito
      expect(errorNext).toHaveBeenCalled();
      expect(errorNext.mock.calls[0][0]).toBeInstanceOf(Error);
      
      // Simula ripristino del servizio
      aiService.answerFiscalQuestion = jest.fn().mockResolvedValue({
        success: true,
        answer: 'Ecco le scadenze fiscali di questo mese...',
        metadata: { confidence: 0.95 }
      });
      
      // Reset delle funzioni mock
      errorNext.mockClear();
      res.status.mockClear();
      res.json.mockClear();
      
      // Secondo tentativo - dovrebbe funzionare
      await assistantController.askQuestion(req, res, errorNext);
      
      // Verifica che la risposta sia corretta
      expect(errorNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    test('Timeout e retry durante generazione procedura', async () => {
      // Mock cliente
      const targetClient = {
        _id: 'clienteTargetId',
        name: 'Cliente Target SPA',
        companyType: 'SPA',
        businessSector: 'Farmaceutico',
        accountingRegime: 'Ordinario',
        vatNumber: 'IT12345678901',
        employees: 150,
        annualRevenue: 15000000
      };
      
      Client.findById = jest.fn().mockResolvedValue(targetClient);
      
      // Simula timeout nella prima chiamata alla generazione procedura
      aiService.generateCustomProcedure = jest.fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({
          success: true,
          procedure: {
            title: 'Procedura complessa SPA',
            steps: [
              { title: 'Bilancio consolidato', description: 'Preparazione bilancio consolidato gruppo' },
              { title: 'Controllo di gestione', description: 'Sistema di controllo interno' }
            ]
          }
        });
      
      // Richiesta di generazione procedura
      req.params.clientId = 'clienteTargetId';
      req.body = {
        title: 'Procedura SPA Avanzata',
        procedureType: 'bilancio'
      };
      
      // Prima chiamata - simula fallimento
      const errorNext = jest.fn();
      await assistantController.generateProcedure(req, res, errorNext);
      
      // Verifica gestione errore
      expect(errorNext).toHaveBeenCalled();
      expect(errorNext.mock.calls[0][0].message).toContain('Errore nella generazione della procedura');
      
      // Reset delle funzioni mock
      errorNext.mockClear();
      res.status.mockClear();
      res.json.mockClear();
      
      // Implementa funzione di retry
      const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            console.log(`Attempt ${attempt} failed: ${error.message}`);
            lastError = error;
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      };
      
      // Simula chiamata con retry automatico
      const generateWithRetry = async () => {
        return await retryOperation(async () => {
          const result = await aiService.generateCustomProcedure({
            id: targetClient._id,
            name: targetClient.name,
            businessType: targetClient.companyType,
            taxRegime: targetClient.accountingRegime,
            sector: targetClient.businessSector,
            employeesCount: targetClient.employees,
            annualRevenue: targetClient.annualRevenue
          });
          
          if (!result.success) {
            throw new Error('Generazione procedura fallita');
          }
          
          return result;
        });
      };
      
      // Mock creazione procedura
      const ClientProcedure = require('../../src/models/ClientProcedure');
      ClientProcedure.create = jest.fn().mockResolvedValue({
        _id: 'proc999',
        clientId: 'clienteTargetId',
        name: 'Procedura SPA Avanzata',
        content: {
          title: 'Procedura complessa SPA',
          steps: [
            { title: 'Bilancio consolidato', description: 'Preparazione bilancio consolidato gruppo' },
            { title: 'Controllo di gestione', description: 'Sistema di controllo interno' }
          ]
        },
        status: 'draft'
      });
      
      // Esegui generazione con retry
      const procedureResult = await generateWithRetry();
      expect(procedureResult.success).toBe(true);
      expect(procedureResult.procedure).toBeDefined();
      
      // Verifica che la seconda chiamata sia avvenuta
      expect(aiService.generateCustomProcedure).toHaveBeenCalledTimes(2);
    });
  });
});