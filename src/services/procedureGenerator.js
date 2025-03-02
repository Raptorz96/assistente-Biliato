/**
 * Procedure Generator Service
 * 
 * Questo servizio gestisce la creazione e gestione di procedure operative
 * personalizzate per i clienti in base al loro profilo e tipo di attività.
 * Analizza il profilo cliente e genera checklist specifiche con attività,
 * scadenze, priorità e dipendenze.
 */

const fs = require('fs').promises;
const path = require('path');
const Client = require('../models/Client');
const Procedure = require('../models/Procedure');

/**
 * Analizza il profilo del cliente e determina le procedure necessarie
 * @param {Object} client - Profilo completo del cliente
 * @returns {Object} - Tipo di procedura e dettagli associati
 */
exports.analyzeProcedureRequirements = async (client) => {
  try {
    // Determina la tipologia di cliente e le procedure associate
    const { 
      companyType, 
      businessSector, 
      accountingRegime, 
      annualRevenue, 
      employees, 
      foundingDate,
      vatNumber 
    } = client;
    
    // Definisci il tipo di procedura in base alle caratteristiche del cliente
    let procedureType = 'standard';
    let complexityLevel = 'medium';
    
    // Determina il tipo di procedura in base al tipo di azienda
    switch (companyType) {
      case 'Individual':
        procedureType = 'individual';
        complexityLevel = accountingRegime === 'Forfettario' ? 'low' : 'medium';
        break;
      case 'Partnership':
        procedureType = 'partnership';
        complexityLevel = 'medium';
        break;
      case 'Corporation':
        procedureType = 'corporation';
        complexityLevel = 'high';
        break;
      case 'LLC':
        procedureType = 'llc';
        complexityLevel = 'high';
        break;
      default:
        procedureType = 'general';
        complexityLevel = 'medium';
    }
    
    // Aggiusta la complessità in base al fatturato e ai dipendenti
    if (annualRevenue > 1000000 || employees > 15) {
      complexityLevel = 'high';
    } else if (annualRevenue < 100000 && employees < 5) {
      complexityLevel = 'low';
    }
    
    // Considerazioni specifiche per settore
    const sectorSpecificTasks = [];
    
    if (businessSector) {
      const lowerSector = businessSector.toLowerCase();
      
      if (lowerSector.includes('commercio') || lowerSector.includes('retail')) {
        sectorSpecificTasks.push({
          title: 'Gestione Inventario',
          description: 'Monitoraggio e controllo dell\'inventario',
          priority: 'medium',
          type: 'inventory_management'
        });
      }
      
      if (lowerSector.includes('costruzioni') || lowerSector.includes('edilizia')) {
        sectorSpecificTasks.push({
          title: 'Tracciamento Progetti',
          description: 'Monitoraggio stati avanzamento lavori per commesse',
          priority: 'high',
          type: 'job_tracking'
        });
      }
      
      if (lowerSector.includes('sanità') || lowerSector.includes('health')) {
        sectorSpecificTasks.push({
          title: 'Adempimenti Sanitari',
          description: 'Gestione adempimenti specifici del settore sanitario',
          priority: 'high',
          type: 'healthcare_compliance'
        });
      }
      
      if (lowerSector.includes('servizi') || lowerSector.includes('service')) {
        sectorSpecificTasks.push({
          title: 'Monitoraggio Prestazioni',
          description: 'Tracciamento delle ore di servizio e analisi della redditività',
          priority: 'medium',
          type: 'service_monitoring'
        });
      }
    }
    
    // Determina requisiti fiscali specifici
    const fiscalRequirements = [];
    
    // Verifica IVA
    if (vatNumber) {
      fiscalRequirements.push('vat_declaration');
      
      // Se non forfettario, aggiungi liquidazione IVA
      if (accountingRegime !== 'Forfettario') {
        fiscalRequirements.push('vat_liquidation');
      }
    }
    
    // Altri requisiti basati sul tipo di società
    if (['Corporation', 'LLC'].includes(companyType)) {
      fiscalRequirements.push('corporate_tax');
      fiscalRequirements.push('financial_statements');
    } else if (companyType === 'Partnership') {
      fiscalRequirements.push('partnership_tax');
    } else {
      fiscalRequirements.push('personal_income_tax');
    }
    
    // Requisiti contabili
    const accountingRequirements = [];
    
    if (accountingRegime === 'Ordinario') {
      accountingRequirements.push('full_accounting');
      accountingRequirements.push('vat_registers');
    } else if (accountingRegime === 'Semplificato') {
      accountingRequirements.push('simplified_accounting');
      accountingRequirements.push('vat_registers');
    } else if (accountingRegime === 'Forfettario') {
      accountingRequirements.push('income_register');
    }
    
    // Valuta se è una nuova attività o un'attività esistente
    const isNewBusiness = foundingDate && 
      new Date(foundingDate) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    
    return {
      procedureType,
      complexityLevel,
      sectorSpecificTasks,
      needsQuarterlyReview: annualRevenue > 300000,
      needsAudit: companyType === 'Corporation' || annualRevenue > 1000000,
      fiscalRequirements,
      accountingRequirements,
      isNewBusiness,
      needsAnnualPlanning: annualRevenue > 500000 || employees > 10
    };
    
  } catch (error) {
    console.error('Errore nell\'analisi requisiti procedura:', error);
    throw new Error(`Impossibile analizzare i requisiti: ${error.message}`);
  }
};

