/**
 * Route per le procedure operative
 */

const express = require('express');
const router = express.Router();
const procedureController = require('../controllers/procedureController');

// ===== Gestione procedure =====

// Creazione di una nuova procedura per un cliente
router.post('/clients/:clientId/procedures', procedureController.createProcedure);

// Ottiene tutte le procedure con filtri e paginazione
router.get('/procedures', procedureController.getProcedures);

// Ottiene i dettagli di una procedura specifica
router.get('/procedures/:procedureId', procedureController.getProcedureById);

// Aggiorna lo stato di una procedura (completa, archiva)
router.patch('/procedures/:procedureId/status', procedureController.updateProcedureStatus);

// Elimina una procedura
router.delete('/procedures/:procedureId', procedureController.deleteProcedure);

// ===== Gestione attività (task) =====

// Aggiunge una nuova attività a una procedura
router.post('/procedures/:procedureId/tasks', procedureController.addTask);

// Aggiorna lo stato di un'attività in una procedura
router.patch('/procedures/:procedureId/tasks/:taskId', procedureController.updateTaskStatus);

// ===== Reportistica e dashboard =====

// Ottiene il report per la dashboard
router.get('/procedures/dashboard/report', procedureController.generateDashboardReport);

// Ottiene le attività in ritardo
router.get('/procedures/tasks/overdue', procedureController.getOverdueTasks);

module.exports = router;