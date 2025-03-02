const mongoose = require('mongoose');
const Client = require('../../src/models/Client');

// Creiamo una funzione di mock per i metodi Mongoose
mongoose.Model.prototype.save = jest.fn();

describe('Client Model', () => {
  beforeEach(() => {
    // Reset del mock prima di ogni test
    mongoose.Model.prototype.save.mockClear();
  });
  
  test('dovrebbe creare un nuovo cliente con campi obbligatori', () => {
    const clientData = {
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'test@example.com',
      companyType: 'Individual'
    };
    
    const client = new Client(clientData);
    
    // Verifica proprietà
    expect(client.name).toBe(clientData.name);
    expect(client.fiscalCode).toBe(clientData.fiscalCode);
    expect(client.email).toBe(clientData.email);
    expect(client.companyType).toBe(clientData.companyType);
    
    // Verifica valori di default
    expect(client.onboardingStatus).toBe('New');
    expect(client.dataCompleteness).toBe(0);
    expect(Array.isArray(client.missingInformation)).toBe(true);
  });
  
  test('dovrebbe calcolare correttamente il campo virtuale fullCompanyName', () => {
    // Test per ditta individuale
    const individualClient = new Client({
      name: 'Mario Rossi',
      companyType: 'Individual'
    });
    
    expect(individualClient.fullCompanyName).toBe('Mario Rossi Ditta Individuale');
    
    // Test per SRL
    const llcClient = new Client({
      name: 'Acme',
      companyType: 'LLC'
    });
    
    expect(llcClient.fullCompanyName).toBe('Acme S.r.l.');
  });
  
  test('dovrebbe calcolare completezza dati e informazioni mancanti prima del salvataggio', () => {
    // Simula la funzionalità del middleware pre-save
    const client = new Client({
      name: 'Test Client',
      email: 'test@example.com'
      // Mancano molti campi obbligatori
    });
    
    // Simuliamo l'esecuzione del middleware pre-save
    const next = jest.fn();
    const preSaveMiddleware = Client.schema.pre.mock.calls.find(call => call[0] === 'save')[1];
    
    // Esegui il middleware
    preSaveMiddleware.call(client, next);
    
    // Verifica che la completezza sia stata calcolata
    expect(client.dataCompleteness).toBeGreaterThan(0);
    expect(client.dataCompleteness).toBeLessThan(100); // Non dovrebbe essere completo
    
    // Verifica che le informazioni mancanti siano state identificate
    expect(Array.isArray(client.missingInformation)).toBe(true);
    expect(client.missingInformation.length).toBeGreaterThan(0);
    expect(client.missingInformation).toContain('fiscalCode');
    
    // Verifica che next() sia stato chiamato
    expect(next).toHaveBeenCalled();
  });
  
  test('dovrebbe validare il formato del codice fiscale', () => {
    // Codice fiscale valido
    const validClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'test@example.com'
    });
    
    let validationError;
    try {
      validClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeUndefined();
    
    // Codice fiscale non valido (troppo corto)
    const invalidClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABC',
      email: 'test@example.com'
    });
    
    validationError = undefined;
    try {
      invalidClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeDefined();
    expect(validationError.errors.fiscalCode).toBeDefined();
  });
  
  test('dovrebbe validare il formato dell\'email', () => {
    // Email valida
    const validClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'test@example.com'
    });
    
    let validationError;
    try {
      validClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeUndefined();
    
    // Email non valida
    const invalidClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'invalid-email'
    });
    
    validationError = undefined;
    try {
      invalidClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeDefined();
    expect(validationError.errors.email).toBeDefined();
  });
  
  test('dovrebbe validare il CAP italiano', () => {
    // Cliente con CAP valido
    const validClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'test@example.com',
      address: {
        street: 'Via Test',
        city: 'Roma',
        province: 'RM',
        postalCode: '00100'
      }
    });
    
    let validationError;
    try {
      validClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeUndefined();
    
    // Cliente con CAP non valido
    const invalidClient = new Client({
      name: 'Test Client',
      fiscalCode: 'ABCDEF12G34H567I',
      email: 'test@example.com',
      address: {
        street: 'Via Test',
        city: 'Roma',
        province: 'RM',
        postalCode: '001' // Troppo corto
      }
    });
    
    validationError = undefined;
    try {
      invalidClient.validateSync();
    } catch (error) {
      validationError = error;
    }
    
    expect(validationError).toBeDefined();
    expect(validationError.errors['address.postalCode']).toBeDefined();
  });
});