/**
 * Genera una checklist di attività in base al regime contabile del cliente
 * @param {Object} client - Profilo cliente
 * @param {Object} procedureRequirements - Requisiti della procedura
 * @returns {Array} - Checklist di attività
 */
exports.generateTaskChecklist = async (client, procedureRequirements) => {
  try {
    const timestamp = Date.now();
    const { 
      procedureType, 
      complexityLevel, 
      sectorSpecificTasks,
      fiscalRequirements,
      accountingRequirements,
      isNewBusiness
    } = procedureRequirements;
    
    // Genera attività contabili di base in base al regime
    const accountingTasks = this.generateBaseAccountingTasks(client.accountingRegime);
    
    // Genera attività specifiche per il tipo di azienda
    const companyTasks = this.generateCompanySpecificTasks(client.companyType, complexityLevel);
    
    // Genera attività fiscali obbligatorie
    const fiscalTasks = this.generateFiscalTasks(fiscalRequirements);
    
    // Formatta le attività specifiche per settore
    const sectorTasks = this.generateSectorSpecificTasks(sectorSpecificTasks);
    
    // Unisci tutte le attività
    let allTasks = [
      ...accountingTasks,
      ...companyTasks,
      ...fiscalTasks,
      ...sectorTasks
    ];
    
    // Calcola date concrete per le scadenze
    allTasks = this.calculateTaskDeadlines(allTasks);
    
    // Imposta dipendenze tra le attività
    allTasks = this.resolveTaskDependencies(allTasks);
    
    // Ordina i task per scadenza e poi priorità
    allTasks.sort((a, b) => {
      // Prima ordina per data di scadenza
      if (a.dueDate && b.dueDate) {
        const dateComparison = new Date(a.dueDate) - new Date(b.dueDate);
        if (dateComparison !== 0) return dateComparison;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }
      
      // Se le date sono uguali o mancanti, ordina per priorità
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return allTasks;
    
  } catch (error) {
    console.error('Errore nella generazione della checklist:', error);
    throw new Error(`Impossibile generare la checklist: ${error.message}`);
  }
};

/**
 * Genera una checklist di attività contabili base in base al regime contabile
 * @param {String} accountingRegime - Regime contabile del cliente
 * @returns {Array} - Lista di attività contabili base
 */
exports.generateBaseAccountingTasks = (accountingRegime) => {
  const timestamp = Date.now();
  
  // Attività comuni a tutti i regimi
  const commonTasks = [
    {
      id: `task-${timestamp}-1`,
      title: 'Raccolta Documentazione Contabile',
      description: 'Raccolta e organizzazione di tutti i documenti contabili del periodo',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'monthly',
        dayOfMonth: 10,
        description: 'Entro il 10 del mese successivo'
      },
      tags: ['contabilità', 'documentazione'],
      dependsOn: []
    },
    {
      id: `task-${timestamp}-2`,
      title: 'Riconciliazione Bancaria',
      description: 'Riconciliazione dei movimenti bancari con le registrazioni contabili',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'monthly',
        dayOfMonth: 20,
        description: 'Entro il 20 del mese successivo'
      },
      tags: ['contabilità', 'banca'],
      dependsOn: [`task-${timestamp}-1`] // Dipende dalla raccolta documentazione
    }
  ];
  
  // Attività specifiche per regime
  let regimeSpecificTasks = [];
  
  switch (accountingRegime) {
    case 'Ordinario':
      regimeSpecificTasks = [
        {
          id: `task-${timestamp}-3`,
          title: 'Registrazione Fatture',
          description: 'Registrazione di tutte le fatture di acquisto e vendita nei registri IVA',
          priority: 'high',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'monthly',
            dayOfMonth: 15,
            description: 'Entro il 15 del mese successivo'
          },
          tags: ['contabilità', 'iva'],
          dependsOn: [`task-${timestamp}-1`]
        },
        {
          id: `task-${timestamp}-4`,
          title: 'Liquidazione IVA',
          description: 'Calcolo dell\'IVA a debito/credito e preparazione F24 per versamento',
          priority: 'high',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'monthly',
            dayOfMonth: 16,
            description: 'Entro il 16 del mese successivo'
          },
          tags: ['fiscale', 'iva'],
          dependsOn: [`task-${timestamp}-3`]
        },
        {
          id: `task-${timestamp}-5`,
          title: 'Scritture di Assestamento',
          description: 'Registrazione delle scritture di assestamento e rettifica',
          priority: 'medium',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'quarterly',
            description: 'Entro 30 giorni dalla chiusura del trimestre'
          },
          tags: ['contabilità', 'bilancio'],
          dependsOn: [`task-${timestamp}-2`, `task-${timestamp}-3`]
        }
      ];
      break;
      
    case 'Semplificato':
      regimeSpecificTasks = [
        {
          id: `task-${timestamp}-3`,
          title: 'Registrazione Fatture',
          description: 'Registrazione di tutte le fatture di acquisto e vendita',
          priority: 'high',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'monthly',
            dayOfMonth: 15,
            description: 'Entro il 15 del mese successivo'
          },
          tags: ['contabilità', 'iva'],
          dependsOn: [`task-${timestamp}-1`]
        },
        {
          id: `task-${timestamp}-4`,
          title: 'Liquidazione IVA',
          description: 'Calcolo dell\'IVA a debito/credito e preparazione F24 per versamento',
          priority: 'high',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'monthly',
            dayOfMonth: 16,
            description: 'Entro il 16 del mese successivo'
          },
          tags: ['fiscale', 'iva'],
          dependsOn: [`task-${timestamp}-3`]
        }
      ];
      break;
      
    case 'Forfettario':
      regimeSpecificTasks = [
        {
          id: `task-${timestamp}-3`,
          title: 'Aggiornamento Registro dei Corrispettivi',
          description: 'Aggiornamento del registro cronologico dei ricavi e delle spese',
          priority: 'medium',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'monthly',
            dayOfMonth: 15,
            description: 'Entro il 15 del mese successivo'
          },
          tags: ['contabilità', 'forfettario'],
          dependsOn: [`task-${timestamp}-1`]
        },
        {
          id: `task-${timestamp}-4`,
          title: 'Verifica Requisiti Regime Forfettario',
          description: 'Controllo del mantenimento dei requisiti per il regime forfettario',
          priority: 'medium',
          status: 'pending',
          progress: 0,
          deadline: {
            type: 'quarterly',
            description: 'Alla fine di ogni trimestre'
          },
          tags: ['fiscale', 'forfettario'],
          dependsOn: [`task-${timestamp}-3`]
        }
      ];
      break;
      
    default:
      // Nessuna attività specifica aggiuntiva
      break;
  }
  
  return [...commonTasks, ...regimeSpecificTasks];
};

