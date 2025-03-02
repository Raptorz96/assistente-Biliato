const aiAssistant = require('../../src/services/aiAssistant');

// Mock delle dipendenze esterne
jest.mock('../../src/services/validationService', () => ({
  validateClient: jest.fn(() => ({
    valid: true,
    dataCompleteness: 70,
    missingInformation: ['Partita IVA', 'Fatturato Annuale']
  }))
}));

// Mock del procedureGenerator
jest.mock('../../src/services/procedureGenerator', () => ({
  generateOperationalProcedure: jest.fn(() => ({
    procedureRequirements: {
      procedureType: 'standard',
      complexityLevel: 'medium',
      needsQuarterlyReview: true
    },
    monitoringSystem: {
      clientId: 'client123',
      name: 'Procedura Test',
      tasks: [
        {
          id: 'task-1',
          title: 'Raccolta Documentazione Contabile',
          description: 'Raccolta e organizzazione di tutti i documenti contabili del periodo',
          priority: 'high',
          status: 'pending',
          progress: 0,
          tags: ['contabilità', 'documentazione'],
          dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15)
        },
        {
          id: 'task-2',
          title: 'Liquidazione IVA',
          description: 'Calcolo dell\'IVA a debito/credito e preparazione F24 per versamento',
          priority: 'medium',
          status: 'pending',
          progress: 0,
          tags: ['fiscale', 'iva'],
          dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 16)
        }
      ],
      summary: {
        totalTasks: 2,
        completedTasks: 0,
        pendingTasks: 2,
        highPriorityTasks: 1
      }
    }
  }))
}));

