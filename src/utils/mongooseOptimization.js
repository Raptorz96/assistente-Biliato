/**
 * Utility per ottimizzare le performance e la scalabilità di MongoDB/Mongoose
 * 
 * Questo modulo fornisce funzionalità per migliorare le performance delle query,
 * implementare strategie di caching, ottimizzare le operazioni di bulk e
 * monitorare le performance del database.
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');
const { performance } = require('perf_hooks');

// Configurazione Redis dal file .env o valori predefiniti
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL) || 3600; // 1 ora di default

// Configurazione soglie per performance query
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 1000; // 1 secondo

// Istanza Redis condivisa per caching
let redisClient = null;

/**
 * Inizializza la connessione Redis per il caching
 * @returns {Object} Client Redis
 */
const initRedis = () => {
  if (!redisClient) {
    try {
      redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        maxRetriesPerRequest: 3
      });
      
      redisClient.on('error', (err) => {
        console.error('Errore connessione Redis:', err);
        redisClient = null;
      });
      
      console.log('Connessione Redis inizializzata per cache query');
    } catch (error) {
      console.error('Errore inizializzazione Redis:', error);
      redisClient = null;
    }
  }
  
  return redisClient;
};

// ========================= MIDDLEWARE GLOBALI =========================

/**
 * Middleware Lean: ottimizza le query di sola lettura omettendo metodi e virtuals
 * 
 * @param {Object} schema - Schema Mongoose
 * @returns {Object} Schema modificato con metodo lean query
 */
const addLeanQueryHelper = (schema) => {
  schema.query.leanSelect = function(fields = '') {
    return this.lean().select(fields);
  };
  
  return schema;
};

/**
 * Middleware Select: ottimizza il caricamento dei campi necessari
 * 
 * @param {Object} schema - Schema Mongoose
 * @returns {Object} Schema modificato con metodo selectOnly
 */
const addSelectHelper = (schema) => {
  schema.query.selectOnly = function(fields = '') {
    if (!fields) return this;
    
    // Converti array a stringa se necessario
    const fieldSelector = Array.isArray(fields) 
      ? fields.join(' ') 
      : fields;
    
    return this.select(fieldSelector);
  };
  
  return schema;
};

/**
 * Middleware Cache: implementa il caching Redis per query frequenti
 * 
 * @param {Object} schema - Schema Mongoose
 * @returns {Object} Schema modificato con metodo cache
 */
const addCacheHelper = (schema) => {
  schema.query.cache = async function(ttl = REDIS_CACHE_TTL) {
    const redis = initRedis();
    if (!redis) return this.exec();
    
    // Crea una chiave cache basata sulla query
    const key = JSON.stringify({
      model: this.model.modelName,
      query: this.getQuery(),
      options: this.getOptions(),
      collection: this.mongooseCollection.name
    });
    
    // Genera hash per ridurre dimensione chiave
    const hashedKey = require('crypto')
      .createHash('md5')
      .update(key)
      .digest('hex');
      
    const cacheKey = `query:${hashedKey}`;
    
    try {
      // Verifica se la risposta è in cache
      const cachedResult = await redis.get(cacheKey);
      
      if (cachedResult) {
        // Restituisci risultato dalla cache
        return JSON.parse(cachedResult);
      }
      
      // Esegui query se non c'è cache
      const result = await this.exec();
      
      // Salva risultato in cache
      await redis.set(cacheKey, JSON.stringify(result), 'EX', ttl);
      
      return result;
    } catch (error) {
      console.error('Errore nel caching della query:', error);
      // In caso di errore di cache, esegui la query normalmente
      return this.exec();
    }
  };
  
  return schema;
};

// ========================= FUNZIONI DI OTTIMIZZAZIONE =========================

/**
 * Funzione per ottimizzare aggregazioni per report complessi
 * 
 * @param {Object} model - Modello Mongoose
 * @param {Array} pipeline - Pipeline di aggregazione
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<Array>} Risultati dell'aggregazione
 */
const optimizedAggregation = async (model, pipeline, options = {}) => {
  // Misura tempo di esecuzione
  const startTime = performance.now();
  
  // Opzioni predefinite ottimizzate
  const defaultOptions = {
    allowDiskUse: true, // Consente l'uso del disco per aggregazioni con grandi dataset
    maxTimeMS: 60000,   // Timeout di 60 secondi per evitare query infinite
    explain: false,     // Se true, restituisce il piano di esecuzione invece dei risultati
    ...options
  };
  
  try {
    // Esegui aggregazione con opzioni ottimizzate
    const result = await model.aggregate(pipeline).option(defaultOptions);
    
    // Calcola tempo di esecuzione
    const executionTime = performance.now() - startTime;
    
    // Log per query lente
    if (executionTime > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`Aggregazione lenta (${executionTime.toFixed(2)}ms) su ${model.modelName}`);
      // Opzionalmente, salva log delle query lente per analisi
      logSlowQuery(model.modelName, 'aggregate', pipeline, executionTime);
    }
    
    return result;
  } catch (error) {
    console.error(`Errore nell'aggregazione su ${model.modelName}:`, error);
    throw error;
  }
};