/**
 * Genera attività specifiche per il tipo di azienda
 * @param {String} companyType - Tipo di azienda
 * @param {String} complexityLevel - Livello di complessità
 * @returns {Array} - Lista di attività specifiche per il tipo di azienda
 */
exports.generateCompanySpecificTasks = (companyType, complexityLevel) => {
  const tasks = [];
  const timestamp = Date.now();
  
  // Attività specifiche per tipo di azienda
  switch (companyType) {
    case 'Individual':
      tasks.push({
        id: `task-${timestamp}-comp-1`,
        title: 'Acconti Imposte',
        description: 'Calcolo e preparazione degli acconti di imposta',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro il 30 Novembre'
        },
        tags: ['fiscale', 'imposte'],
        dependsOn: []
      });
      break;
      
    case 'Partnership':
      tasks.push({
        id: `task-${timestamp}-comp-1`,
        title: 'Ripartizione Utili e Perdite',
        description: 'Calcolo della ripartizione degli utili e delle perdite tra i soci',
        priority: 'medium',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro 4 mesi dalla chiusura dell\'esercizio'
        },
        tags: ['società', 'utili'],
        dependsOn: []
      });
      tasks.push({
        id: `task-${timestamp}-comp-2`,
        title: 'Acconti Imposte Soci',
        description: 'Calcolo e comunicazione degli acconti di imposta per i soci',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro il 30 Novembre'
        },
        tags: ['fiscale', 'imposte'],
        dependsOn: [`task-${timestamp}-comp-1`]
      });
      break;
      
    case 'LLC':
      tasks.push({
        id: `task-${timestamp}-comp-1`,
        title: 'Predisposizione Bilancio',
        description: 'Elaborazione del bilancio di esercizio',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro 4 mesi dalla chiusura dell\'esercizio'
        },
        tags: ['bilancio', 'società'],
        dependsOn: []
      });
      tasks.push({
        id: `task-${timestamp}-comp-2`,
        title: 'Deposito Bilancio CCIAA',
        description: 'Preparazione e deposito del bilancio presso la Camera di Commercio',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro 30 giorni dall\'approvazione del bilancio'
        },
        tags: ['bilancio', 'adempimenti'],
        dependsOn: [`task-${timestamp}-comp-1`]
      });
      break;
      
    case 'Corporation':
      tasks.push({
        id: `task-${timestamp}-comp-1`,
        title: 'Predisposizione Bilancio',
        description: 'Elaborazione del bilancio di esercizio',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro 4 mesi dalla chiusura dell\'esercizio'
        },
        tags: ['bilancio', 'società'],
        dependsOn: []
      });
      tasks.push({
        id: `task-${timestamp}-comp-2`,
        title: 'Revisione Legale',
        description: 'Supporto alle attività di revisione legale dei conti',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Prima dell\'approvazione del bilancio'
        },
        tags: ['bilancio', 'revisione'],
        dependsOn: [`task-${timestamp}-comp-1`]
      });
      tasks.push({
        id: `task-${timestamp}-comp-3`,
        title: 'Deposito Bilancio CCIAA',
        description: 'Preparazione e deposito del bilancio presso la Camera di Commercio',
        priority: 'high',
        status: 'pending',
        progress: 0,
        deadline: {
          type: 'annual',
          description: 'Entro 30 giorni dall\'approvazione del bilancio'
        },
        tags: ['bilancio', 'adempimenti'],
        dependsOn: [`task-${timestamp}-comp-1`, `task-${timestamp}-comp-2`]
      });
      break;
      
    default:
      // Nessuna attività specifica aggiuntiva
      break;
  }
  
  // Aggiungi attività basate sulla complessità
  if (complexityLevel === 'high') {
    tasks.push({
      id: `task-${timestamp}-compl-1`,
      title: 'Analisi Budget vs Actual',
      description: 'Comparazione dei dati previsionali con quelli effettivi',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'quarterly',
        description: 'Entro 20 giorni dalla chiusura del trimestre'
      },
      tags: ['analisi', 'budget'],
      dependsOn: []
    });
    
    tasks.push({
      id: `task-${timestamp}-compl-2`,
      title: 'Forecast Finanziario',
      description: 'Aggiornamento delle previsioni finanziarie',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'quarterly',
        description: 'Entro 30 giorni dalla chiusura del trimestre'
      },
      tags: ['analisi', 'forecast'],
      dependsOn: [`task-${timestamp}-compl-1`]
    });
  }
  
  return tasks;
};

