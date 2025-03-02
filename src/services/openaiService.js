/**
 * OpenAI Service
 * 
 * Wrapper avanzato per l'integrazione con l'API di OpenAI che fornisce:
 * - Gestione robusta degli errori
 * - Sistema di caching per risparmiare token
 * - Gestione del rate limiting con backoff esponenziale
 * - Standardizzazione dei prompt
 * - Fallback a risposte predefinite
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Implementazione di una cache in memoria semplice
const responseCache = {
  cache: new Map(),
  ttl: 3600 * 1000, // 1 ora in millisecondi
  
  get(key) {
    if (this.cache.has(key)) {
      const item = this.cache.get(key);
      // Verifica se l'elemento è scaduto
      if (Date.now() - item.timestamp < this.ttl) {
        return item.value;
      } else {
        // Rimuovi elementi scaduti
        this.cache.delete(key);
      }
    }
    return null;
  },
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  },
  
  flushAll() {
    this.cache.clear();
  },
  
  keys() {
    return Array.from(this.cache.keys());
  },
  
  getStats() {
    return {
      hits: 0,
      misses: 0,
      keys: this.cache.size,
      ksize: this.cache.size,
      vsize: this.cache.size
    };
  }
};

// Contatore per il rate limit
let requestCounter = 0;
let lastRequestTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 60; // Adatta in base al tuo piano OpenAI

// Configurazione OpenAI
let openaiApi = null;
let initialized = false;

// Repository di prompt standard
const promptTemplates = {
  assistant: `Sei un assistente AI per uno studio commercialista italiano. 
Rispondi in modo professionale e preciso a domande su contabilità, fiscalità e normative italiane.
Fornisci risposte dettagliate e pratiche, citando quando opportuno le normative o riferimenti legislativi pertinenti.`,
  
  documentAnalysis: `Sei un assistente specializzato nell'analisi di documenti contabili e fiscali italiani.
Analizza il seguente documento ed estrai tutte le informazioni rilevanti come:
- Nome dell'azienda o persona fisica
- Codice fiscale e/o partita IVA
- Tipo di documento
- Date rilevanti
- Importi
- Qualsiasi altro dato significativo

Fornisci i dati in formato JSON strutturato con campi chiari e significativi.
Aggiungi anche un campo "recommendations" con eventuali suggerimenti contabili o fiscali basati sulle informazioni del documento.`,
  
  procedureGeneration: `Sei un esperto di procedure contabili e fiscali italiane.
Genera una procedura operativa dettagliata per un cliente con le seguenti caratteristiche:
{clientDetails}

La procedura deve includere:
- Attività periodiche (mensili, trimestrali, annuali)
- Scadenze fiscali pertinenti
- Documentazione necessaria
- Passaggi operativi dettagliati
- Suggerimenti personalizzati in base al tipo di attività`
};

/**
 * Inizializza il servizio OpenAI
 * @returns {boolean} Stato dell'inizializzazione
 */
const initialize = () => {
  if (initialized) return true;

  try {
    // Verifica API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('Errore: OPENAI_API_KEY non configurata nelle variabili d\'ambiente');
      return false;
    }
    
    openaiApi = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    initialized = true;
    
    console.log('OpenAI Service inizializzato con successo');
    return true;
  } catch (error) {
    console.error('Errore nell\'inizializzazione di OpenAI Service:', error);
    return false;
  }
};

/**
 * Genera un hash MD5 di un oggetto per usarlo come chiave di cache
 * @param {Object} obj - Oggetto da hashare
 * @returns {string} - Hash MD5
 */
const generateCacheKey = (obj) => {
  const str = JSON.stringify(obj);
  return crypto.createHash('md5').update(str).digest('hex');
};

/**
 * Ottiene il tempo di attesa in base al numero di tentativi
 * @param {number} retryCount - Numero di tentativi
 * @returns {number} - Tempo di attesa in millisecondi
 */
const getBackoffTime = (retryCount) => {
  // Backoff esponenziale: 1s, 2s, 4s, 8s, 16s
  return Math.pow(2, retryCount) * 1000;
};

/**
 * Verifica e gestisce il rate limiting
 * @returns {Promise<boolean>} - True se la richiesta può procedere
 */
const checkRateLimit = async () => {
  const now = Date.now();
  const elapsedMs = now - lastRequestTime;
  
  // Reset contatore se è passato più di un minuto
  if (elapsedMs > 60000) {
    requestCounter = 0;
    lastRequestTime = now;
    return true;
  }
  
  // Controlla se abbiamo raggiunto il limite
  if (requestCounter >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - elapsedMs + 100; // Attendi fino a fine minuto + 100ms margine
    console.warn(`Rate limit OpenAI raggiunto. Attesa di ${waitTime}ms prima della prossima richiesta.`);
    
    // Attendi fino al reset del rate limit
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    requestCounter = 0;
    lastRequestTime = Date.now();
    return true;
  }
  
  // Incrementa contatore
  requestCounter++;
  return true;
};

