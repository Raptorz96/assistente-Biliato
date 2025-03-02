/**
 * Document Generator Service
 * 
 * Gestisce la generazione di documenti a partire da template e dati del cliente
 * con supporto per diversi formati di output e gestione dei metadati.
 */

const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const Template = require('../models/Template');
const DocumentModel = require('../models/Document');
const crypto = require('crypto');
const exportServices = require('./exports');

/**
 * Carica un template per la generazione di documenti
 * @param {string} templateName - Nome del template da caricare
 * @returns {Promise<Object>} - Template caricato
 */
async function loadTemplate(templateName) {
  try {
    // Prima cerca nel database
    const dbTemplate = await Template.findOne({ name: templateName });
    
    if (dbTemplate) {
      return {
        name: dbTemplate.name,
        displayName: dbTemplate.displayName,
        content: dbTemplate.content,
        css: dbTemplate.css,
        type: dbTemplate.type,
        category: dbTemplate.category,
        supportedFormats: dbTemplate.supportedFormats,
        requiredFields: dbTemplate.requiredFields,
        version: dbTemplate.version,
        source: 'database'
      };
    }
    
    // Se non trovato nel database, cerca nel filesystem
    const templatePath = path.join(__dirname, '../../templates', `${templateName}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    
    // Estrai CSS inline
    let css = '';
    const styleMatch = templateContent.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch && styleMatch[1]) {
      css = styleMatch[1].trim();
    }
    
    return {
      name: templateName,
      displayName: templateName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      content: templateContent,
      css: css,
      type: 'letter', // Valore predefinito
      category: 'other', // Valore predefinito
      supportedFormats: ['html', 'pdf', 'docx'],
      version: 1,
      source: 'filesystem'
    };
  } catch (error) {
    console.error(`Errore nel caricamento del template ${templateName}:`, error);
    throw new Error(`Impossibile caricare il template ${templateName}: ${error.message}`);
  }
}

/**
 * Valida i dati del cliente rispetto ai campi richiesti dal template
 * @param {Object} clientData - Dati del cliente
 * @param {Array} requiredFields - Campi richiesti dal template
 * @returns {Object} - Risultato della validazione
 */
function validateClientData(clientData, requiredFields) {
  if (!requiredFields || requiredFields.length === 0) {
    return { valid: true, missingFields: [] };
  }
  
  const missingFields = [];
  
  requiredFields.forEach(field => {
    if (field.isRequired) {
      const value = field.name.includes('.') 
        ? field.name.split('.').reduce((obj, key) => obj && obj[key], clientData)
        : clientData[field.name];
      
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.name);
      }
    }
  });
  
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Estende i dati del cliente con funzioni helper e valori predefiniti
 * @param {Object} clientData - Dati del cliente
 * @param {Object} template - Template del documento
 * @returns {Object} - Dati estesi per il rendering
 */
function enhanceClientData(clientData, template) {
  // Crea una copia profonda dei dati del cliente
  const enhancedData = JSON.parse(JSON.stringify(clientData));
  
  // Aggiungi valori predefiniti per date e formattazione
  const enhancedDataWithDefaults = {
    ...enhancedData,
    currentDate: moment().format('DD/MM/YYYY'),
    currentDateTime: moment().format('DD/MM/YYYY HH:mm'),
    currentYear: moment().format('YYYY'),
    
    // Funzioni helper per formattazione
    formatDate: (date) => date ? moment(date).format('DD/MM/YYYY') : '',
    formatDateTime: (date) => date ? moment(date).format('DD/MM/YYYY HH:mm') : '',
    formatCurrency: (amount) => amount !== undefined && amount !== null 
      ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
      : '',
    formatNumber: (num, decimals = 2) => num !== undefined && num !== null 
      ? new Intl.NumberFormat('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)
      : '',
    
    // Funzioni helper per template
    uppercase: (text) => text ? text.toUpperCase() : '',
    lowercase: (text) => text ? text.toLowerCase() : '',
    capitalize: (text) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '',
    
    // Metadati template
    templateName: template.name,
    templateDisplayName: template.displayName,
    templateVersion: template.version,
    
    // Metadati documento
    documentId: crypto.randomBytes(8).toString('hex'),
    documentCreationDate: moment().format('DD/MM/YYYY'),
    documentCreationTime: moment().format('HH:mm:ss')
  };
  
  // Aggiungi valori predefiniti dal template
  if (template.defaultData) {
    Object.keys(template.defaultData).forEach(key => {
      // Aggiungi solo se non è già definito nei dati cliente
      if (enhancedDataWithDefaults[key] === undefined) {
        enhancedDataWithDefaults[key] = template.defaultData[key];
      }
    });
  }
  
  return enhancedDataWithDefaults;
}

/**
 * Genera un documento basato su template e dati del cliente
 * @param {string} templateName - Nome del template da utilizzare
 * @param {Object} clientData - Dati del cliente per popolare il template
 * @param {string} format - Formato di output ('html', 'pdf', 'docx')
 * @param {Object} options - Opzioni aggiuntive per la generazione
 * @returns {Promise<string>} - Percorso al documento generato
 */
exports.generateDocument = async (templateName, clientData, format = 'html', options = {}) => {
  try {
    // Carica il template
    const template = await loadTemplate(templateName);
    
    // Valida i dati del cliente
    if (template.requiredFields && template.requiredFields.length > 0) {
      const validation = validateClientData(clientData, template.requiredFields);
      if (!validation.valid) {
        throw new Error(`Dati cliente incompleti. Campi mancanti: ${validation.missingFields.join(', ')}`);
      }
    }
    
    // Prepara i dati con variabili helper e valori predefiniti
    const enhancedData = enhanceClientData(clientData, template);
    
    // Imposta opzioni specifiche per il rendering
    const renderOptions = {
      ...options,
      rmWhitespace: false,
      compileDebug: process.env.NODE_ENV !== 'production'
    };
    
    // Esegui il rendering del template con EJS per ottenere l'HTML
    const renderedHtml = ejs.render(template.content, enhancedData, renderOptions);
    
    // Crea le cartelle di output
    const clientDir = clientData.fiscalCode || 'temp';
    const outputDir = path.join(__dirname, '../../generated-docs', clientDir);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Genera il timestamp per il nome del file
    const timestamp = moment().format('YYYYMMDD-HHmmss');
    let outputPath;
    
    // Imposta il percorso di output in base al formato
    switch (format.toLowerCase()) {
      case 'pdf':
        outputPath = path.join(outputDir, `${templateName}-${timestamp}.pdf`);
        break;
      case 'docx':
        outputPath = path.join(outputDir, `${templateName}-${timestamp}.docx`);
        break;
      case 'html':
      default:
        outputPath = path.join(outputDir, `${templateName}-${timestamp}.html`);
        break;
    }
    
    // Usa i servizi di export per generare il documento nel formato richiesto
    await exportServices.generateDocument(
      format,
      renderedHtml,
      outputPath,
      template,
      enhancedData,
      {
        ...options,
        documentInfo: {
          title: template.displayName || template.name,
          author: 'Studio Biliato',
          subject: `Documento per ${clientData.name}`,
          keywords: `${template.category || ''}, ${template.type || ''}`
        }
      }
    );
    
    // Registra l'attività di generazione documento
    await logDocumentGeneration(clientData, template, outputPath, format);
    
    return outputPath;
  } catch (error) {
    console.error('Errore nella generazione del documento:', error);
    throw new Error(`Impossibile generare il documento ${templateName}: ${error.message}`);
  }
};

// Le funzioni generatePdf e generateDocx sono state sostituite dai servizi di export

/**
 * Registra la generazione di un documento
 * @param {Object} clientData - Dati del cliente
 * @param {Object} template - Template utilizzato
 * @param {string} outputPath - Percorso del documento generato
 * @param {string} format - Formato del documento
 * @returns {Promise<void>}
 */
async function logDocumentGeneration(clientData, template, outputPath, format) {
  try {
    // In una implementazione reale, questo aggiornerebbe un record nel database
    console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Documento generato: ${template.name} (${format}) per ${clientData.name}`);
    
    // Se il template proviene dal database e abbiamo un sistema di tracking documenti
    if (template.source === 'database' && template._id) {
      // Potremmo registrare il documento nel sistema di tracking
      // Questo è solo un esempio, dipende dal sistema effettivo
      /*
      const stats = await fs.stat(outputPath);
      const documentRecord = new DocumentModel({
        name: template.displayName,
        filename: path.basename(outputPath),
        path: outputPath,
        client: clientData._id,
        template: template._id,
        templateVersion: template.version,
        format,
        size: stats.size,
        category: template.category,
        documentType: template.type,
        status: 'final',
        metadata: {
          generatedAt: new Date(),
          generatedBy: 'system'
        }
      });
      
      await documentRecord.save();
      */
    }
  } catch (error) {
    console.error('Errore nella registrazione della generazione del documento:', error);
    // Non interrompere il flusso in caso di errore nella registrazione
  }
}