/**
 * Generatore di query ottimizzate che implementa pattern builder
 * 
 * @param {Object} model - Modello Mongoose
 * @returns {Object} Query builder
 */
const queryBuilder = (model) => {
  let queryObj = model.find();
  let fieldsToSelect = [];
  let cacheTTL = null;
  let isLeanQuery = false;
  let populateOptions = [];
  let sortOptions = {};
  
  return {
    // Filtri
    where: (conditions) => {
      queryObj = queryObj.find(conditions);
      return this;
    },
    
    // Proiezione campi
    select: (fields) => {
      fieldsToSelect = fields;
      return this;
    },
    
    // Gestione relazioni
    populate: (field, options = {}) => {
      populateOptions.push({ path: field, ...options });
      return this;
    },
    
    // Ordinamento
    sort: (criteria) => {
      sortOptions = criteria;
      return this;
    },
    
    // Paginazione
    paginate: (page = 1, limit = 10) => {
      queryObj = queryObj.skip((page - 1) * limit).limit(limit);
      return this;
    },
    
    // Ottimizzazioni
    lean: () => {
      isLeanQuery = true;
      return this;
    },
    
    // Cache
    cache: (ttl) => {
      cacheTTL = ttl;
      return this;
    },
    
    // Esecuzione
    exec: async () => {
      // Applica select fields
      if (fieldsToSelect.length > 0) {
        queryObj = queryObj.select(fieldsToSelect.join(' '));
      }
      
      // Applica lean per ottimizzazione memoria
      if (isLeanQuery) {
        queryObj = queryObj.lean();
      }
      
      // Applica populate
      populateOptions.forEach(option => {
        queryObj = queryObj.populate(option);
      });
      
      // Applica ordinamento
      if (Object.keys(sortOptions).length > 0) {
        queryObj = queryObj.sort(sortOptions);
      }
      
      // Applica cache se configurata
      if (cacheTTL !== null && redisClient) {
        return queryObj.cache(cacheTTL);
      }
      
      // Esegui query
      return queryObj.exec();
    },
    
    // Piano di esecuzione per debug
    explain: async () => {
      return queryObj.explain();
    }
  };
};

/**
 * Gestione efficiente di operazioni bulk per import/modifiche di massa
 * 
 * @param {Object} model - Modello Mongoose
 * @param {Array} operations - Operazioni da eseguire
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<Object>} Risultato delle operazioni bulk
 */
