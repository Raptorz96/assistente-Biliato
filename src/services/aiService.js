/**
 * AI Service
 * 
 * Servizio per l'integrazione con Claude AI (Anthropic) che fornisce:
 * - Generazione di procedure personalizzate per clienti
 * - Analisi di documenti e estrazione dati
 * - Risposte a domande in ambito fiscale
 * - Suggerimenti per completamento checklist
 * - Caching dei risultati
 * - Gestione degli errori e timeout
 * - Tracciamento dell'utilizzo
 */

const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const NodeCache = require('node-cache');

// Cache con TTL standard di 30 minuti
const responseCache = new NodeCache({
  stdTTL: 1800,
  checkperiod: 300,
  useClones: false
});

// Stato delle richieste in corso per prevenire chiamate duplicate
const pendingRequests = new Map();

// Configurazione API Claude
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';

// Timeout per le richieste API
const API_TIMEOUT = parseInt(process.env.CLAUDE_API_TIMEOUT) || 60000; // 60 secondi di default

// Configurazione soglie per tentativi
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Delay base per retry

// Repository di prompt standard
const promptTemplates = {
  base: `Sei un assistente AI specializzato in contabilità, fiscalità e normative italiane, parte di un assistente digitale per uno studio commercialista. 
Fornisci risposte precise, dettagliate e professionali, citando quando necessario normative, circolari o riferimenti legislativi.`,

  procedureGeneration: `Sei un esperto di procedure contabili e fiscali per aziende italiane.
Devi creare una procedura operativa dettagliata per un cliente con le seguenti caratteristiche:

{clientDetails}

La procedura deve essere completa e comprendere:
1. ATTIVITÀ PERIODICHE
   - Attività mensili (es. registrazione fatture, liquidazione IVA)
   - Attività trimestrali (es. comunicazioni IVA, F24)
   - Attività annuali (es. bilancio, dichiarazioni fiscali)

2. SCADENZE FISCALI specifiche per il regime del cliente
   - Date precise di ogni adempimento
   - Modalità di presentazione
   - Conseguenze in caso di inadempienza

3. DOCUMENTAZIONE NECESSARIA
   - Elenco documenti da richiedere al cliente
   - Tempistiche di consegna
   - Formato preferito

4. PASSAGGI OPERATIVI
   - Procedura step-by-step per ogni adempimento
   - Software da utilizzare
   - Controlli da effettuare

5. SUGGERIMENTI SPECIFICI per ottimizzazione fiscale in base al tipo di attività

Assicurati che la procedura sia:
- Specifica per il regime fiscale indicato
- Adatta alle dimensioni dell'attività
- Conforme alla normativa italiana aggiornata
- Pratica e implementabile

La tua risposta deve essere ben formattata, con sezioni chiaramente definite, pronta per essere condivisa con il cliente.`,

  documentAnalysis: `Sei un analista esperto di documenti contabili e fiscali italiani.
Il tuo compito è analizzare con precisione il seguente documento ed estrarre tutte le informazioni rilevanti.

Estrai i seguenti dati e organizzali in formato JSON strutturato:
- "documentType": tipo di documento (es. fattura, F24, dichiarazione dei redditi)
- "parties": persone o aziende menzionate, con i relativi ruoli (mittente, destinatario)
- "fiscalData": codici fiscali, partite IVA, numeri di registrazione
- "dates": tutte le date rilevanti con descrizione (emissione, scadenza, periodo di riferimento)
- "amounts": tutti gli importi con valuta e descrizione
- "taxRelevantInfo": informazioni fiscalmente rilevanti
- "notes": eventuali note o dettagli aggiuntivi
- "missingInfo": informazioni che dovrebbero essere presenti ma non lo sono
- "confidenceScore": un valore da 0 a 1 che indica la tua sicurezza nell'analisi

Assicurati che il JSON sia valido, con campi nidificati dove appropriato.
Se alcuni dati non sono presenti o non chiari, indica "non disponibile" o "incerto" nel campo corrispondente.`,

  fiscalQA: `Sei un esperto fiscalista italiano, specializzato in rispondere a domande su contabilità, fiscalità e normative italiane.
Le tue risposte devono essere:
- Accurate: basate sulla normativa italiana aggiornata
- Complete: coprire tutti gli aspetti rilevanti della domanda
- Professionali: utilizzare terminologia tecnica corretta
- Pratiche: fornire indicazioni implementabili
- Referenziate: citare leggi, decreti, circolari o prassi pertinenti

Se la domanda include dettagli specifici di un cliente, adatta la risposta al suo contesto particolare.

{clientContext}

Rispondi alla seguente domanda:`,

  checklistCompletion: `Sei un assistente specializzato nella preparazione di documenti contabili e fiscali.
In base ai dati disponibili su questo cliente e alla checklist fornita, devi suggerire come completare gli elementi mancanti.

Dati cliente:
{clientData}

Checklist attuale (con stato completamento):
{currentChecklist}

Per ogni elemento non completato, fornisci:
1. Le informazioni o documenti specifici da richiedere
2. Come ottenere questi dati (es. documenti da richiedere, sistemi da consultare)
3. Una stima dell'urgenza (alta/media/bassa)
4. Eventuali dipendenze da altri elementi

Formatta la risposta come un elenco strutturato, ordinato per priorità, pronto per essere utilizzato come piano d'azione.
Se ci sono elementi che possono essere completati automaticamente in base ai dati già disponibili, evidenziali e suggerisci i valori.`
};