/**
 * Ottiene la lista dei template disponibili
 * @returns {Promise<Array>} Lista dei template disponibili
 */
exports.getAvailableTemplates = async () => {
  try {
    // Recupera template dal database
    const dbTemplates = await Template.find({ isActive: true })
      .select('name displayName description type category supportedFormats')
      .sort({ category: 1, displayName: 1 });
    
    if (dbTemplates.length > 0) {
      return dbTemplates.map(template => ({
        name: template.name,
        displayName: template.displayName,
        description: template.description,
        type: template.type,
        category: template.category,
        supportedFormats: template.supportedFormats
      }));
    }
    
    // Fallback: carica template dal filesystem
    const templatesDir = path.join(__dirname, '../../templates');
    const files = await fs.readdir(templatesDir);
    
    return files
      .filter(file => file.endsWith('.html'))
      .map(file => {
        const templateName = file.replace('.html', '');
        return {
          name: templateName,
          displayName: templateName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          description: `Template: ${templateName}`,
          type: 'letter',
          category: 'other',
          supportedFormats: ['html', 'pdf', 'docx']
        };
      });
  } catch (error) {
    console.error('Errore nel recupero dei template disponibili:', error);
    throw new Error(`Impossibile recuperare i template: ${error.message}`);
  }
};

/**
 * Genera un pacchetto di documenti di onboarding per un cliente
 * @param {Object} clientData - Dati del cliente
 * @param {string} format - Formato dei documenti ('html', 'pdf', 'docx')
 * @returns {Promise<Array>} - Percorsi ai documenti generati
 */
