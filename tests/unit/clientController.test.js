const clientController = require('../../src/controllers/clientController');
const Client = require('../../src/models/Client');
const validationService = require('../../src/services/validationService');
const aiAssistant = require('../../src/services/aiAssistant');

// Mock delle dipendenze
jest.mock('../../src/models/Client');
jest.mock('../../src/services/validationService');
jest.mock('../../src/services/aiAssistant');

describe('Client Controller', () => {
  let req, res;
  
  beforeEach(() => {
    // Reset delle mock
    jest.clearAllMocks();
    
    // Mock di req e res
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
  
  describe('getAllClients', () => {
    test('dovrebbe restituire la lista dei clienti con paginazione', async () => {
      // Mock dei dati ritornati dal database
      const mockClients = [
        { _id: '1', name: 'Client 1' },
        { _id: '2', name: 'Client 2' }
      ];
      
      Client.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockClients)
      });
      
      Client.countDocuments = jest.fn().mockResolvedValue(2);
      
      // Esecuzione del controller
      await clientController.getAllClients(req, res);
      
      // Verifica delle chiamate
      expect(Client.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Verifica che la risposta includa clienti e paginazione
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('clients');
      expect(response).toHaveProperty('pagination');
      expect(response.clients).toEqual(mockClients);
    });
    
    test('dovrebbe gestire i filtri di ricerca', async () => {
      // Imposta dei filtri nella query
      req.query = {
        onboardingStatus: 'In Progress',
        companyType: 'LLC',
        search: 'test'
      };
      
      Client.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      
      Client.countDocuments = jest.fn().mockResolvedValue(0);
      
      // Esecuzione del controller
      await clientController.getAllClients(req, res);
      
      // Verifica che i filtri siano stati applicati
      const expectedFilter = {
        onboardingStatus: 'In Progress',
        companyType: 'LLC',
        name: { $regex: 'test', $options: 'i' }
      };
      
      expect(Client.find).toHaveBeenCalledWith(expectedFilter);
    });
  });
  
  describe('getClient', () => {
    test('dovrebbe restituire un cliente singolo', async () => {
      const mockClient = { _id: 'mockClientId', name: 'Test Client' };
      Client.findById = jest.fn().mockResolvedValue(mockClient);
      
      await clientController.getClient(req, res);
      
      expect(Client.findById).toHaveBeenCalledWith('mockClientId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockClient);
    });
    
    test('dovrebbe gestire cliente non trovato', async () => {
      Client.findById = jest.fn().mockResolvedValue(null);
      
      await clientController.getClient(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Cliente non trovato' });
    });
  });
  
  describe('createClient', () => {
    test('dovrebbe creare un nuovo cliente con successo', async () => {
      // Prepara i mock per la creazione
      const clientData = {
        name: 'New Client',
        fiscalCode: 'ABCDEF12G34H567I',
        email: 'new@example.com'
      };
      
      req.body = clientData;
      
      const mockValidationResult = {
        valid: true,
        dataCompleteness: 30,
        missingInformation: ['Telefono', 'Indirizzo']
      };
      
      const mockSavedClient = {
        _id: 'newClientId',
        ...clientData,
        onboardingStatus: 'In Progress'
      };
      
      // Mock delle funzioni
      Client.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockSavedClient)
      }));
      
      validationService.validateClient.mockReturnValue(mockValidationResult);
      
      // Esecuzione del controller
      await clientController.createClient(req, res);
      
      // Verifica
      expect(Client).toHaveBeenCalledWith(clientData);
      expect(validationService.validateClient).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      
      // Verifica contenuto risposta
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('client', mockSavedClient);
      expect(response).toHaveProperty('validation', mockValidationResult);
      expect(response).toHaveProperty('nextSteps');
    });
    
    test('dovrebbe gestire errori di validazione', async () => {
      req.body = { name: 'Invalid Client' };
      
      // Simula errore di validazione Mongoose
      const mockError = {
        name: 'ValidationError',
        errors: {
          fiscalCode: { message: 'Il codice fiscale è obbligatorio' },
          email: { message: 'L\'email è obbligatoria' }
        }
      };
      
      Client.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(mockError)
      }));
      
      // Esecuzione del controller
      await clientController.createClient(req, res);
      
      // Verifica
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Errori di validazione',
        errors: {
          fiscalCode: 'Il codice fiscale è obbligatorio',
          email: 'L\'email è obbligatoria'
        }
      });
    });
  });
  
  describe('updateClient', () => {
    test('dovrebbe aggiornare un cliente esistente', async () => {
      const updateData = {
        phone: '1234567890',
        address: { street: 'Via Test', city: 'Roma' }
      };
      
      req.body = updateData;
      
      const existingClient = {
        _id: 'mockClientId',
        name: 'Existing Client',
        onboardingStatus: 'In Progress'
      };
      
      const updatedClient = {
        ...existingClient,
        ...updateData,
        lastContactDate: expect.any(Date)
      };
      
      Client.findById = jest.fn().mockResolvedValue(existingClient);
      Client.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedClient);
      
      validationService.validateClient.mockReturnValue({
        valid: true,
        dataCompleteness: 70,
        missingInformation: []
      });
      
      // Mock per il salvataggio dopo l'aggiornamento dello stato
      updatedClient.save = jest.fn().mockResolvedValue(updatedClient);
      
      // Esecuzione del controller
      await clientController.updateClient(req, res);
      
      // Verifiche
      expect(Client.findById).toHaveBeenCalledWith('mockClientId');
      expect(Client.findByIdAndUpdate).toHaveBeenCalledWith(
        'mockClientId',
        { ...updateData, lastContactDate: expect.any(Date) },
        { new: true, runValidators: true }
      );
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
    
    test('dovrebbe aggiornare lo stato di onboarding se i dati sono completi', async () => {
      req.body = { phone: '1234567890' };
      
      const existingClient = {
        _id: 'mockClientId',
        name: 'Existing Client',
        onboardingStatus: 'In Progress'
      };
      
      const updatedClient = {
        ...existingClient,
        phone: '1234567890',
        onboardingStatus: 'In Progress',
        save: jest.fn().mockResolvedValue({ ...existingClient, onboardingStatus: 'Information Collected' })
      };
      
      Client.findById = jest.fn().mockResolvedValue(existingClient);
      Client.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedClient);
      
      validationService.validateClient.mockReturnValue({
        valid: true,
        dataCompleteness: 100, // Cliente completamente popolato
        missingInformation: []
      });
      
      // Esecuzione del controller
      await clientController.updateClient(req, res);
      
      // Verifica che lo stato sia stato aggiornato
      expect(updatedClient.save).toHaveBeenCalled();
      expect(updatedClient.onboardingStatus).toBe('Information Collected');
    });
  });
  
  describe('validateClientData', () => {
    test('dovrebbe validare i dati cliente e restituire i risultati', async () => {
      const mockClient = { _id: 'mockClientId', name: 'Test Client' };
      const mockValidationResults = {
        valid: true,
        dataCompleteness: 80,
        missingInformation: ['Fatturato Annuale'],
        suggestions: [{ field: 'annualRevenue', message: 'Completare il fatturato' }]
      };
      
      Client.findById = jest.fn().mockResolvedValue(mockClient);
      validationService.validateClient.mockReturnValue(mockValidationResults);
      
      await clientController.validateClientData(req, res);
      
      expect(Client.findById).toHaveBeenCalledWith('mockClientId');
      expect(validationService.validateClient).toHaveBeenCalledWith(mockClient);
      expect(res.status).toHaveBeenCalledWith(200);
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('clientId', 'mockClientId');
      expect(response).toHaveProperty('validation', mockValidationResults);
      expect(response).toHaveProperty('suggestions', mockValidationResults.suggestions);
    });
  });
  
  describe('getClientQuestions', () => {
    test('dovrebbe generare domande per campi mancanti', async () => {
      const mockClient = { _id: 'mockClientId', name: 'Test Client' };
      const mockValidationResults = {
        missingInformation: ['Partita IVA', 'Telefono']
      };
      
      const mockQuestions = [
        { field: 'vatNumber', question: 'Qual è la partita IVA?' },
        { field: 'phone', question: 'Qual è il numero di telefono?' }
      ];
      
      Client.findById = jest.fn().mockResolvedValue(mockClient);
      validationService.validateClient.mockReturnValue(mockValidationResults);
      aiAssistant.generateClientQuestions.mockResolvedValue(mockQuestions);
      
      await clientController.getClientQuestions(req, res);
      
      expect(Client.findById).toHaveBeenCalledWith('mockClientId');
      expect(validationService.validateClient).toHaveBeenCalledWith(mockClient);
      expect(aiAssistant.generateClientQuestions).toHaveBeenCalledWith(
        mockClient,
        mockValidationResults.missingInformation
      );
      
      expect(res.status).toHaveBeenCalledWith(200);
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('clientId', 'mockClientId');
      expect(response).toHaveProperty('questions', mockQuestions);
    });
    
    test('dovrebbe gestire il caso in cui non mancano informazioni', async () => {
      const mockClient = { _id: 'mockClientId', name: 'Complete Client' };
      const mockValidationResults = {
        missingInformation: []
      };
      
      Client.findById = jest.fn().mockResolvedValue(mockClient);
      validationService.validateClient.mockReturnValue(mockValidationResults);
      
      await clientController.getClientQuestions(req, res);
      
      expect(aiAssistant.generateClientQuestions).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('clientId', 'mockClientId');
      expect(response).toHaveProperty('message', 'Tutte le informazioni necessarie sono già presenti');
      expect(response).toHaveProperty('questions', []);
    });
  });
  
  describe('updateOnboardingStatus', () => {
    test('dovrebbe aggiornare lo stato di onboarding', async () => {
      req.body = { status: 'Documents Collected' };
      
      const mockClient = {
        _id: 'mockClientId',
        name: 'Test Client',
        onboardingStatus: 'Information Collected',
        dataCompleteness: 85,
        save: jest.fn().mockResolvedValue({
          _id: 'mockClientId',
          onboardingStatus: 'Documents Collected',
          dataCompleteness: 85
        })
      };
      
      Client.findById = jest.fn().mockResolvedValue(mockClient);
      
      await clientController.updateOnboardingStatus(req, res);
      
      expect(Client.findById).toHaveBeenCalledWith('mockClientId');
      expect(mockClient.onboardingStatus).toBe('Documents Collected');
      expect(mockClient.lastContactDate).toBeInstanceOf(Date);
      expect(mockClient.save).toHaveBeenCalled();
      
      expect(res.status).toHaveBeenCalledWith(200);
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('clientId', 'mockClientId');
      expect(response).toHaveProperty('onboardingProgress');
      expect(response.onboardingProgress).toHaveProperty('previousStatus', 'Information Collected');
      expect(response.onboardingProgress).toHaveProperty('currentStatus', 'Documents Collected');
    });
    
    test('dovrebbe rifiutare stati di onboarding non validi', async () => {
      req.body = { status: 'Invalid Status' };
      
      await clientController.updateOnboardingStatus(req, res);
      
      expect(Client.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Stato di onboarding non valido' });
    });
  });
});