/**
 * Genera attività fiscali obbligatorie
 * @param {Array} fiscalRequirements - Requisiti fiscali del cliente
 * @returns {Array} - Lista di attività fiscali
 */
exports.generateFiscalTasks = (fiscalRequirements) => {
  const tasks = [];
  const timestamp = Date.now();
  
  // Attività per dichiarazione IVA annuale
  if (fiscalRequirements.includes('vat_declaration')) {
    tasks.push({
      id: `task-${timestamp}-fisc-1`,
      title: 'Dichiarazione IVA Annuale',
      description: 'Predisposizione e invio della dichiarazione IVA annuale',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'annual',
        description: 'Entro il 30 Aprile'
      },
      tags: ['fiscale', 'iva', 'dichiarazioni'],
      dependsOn: []
    });
  }
  
  // Attività per dichiarazione dei redditi
  if (fiscalRequirements.includes('personal_income_tax')) {
    tasks.push({
      id: `task-${timestamp}-fisc-2`,
      title: 'Dichiarazione dei Redditi Persone Fisiche',
      description: 'Predisposizione e invio della dichiarazione dei redditi',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'annual',
        description: 'Entro il 30 Novembre'
      },
      tags: ['fiscale', 'redditi', 'dichiarazioni'],
      dependsOn: []
    });
  }
  
  // Attività per tassazione società
  if (fiscalRequirements.includes('corporate_tax')) {
    tasks.push({
      id: `task-${timestamp}-fisc-3`,
      title: 'Dichiarazione dei Redditi Societari',
      description: 'Predisposizione e invio della dichiarazione dei redditi societari',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'annual',
        description: 'Entro l\'ultimo giorno del nono mese successivo alla chiusura del periodo d\'imposta'
      },
      tags: ['fiscale', 'redditi', 'società', 'dichiarazioni'],
      dependsOn: []
    });
  }
  
  // Attività per bilancio
  if (fiscalRequirements.includes('financial_statements')) {
    tasks.push({
      id: `task-${timestamp}-fisc-4`,
      title: 'Chiusura di Bilancio',
      description: 'Operazioni di chiusura e assestamento del bilancio',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'annual',
        description: 'Entro 120 giorni dalla chiusura dell\'esercizio'
      },
      tags: ['bilancio', 'chiusura'],
      dependsOn: []
    });
  }
  
  // Attività per dichiarazione redditi società di persone
  if (fiscalRequirements.includes('partnership_tax')) {
    tasks.push({
      id: `task-${timestamp}-fisc-5`,
      title: 'Dichiarazione Redditi Società di Persone',
      description: 'Predisposizione e invio della dichiarazione dei redditi della società di persone',
      priority: 'high',
      status: 'pending',
      progress: 0,
      deadline: {
        type: 'annual',
        description: 'Entro il 30 Novembre'
      },
      tags: ['fiscale', 'redditi', 'società', 'dichiarazioni'],
      dependsOn: []
    });
  }
  
  return tasks;
};

