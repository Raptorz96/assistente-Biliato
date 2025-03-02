/**
 * Script per la configurazione di indici ottimizzati su MongoDB
 * 
 * Questo script crea gli indici per migliorare le performance delle query più frequenti,
 * inclusi indici composti, indici text per ricerca full-text e indici TTL per 
 * pulizia automatica. Inoltre definisce le pipeline di aggregazione comuni.
 * 
 * Uso: node scripts/setupIndexes.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Carica variabili d'ambiente
dotenv.config();

// Importa i modelli
const Client = require('../src/models/Client');
const Document = require('../src/models/Document');
const User = require('../src/models/User');
const ClientProcedure = require('../src/models/ClientProcedure');
const Template = require('../src/models/Template');
const ActivityLog = require('../src/models/ActivityLog');
const TempStorage = require('../src/models/TempStorage');

// Database URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/assistente-biliato';

// Configurazione logging
const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'index-setup.log');

// Assicura che la directory dei log esista
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Log con timestamp
 * @param {string} message - Messaggio da loggare
 */
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
};

/**
 * Crea un indice sul modello e registra l'operazione
 * @param {Object} model - Modello Mongoose
 * @param {Object} indexSpec - Specifica dell'indice
 * @param {Object} options - Opzioni indice
 * @returns {Promise<Object>} - Risultato creazione indice
 */
const createIndex = async (model, indexSpec, options = {}) => {
  try {
    const indexName = Object.keys(indexSpec).join('_');
    log(`Creazione indice ${model.modelName}.${indexName}...`);
    
    const result = await model.collection.createIndex(indexSpec, options);
    log(`✓ Indice ${model.modelName}.${result} creato con successo`);
    
    return result;
  } catch (error) {
    log(`✗ Errore nella creazione dell'indice ${model.modelName}.${Object.keys(indexSpec).join('_')}: ${error.message}`);
    throw error;
  }
};

/**
 * Si connette a MongoDB e inizia la configurazione degli indici
 */
