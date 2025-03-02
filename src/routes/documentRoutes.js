/**
 * Document Routes
 * 
 * Routes for document generation and download
 */

const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// Template management
router.get('/templates', documentController.getDocumentTemplates);
router.post('/templates/sync', documentController.syncTemplates);
router.get('/templates/:id', documentController.getTemplateById);
router.post('/templates', documentController.createTemplate);
router.put('/templates/:id', documentController.updateTemplate);
router.delete('/templates/:id', documentController.deleteTemplate);

// Document generation
router.post('/generate', documentController.generateDocument);
router.post('/generate-onboarding', documentController.generateOnboardingPackage);
router.post('/generate-pec', documentController.generatePecConfirmation);
router.post('/generate-estimate', documentController.generateCostEstimate);

// Document management
router.get('/', documentController.getAllDocuments);
router.get('/search', documentController.searchDocuments);
router.get('/client/:clientId', documentController.getClientDocuments);
router.get('/:id', documentController.getDocumentById);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);
router.post('/:id/convert', documentController.convertDocument);
router.post('/:id/email', documentController.sendDocumentByEmail);
router.post('/:id/share', documentController.generatePublicLink);

// AI Enhancement
router.post('/:id/enhance', documentController.enhanceDocument);
router.post('/:id/verify', documentController.verifyDocument);
router.post('/:id/enhance-metadata', documentController.enhanceDocumentMetadata);
router.post('/suggest-additional', documentController.suggestAdditionalDocuments);
router.post('/customize-by-context', documentController.customizeDocumentByContext);

// Download document
router.get('/download/:clientId/:documentId', documentController.downloadDocument);
router.get('/public/:documentId/:token', documentController.viewPublicDocument);

module.exports = router;