/**
 * Genera attività specifiche per settore di business
 * @param {Array} sectorSpecificTasks - Lista di attività specifiche per settore
 * @returns {Array} - Lista di attività formattate
 */
exports.generateSectorSpecificTasks = (sectorSpecificTasks) => {
  const timestamp = Date.now();
  
  // Formatta le attività specifiche del settore
  return sectorSpecificTasks.map((task, index) => ({
    id: `task-${timestamp}-sector-${index + 1}`,
    title: task.title,
    description: task.description,
    priority: task.priority || 'medium',
    status: 'pending',
    progress: 0,
    deadline: {
      type: 'monthly',
      dayOfMonth: 30,
      description: 'Entro fine mese'
    },
    tags: ['settore-specifico', task.type],
    dependsOn: []
  }));
};

/**
 * Calcola e imposta le date concrete per le scadenze
 * @param {Array} tasks - Lista di attività con scadenze generiche
 * @returns {Array} - Lista di attività con date concrete
 */
exports.calculateTaskDeadlines = (tasks) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Definisci date di scadenza fiscali
  const fiscalDeadlines = {
    vat_annual: new Date(currentYear, 3, 30), // 30 Aprile
    income_tax_individuals: new Date(currentYear, 10, 30), // 30 Novembre
    income_tax_companies: (() => {
      // Ultimo giorno del nono mese dopo la chiusura dell'esercizio fiscale
      // Assumiamo chiusura standard al 31/12
      const date = new Date(currentYear, 8, 30); // 30 Settembre
      return date;
    })()
  };
  
  return tasks.map(task => {
    const updatedTask = { ...task };
    
    // Se la scadenza è definita, calcola la data concreta
    if (task.deadline) {
      switch (task.deadline.type) {
        case 'monthly':
          // Se siamo oltre il giorno del mese, imposta il mese successivo
          let targetMonth = currentMonth;
          const dayOfMonth = task.deadline.dayOfMonth || 30;
          
          if (today.getDate() > dayOfMonth) {
            targetMonth = (currentMonth + 1) % 12;
          }
          
          updatedTask.dueDate = new Date(
            targetMonth === 11 && currentMonth === 0 ? currentYear - 1 : currentYear,
            targetMonth,
            dayOfMonth
          );
          break;
          
        case 'quarterly':
          // Calcola il prossimo trimestre
          const currentQuarter = Math.floor(currentMonth / 3);
          const nextQuarter = (currentQuarter + 1) % 4;
          const nextQuarterMonth = nextQuarter * 3 + 1; // Mese centrale del trimestre
          
          updatedTask.dueDate = new Date(
            nextQuarter === 0 && currentQuarter === 3 ? currentYear + 1 : currentYear,
            nextQuarterMonth,
            15
          );
          break;
          
        case 'annual':
          // Cerca di identificare la data di scadenza fiscale appropriata
          let annualDueDate;
          
          if (task.title.includes('IVA')) {
            annualDueDate = fiscalDeadlines.vat_annual;
          } else if (task.title.includes('Persone Fisiche')) {
            annualDueDate = fiscalDeadlines.income_tax_individuals;
          } else if (task.title.includes('Societari') || task.title.includes('Società')) {
            annualDueDate = fiscalDeadlines.income_tax_companies;
          } else if (task.title.includes('Bilancio')) {
            // 120 giorni dalla chiusura dell'esercizio, assumiamo 31/12
            annualDueDate = new Date(currentYear, 3, 30); // 30 Aprile
          } else if (task.title.includes('Acconti')) {
            annualDueDate = new Date(currentYear, 10, 30); // 30 Novembre
          } else {
            // Default: fine anno
            annualDueDate = new Date(currentYear, 11, 31); // 31 Dicembre
          }
          
          updatedTask.dueDate = annualDueDate;
          break;
      }
    }
    
    return updatedTask;
  });
};