describe('AI Assistant Service', () => {
  describe('generateClientQuestions', () => {
    test('dovrebbe generare domande per campi mancanti', async () => {
      const client = {
        name: 'Test Client',
        companyType: 'LLC'
      };
      
      const missingFields = ['Partita IVA', 'Fatturato Annuale'];
      
      const questions = await aiAssistant.generateClientQuestions(client, missingFields);
      
      // Verifica che ci siano domande generate
      expect(questions.length).toBeGreaterThan(0);
      
      // Verifica che ci sia una domanda per ogni campo mancante
      const partitaIVAQuestion = questions.find(q => q.field === 'partita iva' || q.field === 'partitaiva');
      const fatturatoQuestion = questions.find(q => q.field === 'fatturato annuale' || q.field === 'fatturatoannuale');
      
      expect(partitaIVAQuestion).toBeDefined();
      expect(fatturatoQuestion).toBeDefined();
      
      // Verifica che le domande siano stringhe non vuote
      expect(typeof partitaIVAQuestion.question).toBe('string');
      expect(partitaIVAQuestion.question.length).toBeGreaterThan(0);
    });

    test('dovrebbe personalizzare le domande in base al tipo di azienda', async () => {
      const llcClient = {
        name: 'Test LLC',
        companyType: 'LLC'
      };
      
      const individualClient = {
        name: 'Test Individual',
        companyType: 'Individual'
      };
      
      const missingFields = ['Fatturato Annuale'];
      
      const llcQuestions = await aiAssistant.generateClientQuestions(llcClient, missingFields);
      const individualQuestions = await aiAssistant.generateClientQuestions(individualClient, missingFields);
      
      const llcFatturatoQuestion = llcQuestions.find(q => q.field === 'fatturato annuale' || q.field === 'fatturatoannuale');
      const individualFatturatoQuestion = individualQuestions.find(q => q.field === 'fatturato annuale' || q.field === 'fatturatoannuale');
      
      // Le domande dovrebbero essere diverse per tipi diversi di azienda
      expect(llcFatturatoQuestion.question).not.toEqual(individualFatturatoQuestion.question);
    });

    test('dovrebbe aggiungere domande di contesto se mancano molti campi', async () => {
      const client = {
        name: 'Test Client'
      };
      
      const missingFields = ['Codice Fiscale', 'Email', 'Telefono', 'Indirizzo', 'Città', 'Provincia'];
      
      const questions = await aiAssistant.generateClientQuestions(client, missingFields);
      
      // Cerca domande contestuali
      const contextualQuestion = questions.find(q => q.contextual === true);
      
      // Dovrebbe esserci almeno una domanda contestuale
      expect(contextualQuestion).toBeDefined();
    });
  });

  describe('analyzeDocuments', () => {
    test('dovrebbe analizzare i documenti e restituire dati estratti', async () => {
      const documentPaths = ['/path/to/doc1.pdf', '/path/to/doc2.pdf'];
      
      const result = await aiAssistant.analyzeDocuments(documentPaths);
      
      // Verifica che il risultato contenga i dati estratti e raccomandazioni
      expect(result).toHaveProperty('analyzedData');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('generateClientProcedure', () => {
    test('dovrebbe generare procedure specifiche per il tipo di cliente', async () => {
      const individualClient = {
        name: 'Test Individual',
        companyType: 'Individual'
      };
      
      const corporationClient = {
        name: 'Test Corporation',
        companyType: 'Corporation'
      };
      
      const individualProcedure = await aiAssistant.generateClientProcedure(individualClient);
      const corporationProcedure = await aiAssistant.generateClientProcedure(corporationClient);
      
      // Verifica che le procedure siano generate correttamente
      expect(individualProcedure).toHaveProperty('procedureType', 'tassazione-individuale');
      expect(corporationProcedure).toHaveProperty('procedureType', 'tassazione-societaria');
      
      // Verifica che ci siano passaggi nella procedura
      expect(Array.isArray(individualProcedure.steps)).toBe(true);
      expect(individualProcedure.steps.length).toBeGreaterThan(0);
    });
  });

  describe('answerQuestion', () => {
    test('dovrebbe rispondere alle domande degli operatori', async () => {
      const question = 'Qual è la scadenza per il pagamento IVA?';
      const clientContext = { name: 'Test Client', companyType: 'LLC' };
      
      const answer = await aiAssistant.answerQuestion(question, clientContext);
      
      // Verifica che la risposta abbia la struttura corretta
      expect(answer).toHaveProperty('answer');
      expect(typeof answer.answer).toBe('string');
      expect(answer).toHaveProperty('sources');
      expect(Array.isArray(answer.sources)).toBe(true);
      expect(answer).toHaveProperty('confidence');
    });

    test('dovrebbe funzionare anche senza contesto cliente', async () => {
      const question = 'Qual è la scadenza per il pagamento IVA?';
      
      const answer = await aiAssistant.answerQuestion(question);
      
      // Verifica che la risposta abbia la struttura corretta anche senza contesto
      expect(answer).toHaveProperty('answer');
      expect(typeof answer.answer).toBe('string');
    });
  });
  
  describe('Integrazione con ProcedureGenerator', () => {
    const testClient = {
      _id: 'client123',
      name: 'Test Client',
      companyType: 'LLC',
      businessSector: 'E-commerce',
      accountingRegime: 'Ordinario',
      annualRevenue: 600000,
      employees: 12,
      foundingDate: new Date(new Date().getFullYear() - 2, 1, 1),
      vatNumber: 'IT12345678901'
    };
    
    test('dovrebbe personalizzare le attività in base al contesto del cliente', async () => {
      // Mock della procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Liquidazione IVA',
              description: 'Calcolo dell\'IVA a debito/credito',
              priority: 'high'
            }
          ]
        }
      };
      
      // Client con regime forfettario
      const forfettarioClient = {
        ...testClient,
        accountingRegime: 'Forfettario'
      };
      
      const result = await aiAssistant.personalizeTasksByClientContext(procedure, forfettarioClient);
      
      // Verifica che la descrizione sia stata personalizzata per il regime forfettario
      expect(result.monitoringSystem.tasks[0].description).toContain('forfettario');
    });
    
    test('dovrebbe suggerire attività aggiuntive basate su best practice', async () => {
      // Mock della procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Task base',
              description: 'Descrizione base',
              priority: 'medium'
            }
          ],
          summary: {
            totalTasks: 1,
            pendingTasks: 1
          }
        }
      };
      
      // Client e-commerce
      const ecommerceClient = {
        ...testClient,
        businessSector: 'E-commerce'
      };
      
      const result = await aiAssistant.suggestAdditionalTasks(procedure, ecommerceClient);
      
      // Verifica che siano state aggiunte attività
      expect(result.monitoringSystem.tasks.length).toBeGreaterThan(1);
      expect(result.monitoringSystem.summary.totalTasks).toBeGreaterThan(1);
      
      // Verifica che ci sia almeno un'attività specifica per e-commerce
      const hasEcommerceTask = result.monitoringSystem.tasks.some(task => 
        task.title.includes('E-commerce') || 
        task.tags.some(tag => tag.includes('ecommerce'))
      );
      
      expect(hasEcommerceTask).toBeTruthy();
    });
    
    test('dovrebbe ottimizzare priorità e scadenze in base al contesto cliente', async () => {
      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const daysToEndOfYear = Math.floor((endOfYear - today) / (1000 * 60 * 60 * 24));
      
      // Mock della procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Attività Fiscale',
              description: 'Descrizione attività fiscale',
              priority: 'medium',
              tags: ['fiscale'],
              dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 15)
            }
          ]
        }
      };
      
      const result = await aiAssistant.optimizePrioritiesAndDeadlines(procedure, testClient);
      
      // Se siamo vicini alla fine dell'anno, la priorità dovrebbe essere aumentata
      if (daysToEndOfYear < 60) {
        expect(result.monitoringSystem.tasks[0].priority).toBe('high');
      }
      
      // Verifica che le attività siano state ordinate
      expect(Array.isArray(result.monitoringSystem.tasks)).toBeTruthy();
    });
    
    test('dovrebbe generare descrizioni dettagliate per le attività', async () => {
      // Mock della procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Raccolta Documentazione Contabile',
              description: 'Descrizione base',
              priority: 'high'
            }
          ]
        }
      };
      
      const result = await aiAssistant.generateDetailedTaskDescriptions(procedure, testClient);
      
      // Verifica che sia stata aggiunta una descrizione dettagliata
      expect(result.monitoringSystem.tasks[0]).toHaveProperty('detailedDescription');
      expect(result.monitoringSystem.tasks[0].detailedDescription.length).toBeGreaterThan(
        result.monitoringSystem.tasks[0].description.length
      );
    });
    
    test('dovrebbe integrare tutte le funzionalità per generare una procedura ottimizzata', async () => {
      const result = await aiAssistant.enhanceProcedureGeneration(testClient);
      
      // Verifica che la procedura sia stata marcata come elaborata dall'AI
      expect(result.monitoringSystem).toHaveProperty('aiEnhanced', true);
      expect(result.monitoringSystem).toHaveProperty('enhancementDate');
      
      // Verifica che almeno un'attività abbia una descrizione dettagliata
      const hasDetailedDescription = result.monitoringSystem.tasks.some(task => 
        task.hasOwnProperty('detailedDescription')
      );
      
      expect(hasDetailedDescription).toBeTruthy();
    });
  });
});