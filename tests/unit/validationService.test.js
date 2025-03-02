const validationService = require('../../src/services/validationService');

describe('Validation Service', () => {
  describe('validateClient', () => {
    test('dovrebbe identificare correttamente i campi mancanti', () => {
      // Client con dati parziali
      const client = {
        name: 'Test Client',
        email: 'test@example.com',
        // Mancanti: fiscalCode, phone, address, companyType, etc.
      };

      const result = validationService.validateClient(client);
      
      // Verifica che il risultato abbia le proprietà attese
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('dataCompleteness');
      expect(result).toHaveProperty('missingInformation');
      expect(result).toHaveProperty('fieldStatus');
      expect(result).toHaveProperty('suggestions');
      
      // Controlla che fiscalCode sia segnalato come mancante
      expect(result.missingInformation).toContain('Codice Fiscale');
      expect(result.valid).toBe(false);
      
      // Controlla che ci siano suggerimenti per i campi mancanti
      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Controlla che il campo name sia segnato come completo
      expect(result.fieldStatus.name.complete).toBe(true);
    });

    test('dovrebbe calcolare correttamente la percentuale di completezza', () => {
      // Client con circa metà dei dati compilati
      const client = {
        name: 'Test Client',
        fiscalCode: 'ABCDEF12G34H567I',
        email: 'test@example.com',
        phone: '1234567890',
        companyType: 'Individual',
        // Mancanti: address, businessSector, foundingDate, etc.
      };

      const result = validationService.validateClient(client);
      
      // Il risultato deve essere maggiore di 0 e minore di 100 (parzialmente completo)
      expect(result.dataCompleteness).toBeGreaterThan(0);
      expect(result.dataCompleteness).toBeLessThan(100);
    });

    test('dovrebbe validare un cliente completamente popolato', () => {
      // Client con tutti i dati compilati
      const client = {
        name: 'Test Complete Client',
        fiscalCode: 'ABCDEF12G34H567I',
        email: 'complete@example.com',
        phone: '1234567890',
        address: {
          street: 'Via Test 123',
          city: 'Roma',
          province: 'RM',
          postalCode: '00100',
          country: 'Italy'
        },
        companyType: 'LLC',
        businessSector: 'Technology',
        foundingDate: new Date(2020, 0, 1),
        vatNumber: '12345678901',
        annualRevenue: 500000,
        employees: 10,
        accountingRegime: 'Ordinario'
      };

      const result = validationService.validateClient(client);
      
      // Il cliente è completamente popolato
      expect(result.valid).toBe(true);
      expect(result.dataCompleteness).toBe(100);
      expect(result.missingInformation.length).toBe(0);
    });

    test('dovrebbe applicare regole specifiche per tipo di azienda', () => {
      // Client di tipo Individual (non richiede partita IVA)
      const individualClient = {
        name: 'Test Individual',
        fiscalCode: 'ABCDEF12G34H567I',
        email: 'individual@example.com',
        phone: '1234567890',
        companyType: 'Individual',
        // Mancante la partita IVA
      };

      // Client di tipo LLC (richiede partita IVA)
      const llcClient = {
        name: 'Test LLC',
        fiscalCode: 'ABCDEF12G34H567I',
        email: 'llc@example.com',
        phone: '1234567890',
        companyType: 'LLC',
        // Mancante la partita IVA
      };

      const individualResult = validationService.validateClient(individualClient);
      const llcResult = validationService.validateClient(llcClient);
      
      // Per Individual la partita IVA non è critica
      const individualVatSuggestion = individualResult.suggestions.find(
        s => s.field === 'vatNumber' && s.priority === 'high'
      );
      
      // Per LLC la partita IVA è critica
      const llcVatSuggestion = llcResult.suggestions.find(
        s => s.field === 'vatNumber' && s.priority === 'high'
      );
      
      // Solo per LLC la mancanza di partita IVA dovrebbe essere segnalata come critica
      expect(individualVatSuggestion).toBeUndefined();
      expect(llcVatSuggestion).toBeDefined();
    });
  });

  describe('validateFieldFormats', () => {
    test('dovrebbe validare correttamente il formato del codice fiscale', () => {
      const validData = { fiscalCode: 'ABCDEF12G34H567I' }; // 16 caratteri
      const invalidData = { fiscalCode: 'ABC12' }; // troppo corto
      
      expect(validationService.validateFieldFormats(validData).valid).toBe(true);
      expect(validationService.validateFieldFormats(invalidData).valid).toBe(false);
    });

    test('dovrebbe validare correttamente il formato della partita IVA', () => {
      const validData = { vatNumber: '12345678901' }; // 11 numeri
      const invalidData = { vatNumber: '123456' }; // troppo corto
      
      expect(validationService.validateFieldFormats(validData).valid).toBe(true);
      expect(validationService.validateFieldFormats(invalidData).valid).toBe(false);
    });

    test('dovrebbe validare correttamente il CAP', () => {
      const validData = { address: { postalCode: '00100' } }; // 5 cifre
      const invalidData = { address: { postalCode: '001' } }; // troppo corto
      
      expect(validationService.validateFieldFormats(validData).valid).toBe(true);
      expect(validationService.validateFieldFormats(invalidData).valid).toBe(false);
    });
  });

  describe('validateDocument', () => {
    test('dovrebbe validare un documento corretto', () => {
      const document = {
        name: 'Test Document',
        path: '/documents/test.pdf',
        type: 'Identity'
      };
      
      const result = validationService.validateDocument(document);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('dovrebbe identificare un documento senza nome', () => {
      const document = {
        path: '/documents/test.pdf',
        type: 'Identity'
      };
      
      const result = validationService.validateDocument(document);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('dovrebbe identificare un tipo di documento non valido', () => {
      const document = {
        name: 'Test Document',
        path: '/documents/test.pdf',
        type: 'InvalidType'
      };
      
      const result = validationService.validateDocument(document);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});