/**
 * Risolve le dipendenze tra le attività e aggiorna l'ordine
 * @param {Array} tasks - Lista di attività con dipendenze basate su ID
 * @returns {Array} - Lista di attività con dipendenze risolte
 */
exports.resolveTaskDependencies = (tasks) => {
  // Crea una mappa degli ID per la risoluzione delle dipendenze
  const taskMap = {};
  tasks.forEach(task => {
    taskMap[task.id] = task;
  });
  
  // Per ogni task, aggiungi la dipendenza risolta
  return tasks.map(task => {
    const resolvedDependencies = [];
    
    // Risolvi ogni dipendenza
    if (task.dependsOn && task.dependsOn.length > 0) {
      task.dependsOn.forEach(depId => {
        if (taskMap[depId]) {
          resolvedDependencies.push({
            id: depId,
            title: taskMap[depId].title
          });
        }
      });
    }
    
    return {
      ...task,
      resolvedDependencies
    };
  });
};

/**
 * Stabilisce priorità e scadenze per le attività della procedura
 * @param {Array} tasks - Lista delle attività
 * @param {Object} client - Profilo cliente
 * @returns {Array} - Attività con priorità e scadenze aggiornate
 */
exports.setupTaskPriorities = (tasks, client) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Definisci le date di scadenza fiscali principali
    const taxDeadlines = {
      annualTaxReturn: new Date(currentYear, 5, 30), // 30 Giugno
      vatPaymentQ1: new Date(currentYear, 4, 16),    // 16 Maggio
      vatPaymentQ2: new Date(currentYear, 7, 16),    // 16 Agosto
      vatPaymentQ3: new Date(currentYear, 10, 16),   // 16 Novembre
      vatPaymentQ4: new Date(currentYear, 1, 16),    // 16 Febbraio anno successivo
    };
    
    // Aggiorna le priorità e le scadenze in base al periodo attuale
    return tasks.map(task => {
      const updatedTask = { ...task };
      
      // Se è una task fiscale, aggiorna la priorità in base alla vicinanza della scadenza
      if (task.tags.includes('fiscale')) {
        // Trova la scadenza fiscale più vicina
        const closestDeadline = Object.values(taxDeadlines).reduce((closest, date) => {
          const diff = date - today;
          if (diff > 0 && (!closest || diff < closest - today)) {
            return date;
          }
          return closest;
        }, null);
        
        // Se la scadenza è entro 30 giorni, imposta priorità alta
        if (closestDeadline && (closestDeadline - today) / (1000 * 60 * 60 * 24) < 30) {
          updatedTask.priority = 'high';
        }
      }
      
      // Calcola date concrete per le scadenze
      if (task.deadline) {
        switch (task.deadline.type) {
          case 'monthly':
            // Se siamo oltre il giorno del mese, imposta il mese successivo
            let targetMonth = currentMonth;
            if (today.getDate() > task.deadline.dayOfMonth) {
              targetMonth = (currentMonth + 1) % 12;
            }
            updatedTask.dueDate = new Date(
              targetMonth === 11 && currentMonth === 0 ? currentYear - 1 : currentYear,
              targetMonth,
              task.deadline.dayOfMonth
            );
            break;
            
          case 'quarterly':
            // Calcola il prossimo trimestre
            const currentQuarter = Math.floor(currentMonth / 3);
            const nextQuarter = (currentQuarter + 1) % 4;
            const nextQuarterMonth = nextQuarter * 3 + 1; // Mese centrale del trimestre
            
            updatedTask.dueDate = new Date(
              nextQuarter === 0 && currentQuarter === 3 ? currentYear + 1 : currentYear,
              nextQuarterMonth,
              15
            );
            break;
            
          case 'annual':
            // Imposta la data annuale (default: fine anno fiscale)
            updatedTask.dueDate = new Date(currentYear, 11, 31);
            break;
        }
      }
      
      return updatedTask;
    });
    
  } catch (error) {
    console.error('Errore nell\'impostazione delle priorità:', error);
    throw new Error(`Impossibile impostare priorità e scadenze: ${error.message}`);
  }
};

