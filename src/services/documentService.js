/**
 * Document Service
 * 
 * Gestisce le operazioni sui documenti, inclusa la ricerca e archiviazione
 */

const fs = require('fs').promises;
const path = require('path');
const Document = require('../models/Document');
const Client = require('../models/Client');
const documentGenerator = require('./documentGenerator');
const templateService = require('./templateService');

/**
 * Crea un nuovo documento
 * @param {Object} documentData - Dati del documento
 * @returns {Promise<Object>} - Documento creato
 */
exports.createDocument = async (documentData) => {
  try {
    // Crea il documento nel database
    const document = new Document(documentData);
    await document.save();
    
    return document;
  } catch (error) {
    console.error('Errore nella creazione del documento:', error);
    throw new Error(`Impossibile creare il documento: ${error.message}`);
  }
};

/**
 * Registra un documento generato nel database
 * @param {string} filePath - Percorso del file generato
 * @param {string} clientId - ID del cliente
 * @param {string} templateId - ID del template
 * @param {string} format - Formato del documento
 * @param {Object} metadata - Metadati aggiuntivi
 * @returns {Promise<Object>} - Documento registrato
 */
exports.registerGeneratedDocument = async (filePath, clientId, templateId, format, metadata = {}) => {
  try {
    // Ottieni informazioni sul file
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);
    
    // Ottieni informazioni sul template
    const template = await templateService.getTemplateById(templateId);
    
    // Crea il documento
    const document = new Document({
      name: metadata.name || template.displayName,
      filename,
      path: filePath,
      client: clientId,
      template: templateId,
      templateVersion: template.version,
      format,
      category: template.category,
      documentType: template.type,
      size: stats.size,
      metadata,
      tags: [...(template.tags || []), ...(metadata.tags || [])]
    });
    
    // Se ci sono date di validità, aggiungile
    if (metadata.validUntil) {
      document.validUntil = new Date(metadata.validUntil);
    }
    
    // Salva il documento
    await document.save();
    
    // Aggiorna anche il riferimento nel cliente
    await Client.findByIdAndUpdate(clientId, {
      $push: {
        documents: {
          name: document.name,
          path: filePath,
          type: mapCategoryToClientDocType(template.category),
          uploadDate: new Date()
        }
      }
    });
    
    return document;
  } catch (error) {
    console.error('Errore nella registrazione del documento:', error);
    throw new Error(`Impossibile registrare il documento: ${error.message}`);
  }
};

/**
 * Ottiene un documento per ID
 * @param {string} documentId - ID del documento
 * @returns {Promise<Object>} - Documento trovato
 */
exports.getDocumentById = async (documentId) => {
  try {
    const document = await Document.findById(documentId)
      .populate('client', 'name fiscalCode email')
      .populate('template', 'name displayName type category');
    
    if (!document) {
      throw new Error('Documento non trovato');
    }
    
    return document;
  } catch (error) {
    console.error('Errore nel recupero del documento:', error);
    throw new Error(`Impossibile recuperare il documento: ${error.message}`);
  }
};

/**
 * Ottiene tutti i documenti di un cliente
 * @param {string} clientId - ID del cliente
 * @param {Object} filters - Filtri opzionali
 * @returns {Promise<Array>} - Lista di documenti
 */
exports.getClientDocuments = async (clientId, filters = {}) => {
  try {
    let query = { client: clientId };
    
    // Applica filtri
    if (filters.category) query.category = filters.category;
    if (filters.documentType) query.documentType = filters.documentType;
    if (filters.format) query.format = filters.format;
    if (filters.tag) query.tags = { $in: [filters.tag] };
    
    // Filtra per data di creazione
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    } else if (filters.startDate) {
      query.createdAt = { $gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      query.createdAt = { $lte: new Date(filters.endDate) };
    }
    
    // Esegui la query
    const documents = await Document.find(query)
      .populate('template', 'name displayName')
      .sort(filters.sort || { createdAt: -1 })
      .skip(filters.skip || 0)
      .limit(filters.limit || 0);
    
    return documents;
  } catch (error) {
    console.error('Errore nel recupero dei documenti del cliente:', error);
    throw new Error(`Impossibile recuperare i documenti: ${error.message}`);
  }
};

/**
 * Ottiene i documenti più recenti
 * @param {number} limit - Numero massimo di documenti
 * @returns {Promise<Array>} - Lista di documenti recenti
 */
exports.getRecentDocuments = async (limit = 10) => {
  try {
    const documents = await Document.find()
      .populate('client', 'name fiscalCode')
      .populate('template', 'name displayName')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return documents;
  } catch (error) {
    console.error('Errore nel recupero dei documenti recenti:', error);
    throw new Error(`Impossibile recuperare i documenti recenti: ${error.message}`);
  }
};

/**
 * Cerca documenti in base a criteri
 * @param {Object} query - Criteri di ricerca
 * @param {Object} options - Opzioni di paginazione e ordinamento
 * @returns {Promise<Object>} - Risultati della ricerca
 */
