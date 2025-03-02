/**
 * AI Document Enhancer Service
 * 
 * Integra l'intelligenza artificiale con il generatore di documenti per:
 * 1. Suggerire miglioramenti ai testi generati
 * 2. Personalizzare i documenti in base al contesto del cliente
 * 3. Verificare la correttezza e completezza dei documenti
 * 4. Suggerire documenti aggiuntivi utili
 */

const aiAssistant = require('./aiAssistant');
const documentGenerator = require('./documentGenerator');
const Template = require('../models/Template');
const Document = require('../models/Document');
const Client = require('../models/Client');
const path = require('path');
const fs = require('fs').promises;
const moment = require('moment');

/**
 * Migliora un documento generato
 * @param {string} documentPath - Percorso al documento generato
 * @param {Object} clientData - Dati del cliente
 * @param {Object} options - Opzioni di miglioramento
 * @returns {Promise<Object>} - Risultato del miglioramento
 */
exports.enhanceDocument = async (documentPath, clientData, options = {}) => {
  try {
    // Leggi il contenuto del documento (in formato HTML)
    const documentContent = await fs.readFile(documentPath, 'utf8');
    
    // In una implementazione reale, qui si invierebbe il contenuto a un LLM
    console.log(`Miglioramento documento per cliente: ${clientData.name}`);
    
    // Simuliamo l'analisi AI del documento
    const enhancementSuggestions = await analyzeDocument(documentContent, clientData, options);
    
    // Se le opzioni specificano di applicare automaticamente i miglioramenti
    if (options.autoApply) {
      // Applica i miglioramenti al documento
      const enhancedContent = applyEnhancements(documentContent, enhancementSuggestions);
      
      // Genera il percorso per il documento migliorato
      const enhancedPath = documentPath.replace(/(\.\w+)$/, '-enhanced$1');
      
      // Salva il documento migliorato
      await fs.writeFile(enhancedPath, enhancedContent);
      
      return {
        original: documentPath,
        enhanced: enhancedPath,
        suggestions: enhancementSuggestions,
        applied: true
      };
    }
    
    // Se non si applicano automaticamente, restituisci solo i suggerimenti
    return {
      original: documentPath,
      suggestions: enhancementSuggestions,
      applied: false
    };
  } catch (error) {
    console.error('Errore nel miglioramento del documento:', error);
    throw new Error(`Impossibile migliorare il documento: ${error.message}`);
  }
};

/**
 * Analizza un documento e fornisce suggerimenti di miglioramento
 * @param {string} documentContent - Contenuto del documento
 * @param {Object} clientData - Dati del cliente
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<Array>} - Suggerimenti di miglioramento
 */