/**
 * Crea un sistema di monitoraggio per lo stato di avanzamento delle procedure
 * @param {string} clientId - ID del cliente
 * @param {Array} tasks - Lista delle attività
 * @returns {Object} - Struttura monitoraggio procedura
 */
exports.createMonitoringSystem = (clientId, tasks) => {
  const procedureId = `proc-${Date.now()}-${clientId.substring(0, 6)}`;
  
  return {
    procedureId,
    clientId,
    name: `Procedura Operativa Cliente ${procedureId}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    completionPercentage: 0,
    status: 'active',
    tasks: tasks.map(task => ({
      ...task,
      progress: 0,
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          note: 'Attività creata'
        }
      ]
    })),
    summary: {
      totalTasks: tasks.length,
      completedTasks: 0,
      pendingTasks: tasks.length,
      highPriorityTasks: tasks.filter(t => t.priority === 'high').length,
      overdueNearest: null
    }
  };
};

/**
 * Genera una procedura operativa completa per un cliente
 * @param {Object} client - Profilo cliente completo
 * @returns {Object} - Procedura operativa generata
 */
exports.generateOperationalProcedure = async (client) => {
  try {
    // Step 1: Analizza il profilo del cliente
    const procedureRequirements = await this.analyzeProcedureRequirements(client);
    
    // Step 2: Genera la checklist di attività
    const tasks = await this.generateTaskChecklist(client, procedureRequirements);
    
    // Step 3: Crea il sistema di monitoraggio con le attività preparate
    const procedureId = `proc-${Date.now()}-${client._id.toString().substring(0, 6)}`;
    
    const monitoringSystem = {
      procedureId,
      clientId: client._id,
      name: `Procedura Operativa: ${client.name}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      completionPercentage: 0,
      status: 'active',
      procedureType: procedureRequirements.procedureType,
      complexityLevel: procedureRequirements.complexityLevel,
      tasks: tasks.map(task => {
        // Rimuovi alcuni campi che non servono più
        const { resolvedDependencies, ...taskWithoutResolved } = task;
        
        return {
          ...taskWithoutResolved,
          progress: 0,
          statusHistory: [{
            status: 'pending',
            timestamp: new Date(),
            note: 'Attività creata automaticamente',
            updatedBy: 'system'
          }]
        };
      }),
      summary: {
        totalTasks: tasks.length,
        completedTasks: 0,
        pendingTasks: tasks.length,
        highPriorityTasks: tasks.filter(t => t.priority === 'high').length,
        overdueNearest: null
      }
    };
    
    // Aggiorna le date di riferimento per il monitoraggio
    const overdueNearest = tasks
      .filter(t => t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]?.dueDate || null;
    
    monitoringSystem.summary.overdueNearest = overdueNearest;
    
    return {
      procedureRequirements,
      monitoringSystem
    };
  } catch (error) {
    console.error('Errore nella generazione della procedura operativa:', error);
    throw new Error(`Impossibile generare procedura operativa: ${error.message}`);
  }
};

/**
 * Aggiorna lo stato di avanzamento di una procedura
 * @param {Object} procedure - Procedura da aggiornare
 * @param {string} taskId - ID dell'attività da aggiornare
 * @param {Object} updateData - Dati di aggiornamento
 * @returns {Object} - Procedura aggiornata
 */