/**
 * Inizializza il servizio AI
 * @returns {boolean} Stato dell'inizializzazione
 */
const initialize = () => {
  try {
    // Verifica che l'API key sia configurata
    if (!CLAUDE_API_KEY) {
      console.error('Errore: CLAUDE_API_KEY non configurata nelle variabili d\'ambiente');
      return false;
    }
    
    console.log('AI Service inizializzato con modello:', CLAUDE_MODEL);
    return true;
  } catch (error) {
    console.error('Errore nell\'inizializzazione di AI Service:', error);
    return false;
  }
};

/**
 * Genera un hash MD5 di un oggetto per la chiave di cache
 * @param {Object} obj - Oggetto da hashare
 * @returns {string} - Hash MD5
 */
const generateCacheKey = (obj) => {
  const str = JSON.stringify(obj);
  return crypto.createHash('md5').update(str).digest('hex');
};

/**
 * Comprime un prompt lungo per risparmiare token
 * @param {string} prompt - Prompt originale
 * @returns {string} - Prompt compresso
 */
const compressPrompt = (prompt) => {
  // Rimuovi spazi e righe vuote eccessive
  let compressed = prompt
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // Abbrevia alcune parole comuni per risparmiare token (solo in italiano)
  const abbreviations = {
    'documento': 'doc',
    'documentazione': 'doc',
    'informazioni': 'info',
    'specificare': 'spec',
    'comunicazione': 'comun',
    'dichiarazione': 'dich',
    'contabilità': 'contab',
    'procedura': 'proc'
  };
  
  // Applica le abbreviazioni solo a prompt molto lunghi (>1000 caratteri)
  if (compressed.length > 1000) {
    for (const [word, abbr] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      compressed = compressed.replace(regex, abbr);
    }
  }
  
  return compressed;
};

/**
 * Traccia l'utilizzo dell'API Claude
 * @param {Object} request - Dettagli della richiesta
 * @param {Object} response - Risposta ricevuta
 * @returns {Promise<void>}
 */