async function analyzeDocument(documentContent, clientData, options) {
  // In un'implementazione reale, qui verrebbe utilizzato un LLM
  // Per ora simuliamo l'analisi con logica predefinita
  
  const suggestions = [];
  
  // Esempio di regola: verifica se ci sono sezioni vuote o incomplete
  const incompletePatterns = [
    'da definire',
    'da compilare',
    'inserire qui',
    'N/A',
    /\[\s*\]/g, // Parentesi quadre vuote
    /\{\s*\}/g  // Parentesi graffe vuote
  ];
  
  for (const pattern of incompletePatterns) {
    if (typeof pattern === 'string') {
      if (documentContent.toLowerCase().includes(pattern.toLowerCase())) {
        suggestions.push({
          type: 'incomplete_section',
          description: `Trovata sezione incompleta: "${pattern}"`,
          severity: 'high',
          position: documentContent.toLowerCase().indexOf(pattern.toLowerCase())
        });
      }
    } else if (pattern instanceof RegExp) {
      const matches = documentContent.match(pattern);
      if (matches) {
        suggestions.push({
          type: 'incomplete_section',
          description: `Trovata sezione incompleta: "${matches[0]}"`,
          severity: 'high',
          position: documentContent.search(pattern)
        });
      }
    }
  }
  
  // Esempio di regola: verifica se ci sono lunghi paragrafi che potrebbero essere divisi
  const paragraphs = documentContent.split(/<p[^>]*>(.*?)<\/p>/gi)
    .filter(p => p.trim().length > 0 && !p.startsWith('<') && !p.endsWith('>'));
  
  for (const paragraph of paragraphs) {
    if (paragraph.length > 500) { // Paragrafi molto lunghi
      suggestions.push({
        type: 'readability',
        description: 'Paragrafo molto lungo che potrebbe essere diviso per migliorare la leggibilità',
        severity: 'medium',
        position: documentContent.indexOf(paragraph)
      });
    }
  }
  
  // Esempio di regola: verifica la presenza di date obsolete
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Formato dd/mm/yyyy
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g    // Formato yyyy-mm-dd
  ];
  
  const today = moment();
  
  for (const pattern of datePatterns) {
    const matches = documentContent.match(pattern);
    if (matches) {
      for (const match of matches) {
        const date = moment(match, ['DD/MM/YYYY', 'YYYY-MM-DD']);
        if (date.isValid()) {
          // Se la data è nel passato (oltre 90 giorni fa)
          if (date.isBefore(today.clone().subtract(90, 'days'))) {
            suggestions.push({
              type: 'outdated_date',
              description: `Trovata data obsoleta: "${match}"`,
              severity: 'medium',
              position: documentContent.indexOf(match),
              suggestion: `Considerare di aggiornare alla data corrente: ${today.format('DD/MM/YYYY')}`
            });
          }
          // Se la data è troppo nel futuro (oltre 365 giorni)
          else if (date.isAfter(today.clone().add(365, 'days'))) {
            suggestions.push({
              type: 'future_date',
              description: `Trovata data molto futura: "${match}"`,
              severity: 'low',
              position: documentContent.indexOf(match)
            });
          }
        }
      }
    }
  }
  
  // Personalizzazione in base al contesto del cliente
  if (clientData) {
    // Esempio: verifica del regime fiscale corretto
    if (clientData.accountingRegime === 'Forfettario' && 
        documentContent.toLowerCase().includes('iva')) {
      suggestions.push({
        type: 'context_mismatch',
        description: 'Il documento fa riferimento all\'IVA, ma il cliente è in regime forfettario',
        severity: 'high',
        suggestion: 'Rimuovere o modificare i riferimenti all\'IVA, specificando che in regime forfettario non si applica l\'IVA'
      });
    }
    
    // Esempio: verifica della forma societaria corretta
    const companyTypeMapping = {
      'Individual': ['ditta individuale', 'persona fisica', 'lavoratore autonomo'],
      'Partnership': ['società di persone', 'snc', 'sas'],
      'Corporation': ['società per azioni', 'spa'],
      'LLC': ['società a responsabilità limitata', 'srl']
    };
    
    if (clientData.companyType && companyTypeMapping[clientData.companyType]) {
      const correctTerms = companyTypeMapping[clientData.companyType];
      let foundCorrectTerm = false;
      
      for (const term of correctTerms) {
        if (documentContent.toLowerCase().includes(term)) {
          foundCorrectTerm = true;
          break;
        }
      }
      
      if (!foundCorrectTerm) {
        suggestions.push({
          type: 'company_type_mismatch',
          description: `Il documento non utilizza la corretta forma societaria per il cliente (${clientData.companyType})`,
          severity: 'medium',
          suggestion: `Utilizzare i termini: ${correctTerms.join(', ')}`
        });
      }
    }
  }
  
  return suggestions;
}

/**
 * Applica suggerimenti di miglioramento a un documento
 * @param {string} documentContent - Contenuto del documento originale
 * @param {Array} suggestions - Suggerimenti di miglioramento
 * @returns {string} - Documento migliorato
 */