/**
 * Crea un registro delle richieste all'API
 * @param {Object} request - Dettagli della richiesta
 * @param {Object} response - Risposta ricevuta
 * @returns {Promise<void>}
 */
const logApiCall = async (request, response) => {
  if (process.env.NODE_ENV !== 'development') return; // Log solo in sviluppo
  
  try {
    const logDir = path.join(process.cwd(), 'logs', 'openai');
    
    // Crea directory se non esiste
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (err) {
      // Ignora errore se la directory esiste già
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logEntry = {
      timestamp,
      request: {
        model: request.model,
        prompt: request.messages,
        temperature: request.temperature,
        maxTokens: request.max_tokens
      },
      response: {
        model: response?.model,
        tokens: response?.usage,
        status: response ? 'success' : 'error'
      }
    };
    
    // Scrivi log su file
    const logFile = path.join(logDir, `openai-log-${timestamp.split('T')[0]}.json`);
    
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
    console.error('Errore nella creazione del log OpenAI:', error);
  }
};

/**
 * Chiamata principale all'API ChatGPT con gestione cache, errori e retry
 * @param {Object} options - Configurazione della richiesta
 * @returns {Promise<Object>} - Risposta elaborata
 */
const callChatGPT = async (options = {}) => {
  // Verifica inizializzazione
  if (!initialized && !initialize()) {
    throw new Error('OpenAI Service non inizializzato');
  }
  
  // Imposta valori di default
  const {
    messages,
    model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature = 0.7,
    maxTokens = 1000,
    useCache = true,
    retryOnError = true,
    retryCount = 0,
    maxRetries = 3
  } = options;
  
  // Verifica parametri obbligatori
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Parametro "messages" obbligatorio e deve essere un array non vuoto');
  }
  
  // Controlla cache se abilitata
  if (useCache) {
    const cacheKey = generateCacheKey({ messages, model, temperature, maxTokens });
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('Risposta recuperata dalla cache');
      return { ...cachedResponse, fromCache: true };
    }
  }
  
  // Controlla rate limit
  await checkRateLimit();
  
  try {
    // Prepara i parametri della richiesta
    const requestParams = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };
    
    // Invia richiesta a OpenAI
    const startTime = Date.now();
    const response = await openaiApi.chat.completions.create(requestParams);
    const responseTime = Date.now() - startTime;
    
    // Log della chiamata API
    await logApiCall(requestParams, response);
    
    // Estrai e struttura la risposta
    const result = {
      answer: response.choices[0].message.content,
      model: response.model,
      usage: response.usage,
      responseTime,
      id: response.id
    };
    
    // Memorizza nella cache se abilitata
    if (useCache) {
      const cacheKey = generateCacheKey({ messages, model, temperature, maxTokens });
      responseCache.set(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error(`Errore nella chiamata a OpenAI (tentativo ${retryCount + 1}/${maxRetries + 1}):`, error.message);
    
    // Retry con backoff esponenziale se abilitato e non abbiamo raggiunto il massimo
    if (retryOnError && retryCount < maxRetries) {
      const backoffTime = getBackoffTime(retryCount);
      console.log(`Attesa di ${backoffTime}ms prima del prossimo tentativo...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      return callChatGPT({
        ...options,
        retryCount: retryCount + 1
      });
    }
    
    // Se raggiungiamo questo punto, tutti i tentativi sono falliti
    return {
      error: true,
      message: 'Errore nella comunicazione con OpenAI',
      details: error.message,
      code: error.response?.status || 500
    };
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
    template = 'Sei un assistente AI utile ed esperto.';
  }
  
  // Effettua sostituzioni
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(`{${key}}`, value);
  }
  
  return template;
};

/**
 * Ottiene statistiche sulla cache
 * @returns {Object} Statistiche della cache
 */
const getCacheStats = () => {
  return {
    keys: responseCache.keys(),
    stats: responseCache.getStats(),
    hitRate: responseCache.getStats().hits / (responseCache.getStats().hits + responseCache.getStats().misses) * 100
  };
};

/**
 * Svuota la cache delle risposte
 */
const clearCache = () => {
  responseCache.flushAll();
  console.log('Cache OpenAI svuotata');
};

/**
 * Risponde a una domanda con contesto cliente opzionale
 * @param {string} question - La domanda dell'utente
 * @param {Object} clientContext - Contesto sul cliente (opzionale)
 * @returns {Promise<Object>} - Risposta generata dall'AI
 */
const answerQuestion = async (question, clientContext = null) => {
  try {
    if (!question) {
      throw new Error('Domanda mancante');
    }
    
    console.log('Risposta alla domanda tramite OpenAI:', question);
    
    // Costruisci il prompt con il contesto
    let systemPrompt = getPromptTemplate('assistant');
    
    // Aggiungi dettagli del contesto se disponibili
    if (clientContext) {
      console.log('Contesto cliente:', clientContext.name);
      systemPrompt += `\nStai rispondendo a una domanda per il cliente: ${clientContext.name}, 
con regime fiscale: ${clientContext.accountingRegime || 'non specificato'}, 
tipo attività: ${clientContext.businessSector || 'non specificato'}.`;
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];
    
    // Chiamata all'API
    const result = await callChatGPT({ messages });
    
    // Gestione errori
    if (result.error) {
      return {
        answer: `Mi dispiace, non sono riuscito a elaborare la tua domanda: "${question}". ${result.message}`,
        error: result.details,
        errorCode: result.code,
        sources: [],
        confidence: 0
      };
    }
    
    // Estrai la risposta
    return {
      answer: result.answer,
      sources: [], // OpenAI non fornisce fonti direttamente
      confidence: 0.92, // Valore fisso per compatibilità
      model: result.model,
      usage: result.usage,
      fromCache: result.fromCache || false
    };
  } catch (error) {
    console.error('Errore nella risposta alla domanda:', error);
    return {
      answer: `Mi dispiace, si è verificato un errore durante l'elaborazione della tua domanda. Per favore, riprova più tardi.`,
      error: error.message,
      confidence: 0,
      sources: []
    };
  }
};

/**
 * Analizza un documento e ne estrae informazioni rilevanti
 * @param {string} documentText - Testo del documento da analizzare
 * @returns {Promise<Object>} - Analisi del documento
 */
const analyzeDocument = async (documentText) => {
  try {
    if (!documentText) {
      throw new Error('Testo del documento mancante');
    }
    
    console.log('Analisi documento tramite OpenAI');
    
    const systemPrompt = getPromptTemplate('documentAnalysis');
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: documentText }
    ];
    
    // Chiamata all'API
    const result = await callChatGPT({ 
      messages,
      temperature: 0.5, // Più deterministico
      maxTokens: 1500  // Output più lungo per analisi dettagliate
    });
    
    // Gestione errori
    if (result.error) {
      return {
        success: false,
        error: result.message,
        details: result.details
      };
    }
    
    // Prova a convertire la risposta in JSON
    let analysisJson;
    try {
      analysisJson = JSON.parse(result.answer);
    } catch (jsonError) {
      // Se non è un JSON valido, usa il testo come è
      analysisJson = {
        rawAnalysis: result.answer,
        parsingError: "La risposta non è in formato JSON valido"
      };
    }
    
    return {
      success: true,
      analysis: analysisJson,
      model: result.model,
      usage: result.usage,
      fromCache: result.fromCache || false
    };
  } catch (error) {
    console.error('Errore nell\'analisi del documento:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Genera una procedura personalizzata per un cliente
 * @param {Object} clientProfile - Profilo cliente completo
 * @returns {Promise<Object>} - Procedura generata
 */
const generateProcedure = async (clientProfile) => {
  try {
    if (!clientProfile) {
      throw new Error('Profilo cliente mancante');
    }
    
    console.log('Generazione procedura per cliente:', clientProfile.name);
    
    // Prepara il riepilogo del cliente per il prompt
    const clientSummary = `
Nome: ${clientProfile.name}
Tipo: ${clientProfile.companyType || 'Non specificato'}
Regime contabile: ${clientProfile.accountingRegime || 'Non specificato'}
Settore: ${clientProfile.businessSector || 'Non specificato'}
Fatturato annuo: ${clientProfile.annualRevenue ? clientProfile.annualRevenue + '€' : 'Non specificato'}
Dipendenti: ${clientProfile.employees || 'Nessuno'}
`;
    
    const systemPrompt = getPromptTemplate('procedureGeneration', {
      clientDetails: clientSummary
    });
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Genera una procedura operativa contabile personalizzata per questo cliente.' }
    ];
    
    // Chiamata all'API
    const result = await callChatGPT({
      messages,
      maxTokens: 2000, // Output più lungo per procedure dettagliate
      temperature: 0.7
    });
    
    // Gestione errori
    if (result.error) {
      return {
        success: false,
        error: result.message,
        details: result.details
      };
    }
    
    return {
      success: true,
      procedureText: result.answer,
      model: result.model,
      usage: result.usage,
      fromCache: result.fromCache || false,
      generatedDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Errore nella generazione della procedura cliente:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Inizializza il servizio all'avvio
initialize();

module.exports = {
  initialize,
  answerQuestion,
  analyzeDocument,
  generateProcedure,
  callChatGPT,
  getCacheStats,
  clearCache,
  getPromptTemplate
};