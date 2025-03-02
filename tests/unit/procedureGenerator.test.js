const procedureGenerator = require('../../src/services/procedureGenerator');

jest.mock('../../src/models/Client');
jest.mock('../../src/models/Procedure');

describe('Procedure Generator Service', () => {
  // Dati di test
  const clientFixtures = {
    individual: {
      _id: 'client123',
      name: 'Mario Rossi',
      companyType: 'Individual',
      businessSector: 'Consulenza',
      accountingRegime: 'Forfettario',
      annualRevenue: 50000,
      employees: 0,
      foundingDate: new Date(new Date().getFullYear() - 1, 0, 1),
      vatNumber: 'IT12345678901'
    },
    corporation: {
      _id: 'client456',
      name: 'Azienda Grande SPA',
      companyType: 'Corporation',
      businessSector: 'Manifattura',
      accountingRegime: 'Ordinario',
      annualRevenue: 2000000,
      employees: 25,
      foundingDate: new Date(new Date().getFullYear() - 5, 0, 1),
      vatNumber: 'IT98765432109'
    }
  };

  describe('analyzeProcedureRequirements', () => {
    test('dovrebbe analizzare correttamente un cliente individuale', async () => {
      const result = await procedureGenerator.analyzeProcedureRequirements(clientFixtures.individual);
      
      expect(result).toHaveProperty('procedureType', 'individual');
      expect(result).toHaveProperty('complexityLevel', 'low');
      expect(result).toHaveProperty('accountingRequirements');
      expect(result.accountingRequirements).toContain('income_register');
      expect(result.isNewBusiness).toBe(true);
    });

    test('dovrebbe analizzare correttamente una società', async () => {
      const result = await procedureGenerator.analyzeProcedureRequirements(clientFixtures.corporation);
      
      expect(result).toHaveProperty('procedureType', 'corporation');
      expect(result).toHaveProperty('complexityLevel', 'high');
      expect(result.accountingRequirements).toContain('full_accounting');
      expect(result.fiscalRequirements).toContain('corporate_tax');
      expect(result.needsAudit).toBe(true);
      expect(result.isNewBusiness).toBe(false);
    });
  });

  describe('generateTaskChecklist', () => {
    test('dovrebbe generare attività appropriate per regime forfettario', async () => {
      const clientRequirements = await procedureGenerator.analyzeProcedureRequirements(clientFixtures.individual);
      const tasks = await procedureGenerator.generateTaskChecklist(clientFixtures.individual, clientRequirements);
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      // Verifica presenza attività specifiche del regime forfettario
      const forfettarioTasks = tasks.filter(task => 
        task.title.includes('Registro') || task.tags.includes('forfettario')
      );
      expect(forfettarioTasks.length).toBeGreaterThan(0);
      
      // Verifica assenza attività IVA specifiche
      const ivaLiquidationTasks = tasks.filter(task => 
        task.title.includes('Liquidazione IVA')
      );
      expect(ivaLiquidationTasks.length).toBe(0);
    });

    test('dovrebbe generare attività appropriate per società', async () => {
      const clientRequirements = await procedureGenerator.analyzeProcedureRequirements(clientFixtures.corporation);
      const tasks = await procedureGenerator.generateTaskChecklist(clientFixtures.corporation, clientRequirements);
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      // Verifica presenza attività specifiche per società
      const bilancioTasks = tasks.filter(task => 
        task.title.includes('Bilancio') || task.tags.includes('bilancio')
      );
      expect(bilancioTasks.length).toBeGreaterThan(0);
      
      // Verifica presenza attività IVA
      const ivaTasks = tasks.filter(task => 
        task.title.includes('IVA') || task.tags.includes('iva')
      );
      expect(ivaTasks.length).toBeGreaterThan(0);
    });
    
    test('dovrebbe includere scadenze concrete per tutte le attività', async () => {
      const clientRequirements = await procedureGenerator.analyzeProcedureRequirements(clientFixtures.corporation);
      const tasks = await procedureGenerator.generateTaskChecklist(clientFixtures.corporation, clientRequirements);
      
      // Ogni task dovrebbe avere una dueDate
      const tasksWithoutDueDate = tasks.filter(task => !task.dueDate);
      expect(tasksWithoutDueDate.length).toBe(0);
      
      // Le date dovrebbero essere istanze di Date
      tasks.forEach(task => {
        expect(task.dueDate instanceof Date).toBe(true);
      });
    });
  });

  describe('calculateTaskDeadlines', () => {
    test('dovrebbe calcolare date concrete per scadenze mensili', () => {
      const now = new Date();
      const tasks = [
        {
          id: 'task-1',
          title: 'Task Mensile',
          deadline: {
            type: 'monthly',
            dayOfMonth: 15,
            description: 'Entro il 15 del mese'
          }
        }
      ];
      
      const result = procedureGenerator.calculateTaskDeadlines(tasks);
      
      expect(result[0]).toHaveProperty('dueDate');
      expect(result[0].dueDate instanceof Date).toBe(true);
      
      // Se oggi è dopo il 15, la data dovrebbe essere nel mese successivo
      if (now.getDate() > 15) {
        // Controlla che il mese sia quello successivo
        const expectedMonth = (now.getMonth() + 1) % 12;
        expect(result[0].dueDate.getMonth()).toBe(expectedMonth);
      } else {
        // Controlla che il mese sia quello corrente
        expect(result[0].dueDate.getMonth()).toBe(now.getMonth());
      }
      
      // Il giorno dovrebbe essere il 15
      expect(result[0].dueDate.getDate()).toBe(15);
    });

    test('dovrebbe calcolare date concrete per scadenze annuali', () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Dichiarazione IVA Annuale',
          deadline: {
            type: 'annual',
            description: 'Entro il 30 Aprile'
          }
        }
      ];
      
      const result = procedureGenerator.calculateTaskDeadlines(tasks);
      
      expect(result[0]).toHaveProperty('dueDate');
      expect(result[0].dueDate instanceof Date).toBe(true);
      
      // Controllo che la data sia nel mese di aprile (indice 3)
      expect(result[0].dueDate.getMonth()).toBe(3);
      
      // Il giorno dovrebbe essere il 30
      expect(result[0].dueDate.getDate()).toBe(30);
    });
  });

  describe('resolveTaskDependencies', () => {
    test('dovrebbe risolvere correttamente le dipendenze tra attività', () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          dependsOn: []
        },
        {
          id: 'task-2',
          title: 'Task 2',
          dependsOn: ['task-1']
        },
        {
          id: 'task-3',
          title: 'Task 3',
          dependsOn: ['task-1', 'task-2']
        }
      ];
      
      const result = procedureGenerator.resolveTaskDependencies(tasks);
      
      // Il task 1 non dovrebbe avere dipendenze
      expect(result[0].resolvedDependencies).toEqual([]);
      
      // Il task 2 dovrebbe dipendere dal task 1
      expect(result[1].resolvedDependencies.length).toBe(1);
      expect(result[1].resolvedDependencies[0].id).toBe('task-1');
      expect(result[1].resolvedDependencies[0].title).toBe('Task 1');
      
      // Il task 3 dovrebbe dipendere dai task 1 e 2
      expect(result[2].resolvedDependencies.length).toBe(2);
      const dependencyIds = result[2].resolvedDependencies.map(d => d.id);
      expect(dependencyIds).toContain('task-1');
      expect(dependencyIds).toContain('task-2');
    });
  });

  describe('generateOperationalProcedure', () => {
    test('dovrebbe generare una procedura completa per un cliente individuale', async () => {
      const result = await procedureGenerator.generateOperationalProcedure(clientFixtures.individual);
      
      expect(result).toHaveProperty('procedureRequirements');
      expect(result).toHaveProperty('monitoringSystem');
      
      const { monitoringSystem } = result;
      
      expect(monitoringSystem).toHaveProperty('clientId', clientFixtures.individual._id);
      expect(monitoringSystem).toHaveProperty('procedureType', 'individual');
      expect(monitoringSystem).toHaveProperty('tasks');
      expect(Array.isArray(monitoringSystem.tasks)).toBe(true);
      expect(monitoringSystem.tasks.length).toBeGreaterThan(0);
      
      // Verifica che il riepilogo sia inizializzato correttamente
      expect(monitoringSystem.summary).toHaveProperty('totalTasks', monitoringSystem.tasks.length);
      expect(monitoringSystem.summary).toHaveProperty('completedTasks', 0);
      expect(monitoringSystem.summary).toHaveProperty('pendingTasks', monitoringSystem.tasks.length);
      
      // Verifica che la percentuale di completamento sia 0
      expect(monitoringSystem.completionPercentage).toBe(0);
    });

    test('dovrebbe generare una procedura completa per una società', async () => {
      const result = await procedureGenerator.generateOperationalProcedure(clientFixtures.corporation);
      
      const { monitoringSystem } = result;
      
      expect(monitoringSystem).toHaveProperty('procedureType', 'corporation');
      
      // Verifica presenza attività specifiche per società
      const hasCorporateTasks = monitoringSystem.tasks.some(task => 
        task.title.includes('Bilancio') || 
        task.title.includes('Revisione')
      );
      expect(hasCorporateTasks).toBe(true);
    });
  });

  describe('updateTaskProgress', () => {
    test('dovrebbe aggiornare lo stato e il progresso di un\'attività', () => {
      // Mock di una procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Task 1',
              status: 'pending',
              progress: 0,
              statusHistory: [
                {
                  status: 'pending',
                  timestamp: new Date(),
                  note: 'Attività creata',
                  updatedBy: 'system'
                }
              ]
            },
            {
              id: 'task-2',
              title: 'Task 2',
              status: 'pending',
              progress: 0,
              statusHistory: [
                {
                  status: 'pending',
                  timestamp: new Date(),
                  note: 'Attività creata',
                  updatedBy: 'system'
                }
              ],
              dependsOn: ['task-1']
            }
          ],
          summary: {
            totalTasks: 2,
            completedTasks: 0,
            pendingTasks: 2,
            highPriorityTasks: 0
          },
          completionPercentage: 0
        }
      };
      
      // Aggiorna task-1 a 50% completato
      const updateData = {
        status: 'in_progress',
        progress: 50,
        note: 'Lavoro in corso',
        updatedBy: 'user123'
      };
      
      const result = procedureGenerator.updateTaskProgress(procedure, 'task-1', updateData);
      
      // Verifica che l'attività sia stata aggiornata
      const updatedTask = result.monitoringSystem.tasks.find(t => t.id === 'task-1');
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.progress).toBe(50);
      
      // Verifica che la cronologia sia stata aggiornata
      expect(updatedTask.statusHistory.length).toBe(2);
      expect(updatedTask.statusHistory[1].status).toBe('in_progress');
      expect(updatedTask.statusHistory[1].note).toBe('Lavoro in corso');
      expect(updatedTask.statusHistory[1].updatedBy).toBe('user123');
    });

    test('dovrebbe completare automaticamente un\'attività quando il progresso è 100%', () => {
      // Mock di una procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Task 1',
              status: 'in_progress',
              progress: 50,
              statusHistory: [
                {
                  status: 'pending',
                  timestamp: new Date(),
                  note: 'Attività creata',
                  updatedBy: 'system'
                },
                {
                  status: 'in_progress',
                  timestamp: new Date(),
                  note: 'Lavoro in corso',
                  updatedBy: 'user123'
                }
              ]
            }
          ],
          summary: {
            totalTasks: 1,
            completedTasks: 0,
            pendingTasks: 1,
            highPriorityTasks: 0
          },
          completionPercentage: 50
        }
      };
      
      // Aggiorna task-1 a 100% completato
      const updateData = {
        progress: 100,
        note: 'Lavoro completato',
        updatedBy: 'user123'
      };
      
      const result = procedureGenerator.updateTaskProgress(procedure, 'task-1', updateData);
      
      // Verifica che l'attività sia stata completata
      const updatedTask = result.monitoringSystem.tasks.find(t => t.id === 'task-1');
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.progress).toBe(100);
      
      // Verifica che la cronologia contenga l'aggiornamento manuale e quello automatico
      expect(updatedTask.statusHistory.length).toBe(4);
      
      // L'ultimo aggiornamento dovrebbe essere il completamento automatico
      const lastUpdate = updatedTask.statusHistory[updatedTask.statusHistory.length - 1];
      expect(lastUpdate.status).toBe('completed');
      expect(lastUpdate.updatedBy).toBe('system');
    });

    test('dovrebbe sbloccare attività dipendenti quando le dipendenze sono completate', () => {
      // Mock di una procedura
      const procedure = {
        monitoringSystem: {
          tasks: [
            {
              id: 'task-1',
              title: 'Task 1',
              status: 'in_progress',
              progress: 50,
              statusHistory: [
                {
                  status: 'pending',
                  timestamp: new Date(),
                  note: 'Attività creata',
                  updatedBy: 'system'
                },
                {
                  status: 'in_progress',
                  timestamp: new Date(),
                  note: 'Lavoro in corso',
                  updatedBy: 'user123'
                }
              ]
            },
            {
              id: 'task-2',
              title: 'Task 2',
              status: 'pending',
              progress: 0,
              statusHistory: [
                {
                  status: 'pending',
                  timestamp: new Date(),
                  note: 'Attività creata',
                  updatedBy: 'system'
                }
              ],
              dependsOn: ['task-1']
            }
          ],
          summary: {
            totalTasks: 2,
            completedTasks: 0,
            pendingTasks: 2,
            highPriorityTasks: 0
          },
          completionPercentage: 25
        }
      };
      
      // Completa task-1
      const updateData = {
        status: 'completed',
        progress: 100,
        note: 'Completato',
        updatedBy: 'user123'
      };
      
      const result = procedureGenerator.updateTaskProgress(procedure, 'task-1', updateData);
      
      // Verifica che l'attività 1 sia stata completata
      const updatedTask1 = result.monitoringSystem.tasks.find(t => t.id === 'task-1');
      expect(updatedTask1.status).toBe('completed');
      
      // Verifica che l'attività 2 sia stata sbloccata (un nuovo aggiornamento di stato nella cronologia)
      const updatedTask2 = result.monitoringSystem.tasks.find(t => t.id === 'task-2');
      expect(updatedTask2.statusHistory.length).toBe(2);
      
      // L'ultimo aggiornamento dovrebbe indicare che l'attività è stata sbloccata
      const lastUpdate = updatedTask2.statusHistory[updatedTask2.statusHistory.length - 1];
      expect(lastUpdate.note).toContain('sbloccata');
    });
  });

  describe('generateProgressReport', () => {
    test('dovrebbe generare un report corretto sullo stato delle procedure', () => {
      // Mock delle procedure
      const procedures = [
        {
          monitoringSystem: {
            procedureId: 'proc-1',
            clientId: 'client1',
            tasks: [
              {
                id: 'task-1',
                title: 'Task Completato',
                status: 'completed',
                progress: 100,
                dueDate: null
              },
              {
                id: 'task-2',
                title: 'Task In Corso',
                status: 'in_progress',
                progress: 50,
                dueDate: null
              }
            ],
            completionPercentage: 75
          }
        },
        {
          monitoringSystem: {
            procedureId: 'proc-2',
            clientId: 'client2',
            tasks: [
              {
                id: 'task-3',
                title: 'Task In Ritardo',
                status: 'pending',
                progress: 0,
                dueDate: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000), // 5 giorni fa
                priority: 'high'
              }
            ],
            completionPercentage: 0
          }
        },
        {
          monitoringSystem: {
            procedureId: 'proc-3',
            clientId: 'client3',
            tasks: [
              {
                id: 'task-4',
                title: 'Task Completato',
                status: 'completed',
                progress: 100,
                dueDate: null
              }
            ],
            completionPercentage: 100
          }
        }
      ];
      
      const report = procedureGenerator.generateProgressReport(procedures);
      
      // Verifica il sommario
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('totalProcedures', 3);
      expect(report.summary).toHaveProperty('completedProcedures', 1);
      expect(report.summary).toHaveProperty('inProgressProcedures', 1);
      expect(report.summary).toHaveProperty('notStartedProcedures', 1);
      expect(report.summary).toHaveProperty('completionRate', '33.33');
      
      // Verifica attività in ritardo
      expect(report).toHaveProperty('overdueTasks');
      expect(report.overdueTasks.length).toBe(1);
      expect(report.overdueTasks[0].taskTitle).toBe('Task In Ritardo');
      expect(report.overdueTasks[0].daysOverdue).toBe(5);
    });
  });
});