const logApiCall = async (request, response) => {
  try {
    const logDir = path.join(process.cwd(), 'logs', 'claude');
    
    // Crea directory se non esiste
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (err) {
      // Ignora errore se la directory esiste già
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const date = timestamp.split('T')[0];
    
    const logEntry = {
      timestamp,
      request: {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        system: request.system
      },
      response: {
        usage: response?.usage,
        status: response ? 'success' : 'error'
      }
    };
    
    // Scrivi log su file
    const logFile = path.join(logDir, `claude-log-${date}.json`);
    
    let logContent = [];
    try {
      const fileExists = await fs.access(logFile).then(() => true).catch(() => false);
      if (fileExists) {
        const content = await fs.readFile(logFile, 'utf8');
        logContent = JSON.parse(content);
      }
    } catch (err) {
      // File non esiste o errore di parsing, usa array vuoto
    }
    
    logContent.push(logEntry);
    await fs.writeFile(logFile, JSON.stringify(logContent, null, 2), 'utf8');
  } catch (error) {
    console.error('Errore nella creazione del log Claude:', error);
  }
};

/**
 * Ottiene il template di prompt specifico con eventuali sostituzioni
 * @param {string} templateName - Nome del template
 * @param {Object} replacements - Oggetto con valori da sostituire
 * @returns {string} - Template con sostituzioni
 */
const getPromptTemplate = (templateName, replacements = {}) => {
  let template = promptTemplates[templateName];
  
  if (!template) {
    console.warn(`Template di prompt "${templateName}" non trovato. Utilizzo di un prompt generico.`);
    template = promptTemplates.base;
  }
  
  // Effettua sostituzioni
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(`{${key}}`, value);
  }
  
  return template;
};

/**
 * Tempo di backoff esponenziale per retry
 * @param {number} attempt - Numero del tentativo corrente
 * @returns {number} - Millisecondi da attendere
 */
const getBackoffTime = (attempt) => {
  return Math.min(
    RETRY_DELAY_MS * Math.pow(2, attempt),
    30000 // Max 30 secondi
  );
};

/**
 * Chiamata all'API Claude con gestione cache e retry
 * @param {Object} options - Opzioni per la chiamata
 * @returns {Promise<Object>} - Risposta dall'API
 */
