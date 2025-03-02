const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Client CRUD routes
router.get('/', clientController.getAllClients);
router.get('/:id', clientController.getClient);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

// Client validation routes
router.get('/:id/validate', clientController.validateClientData);
router.get('/:id/questions', clientController.getClientQuestions);
router.put('/:id/onboarding-status', clientController.updateOnboardingStatus);

module.exports = router;