const bulkOperations = async (model, operations, options = {}) => {
  // Opzioni predefinite
  const defaultOptions = {
    ordered: false,      // Non si ferma al primo errore
    bypassDocumentValidation: false,
    ...options
  };
  
  try {
    // Crea batch di dimensione appropriata per ottimizzare performance
    const BATCH_SIZE = 1000;
    const batches = [];
    
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      batches.push(operations.slice(i, i + BATCH_SIZE));
    }
    
    // Risultati aggregati
    const results = {
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      errors: []
    };
    
    // Esegui operazioni in batch
    for (const batch of batches) {
      const bulkOp = model.collection.initializeUnorderedBulkOp();
      
      batch.forEach(op => {
        if (op.insertOne) {
          bulkOp.insert(op.insertOne.document);
        } else if (op.updateOne) {
          bulkOp.find(op.updateOne.filter).updateOne(op.updateOne.update);
        } else if (op.updateMany) {
          bulkOp.find(op.updateMany.filter).update(op.updateMany.update);
        } else if (op.deleteOne) {
          bulkOp.find(op.deleteOne.filter).deleteOne();
        } else if (op.deleteMany) {
          bulkOp.find(op.deleteMany.filter).delete();
        } else if (op.replaceOne) {
          bulkOp.find(op.replaceOne.filter).replaceOne(op.replaceOne.replacement);
        }
      });
      
      // Esegui operazioni batch
      if (bulkOp.length > 0) {
        const result = await bulkOp.execute(defaultOptions);
        
        // Aggregazione risultati
        results.insertedCount += result.nInserted || 0;
        results.matchedCount += result.nMatched || 0;
        results.modifiedCount += result.nModified || 0;
        results.deletedCount += result.nRemoved || 0;
        results.upsertedCount += result.nUpserted || 0;
        
        if (result.writeErrors && result.writeErrors.length > 0) {
          results.errors = [...results.errors, ...result.writeErrors];
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Errore nell\'esecuzione di operazioni bulk:', error);
    throw error;
  }
};

// ========================= MONITORAGGIO PERFORMANCE =========================

/**
 * Registra e monitora query lente per ottimizzazione
 * 
 * @param {String} model - Nome del modello
 * @param {String} operation - Operazione eseguita
 * @param {Object} query - Query eseguita
 * @param {Number} executionTime - Tempo di esecuzione in ms
 */
const logSlowQuery = (model, operation, query, executionTime) => {
  // Formatta la query per la visualizzazione
  const queryString = typeof query === 'object' ? 
    JSON.stringify(query, null, 2) : 
    String(query);
  
  // Log dettagliato per analisi
  const logEntry = {
    timestamp: new Date(),
    model,
    operation,
    query: queryString,
    executionTime
  };
  
  // Salva in console per sviluppo
  console.warn(`Query lenta rilevata: ${model}.${operation} - ${executionTime.toFixed(2)}ms`);
  
  // In ambiente di produzione, salvare su file di log o database
  if (process.env.NODE_ENV === 'production') {
    // Qui logica per salvare su file/database
    const fs = require('fs');
    const logPath = process.env.SLOW_QUERY_LOG_PATH || './logs/slow-queries.log';
    
    fs.appendFile(
      logPath, 
      JSON.stringify(logEntry) + '\n', 
      (err) => { if (err) console.error('Errore nel log query lente:', err); }
    );
  }
};

/**
 * Raccoglie metriche sullo stato della connessione MongoDB
 * 
 * @returns {Object} Metriche della connessione
 */
const getConnectionMetrics = async () => {
  const connection = mongoose.connection;
  
  if (!connection || connection.readyState !== 1) {
    return { status: 'disconnesso' };
  }
  
  try {
    // Base stats
    const metrics = {
      status: 'connesso',
      host: connection.host,
      port: connection.port,
      dbName: connection.db.databaseName,
      collections: Object.keys(connection.collections).length,
      models: Object.keys(mongoose.models).length
    };
    
    // Solo in produzione, ottieni metriche avanzate
    if (process.env.NODE_ENV === 'production') {
      const client = connection.getClient();
      
      // Pool stats
      const serverStatus = await client.db().admin().serverStatus();
      if (serverStatus && serverStatus.connections) {
        metrics.connections = {
          current: serverStatus.connections.current,
          available: serverStatus.connections.available,
          totalCreated: serverStatus.connections.totalCreated
        };
      }
      
      // Operazioni attive
      const currentOps = await client.db().admin().command({ 
        currentOp: 1, 
        active: true 
      });
      
      if (currentOps && currentOps.inprog) {
        metrics.activeOperations = currentOps.inprog.length;
        
        // Classifica per tipo di operazione
        const opsByType = {};
        currentOps.inprog.forEach(op => {
          opsByType[op.op] = (opsByType[op.op] || 0) + 1;
        });
        metrics.operationsByType = opsByType;
      }
    }
    
    return metrics;
  } catch (error) {
    console.error('Errore nel recupero metriche di connessione:', error);
    return { 
      status: 'errore',
      error: error.message
    };
  }
};

/**
 * Debug di query complesse con spiegazione del piano di esecuzione
 * 
 * @param {Object} query - Query Mongoose
 * @returns {Promise<Object>} Piano di esecuzione
 */
const explainQuery = async (query) => {
  try {
    // Evita modifiche alla query originale
    const explainable = query.model.find().merge(query);
    
    // Ottieni il piano di esecuzione completo
    const executionPlan = await explainable.explain('executionStats');
    
    // Estrai informazioni rilevanti per debugging
    const summary = {
      queryPlanner: {
        plannerVersion: executionPlan.queryPlanner.plannerVersion,
        winningPlan: executionPlan.queryPlanner.winningPlan,
        rejectedPlans: executionPlan.queryPlanner.rejectedPlans
      },
      executionStats: {
        executionSuccess: executionPlan.executionStats.executionSuccess,
        executionTimeMillis: executionPlan.executionStats.executionTimeMillis,
        totalKeysExamined: executionPlan.executionStats.totalKeysExamined,
        totalDocsExamined: executionPlan.executionStats.totalDocsExamined,
        nReturned: executionPlan.executionStats.nReturned
      }
    };
    
    // Analisi dell'efficienza
    const efficiency = {
      documentsPerKeyRatio: summary.executionStats.totalKeysExamined > 0 
        ? summary.executionStats.nReturned / summary.executionStats.totalKeysExamined 
        : 0,
      documentsScannedPerReturned: summary.executionStats.nReturned > 0 
        ? summary.executionStats.totalDocsExamined / summary.executionStats.nReturned 
        : 0,
      performance: summary.executionStats.totalDocsExamined === summary.executionStats.nReturned ? 'Ottimale' :
                  summary.executionStats.totalDocsExamined <= summary.executionStats.nReturned * 3 ? 'Buona' : 
                  summary.executionStats.totalDocsExamined <= summary.executionStats.nReturned * 10 ? 'Migliorabile' : 'Scarsa'
    };
    
    // Rilevamento stage potenzialmente problematici
    const stagesAnalysis = [];
    const findStages = (plan, path = '') => {
      if (!plan) return;
      
      // Analisi stage corrente
      if (plan.stage) {
        // Rileva stage che possono indicare problemi
        if (['COLLSCAN', 'SORT', 'SORT_KEY_GENERATOR'].includes(plan.stage)) {
          stagesAnalysis.push({
            path: path || 'root',
            stage: plan.stage,
            issue: plan.stage === 'COLLSCAN' ? 
              'Scansione completa collezione - considerare indice' : 
              'Ordinamento in memoria - considerare indice per sort'
          });
        }
      }
      
      // Analisi ricorsiva dei sotto-piani
      if (plan.inputStage) {
        findStages(plan.inputStage, path ? `${path}.inputStage` : 'inputStage');
      }
      
      // Analisi piani in parallelo
      if (plan.inputStages) {
        plan.inputStages.forEach((stage, i) => {
          findStages(stage, path ? `${path}.inputStages[${i}]` : `inputStages[${i}]`);
        });
      }
    };
    
    findStages(summary.queryPlanner.winningPlan);
    
    return {
      summary,
      efficiency,
      suggerimenti: stagesAnalysis,
      dettaglio: executionPlan
    };
  } catch (error) {
    console.error('Errore nell\'analisi della query:', error);
    throw error;
  }
};

// ========================= ESPORTAZIONE MODULO =========================

module.exports = {
  // Plugin Mongoose
  addLeanQueryHelper,
  addSelectHelper,
  addCacheHelper,
  
  // Funzioni di ottimizzazione
  optimizedAggregation,
  queryBuilder,
  bulkOperations,
  
  // Monitoraggio performance
  logSlowQuery,
  getConnectionMetrics,
  explainQuery,
  
  // Configurazione Redis
  initRedis
};

/**
 * Documentazione d'uso delle tecniche di ottimizzazione
 * 
 * === QUANDO USARE LE DIVERSE TECNICHE ===
 * 
 * 1. LEAN QUERIES:
 *    - Usare per query di sola lettura dove non servono virtuals o metodi
 *    - Perfetto per API che restituiscono grandi quantità di dati
 *    - Riduce significativamente l'uso della memoria
 *    - Esempio: Model.find().lean() o con helper Model.find().leanSelect()
 * 
 * 2. SELECT FIELDS:
 *    - Usare quando non sono necessari tutti i campi di un documento
 *    - Riduce traffico di rete e utilizzo memoria
 *    - Particolarmente utile per collezioni con documenti di grandi dimensioni
 *    - Esempio: Model.find().select('campo1 campo2') o con helper Model.find().selectOnly(['campo1', 'campo2'])
 * 
 * 3. REDIS CACHE:
 *    - Usare per query frequenti con risultati relativamente statici
 *    - Ottimo per dati di riferimento o dashboard
 *    - Non usare per dati che cambiano frequentemente o richiedono consistenza in tempo reale
 *    - Esempio: Model.find().cache(3600) // Cache per 1 ora
 * 
 * 4. AGGREGAZIONI OTTIMIZZATE:
 *    - Ideali per reporting e analytics complessi
 *    - Utilizzare allow disk use per grandi dataset
 *    - Preferire l'esecuzione in background per operazioni lunghe
 *    - Includere indici appropriati per $match e $sort iniziali
 * 
 * 5. BULK OPERATIONS:
 *    - Usare per inserimenti/aggiornamenti multipli (>100 documenti)
 *    - Ottimo per import di dati o aggiornamenti batch
 *    - Evitare transazioni o middlewares per massima performance
 * 
 * 6. MONITORAGGIO PERFORMANCE:
 *    - Usare in sviluppo per identificare colli di bottiglia
 *    - Implementare in produzione per notifiche su query problematiche
 *    - Analizzare periodicamente i log per ottimizzare indici e schema
 * 
 * 7. SUGGERIMENTI GENERALI:
 *    - Creare indici appropriati basati sui pattern di query
 *    - Usare compound index per query che filtrano su più campi
 *    - Preferire proiezioni e filtri lato DB invece che in memoria
 *    - Pianificare la strategia di sharding per collezioni >10GB
 */