exports.searchDocuments = async (query = {}, options = {}) => {
  try {
    const dbQuery = {};
    
    // Cerca per nome (case insensitive)
    if (query.name) {
      dbQuery.name = { $regex: query.name, $options: 'i' };
    }
    
    // Filtra per cliente
    if (query.client) {
      dbQuery.client = query.client;
    }
    
    // Filtra per template
    if (query.template) {
      dbQuery.template = query.template;
    }
    
    // Filtra per tipo di documento
    if (query.documentType) {
      dbQuery.documentType = query.documentType;
    }
    
    // Filtra per categoria
    if (query.category) {
      dbQuery.category = query.category;
    }
    
    // Filtra per formato
    if (query.format) {
      dbQuery.format = query.format;
    }
    
    // Filtra per tag
    if (query.tags && query.tags.length > 0) {
      dbQuery.tags = { $in: query.tags };
    }
    
    // Filtra per data di creazione
    if (query.createdAfter || query.createdBefore) {
      dbQuery.createdAt = {};
      
      if (query.createdAfter) {
        dbQuery.createdAt.$gte = new Date(query.createdAfter);
      }
      
      if (query.createdBefore) {
        dbQuery.createdAt.$lte = new Date(query.createdBefore);
      }
    }
    
    // Opzioni di paginazione
    const skip = options.page ? (options.page - 1) * (options.limit || 10) : 0;
    const limit = options.limit || 10;
    
    // Opzioni di ordinamento
    const sort = options.sort || { createdAt: -1 };
    
    // Esegui la query per contare i risultati totali
    const total = await Document.countDocuments(dbQuery);
    
    // Esegui la query principale
    const documents = await Document.find(dbQuery)
      .populate('client', 'name fiscalCode email')
      .populate('template', 'name displayName')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    return {
      documents,
      pagination: {
        total,
        page: options.page || 1,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Errore nella ricerca dei documenti:', error);
    throw new Error(`Impossibile eseguire la ricerca: ${error.message}`);
  }
};

/**
 * Elimina un documento
 * @param {string} documentId - ID del documento da eliminare
 * @returns {Promise<Object>} - Risultato operazione
 */
exports.deleteDocument = async (documentId) => {
  try {
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new Error('Documento non trovato');
    }
    
    // Elimina il file
    try {
      await fs.unlink(document.path);
    } catch (fileError) {
      console.warn('Impossibile eliminare il file del documento:', fileError);
      // Continua anche se il file non può essere eliminato
    }
    
    // Elimina il riferimento nel cliente
    await Client.findByIdAndUpdate(document.client, {
      $pull: {
        documents: { path: document.path }
      }
    });
    
    // Elimina il documento dal database
    await Document.deleteOne({ _id: documentId });
    
    return { success: true, message: 'Documento eliminato con successo' };
  } catch (error) {
    console.error('Errore nell\'eliminazione del documento:', error);
    throw new Error(`Impossibile eliminare il documento: ${error.message}`);
  }
};

/**
 * Converte un documento in un altro formato
 * @param {string} documentId - ID del documento
 * @param {string} targetFormat - Formato di destinazione (pdf, docx, html)
 * @returns {Promise<Object>} - Documento convertito
 */
exports.convertDocument = async (documentId, targetFormat) => {
  try {
    const document = await Document.findById(documentId)
      .populate('client')
      .populate('template');
    
    if (!document) {
      throw new Error('Documento non trovato');
    }
    
    // Se il documento è già nel formato richiesto, restituiscilo
    if (document.format === targetFormat) {
      return document;
    }
    
    // Ottieni i dati del cliente
    const clientData = document.client.toObject();
    
    // Ottieni il template
    const templateName = document.template.name;
    
    // Genera il documento nel nuovo formato
    const outputPath = await documentGenerator.generateDocument(
      templateName,
      clientData,
      targetFormat
    );
    
    // Crea un nuovo record per il documento convertito
    const convertedDocument = new Document({
      name: `${document.name} (${targetFormat.toUpperCase()})`,
      filename: path.basename(outputPath),
      path: outputPath,
      client: document.client._id,
      template: document.template._id,
      templateVersion: document.templateVersion,
      format: targetFormat,
      category: document.category,
      documentType: document.documentType,
      status: document.status,
      metadata: document.metadata,
      tags: document.tags
    });
    
    await convertedDocument.save();
    
    return convertedDocument;
  } catch (error) {
    console.error('Errore nella conversione del documento:', error);
    throw new Error(`Impossibile convertire il documento: ${error.message}`);
  }
};

/**
 * Invia un documento via email
 * @param {string} documentId - ID del documento
 * @param {string} recipientEmail - Email del destinatario
 * @param {Object} emailOptions - Opzioni per l'email
 * @returns {Promise<Object>} - Risultato dell'invio
 */
exports.sendDocumentByEmail = async (documentId, recipientEmail, emailOptions = {}) => {
  try {
    const document = await Document.findById(documentId)
      .populate('client', 'name email')
      .populate('template', 'displayName');
    
    if (!document) {
      throw new Error('Documento non trovato');
    }
    
    // Questa è solo una simulazione - in una implementazione reale,
    // qui ci sarebbe l'integrazione con un servizio di invio email
    console.log(`[EMAIL SIMULATA] Invio documento ${document.name} a ${recipientEmail}`);
    
    // Aggiorna lo stato del documento
    document.status = 'sent';
    document.sentInfo = {
      sentAt: new Date(),
      sentBy: emailOptions.sender || 'sistema',
      sentTo: recipientEmail,
      sentMethod: 'email',
      deliveryStatus: 'sent'
    };
    
    await document.save();
    
    return {
      success: true,
      message: `Documento inviato con successo a ${recipientEmail}`,
      sentInfo: document.sentInfo
    };
  } catch (error) {
    console.error('Errore nell\'invio del documento:', error);
    throw new Error(`Impossibile inviare il documento: ${error.message}`);
  }
};

/**
 * Mappa le categorie di template ai tipi di documento del cliente
 * @param {string} category - Categoria del template
 * @returns {string} - Tipo di documento per il modello Cliente
 */
function mapCategoryToClientDocType(category) {
  const mapping = {
    'onboarding': 'Legal',
    'accounting': 'Financial',
    'tax': 'Tax',
    'legal': 'Legal',
    'communication': 'Other',
    'other': 'Other'
  };
  
  return mapping[category] || 'Other';
}