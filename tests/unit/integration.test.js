const mongoose = require('mongoose');
const Client = require('../../src/models/Client');
const validationService = require('../../src/services/validationService');
const aiAssistant = require('../../src/services/aiAssistant');
const clientController = require('../../src/controllers/clientController');

// Mock delle dipendenze
jest.mock('mongoose');
jest.mock('../../src/models/Client');

describe('Integrazione Modulo Cliente', () => {
  let req, res;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      params: { id: 'mockClientId' },
      body: {},
      query: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  // Mock di aiAssistant.enhanceProcedureGeneration per i test di integrazione
  aiAssistant.enhanceProcedureGeneration = jest.fn().mockImplementation(async (client) => {
    return {
      procedureRequirements: {
        procedureType: client.companyType === 'Individual' ? 'individual' : 'corporation',
        complexityLevel: client.annualRevenue > 1000000 ? 'high' : 'medium',
        needsQuarterlyReview: client.annualRevenue > 300000
      },
      monitoringSystem: {
        clientId: client._id,
        name: `Procedura Operativa: ${client.name}`,
        procedureId: `proc-${Date.now()}-${client._id.substring(0, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        completionPercentage: 0,
        status: 'active',
        aiEnhanced: true,
        enhancementDate: new Date().toISOString(),
        tasks: [
          {
            id: `task-${Date.now()}-1`,
            title: 'Raccolta Documentazione Contabile',
            description: 'Raccolta e organizzazione di tutti i documenti contabili del periodo',
            detailedDescription: 'Descrizione dettagliata generata dall\'AI',
            priority: 'high',
            status: 'pending',
            progress: 0,
            dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15),
            tags: ['contabilità', 'documentazione'],
            statusHistory: [{
              status: 'pending',
              timestamp: new Date(),
              note: 'Attività creata automaticamente',
              updatedBy: 'system'
            }]
          },
          {
            id: `task-${Date.now()}-2`,
            title: client.accountingRegime === 'Forfettario' ? 
              'Aggiornamento Registro dei Corrispettivi' : 
              'Liquidazione IVA',
            description: client.accountingRegime === 'Forfettario' ?
              'Aggiornamento del registro cronologico per regime forfettario' :
              'Calcolo dell\'IVA a debito/credito e preparazione F24',
            detailedDescription: 'Descrizione dettagliata generata dall\'AI',
            priority: 'medium',
            status: 'pending',
            progress: 0,
            dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 16),
            tags: client.accountingRegime === 'Forfettario' ? 
              ['contabilità', 'forfettario'] : 
              ['fiscale', 'iva'],
            statusHistory: [{
              status: 'pending',
              timestamp: new Date(),
              note: 'Attività creata automaticamente',
              updatedBy: 'system'
            }]
          }
        ],
        summary: {
          totalTasks: 2,
          completedTasks: 0,
          pendingTasks: 2,
          highPriorityTasks: 1
        }
      }
    };
  });
  
  test('Flusso di creazione ed aggiornamento cliente', async () => {
    // 1. Creazione cliente con dati parziali
    const clientData = {
      name: 'Nuovo Cliente SRL',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'nuovo@example.com',
      companyType: 'LLC'
    };
    
    req.body = clientData;
    
    // Mock del client salvato
    const savedClient = {
      _id: 'newClientId',
      ...clientData,
      onboardingStatus: 'In Progress',
      dataCompleteness: 30,
      missingInformation: ['Telefono', 'Indirizzo', 'Partita IVA']
    };
    
    // Mocks per validazione
    const validationResults = {
      valid: true,
      dataCompleteness: 30,
      missingInformation: ['Telefono', 'Indirizzo', 'Partita IVA'],
      suggestions: [
        { field: 'phone', message: 'Completa il campo Telefono' },
        { field: 'address', message: 'Completa l\'indirizzo' },
        { field: 'vatNumber', message: 'La partita IVA è importante per la corretta gestione fiscale' }
      ]
    };
    
    Client.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(savedClient)
    }));
    
    validationService.validateClient.mockReturnValue(validationResults);
    
    // Esecuzione creazione cliente
    await clientController.createClient(req, res);
    
    // Verifica creazione
    expect(Client).toHaveBeenCalledWith(clientData);
    expect(validationService.validateClient).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    
    // Salviamo l'ID del cliente creato per il prossimo passo
    const newClientId = res.json.mock.calls[0][0].client._id;
    
    // 2. Richiesta di domande per completare le informazioni
    req.params.id = newClientId;
    
    // Mock per le domande generate
    const generatedQuestions = [
      { field: 'phone', question: 'Qual è il numero di telefono?' },
      { field: 'address', question: 'Qual è l\'indirizzo completo della sede legale?' },
      { field: 'vatNumber', question: 'Qual è il numero di Partita IVA?' }
    ];
    
    Client.findById = jest.fn().mockResolvedValue(savedClient);
    aiAssistant.generateClientQuestions.mockResolvedValue(generatedQuestions);
    
    // Reset mocks per nuova chiamata
    res.status.mockClear();
    res.json.mockClear();
    
    // Esecuzione generazione domande
    await clientController.getClientQuestions(req, res);
    
    // Verifica generazione domande
    expect(Client.findById).toHaveBeenCalledWith(newClientId);
    expect(validationService.validateClient).toHaveBeenCalledWith(savedClient);
    expect(aiAssistant.generateClientQuestions).toHaveBeenCalledWith(
      savedClient,
      validationResults.missingInformation
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].questions).toEqual(generatedQuestions);
    
    // 3. Aggiornamento con dati completi
    const updateData = {
      phone: '0123456789',
      address: {
        street: 'Via Roma 123',
        city: 'Milano',
        province: 'MI',
        postalCode: '20100'
      },
      vatNumber: '12345678901'
    };
    
    req.body = updateData;
    
    // Mock per il cliente aggiornato
    const updatedClient = {
      ...savedClient,
      ...updateData,
      dataCompleteness: 85,
      missingInformation: [],
      lastContactDate: new Date(),
      save: jest.fn().mockResolvedValue({
        ...savedClient,
        ...updateData,
        onboardingStatus: 'Information Collected'
      })
    };
    
    // Mock per la validazione dell'aggiornamento
    const updatedValidation = {
      valid: true,
      dataCompleteness: 100,
      missingInformation: []
    };
    
    Client.findById.mockResolvedValue(savedClient);
    Client.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedClient);
    validationService.validateClient.mockReturnValue(updatedValidation);
    
    // Reset mocks per nuova chiamata
    res.status.mockClear();
    res.json.mockClear();
    
    // Esecuzione aggiornamento
    await clientController.updateClient(req, res);
    
    // Verifica aggiornamento
    expect(Client.findById).toHaveBeenCalledWith(newClientId);
    expect(Client.findByIdAndUpdate).toHaveBeenCalledWith(
      newClientId,
      { ...updateData, lastContactDate: expect.any(Date) },
      { new: true, runValidators: true }
    );
    
    expect(validationService.validateClient).toHaveBeenCalledWith(updatedClient);
    expect(updatedClient.save).toHaveBeenCalled(); // Aggiorna lo stato di onboarding
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].client).toEqual(updatedClient);
    
    // 4. Verifica stato completezza dopo aggiornamento
    req.body = {};
    
    // Reset mocks per nuova chiamata
    res.status.mockClear();
    res.json.mockClear();
    
    // Esecuzione validazione
    await clientController.validateClientData(req, res);
    
    // Verifica validazione
    expect(Client.findById).toHaveBeenCalledWith(newClientId);
    expect(validationService.validateClient).toHaveBeenCalledWith(updatedClient);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].validation).toEqual(updatedValidation);
  });
  
  test('Flusso di onboarding completo con generazione di procedura avanzata', async () => {
    // 1. Cliente già creato con tutte le informazioni
    const completeClient = {
      _id: 'completeClientId',
      name: 'Cliente Completo SRL',
      fiscalCode: 'RSTUVW12X34Y567Z',
      email: 'completo@example.com',
      companyType: 'LLC',
      phone: '9876543210',
      address: {
        street: 'Via Completa 456',
        city: 'Roma',
        province: 'RM',
        postalCode: '00100'
      },
      vatNumber: '98765432109',
      businessSector: 'Technology',
      accountingRegime: 'Ordinario',
      annualRevenue: 750000,
      employees: 8,
      foundingDate: new Date(2020, 0, 1),
      onboardingStatus: 'Information Collected',
      dataCompleteness: 100,
      missingInformation: [],
      save: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      })
    };
    
    req.params.id = 'completeClientId';
    
    // 2. Aggiornamento dello stato di onboarding a "Documents Collected"
    req.body = { status: 'Documents Collected' };
    
    Client.findById = jest.fn().mockResolvedValue(completeClient);
    
    // Esecuzione aggiornamento stato
    await clientController.updateOnboardingStatus(req, res);
    
    // Verifica
    expect(Client.findById).toHaveBeenCalledWith('completeClientId');
    expect(completeClient.save).toHaveBeenCalled();
    expect(completeClient.onboardingStatus).toBe('Documents Collected');
    expect(res.status).toHaveBeenCalledWith(200);
    
    // 3. Generazione procedura con AI avanzata
    res.status.mockClear();
    res.json.mockClear();
    
    // Simuliamo la richiesta di generazione procedura avanzata
    const generateEnhancedProcedure = async (req, res) => {
      try {
        const client = await Client.findById(req.params.id);
        if (!client) {
          return res.status(404).json({ message: 'Cliente non trovato' });
        }
        
        // Usa enhanceProcedureGeneration invece di generateClientProcedure
        const procedure = await aiAssistant.enhanceProcedureGeneration(client);
        
        // Aggiorna lo stato di onboarding
        client.onboardingStatus = 'Procedures Created';
        await client.save();
        
        res.status(200).json({ 
          clientId: client._id,
          procedure,
          onboardingStatus: client.onboardingStatus
        });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    };
    
    // Esecuzione generazione procedura avanzata
    await generateEnhancedProcedure(req, res);
    
    // Verifica
    expect(Client.findById).toHaveBeenCalledWith('completeClientId');
    expect(aiAssistant.enhanceProcedureGeneration).toHaveBeenCalledWith(completeClient);
    expect(completeClient.onboardingStatus).toBe('Procedures Created');
    expect(completeClient.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    
    // Verifica risposta
    const response = res.json.mock.calls[0][0];
    expect(response).toHaveProperty('procedure.monitoringSystem.aiEnhanced', true);
    expect(response).toHaveProperty('procedure.monitoringSystem.tasks');
    expect(Array.isArray(response.procedure.monitoringSystem.tasks)).toBe(true);
    expect(response.procedure.monitoringSystem.tasks.length).toBeGreaterThan(0);
    
    // Verifica che le attività abbiano descrizioni dettagliate generate dall'AI
    const hasTasks = response.procedure.monitoringSystem.tasks.some(task => 
      task.hasOwnProperty('detailedDescription')
    );
    expect(hasTasks).toBe(true);
    
    // 4. Simulazione di aggiornamento stato di un'attività
    res.status.mockClear();
    res.json.mockClear();
    
    // Simuliamo la richiesta di aggiornamento attività
    const updateTaskStatus = async (req, res) => {
      try {
        const { procedureId, taskId } = req.params;
        const { progress, status, note } = req.body;
        
        // Recuperiamo la procedura dal mock
        const procedure = response.procedure;
        
        // Aggiorna lo stato dell'attività
        const updateData = {
          progress: progress || 0,
          status: status || 'in_progress',
          note: note || 'Aggiornamento stato',
          updatedBy: 'user123'
        };
        
        // Usa il servizio procedureGenerator per aggiornare lo stato
        const updatedProcedure = procedureGenerator.updateTaskProgress(
          procedure, 
          procedure.monitoringSystem.tasks[0].id, 
          updateData
        );
        
        res.status(200).json({ 
          success: true,
          procedure: updatedProcedure,
          taskId: procedure.monitoringSystem.tasks[0].id
        });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    };
    
    // Prepara la richiesta
    req.params.procedureId = response.procedure.monitoringSystem.procedureId;
    req.params.taskId = response.procedure.monitoringSystem.tasks[0].id;
    req.body = {
      progress: 50,
      status: 'in_progress',
      note: 'Lavoro in corso'
    };
    
    // Simula la funzione updateTaskProgress
    procedureGenerator.updateTaskProgress = jest.fn().mockImplementation((procedure, taskId, updateData) => {
      // Creazione di una copia profonda della procedura
      const updatedProcedure = JSON.parse(JSON.stringify(procedure));
      
      // Trova il task da aggiornare
      const taskIndex = updatedProcedure.monitoringSystem.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return procedure;
      
      // Aggiorna i campi del task
      const task = updatedProcedure.monitoringSystem.tasks[taskIndex];
      task.progress = updateData.progress;
      task.status = updateData.status;
      
      // Aggiorna la storia di stato
      if (!task.statusHistory) task.statusHistory = [];
      task.statusHistory.push({
        status: updateData.status,
        timestamp: new Date().toISOString(),
        note: updateData.note,
        updatedBy: updateData.updatedBy
      });
      
      // Aggiorna il riepilogo della procedura
      updatedProcedure.monitoringSystem.completionPercentage = 25; // Simuliamo il 25% di completamento
      
      return updatedProcedure;
    });
    
    // Esecuzione aggiornamento stato attività
    await updateTaskStatus(req, res);
    
    // Verifica
    expect(procedureGenerator.updateTaskProgress).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    
    // Verifica che la risposta contenga la procedura aggiornata
    const taskUpdateResponse = res.json.mock.calls[0][0];
    expect(taskUpdateResponse).toHaveProperty('success', true);
    expect(taskUpdateResponse).toHaveProperty('procedure');
    
    // Verifica che il task sia stato aggiornato
    const updatedTask = taskUpdateResponse.procedure.monitoringSystem.tasks[0];
    expect(updatedTask.progress).toBe(50);
    expect(updatedTask.status).toBe('in_progress');
    expect(updatedTask.statusHistory).toBeDefined();
    expect(updatedTask.statusHistory.length).toBeGreaterThan(0);
    
    // Verifica che la percentuale di completamento sia stata aggiornata
    expect(taskUpdateResponse.procedure.monitoringSystem.completionPercentage).toBe(25);
    
    // 5. Completamento onboarding
    res.status.mockClear();
    res.json.mockClear();
    
    req.body = { status: 'Completed' };
    
    // Reset save mock
    completeClient.save.mockClear();
    
    // Esecuzione completamento onboarding
    await clientController.updateOnboardingStatus(req, res);
    
    // Verifica completamento
    expect(Client.findById).toHaveBeenCalledWith('completeClientId');
    expect(completeClient.onboardingStatus).toBe('Completed');
    expect(completeClient.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    
    const finalResponse = res.json.mock.calls[0][0];
    expect(finalResponse.onboardingProgress.currentStatus).toBe('Completed');
  });
});