function applyEnhancements(documentContent, suggestions) {
  let enhancedContent = documentContent;
  
  // Applica i suggerimenti uno alla volta
  for (const suggestion of suggestions) {
    switch (suggestion.type) {
      case 'outdated_date':
        if (suggestion.suggestion && suggestion.position >= 0) {
          // Estrai la data originale
          const originalDateStr = enhancedContent.substring(
            suggestion.position, 
            suggestion.position + 10 // Assumiamo date di 10 caratteri come DD/MM/YYYY
          );
          // Sostituisci con la data suggerita
          const newDateStr = suggestion.suggestion.match(/\d{1,2}\/\d{1,2}\/\d{4}/)[0];
          enhancedContent = enhancedContent.replace(originalDateStr, newDateStr);
        }
        break;
        
      case 'incomplete_section':
        // Non possiamo applicare automaticamente questa correzione,
        // richiederebbe intervento umano
        break;
        
      case 'context_mismatch':
        if (suggestion.suggestion) {
          // Esempi di sostituzioni per regime forfettario
          if (suggestion.description.includes('regime forfettario') && 
              suggestion.description.includes('IVA')) {
            enhancedContent = enhancedContent.replace(
              /(addebiter[àaemo]\s+IVA|con\s+IVA|applicazione\s+dell[']IVA)/gi,
              'non si applicherà IVA (regime forfettario)'
            );
          }
        }
        break;
    }
  }
  
  return enhancedContent;
}

/**
 * Verifica la completezza e correttezza di un documento
 * @param {string} documentPath - Percorso al documento
 * @param {Object} verificationCriteria - Criteri di verifica
 * @returns {Promise<Object>} - Risultato della verifica
 */
exports.verifyDocument = async (documentPath, verificationCriteria = {}) => {
  try {
    // Leggi il contenuto del documento
    const documentContent = await fs.readFile(documentPath, 'utf8');
    
    const verificationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Verifica dei requisiti minimi
    if (verificationCriteria.requiredSections) {
      for (const section of verificationCriteria.requiredSections) {
        if (!documentContent.includes(section.identifier)) {
          verificationResults.isValid = false;
          verificationResults.errors.push({
            type: 'missing_section',
            description: `Sezione obbligatoria mancante: ${section.name}`,
            severity: 'high'
          });
        }
      }
    }
    
    // Verifica dei campi obbligatori
    if (verificationCriteria.requiredFields) {
      for (const field of verificationCriteria.requiredFields) {
        const pattern = new RegExp(`{{\\s*${field.name}\\s*}}`, 'g');
        if (pattern.test(documentContent)) {
          verificationResults.isValid = false;
          verificationResults.errors.push({
            type: 'unsubstituted_field',
            description: `Campo non sostituito: ${field.name}`,
            severity: 'high',
            field: field.name
          });
        }
      }
    }
    
    // Verifica coerenza normativa
    if (verificationCriteria.regulatoryReferences) {
      for (const reference of verificationCriteria.regulatoryReferences) {
        // Verifica se il documento cita la normativa corretta
        if (reference.required && !documentContent.includes(reference.identifier)) {
          verificationResults.warnings.push({
            type: 'missing_regulatory_reference',
            description: `Riferimento normativo consigliato mancante: ${reference.name}`,
            severity: 'medium',
            suggestion: `Considerare di aggiungere un riferimento a: ${reference.name}`
          });
        }
        // Verifica se il documento cita una normativa obsoleta
        else if (reference.obsolete && documentContent.includes(reference.identifier)) {
          verificationResults.warnings.push({
            type: 'obsolete_regulatory_reference',
            description: `Riferimento normativo obsoleto: ${reference.name}`,
            severity: 'medium',
            suggestion: `Considerare di aggiornare il riferimento a: ${reference.replacement || 'normativa aggiornata'}`
          });
        }
      }
    }
    
    return verificationResults;
  } catch (error) {
    console.error('Errore nella verifica del documento:', error);
    throw new Error(`Impossibile verificare il documento: ${error.message}`);
  }
};

/**
 * Personalizza un documento in base al contesto del cliente
 * @param {string} templateName - Nome del template da personalizzare
 * @param {Object} clientData - Dati del cliente
 * @param {Object} customizationOptions - Opzioni di personalizzazione
 * @returns {Promise<Object>} - Informazioni sul documento personalizzato
 */
exports.customizeDocumentByContext = async (templateName, clientData, customizationOptions = {}) => {
  try {
    console.log(`Personalizzazione documento "${templateName}" per cliente: ${clientData.name}`);
    
    // Estratti automaticamente dal contesto del cliente
    const contextualEnhancements = generateContextualEnhancements(clientData);
    
    // Combina gli enhancement automatici con quelli specificati nelle opzioni
    const allEnhancements = {
      ...contextualEnhancements,
      ...customizationOptions.enhancements
    };
    
    // Genera il documento con gli enhancement contestuali
    const documentPath = await documentGenerator.generateDocument(
      templateName,
      {
        ...clientData,
        ...allEnhancements
      },
      customizationOptions.format || 'pdf',
      {
        contextSpecific: true
      }
    );
    
    return {
      documentPath,
      appliedEnhancements: Object.keys(allEnhancements),
      customization: {
        clientType: clientData.companyType,
        clientSector: clientData.businessSector,
        adaptations: allEnhancements
      }
    };
  } catch (error) {
    console.error('Errore nella personalizzazione del documento:', error);
    throw new Error(`Impossibile personalizzare il documento: ${error.message}`);
  }
};

/**
 * Genera miglioramenti contestuali in base al profilo cliente
 * @param {Object} clientData - Dati del cliente
 * @returns {Object} - Miglioramenti contestuali
 */
function generateContextualEnhancements(clientData) {
  const enhancements = {};
  
  // Personalizzazione in base al tipo di azienda
  if (clientData.companyType === 'Individual') {
    enhancements.taxSection = `
      <div class="tax-info-box">
        <h4>Informazioni fiscali per Ditta Individuale</h4>
        <p>In quanto ditta individuale${clientData.accountingRegime === 'Forfettario' ? ' in regime forfettario' : ''}, 
        si applicano le seguenti condizioni specifiche:</p>
        <ul>
          ${clientData.accountingRegime === 'Forfettario' ? 
            '<li>Esenzione IVA secondo l\'art. 1, comma 54-89, Legge n. 190/2014</li>' : 
            '<li>Applicazione IVA secondo normativa standard</li>'}
          <li>Tassazione del reddito secondo ${getIndividualTaxDescription(clientData)}</li>
          <li>Obbligo di fatturazione elettronica${clientData.accountingRegime === 'Forfettario' ? ' con le deroghe previste per il regime forfettario' : ''}</li>
        </ul>
      </div>
    `;
  } else if (clientData.companyType === 'LLC' || clientData.companyType === 'Corporation') {
    enhancements.taxSection = `
      <div class="tax-info-box">
        <h4>Informazioni fiscali per Società di Capitali</h4>
        <p>In quanto società di capitali, si applicano le seguenti condizioni specifiche:</p>
        <ul>
          <li>Applicazione IRES con aliquota del 24%</li>
          <li>Applicazione IRAP secondo normativa regionale vigente</li>
          <li>Obblighi di rendicontazione periodica secondo normativa civilistica e fiscale</li>
          <li>Obbligo di fatturazione elettronica</li>
        </ul>
      </div>
    `;
  }
  
  // Personalizzazione in base al settore di attività
  if (clientData.businessSector) {
    const sector = clientData.businessSector.toLowerCase();
    
    if (sector.includes('commercio') || sector.includes('retail')) {
      enhancements.sectorSpecificSection = `
        <div class="sector-specific-box">
          <h4>Informazioni specifiche per il settore Commercio</h4>
          <p>Per le attività commerciali, è importante considerare:</p>
          <ul>
            <li>Gestione accurata delle scorte di magazzino</li>
            <li>Corretta applicazione delle aliquote IVA differenziate per categorie merceologiche</li>
            <li>Adempimenti specifici per vendite al dettaglio (scontrini, ricevute, ecc.)</li>
          </ul>
        </div>
      `;
    } else if (sector.includes('manifattura') || sector.includes('produzione')) {
      enhancements.sectorSpecificSection = `
        <div class="sector-specific-box">
          <h4>Informazioni specifiche per il settore Manifatturiero</h4>
          <p>Per le attività manifatturiere, è importante considerare:</p>
          <ul>
            <li>Rilevazione accurata dei costi di produzione</li>
            <li>Gestione della valorizzazione delle rimanenze</li>
            <li>Possibilità di ammortamenti specifici per macchinari e impianti</li>
          </ul>
        </div>
      `;
    } else if (sector.includes('servizi') || sector.includes('consulenza')) {
      enhancements.sectorSpecificSection = `
        <div class="sector-specific-box">
          <h4>Informazioni specifiche per il settore Servizi</h4>
          <p>Per le attività di servizi, è importante considerare:</p>
          <ul>
            <li>Corretta valutazione dei servizi in corso di esecuzione</li>
            <li>Gestione appropriata di anticipi e acconti</li>
            <li>Applicazione della ritenuta d'acconto ove prevista</li>
          </ul>
        </div>
      `;
    }
  }
  
  // Personalizzazione in base alla dimensione aziendale
  if (clientData.employees !== undefined || clientData.annualRevenue !== undefined) {
    const isSmall = (clientData.employees || 0) < 10 && (clientData.annualRevenue || 0) < 500000;
    const isMedium = (clientData.employees || 0) >= 10 && (clientData.employees || 0) < 50 && 
                    (clientData.annualRevenue || 0) >= 500000 && (clientData.annualRevenue || 0) < 10000000;
    const isLarge = (clientData.employees || 0) >= 50 || (clientData.annualRevenue || 0) >= 10000000;
    
    if (isSmall) {
      enhancements.companySize = 'small';
      enhancements.sizeSpecificNote = 'Per le piccole imprese, consideriamo soluzioni fiscali e contabili semplificate per ottimizzare i costi amministrativi.';
    } else if (isMedium) {
      enhancements.companySize = 'medium';
      enhancements.sizeSpecificNote = 'Per le medie imprese, offriamo un equilibrio tra controllo dettagliato e ottimizzazione dei processi amministrativi.';
    } else if (isLarge) {
      enhancements.companySize = 'large';
      enhancements.sizeSpecificNote = 'Per le grandi imprese, implementiamo soluzioni complete di controllo di gestione e pianificazione fiscale strategica.';
    }
  }
  
  return enhancements;
}

/**
 * Ottiene la descrizione del regime fiscale per una ditta individuale
 * @param {Object} clientData - Dati del cliente
 * @returns {string} - Descrizione del regime fiscale
 */
function getIndividualTaxDescription(clientData) {
  switch (clientData.accountingRegime) {
    case 'Forfettario':
      return 'il regime forfettario con imposta sostitutiva del 5% o 15%';
    case 'Semplificato':
      return 'il regime semplificato con tassazione IRPEF progressiva';
    case 'Ordinario':
      return 'il regime ordinario con tassazione IRPEF progressiva';
    default:
      return 'la normativa fiscale vigente';
  }
}

/**
 * Suggerisce documenti aggiuntivi utili per il cliente
 * @param {Object} clientData - Dati del cliente
 * @param {Array} currentDocuments - Documenti già generati
 * @returns {Promise<Array>} - Suggerimenti di documenti aggiuntivi
 */
exports.suggestAdditionalDocuments = async (clientData, currentDocuments = []) => {
  try {
    console.log(`Generazione suggerimenti documenti per cliente: ${clientData.name}`);
    
    // Ottieni template disponibili
    const availableTemplates = await Template.find({ isActive: true })
      .select('name displayName description type category')
      .sort({ category: 1, displayName: 1 });
    
    // Determina quali template sono già stati utilizzati
    const currentTemplateNames = currentDocuments.map(doc => {
      if (typeof doc === 'string') {
        // Se è un percorso file, estrai il nome del template
        const filename = path.basename(doc);
        return filename.split('-')[0]; // Assumiamo che il nome del file inizi con il nome del template
      } else if (doc.template) {
        // Se è un oggetto documento con riferimento al template
        return doc.template.name || doc.template;
      }
      return '';
    }).filter(name => name);
    
    // Analizza il profilo cliente per determinare i documenti utili
    const suggestions = [];
    
    // Regole di suggerimento basate sul tipo di azienda
    if (clientData.companyType === 'Individual') {
      // Documenti specifici per ditte individuali
      suggestTemplateByName(availableTemplates, 'privacy-policy-individual', 'Informativa Privacy per Ditta Individuale', 'Documento obbligatorio per il trattamento dei dati', suggestions, currentTemplateNames);
      
      if (clientData.accountingRegime === 'Forfettario') {
        suggestTemplateByName(availableTemplates, 'forfettario-requirements', 'Requisiti Regime Forfettario', 'Documento informativo sui requisiti e limiti del regime forfettario', suggestions, currentTemplateNames);
      }
    } else if (clientData.companyType === 'LLC' || clientData.companyType === 'Corporation') {
      // Documenti specifici per società di capitali
      suggestTemplateByName(availableTemplates, 'company-statute-checklist', 'Checklist Statuto Societario', 'Verifica della conformità dello statuto alla normativa vigente', suggestions, currentTemplateNames);
      suggestTemplateByName(availableTemplates, 'board-minutes-template', 'Modello Verbale CdA', 'Template per la redazione dei verbali del consiglio di amministrazione', suggestions, currentTemplateNames);
    }
    
    // Regole di suggerimento basate sul settore di attività
    if (clientData.businessSector) {
      const sector = clientData.businessSector.toLowerCase();
      
      if (sector.includes('e-commerce') || sector.includes('commercio elettronico')) {
        suggestTemplateByName(availableTemplates, 'ecommerce-tax-guide', 'Guida Fiscale E-commerce', 'Documento informativo sugli aspetti fiscali del commercio elettronico', suggestions, currentTemplateNames);
      }
      
      if (sector.includes('export') || sector.includes('import') || sector.includes('estero')) {
        suggestTemplateByName(availableTemplates, 'international-trade-checklist', 'Checklist Commercio Internazionale', 'Verifica degli adempimenti per le operazioni con l\'estero', suggestions, currentTemplateNames);
      }
    }
    
    // Regole di suggerimento basate sul numero di dipendenti
    if (clientData.employees > 0) {
      suggestTemplateByName(availableTemplates, 'payroll-procedures', 'Procedure Gestione Paghe', 'Linee guida per la corretta gestione delle buste paga', suggestions, currentTemplateNames);
    }
    
    // Suggerimenti stagionali
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    if (currentMonth >= 10 && currentMonth <= 12) {
      // Ultimo trimestre dell'anno
      suggestTemplateByName(availableTemplates, 'year-end-tax-planning', 'Pianificazione Fiscale Fine Anno', 'Strategie fiscali da implementare prima della chiusura dell\'esercizio', suggestions, currentTemplateNames);
    } else if (currentMonth >= 1 && currentMonth <= 3) {
      // Primo trimestre dell'anno
      suggestTemplateByName(availableTemplates, 'tax-calendar', 'Calendario Fiscale Annuale', 'Riepilogo delle scadenze fiscali per l\'anno in corso', suggestions, currentTemplateNames);
    }
    
    return suggestions;
  } catch (error) {
    console.error('Errore nella generazione dei suggerimenti di documenti:', error);
    throw new Error(`Impossibile generare suggerimenti di documenti: ${error.message}`);
  }
};

/**
 * Aiuta a suggerire un template specifico in base al nome
 * @param {Array} templates - Lista di template disponibili
 * @param {string} templateName - Nome del template da suggerire
 * @param {string} fallbackName - Nome alternativo se il template non è trovato
 * @param {string} description - Descrizione del template
 * @param {Array} suggestions - Array di suggerimenti a cui aggiungere
 * @param {Array} currentTemplateNames - Nomi dei template già utilizzati
 */
function suggestTemplateByName(templates, templateName, fallbackName, description, suggestions, currentTemplateNames) {
  // Verifica se il template è già stato utilizzato
  if (currentTemplateNames.includes(templateName)) {
    return;
  }
  
  // Cerca il template nella lista dei disponibili
  const template = templates.find(t => t.name === templateName);
  
  if (template) {
    suggestions.push({
      template: {
        id: template._id,
        name: template.name,
        displayName: template.displayName,
        type: template.type,
        category: template.category
      },
      reason: description,
      priority: 'medium'
    });
  } else {
    // Se il template non esiste, aggiungi comunque un suggerimento generico
    suggestions.push({
      templateName: templateName,
      displayName: fallbackName,
      reason: description,
      priority: 'medium',
      notAvailable: true,
      message: `Il template "${templateName}" non è attualmente disponibile nel sistema. Considerare di crearlo.`
    });
  }
}

/**
 * Migliora i metadati di un documento generato
 * @param {string} documentId - ID del documento
 * @param {Object} options - Opzioni per migliorare i metadati
 * @returns {Promise<Object>} - Documento con metadati migliorati
 */
exports.enhanceDocumentMetadata = async (documentId, options = {}) => {
  try {
    // Recupera il documento dal database
    const document = await Document.findById(documentId)
      .populate('client', 'name fiscalCode businessSector companyType')
      .populate('template', 'name displayName category type');
    
    if (!document) {
      throw new Error(`Documento con ID ${documentId} non trovato`);
    }
    
    console.log(`Miglioramento metadati per documento ${document.name}`);
    
    // Arricchisci i metadati esistenti
    const enhancedMetadata = {
      ...document.metadata,
      enhanced: true,
      enhancedAt: new Date(),
      documentVersion: (document.metadata.documentVersion || 1) + 0.1,
      clientContext: {
        companyType: document.client.companyType,
        businessSector: document.client.businessSector
      }
    };
    
    // Aggiungi tag appropriati in base al contesto
    const tags = document.tags || [];
    
    // Tag in base al tipo di cliente
    if (document.client.companyType && !tags.includes(document.client.companyType.toLowerCase())) {
      tags.push(document.client.companyType.toLowerCase());
    }
    
    // Tag in base al settore
    if (document.client.businessSector) {
      const sectorTag = document.client.businessSector
        .toLowerCase()
        .replace(/\s+/g, '-');
      
      if (!tags.includes(sectorTag)) {
        tags.push(sectorTag);
      }
    }
    
    // Tag in base al tipo di documento
    if (document.documentType && !tags.includes(document.documentType)) {
      tags.push(document.documentType);
    }
    
    // Tag categoria
    if (document.category && !tags.includes(document.category)) {
      tags.push(document.category);
    }
    
    // Aggiorna il documento
    const updatedDocument = await Document.findByIdAndUpdate(
      documentId,
      {
        metadata: enhancedMetadata,
        tags: tags
      },
      { new: true }
    );
    
    return updatedDocument;
  } catch (error) {
    console.error('Errore nel miglioramento dei metadati del documento:', error);
    throw new Error(`Impossibile migliorare i metadati: ${error.message}`);
  }
};