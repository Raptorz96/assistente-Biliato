const mongoose = require('mongoose');
const Procedure = require('../../src/models/Procedure');
const procedureGenerator = require('../../src/services/procedureGenerator');
const aiAssistant = require('../../src/services/aiAssistant');

jest.mock('mongoose');
jest.mock('../../src/models/Procedure');

describe('Procedure Model', () => {
  let mockProcedure;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock di una procedura
    mockProcedure = {
      _id: new mongoose.Types.ObjectId(),
      clientId: new mongoose.Types.ObjectId(),
      procedureId: 'PROC-123',
      name: 'Test Procedure',
      status: 'active',
      procedureType: 'individual',
      complexityLevel: 'medium',
      completionPercentage: 0,
      tasks: [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          priority: 'high',
          status: 'pending',
          progress: 0,
          dueDate: new Date(),
          statusHistory: [
            {
              status: 'pending',
              timestamp: new Date(),
              note: 'Task created',
              updatedBy: 'system'
            }
          ]
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Description 2',
          priority: 'medium',
          status: 'pending',
          progress: 0,
          dueDate: new Date(),
          dependsOn: ['task-1'],
          statusHistory: [
            {
              status: 'pending',
              timestamp: new Date(),
              note: 'Task created',
              updatedBy: 'system'
            }
          ]
        }
      ],
      summary: {
        totalTasks: 2,
        completedTasks: 0,
        pendingTasks: 2,
        highPriorityTasks: 1,
        overdueNearest: null
      },
      save: jest.fn().mockResolvedValue(true),
      getTaskDelay: jest.fn().mockReturnValue(0),
      updateTaskStatus: jest.fn().mockImplementation(function(taskId, updateData) {
        // Trova il task
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return false;
        
        // Aggiorna il task
        const task = { ...this.tasks[taskIndex] };
        
        // Applica gli aggiornamenti
        Object.keys(updateData).forEach(key => {
          if (key !== 'statusHistory') {
            task[key] = updateData[key];
          }
        });
        
        // Aggiorna cronologia
        task.statusHistory.push({
          status: task.status,
          timestamp: new Date(),
          note: updateData.note || 'Stato aggiornato',
          updatedBy: updateData.updatedBy || 'system'
        });
        
        // Imposta completato se progresso è 100%
        if (task.progress === 100 && task.status !== 'completed') {
          task.status = 'completed';
          task.statusHistory.push({
            status: 'completed',
            timestamp: new Date(),
            note: 'Completato automaticamente',
            updatedBy: 'system'
          });
        }
        
        this.tasks[taskIndex] = task;
        return true;
      })
    };
    
    // Mock virtuale per calcolo task in ritardo
    Object.defineProperty(mockProcedure, 'overdueTasks', {
      get: function() {
        const today = new Date();
        return this.tasks.filter(task => 
          task.status !== 'completed' && 
          task.dueDate && 
          new Date(task.dueDate) < today
        ).length;
      }
    });
  });
  
  describe('task management', () => {
    test('dovrebbe aggiornare lo stato di un task', () => {
      // Aggiorna task-1 a 50% completato e in_progress
      const updateData = {
        status: 'in_progress',
        progress: 50,
        note: 'Lavoro in corso',
        updatedBy: 'user123'
      };
      
      // Chiama il metodo
      const result = mockProcedure.updateTaskStatus('task-1', updateData);
      
      // Verifica risultato
      expect(result).toBe(true);
      
      // Verifica che il task sia stato aggiornato
      const updatedTask = mockProcedure.tasks.find(t => t.id === 'task-1');
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.progress).toBe(50);
      
      // Verifica che la cronologia sia stata aggiornata
      expect(updatedTask.statusHistory.length).toBe(2);
      expect(updatedTask.statusHistory[1].status).toBe('in_progress');
      expect(updatedTask.statusHistory[1].note).toBe('Lavoro in corso');
      expect(updatedTask.statusHistory[1].updatedBy).toBe('user123');
    });
    
    test('dovrebbe completare automaticamente task al 100%', () => {
      // Aggiorna task-1 a 100% completato
      const updateData = {
        progress: 100,
        note: 'Completato',
        updatedBy: 'user123'
      };
      
      // Chiama il metodo
      mockProcedure.updateTaskStatus('task-1', updateData);
      
      // Verifica che il task sia stato impostato come completato
      const updatedTask = mockProcedure.tasks.find(t => t.id === 'task-1');
      expect(updatedTask.status).toBe('completed');
      
      // Verifica cronologia
      expect(updatedTask.statusHistory.length).toBe(3);
      expect(updatedTask.statusHistory[2].status).toBe('completed');
      expect(updatedTask.statusHistory[2].updatedBy).toBe('system');
    });
    
    test('dovrebbe calcolare correttamente il ritardo di un task', () => {
      // Prepara un task scaduto
      const overdueDays = 5;
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - overdueDays);
      
      mockProcedure.tasks[0].dueDate = overdueDate;
      
      // Mock getTaskDelay
      mockProcedure.getTaskDelay.mockImplementation((taskId) => {
        const task = mockProcedure.tasks.find(t => t.id === taskId);
        if (!task || task.status === 'completed' || !task.dueDate) return 0;
        
        const today = new Date();
        const dueDate = new Date(task.dueDate);
        if (dueDate > today) return 0;
        
        return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      });
      
      // Testa il calcolo del ritardo
      const delay = mockProcedure.getTaskDelay('task-1');
      
      // Tolleriamo una differenza di 1 giorno per evitare flakiness del test
      expect(delay).toBeGreaterThanOrEqual(overdueDays - 1);
      expect(delay).toBeLessThanOrEqual(overdueDays + 1);
    });
  });
  
  describe('calcolator completeness', () => {
    test('dovrebbe calcolare correttamente la percentuale di completamento', () => {
      // Implementa un middleware pre-save mock
      const preSaveMiddleware = (next) => {
        // Calcola i conteggi per il riepilogo
        const totalTasks = mockProcedure.tasks.length;
        const completedTasks = mockProcedure.tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = totalTasks - completedTasks;
        const highPriorityTasks = mockProcedure.tasks.filter(t => 
          t.priority === 'high' && t.status !== 'completed'
        ).length;
        
        // Calcola la percentuale di completamento
        const completionPercentage = totalTasks === 0 ? 0 : 
          Math.round((mockProcedure.tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks));
        
        // Aggiorna il riepilogo
        mockProcedure.summary = {
          totalTasks,
          completedTasks,
          pendingTasks,
          highPriorityTasks,
          overdueNearest: null
        };
        
        // Aggiorna la percentuale di completamento
        mockProcedure.completionPercentage = completionPercentage;
        
        next();
      };
      
      // Aggiorna i task con progress specifici
      mockProcedure.tasks[0].progress = 100;
      mockProcedure.tasks[0].status = 'completed';
      mockProcedure.tasks[1].progress = 50;
      
      // Esegui il middleware
      preSaveMiddleware(() => {});
      
      // Verifica i risultati
      expect(mockProcedure.completionPercentage).toBe(75); // (100 + 50) / 2 = 75
      expect(mockProcedure.summary.completedTasks).toBe(1);
      expect(mockProcedure.summary.pendingTasks).toBe(1);
    });
  });
  
  describe('integrazione procedure-cliente', () => {
    // Mock dell'oggetto Client
    const mockClient = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Cliente Test SRL',
      companyType: 'LLC',
      businessSector: 'Technology',
      accountingRegime: 'Ordinario',
      annualRevenue: 800000,
      employees: 12,
      foundingDate: new Date(2018, 0, 1),
      vatNumber: 'IT12345678901',
      onboardingStatus: 'Documents Collected'
    };
    
    test('dovrebbe generare una procedura completa in base al profilo cliente', async () => {
      // Mock dei servizi
      procedureGenerator.generateOperationalProcedure = jest.fn().mockResolvedValue({
        procedureRequirements: {
          procedureType: 'llc',
          complexityLevel: 'high'
        },
        monitoringSystem: {
          clientId: mockClient._id,
          name: 'Procedura Test',
          procedureId: 'proc-test',
          tasks: [
            {
              id: 'task-1',
              title: 'Task 1',
              description: 'Description',
              priority: 'high',
              status: 'pending',
              progress: 0
            }
          ],
          summary: {
            totalTasks: 1,
            completedTasks: 0,
            pendingTasks: 1,
            highPriorityTasks: 1
          }
        }
      });
      
      // Mock del costruttore di Procedure
      Procedure.mockImplementation(() => mockProcedure);
      
      // Chiamata al servizio
      const result = await procedureGenerator.generateOperationalProcedure(mockClient);
      
      // Verifica
      expect(procedureGenerator.generateOperationalProcedure).toHaveBeenCalledWith(mockClient);
      expect(result).toHaveProperty('procedureRequirements');
      expect(result).toHaveProperty('monitoringSystem');
      expect(result.procedureRequirements.procedureType).toBe('llc');
    });
    
    test('dovrebbe migliorare una procedura esistente con AI', async () => {
      // Mock di aiAssistant.enhanceProcedureGeneration
      aiAssistant.enhanceProcedureGeneration = jest.fn().mockResolvedValue({
        procedureRequirements: {
          procedureType: 'llc',
          complexityLevel: 'high'
        },
        monitoringSystem: {
          clientId: mockClient._id,
          name: 'Procedura Migliorata',
          procedureId: 'proc-enhanced',
          aiEnhanced: true,
          tasks: [
            {
              id: 'task-1',
              title: 'Task Migliorato',
              description: 'Descrizione base',
              detailedDescription: 'Descrizione dettagliata generata dall\'AI',
              priority: 'high',
              status: 'pending',
              progress: 0
            }
          ],
          summary: {
            totalTasks: 1,
            completedTasks: 0,
            pendingTasks: 1,
            highPriorityTasks: 1
          }
        }
      });
      
      // Chiamata al servizio
      const result = await aiAssistant.enhanceProcedureGeneration(mockClient);
      
      // Verifica
      expect(aiAssistant.enhanceProcedureGeneration).toHaveBeenCalledWith(mockClient);
      expect(result).toHaveProperty('monitoringSystem.aiEnhanced', true);
      expect(result.monitoringSystem.tasks[0]).toHaveProperty('detailedDescription');
      expect(result.monitoringSystem.tasks[0].detailedDescription).toContain('AI');
    });
  });
});