const setupIndexes = async () => {
  try {
    log(`Connessione a MongoDB: ${MONGODB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://****:****@')}`);
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    log('Connessione a MongoDB stabilita');
    log('Inizio configurazione indici...');
    
    // ============ INDICI COMPOSTI PER QUERY FREQUENTI ============
    
    // Client
    await createIndex(Client, { name: 1, fiscalCode: 1, vatNumber: 1 }, {
      name: 'idx_client_identity',
      background: true,
      comment: 'Ottimizza ricerche per identificazione cliente, sia per nome che per codici fiscali'
    });
    
    // Document
    await createIndex(Document, { clientId: 1, category: 1, status: 1 }, {
      name: 'idx_document_client_category_status',
      background: true,
      comment: 'Ottimizza ricerche di documenti per cliente, filtrate per categoria e stato'
    });
    
    // ClientProcedure
    await createIndex(ClientProcedure, { clientId: 1, status: 1, startDate: -1 }, {
      name: 'idx_clientprocedure_client_status_date',
      background: true,
      comment: 'Ottimizza ricerche di procedure per cliente, filtrate per stato e ordinate per data'
    });
    
    // User - ottimizzazione per ricerche di utenti per ruolo e stato
    await createIndex(User, { role: 1, status: 1, lastActive: -1 }, {
      name: 'idx_user_role_status_activity',
      background: true,
      comment: 'Ottimizza ricerche utenti per ruolo e stato, ordinate per ultima attività'
    });
    
    // ============ INDICI TEXT PER RICERCA FULL-TEXT ============
    
    // Client - ricerca testuale
    await createIndex(Client, { 
      name: 'text', 
      notes: 'text', 
      'contactInfo.email': 'text',
      'legalRepresentative.firstName': 'text',
      'legalRepresentative.lastName': 'text'
    }, {
      name: 'idx_client_text_search',
      weights: {
        name: 10,
        'legalRepresentative.firstName': 5,
        'legalRepresentative.lastName': 5,
        'contactInfo.email': 3,
        notes: 1
      },
      default_language: 'italian',
      background: true,
      comment: 'Indice di ricerca full-text per clienti'
    });
    
    // Document - ricerca testuale
    await createIndex(Document, { 
      filename: 'text', 
      originalName: 'text', 
      tags: 'text',
      notes: 'text'
    }, {
      name: 'idx_document_text_search',
      weights: {
        originalName: 10,
        filename: 8,
        tags: 5,
        notes: 1
      },
      default_language: 'italian',
      background: true,
      comment: 'Indice di ricerca full-text per documenti'
    });
    
    // ============ INDICI TTL PER PULIZIA AUTOMATICA ============
    
    // TempStorage - elimina record temporanei dopo 24 ore
    await createIndex(TempStorage, { expireAt: 1 }, {
      name: 'idx_tempstorage_ttl',
      expireAfterSeconds: 0, // Usa il campo expireAt per calcolare la scadenza
      background: true,
      comment: 'Indice TTL per pulizia automatica storage temporaneo'
    });
    
    // ActivityLog - elimina log più vecchi di 90 giorni
    await createIndex(ActivityLog, { timestamp: 1 }, {
      name: 'idx_activitylog_ttl',
      expireAfterSeconds: 90 * 24 * 60 * 60, // 90 giorni in secondi
      background: true,
      comment: 'Indice TTL per pulizia automatica log attività vecchi'
    });
    
    // ============ ALTRI INDICI IMPORTANTI ============
    
    // Document - verifica documenti in scadenza
    await createIndex(Document, { 'metadata.expiryDate': 1, status: 1, clientId: 1 }, {
      name: 'idx_document_expiry',
      background: true,
      comment: 'Ottimizza query per documenti in scadenza'
    });
    
    // Client - ottimizzazione per dashboard
    await createIndex(Client, { isActive: 1, accountingRegime: 1, 'onboarding.status': 1 }, {
      name: 'idx_client_dashboard',
      background: true,
      comment: 'Ottimizza query per dashboard clienti'
    });
    
    // ClientProcedure - scadenze e attività
    await createIndex(ClientProcedure, { 'tasks.dueDate': 1, 'tasks.status': 1, 'tasks.assignedTo': 1 }, {
      name: 'idx_clientprocedure_tasks',
      background: true,
      comment: 'Ottimizza query per scadenze e attività'
    });
    
    log('Configurazione indici completata con successo');
    
    // ============ CREAZIONE PIPELINE AGGREGATE ============
    // Nota: Queste pipeline vengono salvate come file JS per essere importate nei controller
    
    log('Creazione pipeline di aggregazione predefinite...');
    
    const aggregationPipelines = {
      // Dashboard di stato cliente
      clientDashboard: [
        // Raggruppamento per regime contabile e stato
        {
          $group: {
            _id: {
              accountingRegime: '$accountingRegime',
              onboardingStatus: '$onboarding.status'
            },
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            avgRevenue: { $avg: '$annualRevenue' },
            clients: { $push: { id: '$_id', name: '$name', email: '$contactInfo.email' } }
          }
        },
        // Riorganizza risultati
        {
          $project: {
            _id: 0,
            regime: '$_id.accountingRegime',
            status: '$_id.onboardingStatus',
            count: 1,
            activeCount: 1,
            avgRevenue: 1,
            clients: { $slice: ['$clients', 5] } // Limita a 5 clienti per gruppo
          }
        },
        // Ordina per conteggio
        { $sort: { count: -1 } }
      ],
      
      // Report attività per utente
      activityReport: [
        // Join con collection User
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        // Unwind array userInfo
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
        // Raggruppa per utente e tipo attività
        {
          $group: {
            _id: {
              userId: '$user',
              activityType: '$activityType',
              month: { $month: '$timestamp' },
              year: { $year: '$timestamp' }
            },
            userName: { $first: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] } },
            userRole: { $first: '$userInfo.role' },
            count: { $sum: 1 },
            lastActivity: { $max: '$timestamp' }
          }
        },
        // Riorganizza risultati
        {
          $project: {
            _id: 0,
            userId: '$_id.userId',
            userName: 1,
            userRole: 1,
            activityType: '$_id.activityType',
            month: '$_id.month',
            year: '$_id.year',
            count: 1,
            lastActivity: 1,
            period: { $concat: [{ $toString: '$_id.month' }, '/', { $toString: '$_id.year' }] }
          }
        },
        // Ordina per periodo e conteggio
        { $sort: { year: -1, month: -1, count: -1 } }
      ],
      
      // Statistiche documenti per categoria
      documentStats: [
        // Raggruppa per categoria e stato
        {
          $group: {
            _id: {
              category: '$category',
              status: '$status'
            },
            count: { $sum: 1 },
            totalSize: { $sum: '$size' },
            avgSize: { $avg: '$size' },
            clients: { $addToSet: '$clientId' }
          }
        },
        // Riorganizza risultati
        {
          $project: {
            _id: 0,
            category: '$_id.category',
            status: '$_id.status',
            count: 1,
            totalSizeMB: { $divide: ['$totalSize', 1048576] }, // Converti in MB
            avgSizeKB: { $divide: ['$avgSize', 1024] }, // Converti in KB
            uniqueClients: { $size: '$clients' }
          }
        },
        // Ordina per categoria e conteggio
        { $sort: { category: 1, count: -1 } }
      ]
    };
    
    // Salva le pipeline nei file
    const pipelineDir = path.join(__dirname, '..', 'src', 'aggregations');
    if (!fs.existsSync(pipelineDir)) {
      fs.mkdirSync(pipelineDir, { recursive: true });
    }
    
    for (const [name, pipeline] of Object.entries(aggregationPipelines)) {
      const filePath = path.join(pipelineDir, `${name}.js`);
      const fileContent = `/**
 * Pipeline di aggregazione: ${name}
 * Generata automaticamente da setupIndexes.js
 */
      
module.exports = ${JSON.stringify(pipeline, null, 2)};`;
      
      fs.writeFileSync(filePath, fileContent);
      log(`Pipeline ${name} salvata in ${filePath}`);
    }
    
    log('Configurazione completata con successo');
  } catch (error) {
    log(`Errore durante la configurazione degli indici: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  } finally {
    // Chiudi la connessione
    await mongoose.connection.close();
    log('Connessione MongoDB chiusa');
  }
};

// Esegui lo script
setupIndexes().catch(error => {
  console.error('Errore non gestito:', error);
  process.exit(1);
});

/**
 * ==== DOCUMENTAZIONE INDICI ====
 * 
 * === INDICI COMPOSTI ===
 * 
 * 1. Client: {name: 1, fiscalCode: 1, vatNumber: 1}
 *    - Query ottimizzate: Ricerche di clienti per nome o codici fiscali
 *    - Performance attesa: Miglioramento 70-90% vs scansione completa
 *    - Impatto scritture: Basso (3 campi semplici)
 *    - Note: I campi sono spesso usati nei filtri dell'interfaccia di ricerca
 * 
 * 2. Document: {clientId: 1, category: 1, status: 1}
 *    - Query ottimizzate: Ricerca documenti per cliente, filtrati per categoria e stato
 *    - Performance attesa: Miglioramento 80-95% su collezioni grandi
 *    - Impatto scritture: Medio (la combinazione più usata nelle query)
 *    - Note: Ordine preciso per massimizzare l'utilizzo (clientId come discriminante principale)
 * 
 * 3. ClientProcedure: {clientId: 1, status: 1, startDate: -1}
 *    - Query ottimizzate: Ricerca procedure per cliente, filtrate per stato e ordinate per data
 *    - Performance attesa: Miglioramento 75-90%, elimina necessstà di SORT in memoria
 *    - Impatto scritture: Medio-basso (aggiornamenti di stato relativamente infrequenti)
 *    - Note: L'ordinamento -1 su startDate permette query "ultime N procedure" efficienti
 * 
 * === INDICI TEXT ===
 * 
 * 1. Client: {name: "text", notes: "text", ...}
 *    - Query ottimizzate: Ricerca full-text di clienti per nome, note o dettagli
 *    - Performance attesa: Ricerca testuale istantanea vs impossibile senza indice
 *    - Impatto scritture: Medio-alto (indici testuali sono pesanti)
 *    - Note: Pesi personalizzati per dare priorità ai campi più rilevanti
 * 
 * 2. Document: {filename: "text", originalName: "text", ...}
 *    - Query ottimizzate: Ricerca full-text nei documenti per nome o contenuto
 *    - Performance attesa: Ricerca testuale istantanea vs impossibile senza indice
 *    - Impatto scritture: Medio-alto (indici testuali sono pesanti)
 *    - Note: Configurato per italiano per migliorare stemming e stop words
 * 
 * === INDICI TTL ===
 * 
 * 1. TempStorage: {expireAt: 1} con expireAfterSeconds: 0
 *    - Funzionalità: Eliminazione automatica dati temporanei
 *    - Impatto: Riduzione spazio disco, no overhead manuale
 *    - Note: Usa il campo expireAt per timing preciso
 * 
 * 2. ActivityLog: {timestamp: 1} con expireAfterSeconds: 7776000 (90 giorni)
 *    - Funzionalità: Pulizia log vecchi
 *    - Impatto: Previene crescita incontrollata della collezione
 *    - Note: Durata personalizzabile modificando expireAfterSeconds
 */