const callClaudeAPI = async (options = {}) => {
  // Opzioni di default
  const {
    messages,
    system,
    model = CLAUDE_MODEL,
    maxTokens = 1024,
    temperature = 0.7,
    useCache = true,
    requestId = generateCacheKey({ messages, system, model, maxTokens, temperature }),
    attempt = 0
  } = options;
  
  // Verifica parametri obbligatori
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Parametro "messages" obbligatorio e deve essere un array non vuoto');
  }
  
  // Controlla cache
  if (useCache) {
    const cacheKey = generateCacheKey({ messages, system, model, maxTokens, temperature });
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('Risposta Claude recuperata dalla cache');
      return { ...cachedResponse, fromCache: true };
    }
  }
  
  // Verifica se c'è già una richiesta in corso con lo stesso ID
  if (pendingRequests.has(requestId)) {
    console.log(`Richiesta Claude con ID ${requestId} già in corso, attendo...`);
    try {
      return await pendingRequests.get(requestId);
    } catch (error) {
      console.error(`Errore nella richiesta pendente: ${error.message}`);
      // Continua con una nuova richiesta
    }
  }
  
  // Crea una promise per questa richiesta
  const requestPromise = (async () => {
    try {
      const startTime = Date.now();
      
      // Prepara la richiesta
      const requestBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages
      };
      
      // Chiamata all'API
      const response = await axios.post(CLAUDE_API_URL, requestBody, {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: API_TIMEOUT
      });
      
      const responseTime = Date.now() - startTime;
      
      // Log dell'utilizzo
      await logApiCall(requestBody, response.data);
      
      // Formatta la risposta
      const result = {
        content: response.data.content,
        model: response.data.model,
        usage: response.data.usage,
        responseTime,
        id: response.data.id
      };
      
      // Salva in cache
      if (useCache) {
        const cacheKey = generateCacheKey({ messages, system, model, maxTokens, temperature });
        responseCache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error(`Errore nella chiamata a Claude (tentativo ${attempt + 1}/${MAX_RETRIES + 1}):`, error.message);
      
      // Controlla se è un errore che può essere risolto con retry
      const isRetryable = 
        error.response?.status >= 500 || // Errori server
        error.code === 'ECONNABORTED' ||  // Timeout
        error.code === 'EAI_AGAIN' ||     // Problemi di DNS
        error.code === 'ECONNRESET';      // Connessione resettata
      
      // Retry con backoff se possibile
      if (isRetryable && attempt < MAX_RETRIES) {
        const backoffTime = getBackoffTime(attempt);
        console.log(`Attesa di ${backoffTime}ms prima del tentativo ${attempt + 1}...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Rimuovi questa richiesta dalle pendenti prima di riprovare
        pendingRequests.delete(requestId);
        
        // Riprova con incremento del tentativo
        return callClaudeAPI({
          ...options,
          attempt: attempt + 1,
          requestId // Mantieni lo stesso ID
        });
      }
      
      // Se raggiungiamo questo punto, tutti i tentativi sono falliti
      const errorResponse = {
        error: true,
        message: 'Errore nella comunicazione con Claude',
        details: error.message,
        code: error.response?.status || 500
      };
      
      throw errorResponse;
    } finally {
      // Rimuovi questa richiesta dalle pendenti
      pendingRequests.delete(requestId);
    }
  })();
  
  // Registra questa richiesta come in corso
  pendingRequests.set(requestId, requestPromise);
  
  return requestPromise;
};

/**
 * Genera una procedura personalizzata basata sul profilo cliente
 * @param {Object} clientProfile - Profilo del cliente
 * @returns {Promise<Object>} - Procedura generata
 */
const generateCustomProcedure = async (clientProfile) => {
  try {
    if (!clientProfile || !clientProfile.name) {
      throw new Error('Profilo cliente mancante o incompleto');
    }
    
    console.log(`Generazione procedura per cliente: ${clientProfile.name}`);
    
    // Prepara il sommario del cliente
    const clientSummary = `
Nome: ${clientProfile.name}
Tipo attività: ${clientProfile.businessType || 'Non specificato'}
Regime fiscale: ${clientProfile.taxRegime || 'Non specificato'}
Settore: ${clientProfile.sector || 'Non specificato'}
Fatturato annuo: ${clientProfile.annualRevenue ? `€${clientProfile.annualRevenue}` : 'Non specificato'}
Numero dipendenti: ${clientProfile.employeesCount || '0'}
Altre informazioni: ${clientProfile.additionalInfo || 'Nessuna'}
`;
    
    // Ottieni il template e sostituisci i dati del cliente
    const systemPrompt = getPromptTemplate('procedureGeneration', {
      clientDetails: clientSummary
    });
    
    // Previeni chiamate duplicate con lo stesso profilo
    const requestId = generateCacheKey({
      type: 'procedure',
      clientId: clientProfile.id || clientProfile.name,
      clientData: clientSummary
    });
    
    // Chiamata all'API con compression del prompt per risparmiare token
    const result = await callClaudeAPI({
      system: compressPrompt(systemPrompt),
      messages: [
        { role: 'user', content: 'Genera una procedura contabile-fiscale completa per questo cliente.' }
      ],
      maxTokens: 4000, // Spazio per una risposta dettagliata
      temperature: 0.3, // Più deterministico per procedure tecniche
      requestId
    });
    
    return {
      success: true,
      procedure: result.content,
      clientName: clientProfile.name,
      generatedAt: new Date().toISOString(),
      metadata: {
        model: result.model,
        usage: result.usage,
        fromCache: result.fromCache || false
      }
    };
  } catch (error) {
    console.error('Errore nella generazione della procedura:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
      clientName: clientProfile?.name || 'Cliente sconosciuto'
    };
  }
};

/**
 * Analizza documenti caricati ed estrae dati strutturati
 * @param {string} documentContent - Contenuto testuale del documento
 * @param {string} documentType - Tipo di documento (opzionale)
 * @returns {Promise<Object>} - Dati estratti dal documento
 */
const analyzeDocument = async (documentContent, documentType = '') => {
  try {
    if (!documentContent || documentContent.trim().length < 10) {
      throw new Error('Contenuto del documento insufficiente per l\'analisi');
    }
    
    console.log(`Analisi documento di tipo: ${documentType || 'non specificato'}`);
    
    // Ottieni il template per l'analisi
    const systemPrompt = getPromptTemplate('documentAnalysis');
    
    // Aggiungi informazioni sul tipo se disponibili
    let userMessage = 'Analizza questo documento ed estrai tutte le informazioni rilevanti in formato JSON.';
    if (documentType) {
      userMessage = `Analizza questo documento (tipo: ${documentType}) ed estrai tutte le informazioni rilevanti in formato JSON.`;
    }
    
    // Chiamata all'API
    const result = await callClaudeAPI({
      system: systemPrompt,
      messages: [
        { role: 'user', content: `${userMessage}\n\n${documentContent}` }
      ],
      maxTokens: 2500,
      temperature: 0.2 // Molto deterministico per estrazione di dati
    });
    
    // Estrai JSON dalla risposta
    let extractedData;
    try {
      // Cerca il primo blocco JSON nella risposta
      const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/) || 
                        result.content.match(/\{[\s\S]*\}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result.content;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn('Errore parsing JSON dalla risposta Claude:', parseError);
      extractedData = {
        error: 'Formato risposta non valido',
        rawContent: result.content
      };
    }
    
    return {
      success: true,
      data: extractedData,
      documentType: documentType || extractedData.documentType || 'Non specificato',
      metadata: {
        model: result.model,
        usage: result.usage,
        fromCache: result.fromCache || false,
        analyzedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Errore nell\'analisi del documento:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
      documentType: documentType || 'Non specificato'
    };
  }
};

/**
 * Genera risposte a domande comuni in ambito fiscale
 * @param {string} question - Domanda dell'utente
 * @param {Object} clientContext - Contesto del cliente (opzionale)
 * @returns {Promise<Object>} - Risposta generata
 */
const answerFiscalQuestion = async (question, clientContext = null) => {
  try {
    if (!question || question.trim().length < 5) {
      throw new Error('Domanda troppo breve o mancante');
    }
    
    console.log(`Risposta a domanda fiscale${clientContext ? ' con contesto cliente' : ''}`);
    
    // Prepara il contesto del cliente se disponibile
    let clientContextStr = '';
    if (clientContext) {
      clientContextStr = `
Stai rispondendo a una domanda per il cliente:
- Nome: ${clientContext.name}
- Regime fiscale: ${clientContext.taxRegime || 'Non specificato'}
- Tipo attività: ${clientContext.businessType || 'Non specificato'}
- Settore: ${clientContext.sector || 'Non specificato'}
- Altre informazioni rilevanti: ${clientContext.additionalInfo || 'Nessuna'}
`;
    }
    
    // Ottieni il template per le risposte fiscali
    const systemPrompt = getPromptTemplate('fiscalQA', {
      clientContext: clientContextStr
    });
    
    // Chiamata all'API
    const result = await callClaudeAPI({
      system: systemPrompt,
      messages: [
        { role: 'user', content: question }
      ],
      maxTokens: 2000,
      temperature: 0.4 // Equilibrio tra precisione e variabilità
    });
    
    return {
      success: true,
      answer: result.content,
      question,
      clientId: clientContext?.id,
      metadata: {
        model: result.model,
        usage: result.usage,
        fromCache: result.fromCache || false,
        answeredAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Errore nella risposta alla domanda fiscale:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
      question,
      clientId: clientContext?.id
    };
  }
};

/**
 * Suggerisce completamento checklist basato su dati esistenti
 * @param {Object} clientData - Dati cliente disponibili
 * @param {Array} currentChecklist - Stato attuale della checklist
 * @returns {Promise<Object>} - Suggerimenti per completare la checklist
 */
const suggestChecklistCompletion = async (clientData, currentChecklist) => {
  try {
    if (!clientData || !currentChecklist || !Array.isArray(currentChecklist)) {
      throw new Error('Dati cliente o checklist mancanti o in formato non valido');
    }
    
    console.log(`Generazione suggerimenti checklist per cliente: ${clientData.name}`);
    
    // Prepara il riepilogo dei dati cliente
    const clientSummary = JSON.stringify(clientData, null, 2);
    
    // Prepara lo stato attuale della checklist
    const checklistSummary = currentChecklist.map(item => 
      `${item.title}: ${item.completed ? '✓ Completato' : '☐ Non completato'}${item.notes ? ` - Note: ${item.notes}` : ''}`
    ).join('\n');
    
    // Ottieni il template per i suggerimenti checklist
    const systemPrompt = getPromptTemplate('checklistCompletion', {
      clientData: clientSummary,
      currentChecklist: checklistSummary
    });
    
    // Chiamata all'API
    const result = await callClaudeAPI({
      system: compressPrompt(systemPrompt), // Comprimi per risparmiare token
      messages: [
        { role: 'user', content: 'Genera suggerimenti per completare la checklist di questo cliente.' }
      ],
      maxTokens: 2000,
      temperature: 0.3 // Più deterministico per suggerimenti tecnici
    });
    
    return {
      success: true,
      suggestions: result.content,
      clientId: clientData.id,
      checklist: {
        totalItems: currentChecklist.length,
        completedItems: currentChecklist.filter(item => item.completed).length
      },
      metadata: {
        model: result.model,
        usage: result.usage,
        fromCache: result.fromCache || false,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Errore nella generazione suggerimenti checklist:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
      clientId: clientData?.id
    };
  }
};

/**
 * Ottiene statistiche sull'utilizzo dell'API e della cache
 * @returns {Object} - Statistiche di utilizzo
 */
const getUsageStats = async () => {
  try {
    // Recupera statistiche della cache
    const cacheStats = {
      keys: responseCache.keys(),
      hits: responseCache.getStats().hits,
      misses: responseCache.getStats().misses,
      hitRate: responseCache.getStats().hits / 
        (responseCache.getStats().hits + responseCache.getStats().misses || 1) * 100,
      size: responseCache.stats.keys
    };
    
    // Recupera dati di utilizzo dai log
    const logDir = path.join(process.cwd(), 'logs', 'claude');
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `claude-log-${today}.json`);
    
    let todayUsage = {
      totalRequests: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      byEndpoint: {}
    };
    
    try {
      const fileExists = await fs.access(logFile).then(() => true).catch(() => false);
      if (fileExists) {
        const content = await fs.readFile(logFile, 'utf8');
        const logs = JSON.parse(content);
        
        // Calcola l'utilizzo odierno
        todayUsage.totalRequests = logs.length;
        
        for (const log of logs) {
          if (log.response && log.response.usage) {
            todayUsage.totalTokensIn += log.response.usage.input_tokens || 0;
            todayUsage.totalTokensOut += log.response.usage.output_tokens || 0;
          }
          
          // Categorizza per tipo di richiesta
          const requestType = 
            log.request.system?.includes('procedura') ? 'procedure' :
            log.request.system?.includes('analista') ? 'document' :
            log.request.system?.includes('fiscalista') ? 'fiscal' :
            log.request.system?.includes('checklist') ? 'checklist' : 'other';
          
          todayUsage.byEndpoint[requestType] = todayUsage.byEndpoint[requestType] || {
            count: 0,
            tokensIn: 0,
            tokensOut: 0
          };
          
          todayUsage.byEndpoint[requestType].count += 1;
          if (log.response && log.response.usage) {
            todayUsage.byEndpoint[requestType].tokensIn += log.response.usage.input_tokens || 0;
            todayUsage.byEndpoint[requestType].tokensOut += log.response.usage.output_tokens || 0;
          }
        }
      }
    } catch (err) {
      console.error('Errore nel calcolo delle statistiche di utilizzo:', err);
    }
    
    return {
      cache: cacheStats,
      usage: todayUsage,
      pendingRequests: pendingRequests.size,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Errore nel recupero delle statistiche:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Svuota la cache delle risposte
 * @returns {Object} - Risultato dell'operazione
 */
const clearCache = () => {
  const keysCount = responseCache.keys().length;
  responseCache.flushAll();
  console.log(`Cache AI svuotata (${keysCount} chiavi eliminate)`);
  return {
    success: true,
    keysRemoved: keysCount
  };
};

// Inizializza il servizio all'avvio
initialize();

// Esporta le funzioni del modulo
module.exports = {
  generateCustomProcedure,
  analyzeDocument,
  answerFiscalQuestion,
  suggestChecklistCompletion,
  getUsageStats,
  clearCache,
  callClaudeAPI
};