exports.generateOnboardingPackage = async (clientData, format = 'pdf') => {
  try {
    // Cerca template di onboarding nel database
    const onboardingTemplates = await Template.find({
      category: 'onboarding',
      isActive: true
    });
    
    if (onboardingTemplates.length > 0) {
      // Usa i template dal database
      const generatedDocs = [];
      
      for (const template of onboardingTemplates) {
        try {
          const docPath = await this.generateDocument(
            template.name,
            clientData,
            format
          );
          
          generatedDocs.push(docPath);
        } catch (error) {
          console.error(`Errore nella generazione del documento ${template.name}:`, error);
          // Continua con il prossimo template
        }
      }
      
      return generatedDocs;
    }
    
    // Fallback: usa template predefiniti
    const defaultTemplates = [
      'welcome-letter',
      'service-agreement',
      'privacy-policy',
      'document-checklist'
    ];
    
    const generatedDocs = [];
    
    for (const templateName of defaultTemplates) {
      try {
        const docPath = await this.generateDocument(
          templateName,
          clientData,
          format
        );
        
        generatedDocs.push(docPath);
      } catch (error) {
        console.error(`Errore nella generazione del documento ${templateName}:`, error);
        // Continua con il prossimo template
      }
    }
    
    return generatedDocs;
  } catch (error) {
    console.error('Errore nella generazione del pacchetto onboarding:', error);
    throw new Error(`Impossibile generare il pacchetto di onboarding: ${error.message}`);
  }
};

/**
 * Genera un documento di conferma PEC
 * @param {Object} clientData - Dati del cliente
 * @param {Object} pecData - Dati specifici della PEC
 * @param {string} format - Formato di output
 * @returns {Promise<string>} - Percorso al documento generato
 */
exports.generatePecConfirmation = async (clientData, pecData, format = 'pdf') => {
  try {
    // Prepara i dati per il template
    const enhancedData = {
      ...clientData,
      pec: {
        address: pecData.address,
        provider: pecData.provider || 'Aruba PEC S.p.A.',
        activationDate: pecData.activationDate || new Date(),
        requestDate: pecData.requestDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 giorni fa
        expiryDate: pecData.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 anno da oggi
        space: pecData.space || '1 GB',
        webmailUrl: pecData.webmailUrl || 'https://webmail.pec.it',
        credentialsSentMethod: pecData.credentialsSentMethod || 'SMS',
        notes: pecData.notes || ''
      }
    };
    
    return await this.generateDocument('pec-confirmation', enhancedData, format, {
      metadata: {
        documentType: 'pec-confirmation',
        category: 'communication'
      }
    });
  } catch (error) {
    console.error('Errore nella generazione della conferma PEC:', error);
    throw new Error(`Impossibile generare la conferma PEC: ${error.message}`);
  }
};

/**
 * Genera un preventivo
 * @param {Object} clientData - Dati del cliente
 * @param {Object} serviceData - Dati dei servizi e costi
 * @param {string} format - Formato di output
 * @returns {Promise<string>} - Percorso al documento generato
 */
exports.generateCostEstimate = async (clientData, serviceData, format = 'pdf') => {
  try {
    // Calcola il totale annuo per ogni servizio
    const services = serviceData.services.map(service => {
      // Calcola il totale annuo in base alla frequenza
      let annualTotal = service.amount;
      
      if (service.frequency === 'Mensile') {
        annualTotal = service.amount * 12;
      } else if (service.frequency === 'Trimestrale') {
        annualTotal = service.amount * 4;
      } else if (service.frequency === 'Semestrale') {
        annualTotal = service.amount * 2;
      }
      
      return {
        ...service,
        annualTotal
      };
    });
    
    // Calcola il totale complessivo
    const totalAmount = services.reduce((total, service) => total + service.annualTotal, 0);
    
    // Prepara i dati per il template
    const estimateData = {
      ...clientData,
      services,
      totalAmount: totalAmount,
      estimateNumber: serviceData.estimateNumber || `EST-${Date.now()}`,
      estimateDate: serviceData.estimateDate || new Date(),
      validUntil: serviceData.validUntil || moment().add(30, 'days').toDate(),
      paymentTerms: serviceData.paymentTerms || '30 giorni data fattura',
      notes: serviceData.notes || '',
      conditions: serviceData.conditions || []
    };
    
    return await this.generateDocument('cost-estimate', estimateData, format, {
      metadata: {
        documentType: 'cost-estimate',
        category: 'financial',
        estimateNumber: estimateData.estimateNumber,
        totalAmount: totalAmount,
        validUntil: estimateData.validUntil
      }
    });
  } catch (error) {
    console.error('Errore nella generazione del preventivo:', error);
    throw new Error(`Impossibile generare il preventivo: ${error.message}`);
  }
};