exports.updateTaskProgress = (procedure, taskId, updateData) => {
  try {
    const { monitoringSystem } = procedure;
    const taskIndex = monitoringSystem.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error(`Attività con ID ${taskId} non trovata`);
    }
    
    // Aggiorna lo stato dell'attività
    const task = monitoringSystem.tasks[taskIndex];
    const updatedTask = {
      ...task,
      ...updateData,
      updatedAt: new Date()
    };
    
    // Aggiungi l'aggiornamento alla cronologia
    updatedTask.statusHistory = [
      ...task.statusHistory,
      {
        status: updateData.status || task.status,
        timestamp: new Date(),
        note: updateData.note || `Aggiornamento stato: ${updateData.progress || task.progress}%`,
        updatedBy: updateData.updatedBy || 'system'
      }
    ];
    
    // Se il progresso è 100% ma lo stato non è completato, aggiorna lo stato
    if (updatedTask.progress === 100 && updatedTask.status !== 'completed') {
      updatedTask.status = 'completed';
      updatedTask.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        note: 'Completato automaticamente (progresso 100%)',
        updatedBy: updateData.updatedBy || 'system'
      });
    }
    
    // Aggiorna l'attività nella procedura
    monitoringSystem.tasks[taskIndex] = updatedTask;
    
    // Controlla le dipendenze per sbloccare attività che dipendono da quella completata
    if (updatedTask.status === 'completed') {
      monitoringSystem.tasks.forEach((t, idx) => {
        if (t.dependsOn && t.dependsOn.includes(taskId) && t.status === 'pending') {
          // Verifica se tutte le dipendenze sono state completate
          const allDependenciesCompleted = t.dependsOn.every(depId => {
            const depTask = monitoringSystem.tasks.find(dt => dt.id === depId);
            return depTask && depTask.status === 'completed';
          });
          
          if (allDependenciesCompleted) {
            // Aggiorna lo stato per indicare che l'attività è ora disponibile
            monitoringSystem.tasks[idx].statusHistory.push({
              status: t.status,
              timestamp: new Date(),
              note: 'Attività sbloccata (dipendenze completate)',
              updatedBy: 'system'
            });
          }
        }
      });
    }
    
    // Ricalcola lo stato complessivo della procedura
    const totalTasks = monitoringSystem.tasks.length;
    const completedTasks = monitoringSystem.tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = totalTasks - completedTasks;
    
    // Calcola percentuale di completamento
    const completionPercentage = Math.round(monitoringSystem.tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks);
    
    // Trova l'attività in scadenza più vicina tra le non completate
    const today = new Date();
    const upcomingTasks = monitoringSystem.tasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    const overdueNearest = upcomingTasks.length > 0 ? upcomingTasks[0].dueDate : null;
    
    // Calcola le attività in ritardo
    const overdueTasks = monitoringSystem.tasks.filter(t => 
      t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < today
    ).length;
    
    // Aggiorna il riepilogo
    monitoringSystem.summary = {
      totalTasks,
      completedTasks,
      pendingTasks,
      highPriorityTasks: monitoringSystem.tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
      overdueNearest,
      overdueTasks
    };
    
    monitoringSystem.completionPercentage = completionPercentage;
    monitoringSystem.updatedAt = new Date();
    
    // Aggiorna lo stato complessivo della procedura
    if (completedTasks === totalTasks) {
      monitoringSystem.status = 'completed';
    }
    
    return procedure;
  } catch (error) {
    console.error('Errore nell\'aggiornamento avanzamento:', error);
    throw new Error(`Impossibile aggiornare avanzamento: ${error.message}`);
  }
};

/**
 * Genera una reportistica sullo stato delle procedure
 * @param {Array} procedures - Lista delle procedure da analizzare
 * @returns {Object} - Report sullo stato delle procedure
 */
exports.generateProgressReport = (procedures) => {
  try {
    // Statistiche generali
    const total = procedures.length;
    const completed = procedures.filter(p => parseFloat(p.monitoringSystem.completionPercentage) === 100).length;
    const inProgress = procedures.filter(p => 
      parseFloat(p.monitoringSystem.completionPercentage) > 0 && 
      parseFloat(p.monitoringSystem.completionPercentage) < 100
    ).length;
    const notStarted = procedures.filter(p => parseFloat(p.monitoringSystem.completionPercentage) === 0).length;
    
    // Calcola attività in ritardo
    const today = new Date();
    const overdueTasks = [];
    
    procedures.forEach(procedure => {
      procedure.monitoringSystem.tasks.forEach(task => {
        if (task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < today) {
          overdueTasks.push({
            procedureId: procedure.monitoringSystem.procedureId,
            clientId: procedure.monitoringSystem.clientId,
            taskId: task.id,
            taskTitle: task.title,
            dueDate: task.dueDate,
            daysOverdue: Math.floor((today - new Date(task.dueDate)) / (1000 * 60 * 60 * 24)),
            priority: task.priority
          });
        }
      });
    });
    
    // Ordina attività in ritardo per priorità e giorni di ritardo
    const sortedOverdueTasks = overdueTasks.sort((a, b) => {
      const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.daysOverdue - a.daysOverdue;
    });
    
    return {
      summary: {
        totalProcedures: total,
        completedProcedures: completed,
        inProgressProcedures: inProgress,
        notStartedProcedures: notStarted,
        completionRate: total > 0 ? (completed / total * 100).toFixed(2) : 0,
        overdueTasks: overdueTasks.length
      },
      overdueTasks: sortedOverdueTasks.slice(0, 10), // Top 10 attività in ritardo
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Errore nella generazione del report:', error);
    throw new Error(`Impossibile generare report: ${error.message}`);
  }
};