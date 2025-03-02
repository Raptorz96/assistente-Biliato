/**
 * Servizio di assistenza AI
 * Wrapper per l'integrazione con OpenAI o Claude in base alla disponibilità
 */

// Servizio principale
let aiService;

// Determina quale servizio AI utilizzare in base alla disponibilità
try {
  // Prima prova il servizio Claude
  aiService = require('./aiService');
  console.log('Utilizzo servizio Claude AI');
} catch (error) {
  try {
    // Fallback al servizio OpenAI
    aiService = require('./openaiService');
    console.log('Utilizzo servizio OpenAI (fallback)');
  } catch (openaiError) {
    console.error('Errore nel caricamento dei servizi AI:', error);
    console.error('Errore nel fallback a OpenAI:', openaiError);
    
    // Mock del servizio per sviluppo senza API esterne
    aiService = {
      answerQuestion: async (question, context) => {
        console.log('Utilizzo mock del servizio AI (solo sviluppo)');
        return {
          answer: `[MOCK] Risposta alla domanda: "${question}" ${context ? `per il cliente ${context.name}` : ''}`,
          sources: [],
          model: 'mock-model',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          fromCache: false
        };
      },
      analyzeDocument: async (text) => {
        return {
          analysis: { type: 'mock-analysis', content: text.substring(0, 100) + '...' },
          confidence: 0.5
        };
      },
      generateProcedure: async (clientProfile) => {
        return {
          success: true,
          procedure: `[MOCK] Procedura generata per ${clientProfile.name}`,
          metadata: { model: 'mock-model' }
        };
      }
    };
  }
}

/**
 * Risponde a una domanda utilizzando l'assistente AI
 * @param {string} question - La domanda dell'utente
 * @param {Object} clientContext - Contesto del cliente (opzionale)
 * @returns {Promise<Object>} - Risposta generata
 */
exports.answerQuestion = async (question, clientContext = null) => {
  try {
    if (aiService.answerFiscalQuestion) {
      // Usa il servizio Claude
      return await aiService.answerFiscalQuestion(question, clientContext);
    } else if (aiService.answerQuestion) {
      // Usa il servizio OpenAI
      return await aiService.answerQuestion(question, clientContext);
    } else {
      throw new Error('Nessun metodo compatibile trovato per rispondere alle domande');
    }
  } catch (error) {
    console.error('Errore nel servizio AI:', error);
    return {
      answer: 'Mi dispiace, si è verificato un errore nel processare la tua domanda. Riprova più tardi.',
      error: error.message,
      sources: []
    };
  }
};

/**
 * Analizza documenti e ne estrae informazioni
 * @param {Array<string>} documentPaths - Percorsi dei documenti
 * @returns {Promise<Object>} - Risultato dell'analisi
 */
exports.analyzeDocuments = async (documentPaths) => {
  try {
    // Implementazione base - da espandere
    const fs = require('fs').promises;
    
    const results = [];
    for (const path of documentPaths) {
      try {
        // Leggi il documento
        const content = await fs.readFile(path, 'utf8');
        
        // Analizza con AI
        const analysis = await analyzeDocumentContent(content, path);
        
        results.push({
          path,
          success: true,
          ...analysis
        });
      } catch (docError) {
        results.push({
          path,
          success: false,
          error: docError.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Errore nell\'analisi dei documenti:', error);
    throw error;
  }
};

/**
 * Analizza il contenuto di un documento
 * @param {string} content - Contenuto del documento
 * @param {string} filePath - Percorso del file (per determinare il tipo)
 * @returns {Promise<Object>} - Risultato dell'analisi
 */
async function analyzeDocumentContent(content, filePath) {
  try {
    // Determina il tipo di documento in base all'estensione
    const path = require('path');
    const extension = path.extname(filePath).toLowerCase();
    
    // Limita la dimensione del contenuto
    const maxLength = 10000;
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '...[TRUNCATED]' 
      : content;
    
    let documentType = '';
    if (['.pdf', '.doc', '.docx'].includes(extension)) {
      documentType = 'document';
    } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
      documentType = 'image';
    } else if (['.txt', '.csv'].includes(extension)) {
      documentType = 'text';
    }
    
    // Usa il servizio AI appropriato per l'analisi
    if (aiService.analyzeDocument) {
      return await aiService.analyzeDocument(truncatedContent, documentType);
    } else {
      // Implementazione di fallback
      return {
        type: documentType,
        analysis: {
          summary: 'Analisi automatica non disponibile',
          content: truncatedContent.substring(0, 200) + '...'
        }
      };
    }
  } catch (error) {
    console.error('Errore nell\'analisi del contenuto:', error);
    return {
      error: error.message,
      analysis: null
    };
  }
}

/**
 * Genera una procedura personalizzata per un cliente
 * @param {Object} clientProfile - Profilo del cliente
 * @returns {Promise<Object>} - Procedura generata
 */
exports.generateCustomProcedure = async (clientProfile) => {
  try {
    if (aiService.generateCustomProcedure) {
      // Usa il servizio Claude
      return await aiService.generateCustomProcedure(clientProfile);
    } else if (aiService.generateProcedure) {
      // Usa il servizio OpenAI
      return await aiService.generateProcedure(clientProfile);
    } else {
      throw new Error('Nessun metodo compatibile trovato per generare procedure');
    }
  } catch (error) {
    console.error('Errore nella generazione della procedura:', error);
    return {
      success: false,
      error: error.message,
      procedure: null
    };
  }
};