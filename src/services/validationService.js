/**
 * Validation Service
 * 
 * Gestisce la validazione dei dati dei clienti e fornisce
 * suggerimenti per completare le informazioni mancanti.
 */

/**
 * Valida i dati di un cliente e calcola il livello di completezza
 * @param {Object} client - Il documento cliente da validare
 * @returns {Object} Risultati della validazione
 */
exports.validateClient = (client) => {
  // Definizione dei campi da validare
  const requiredFields = [
    { key: 'name', label: 'Nome', importance: 'high' },
    { key: 'fiscalCode', label: 'Codice Fiscale', importance: 'high' },
    { key: 'email', label: 'Email', importance: 'high' },
    { key: 'phone', label: 'Telefono', importance: 'medium' },
    { key: 'address.street', label: 'Indirizzo', importance: 'medium' },
    { key: 'address.city', label: 'Città', importance: 'medium' },
    { key: 'address.province', label: 'Provincia', importance: 'medium' },
    { key: 'address.postalCode', label: 'CAP', importance: 'medium' },
    { key: 'companyType', label: 'Tipo Azienda', importance: 'high' },
    { key: 'businessSector', label: 'Settore Attività', importance: 'medium' },
    { key: 'foundingDate', label: 'Data Fondazione', importance: 'medium' }
  ];
  
  const additionalFields = [
    { key: 'vatNumber', label: 'Partita IVA', importance: 'high', condition: () => ['Partnership', 'Corporation', 'LLC'].includes(client.companyType) },
    { key: 'annualRevenue', label: 'Fatturato Annuale', importance: 'medium' },
    { key: 'employees', label: 'Numero Dipendenti', importance: 'low' },
    { key: 'accountingRegime', label: 'Regime Contabile', importance: 'high' }
  ];
  
  // Risultati della validazione
  const validationResults = {
    valid: true,
    dataCompleteness: 0,
    missingInformation: [],
    fieldStatus: {},
    suggestions: []
  };
  
  // Controlla i campi richiesti
  let completedRequired = 0;
  requiredFields.forEach(field => {
    const value = field.key.includes('.') 
      ? field.key.split('.').reduce((obj, key) => obj && obj[key], client)
      : client[field.key];
    
    // Definisci lo stato del campo
    const fieldStatus = {
      complete: Boolean(value),
      importance: field.importance
    };
    
    validationResults.fieldStatus[field.key] = fieldStatus;
    
    if (fieldStatus.complete) {
      completedRequired++;
    } else {
      validationResults.missingInformation.push(field.label);
      
      // Aggiungi suggerimento in base all'importanza
      if (field.importance === 'high') {
        validationResults.suggestions.push({
          field: field.key,
          label: field.label,
          message: `${field.label} è un campo obbligatorio e deve essere compilato per procedere.`,
          priority: 'high'
        });
      } else {
        validationResults.suggestions.push({
          field: field.key,
          label: field.label,
          message: `Completa il campo ${field.label} per migliorare il profilo cliente.`,
          priority: 'medium'
        });
      }
    }
  });
  
  // Controlla i campi aggiuntivi
  let completedAdditional = 0;
  let applicableAdditional = 0;
  
  additionalFields.forEach(field => {
    // Verifica se il campo è applicabile (se c'è una condizione)
    const isApplicable = !field.condition || field.condition();
    
    if (isApplicable) {
      applicableAdditional++;
      const value = client[field.key];
      
      // Definisci lo stato del campo
      const fieldStatus = {
        complete: Boolean(value),
        importance: field.importance,
        applicable: isApplicable
      };
      
      validationResults.fieldStatus[field.key] = fieldStatus;
      
      if (fieldStatus.complete) {
        completedAdditional++;
      } else {
        // Aggiungi alla lista delle informazioni mancanti solo se è importante
        if (field.importance === 'high') {
          validationResults.missingInformation.push(field.label);
        }
        
        // Aggiungi suggerimento in base all'importanza
        validationResults.suggestions.push({
          field: field.key,
          label: field.label,
          message: field.importance === 'high' 
            ? `${field.label} è importante per la corretta gestione fiscale.` 
            : `Il campo ${field.label} fornisce informazioni utili per il tuo profilo contabile.`,
          priority: field.importance
        });
      }
    }
  });
  
  // Calcolo percentuale di completezza
  // 70% peso campi richiesti, 30% campi aggiuntivi applicabili
  const requiredPercentage = requiredFields.length > 0 
    ? (completedRequired / requiredFields.length) * 70 
    : 70;
    
  const additionalPercentage = applicableAdditional > 0 
    ? (completedAdditional / applicableAdditional) * 30 
    : 30;
  
  validationResults.dataCompleteness = Math.round(requiredPercentage + additionalPercentage);
  
  // Verifica se ci sono errori di validazione critici
  validationResults.valid = requiredFields
    .filter(field => field.importance === 'high')
    .every(field => {
      const value = field.key.includes('.') 
        ? field.key.split('.').reduce((obj, key) => obj && obj[key], client)
        : client[field.key];
      return Boolean(value);
    });
  
  // Ordinamento suggerimenti per priorità
  validationResults.suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return validationResults;
};

/**
 * Verifica i formati di specifici campi client
 * @param {Object} data - Dati del cliente da verificare
 * @returns {Object} Risultati della verifica dei formati
 */
exports.validateFieldFormats = (data) => {
  const formatValidations = {
    valid: true,
    errors: {}
  };
  
  // Valida codice fiscale
  if (data.fiscalCode && !/^[A-Z0-9]{11,16}$/.test(data.fiscalCode)) {
    formatValidations.valid = false;
    formatValidations.errors.fiscalCode = 'Formato codice fiscale non valido';
  }
  
  // Valida partita IVA
  if (data.vatNumber && !/^[0-9]{11}$/.test(data.vatNumber)) {
    formatValidations.valid = false;
    formatValidations.errors.vatNumber = 'La partita IVA deve essere di 11 cifre';
  }
  
  // Valida email
  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    formatValidations.valid = false;
    formatValidations.errors.email = 'Formato email non valido';
  }
  
  // Valida CAP
  if (data.address && data.address.postalCode && !/^[0-9]{5}$/.test(data.address.postalCode)) {
    formatValidations.valid = false;
    formatValidations.errors['address.postalCode'] = 'Il CAP deve essere di 5 cifre';
  }
  
  // Valida sigla provincia
  if (data.address && data.address.province && data.address.province.length !== 2) {
    formatValidations.valid = false;
    formatValidations.errors['address.province'] = 'La sigla provincia deve essere di 2 caratteri';
  }
  
  return formatValidations;
};

/**
 * Valida un documento client prima del caricamento
 * @param {Object} document - Documento da validare
 * @returns {Object} Risultati della validazione
 */
exports.validateDocument = (document) => {
  const validationResult = {
    valid: true,
    errors: []
  };
  
  // Verifica che il nome sia presente
  if (!document.name || document.name.trim() === '') {
    validationResult.valid = false;
    validationResult.errors.push('Il nome del documento è obbligatorio');
  }
  
  // Verifica che il path sia presente
  if (!document.path || document.path.trim() === '') {
    validationResult.valid = false;
    validationResult.errors.push('Il percorso del documento è obbligatorio');
  }
  
  // Verifica che il tipo sia valido
  const validTypes = ['Identity', 'Financial', 'Tax', 'Legal', 'Other'];
  if (document.type && !validTypes.includes(document.type)) {
    validationResult.valid = false;
    validationResult.errors.push('Il tipo di documento non è valido');
  }
  
  return validationResult;
};