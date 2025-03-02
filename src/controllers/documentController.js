/**
 * Document Controller
 * 
 * Handles document generation requests and responses
 */

const documentGenerator = require('../services/documentGenerator');
const documentService = require('../services/documentService');
const templateService = require('../services/templateService');
const aiDocumentEnhancer = require('../services/aiDocumentEnhancer');
const Client = require('../models/Client');
const Template = require('../models/Template');
const Document = require('../models/Document');
const path = require('path');
const fs = require('fs').promises;

/**
 * Get list of available document templates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDocumentTemplates = async (req, res) => {
  try {
    // Get templates from the database
    const templates = await Template.find({ isActive: true })
      .select('name displayName description type category supportedFormats tags')
      .sort({ category: 1, displayName: 1 });
      
    res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error('Error getting document templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Sync templates from filesystem to database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.syncTemplates = async (req, res) => {
  try {
    const result = await templateService.syncTemplates();
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error syncing templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate a document for a client
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateDocument = async (req, res) => {
  try {
    const { clientId, templateName, format = 'pdf', metadata = {} } = req.body;
    
    if (!clientId || !templateName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and template name are required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Get template
    const template = await templateService.getTemplateByName(templateName);
    
    // Check if format is supported
    if (template.supportedFormats && !template.supportedFormats.includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: `Format ${format} not supported for this template. Supported formats: ${template.supportedFormats.join(', ')}` 
      });
    }
    
    // Generate document
    const documentPath = await documentGenerator.generateDocument(
      templateName, 
      client.toObject(), 
      format
    );
    
    // Register document in the database
    const document = await documentService.registerGeneratedDocument(
      documentPath,
      client._id,
      template._id,
      format,
      metadata
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Document generated successfully', 
      document: {
        id: document._id,
        name: document.name,
        path: document.path,
        format,
        createdAt: document.createdAt
      }
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate onboarding package for a client
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateOnboardingPackage = async (req, res) => {
  try {
    const { clientId, format = 'pdf' } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Get templates for onboarding
    const onboardingTemplates = await Template.find({ 
      category: 'onboarding',
      isActive: true
    });
    
    if (onboardingTemplates.length === 0) {
      // Fallback to default templates
      // Generate onboarding package with the old method
      const documentPaths = await documentGenerator.generateOnboardingPackage(
        client.toObject(), 
        format
      );
      
      // Add documents to client record
      const documents = documentPaths.map(path => {
        const fileName = path.split('/').pop();
        const templateName = fileName.split('-')[0];
        
        return {
          name: `${templateName}.${format}`,
          path: path,
          type: 'Legal',
          uploadDate: new Date()
        };
      });
      
      client.documents.push(...documents);
      client.onboardingStatus = 'Documents Collected';
      await client.save();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Onboarding package generated successfully (legacy method)', 
        documentPaths 
      });
    }
    
    // Generate documents for each template
    const generatedDocuments = [];
    
    for (const template of onboardingTemplates) {
      try {
        // Check if format is supported
        if (template.supportedFormats && !template.supportedFormats.includes(format)) {
          console.warn(`Format ${format} not supported for template ${template.name}. Skipping.`);
          continue;
        }
        
        // Generate document
        const documentPath = await documentGenerator.generateDocument(
          template.name, 
          client.toObject(), 
          format
        );
        
        // Register document
        const document = await documentService.registerGeneratedDocument(
          documentPath,
          client._id,
          template._id,
          format,
          { category: 'onboarding' }
        );
        
        generatedDocuments.push(document);
      } catch (error) {
        console.error(`Error generating document from template ${template.name}:`, error);
        // Continue with next template
      }
    }
    
    // Update client status
    client.onboardingStatus = 'Documents Collected';
    await client.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Onboarding package generated successfully', 
      documents: generatedDocuments.map(doc => ({
        id: doc._id,
        name: doc.name,
        path: doc.path,
        format: doc.format,
        templateName: doc.template.name
      }))
    });
  } catch (error) {
    console.error('Error generating onboarding package:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate a PEC confirmation document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generatePecConfirmation = async (req, res) => {
  try {
    const { clientId, pecData, format = 'pdf' } = req.body;
    
    if (!clientId || !pecData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and PEC data are required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Generate PEC confirmation
    const documentPath = await documentGenerator.generatePecConfirmation(
      client.toObject(), 
      pecData, 
      format
    );
    
    // Add document to client record
    client.documents.push({
      name: `pec-confirmation.${format}`,
      path: documentPath,
      type: 'Legal',
      uploadDate: new Date()
    });
    
    await client.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'PEC confirmation generated successfully', 
      documentPath 
    });
  } catch (error) {
    console.error('Error generating PEC confirmation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate a cost estimate document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateCostEstimate = async (req, res) => {
  try {
    const { clientId, serviceData, format = 'pdf' } = req.body;
    
    if (!clientId || !serviceData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and service data are required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Generate cost estimate
    const documentPath = await documentGenerator.generateCostEstimate(
      client.toObject(), 
      serviceData, 
      format
    );
    
    // Add document to client record
    client.documents.push({
      name: `cost-estimate.${format}`,
      path: documentPath,
      type: 'Financial',
      uploadDate: new Date()
    });
    
    await client.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Cost estimate generated successfully', 
      documentPath 
    });
  } catch (error) {
    console.error('Error generating cost estimate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get a document by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDocumentById = async (req, res) => {
  try {
    const documentId = req.params.id;
    
    if (!documentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    const document = await documentService.getDocumentById(documentId);
    
    res.status(200).json({ 
      success: true, 
      document 
    });
  } catch (error) {
    console.error('Error retrieving document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all documents with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'createdAt_desc', 
      ...filters 
    } = req.query;
    
    // Parse and format sort option
    const sortOption = {};
    const [sortField, sortDirection] = sort.split('_');
    sortOption[sortField] = sortDirection === 'desc' ? -1 : 1;
    
    const result = await documentService.searchDocuments(
      filters,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sortOption
      }
    );
    
    res.status(200).json({ 
      success: true, 
      ...result
    });
  } catch (error) {
    console.error('Error retrieving documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get documents for a specific client
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getClientDocuments = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }
    
    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    const documents = await documentService.getClientDocuments(clientId, req.query);
    
    res.status(200).json({ 
      success: true, 
      documents 
    });
  } catch (error) {
    console.error('Error retrieving client documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Search for documents based on criteria
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchDocuments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'createdAt_desc', 
      ...query 
    } = req.query;
    
    // Parse and format sort option
    const sortOption = {};
    const [sortField, sortDirection] = sort.split('_');
    sortOption[sortField] = sortDirection === 'desc' ? -1 : 1;
    
    const result = await documentService.searchDocuments(
      query,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sortOption
      }
    );
    
    res.status(200).json({ 
      success: true, 
      ...result
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update document metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    // Restricting updatable fields for security
    const allowedFields = ['name', 'status', 'tags', 'notes', 'metadata'];
    const filteredData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });
    
    const document = await Document.findByIdAndUpdate(
      id,
      filteredData,
      { new: true }
    );
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Document updated successfully',
      document
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete a document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    const result = await documentService.deleteDocument(id);
    
    res.status(200).json({ 
      success: true, 
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Convert a document to another format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.convertDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body;
    
    if (!id || !format) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID and target format are required' 
      });
    }
    
    if (!['pdf', 'docx', 'html'].includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid format. Supported formats: pdf, docx, html' 
      });
    }
    
    const convertedDocument = await documentService.convertDocument(id, format);
    
    res.status(200).json({ 
      success: true, 
      message: `Document converted to ${format.toUpperCase()} successfully`,
      document: {
        id: convertedDocument._id,
        name: convertedDocument.name,
        path: convertedDocument.path,
        format: convertedDocument.format,
        createdAt: convertedDocument.createdAt
      }
    });
  } catch (error) {
    console.error('Error converting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Send a document by email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendDocumentByEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, subject, message } = req.body;
    
    if (!id || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID and recipient email are required' 
      });
    }
    
    const result = await documentService.sendDocumentByEmail(id, email, {
      subject,
      message,
      sender: 'system'
    });
    
    res.status(200).json({ 
      success: true, 
      message: result.message,
      sentInfo: result.sentInfo
    });
  } catch (error) {
    console.error('Error sending document by email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate a public link for document sharing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generatePublicLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { expiryDays = 7 } = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    await document.generatePublicAccess(expiryDays);
    
    // Generate full URL including hostname
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}${document.publicUrl}`;
    
    res.status(200).json({ 
      success: true, 
      message: 'Public link generated successfully',
      publicUrl,
      expiresAt: document.publicAccessUntil
    });
  } catch (error) {
    console.error('Error generating public link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * View a document with a public token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.viewPublicDocument = async (req, res) => {
  try {
    const { documentId, token } = req.params;
    
    if (!documentId || !token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID and token are required' 
      });
    }
    
    const document = await Document.findById(documentId);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    // Verify token and access
    if (!document.isPublic || 
        !document.publicUrl.includes(token) ||
        document.publicAccessUntil < new Date()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired access link' 
      });
    }
    
    // Check if file exists
    try {
      await fs.access(document.path);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document file not found' 
      });
    }
    
    // Update access counter and last accessed date
    document.accessCount += 1;
    document.lastAccessedAt = new Date();
    await document.save();
    
    // Send the file
    res.sendFile(document.path);
  } catch (error) {
    console.error('Error viewing public document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get a template by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template ID is required' 
      });
    }
    
    const template = await templateService.getTemplateById(id);
    
    res.status(200).json({ 
      success: true, 
      template 
    });
  } catch (error) {
    console.error('Error retrieving template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create a new template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createTemplate = async (req, res) => {
  try {
    const templateData = req.body;
    
    if (!templateData.name || !templateData.content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template name and content are required' 
      });
    }
    
    const template = await templateService.createTemplate(templateData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update a template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template ID is required' 
      });
    }
    
    const template = await templateService.updateTemplate(id, updateData);
    
    res.status(200).json({ 
      success: true, 
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete a template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template ID is required' 
      });
    }
    
    const result = await templateService.deleteTemplate(id);
    
    res.status(200).json({ 
      success: true, 
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Enhance a document with AI suggestions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.enhanceDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const options = req.body || {};
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    // Get document details
    const document = await Document.findById(id).populate('client');
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    // Enhance the document
    const enhancementResult = await aiDocumentEnhancer.enhanceDocument(
      document.path,
      document.client.toObject(),
      options
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Document enhancement complete',
      result: enhancementResult
    });
  } catch (error) {
    console.error('Error enhancing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Verify document correctness and completeness
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const verificationCriteria = req.body || {};
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    // Get document details
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    // Verify the document
    const verificationResults = await aiDocumentEnhancer.verifyDocument(
      document.path,
      verificationCriteria
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Document verification complete',
      results: verificationResults
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Enhance document metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.enhanceDocumentMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const options = req.body || {};
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document ID is required' 
      });
    }
    
    // Enhance document metadata
    const updatedDocument = await aiDocumentEnhancer.enhanceDocumentMetadata(id, options);
    
    res.status(200).json({ 
      success: true, 
      message: 'Document metadata enhanced successfully',
      document: {
        id: updatedDocument._id,
        name: updatedDocument.name,
        metadata: updatedDocument.metadata,
        tags: updatedDocument.tags
      }
    });
  } catch (error) {
    console.error('Error enhancing document metadata:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Suggest additional documents for a client
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.suggestAdditionalDocuments = async (req, res) => {
  try {
    const { clientId, currentDocuments } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Get current documents if not provided
    let documentsList = currentDocuments;
    if (!documentsList) {
      // Get documents from database
      const clientDocuments = await Document.find({ client: clientId })
        .populate('template', 'name');
      
      documentsList = clientDocuments;
    }
    
    // Get document suggestions
    const suggestions = await aiDocumentEnhancer.suggestAdditionalDocuments(
      client.toObject(),
      documentsList
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Document suggestions generated',
      suggestions
    });
  } catch (error) {
    console.error('Error suggesting additional documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Customize document by client context
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.customizeDocumentByContext = async (req, res) => {
  try {
    const { clientId, templateName, customizationOptions } = req.body;
    
    if (!clientId || !templateName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and template name are required' 
      });
    }
    
    // Get client data
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Customize document by context
    const customizationResult = await aiDocumentEnhancer.customizeDocumentByContext(
      templateName,
      client.toObject(),
      customizationOptions || {}
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Document customized by context',
      result: customizationResult
    });
  } catch (error) {
    console.error('Error customizing document by context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Download a generated document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { clientId, documentId } = req.params;
    
    if (!clientId || !documentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID and document ID are required' 
      });
    }
    
    // Try first to find in the Document model
    let document = await Document.findById(documentId);
    
    if (document) {
      // Verify that the document belongs to the specified client
      if (document.client.toString() !== clientId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Document does not belong to the specified client' 
        });
      }
      
      // Check if the file exists
      try {
        await fs.access(document.path);
      } catch (error) {
        return res.status(404).json({ 
          success: false, 
          error: 'Document file not found' 
        });
      }
      
      // Send the file
      return res.download(document.path, document.filename);
    }
    
    // Fallback to legacy client.documents embedded documents
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    // Find the document in client's embedded documents
    const embeddedDocument = client.documents.id(documentId);
    if (!embeddedDocument) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }
    
    // Check if the file exists
    try {
      await fs.access(embeddedDocument.path);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document file not found' 
      });
    }
    
    // Send the file
    res.download(embeddedDocument.path, embeddedDocument.name);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};