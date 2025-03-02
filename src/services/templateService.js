/**
 * Template Service
 * 
 * Gestisce le operazioni sui template, inclusi creazione, aggiornamento e ricerca
 */

const fs = require('fs').promises;
const path = require('path');
const Template = require('../models/Template');

/**
 * Crea un nuovo template
 * @param {Object} templateData - Dati del template
 * @returns {Promise<Object>} - Template creato
 */
exports.createTemplate = async (templateData) => {
  try {
    // Crea il template nel database
    const template = new Template(templateData);
    
    // Se il contenuto HTML è definito, estrai i campi richiesti
    if (templateData.content) {
      template.requiredFields = template.extractRequiredFields();
    }
    
    // Salva il template nel database
    await template.save();
    
    // Se necessario, salva anche su file system
    await saveTemplateToFile(template);
    
    return template;
  } catch (error) {
    console.error('Errore nella creazione del template:', error);
    throw new Error(`Impossibile creare il template: ${error.message}`);
  }
};

/**
 * Aggiorna un template esistente
 * @param {string} templateId - ID del template da aggiornare
 * @param {Object} updateData - Dati da aggiornare
 * @returns {Promise<Object>} - Template aggiornato
 */
exports.updateTemplate = async (templateId, updateData) => {
  try {
    const template = await Template.findById(templateId);
    
    if (!template) {
      throw new Error('Template non trovato');
    }
    
    // Aggiorna i campi del template
    Object.keys(updateData).forEach(key => {
      template[key] = updateData[key];
    });
    
    // Se il contenuto è stato aggiornato, ricalcola i campi richiesti
    if (updateData.content) {
      template.requiredFields = template.extractRequiredFields();
    }
    
    // Salva le modifiche
    await template.save();
    
    // Aggiorna anche il file su disco
    await saveTemplateToFile(template);
    
    return template;
  } catch (error) {
    console.error('Errore nell\'aggiornamento del template:', error);
    throw new Error(`Impossibile aggiornare il template: ${error.message}`);
  }
};

/**
 * Ottiene un template per ID
 * @param {string} templateId - ID del template
 * @returns {Promise<Object>} - Template trovato
 */
exports.getTemplateById = async (templateId) => {
  try {
    const template = await Template.findById(templateId);
    
    if (!template) {
      throw new Error('Template non trovato');
    }
    
    return template;
  } catch (error) {
    console.error('Errore nel recupero del template:', error);
    throw new Error(`Impossibile recuperare il template: ${error.message}`);
  }
};

/**
 * Ottiene un template per nome
 * @param {string} templateName - Nome del template
 * @returns {Promise<Object>} - Template trovato
 */
exports.getTemplateByName = async (templateName) => {
  try {
    const template = await Template.findOne({ name: templateName });
    
    if (!template) {
      throw new Error(`Template con nome "${templateName}" non trovato`);
    }
    
    return template;
  } catch (error) {
    console.error('Errore nel recupero del template per nome:', error);
    throw new Error(`Impossibile recuperare il template: ${error.message}`);
  }
};

/**
 * Ottiene tutti i template, con possibilità di filtraggio
 * @param {Object} filters - Filtri (tipo, categoria, attivi, ecc.)
 * @returns {Promise<Array>} - Lista di template
 */
exports.getAllTemplates = async (filters = {}) => {
  try {
    let query = {};
    
    // Applica filtri
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.tag) query.tags = { $in: [filters.tag] };
    
    // Esegui la query con eventuali ordinamenti e paginazione
    const templates = await Template.find(query)
      .sort(filters.sort || { updatedAt: -1 })
      .skip(filters.skip || 0)
      .limit(filters.limit || 0);
    
    return templates;
  } catch (error) {
    console.error('Errore nel recupero dei template:', error);
    throw new Error(`Impossibile recuperare i template: ${error.message}`);
  }
};

/**
 * Elimina un template
 * @param {string} templateId - ID del template da eliminare
 * @returns {Promise<Object>} - Risultato operazione
 */
exports.deleteTemplate = async (templateId) => {
  try {
    const template = await Template.findById(templateId);
    
    if (!template) {
      throw new Error('Template non trovato');
    }
    
    // Elimina il template dal database
    await Template.deleteOne({ _id: templateId });
    
    // Elimina anche il file dal disco
    try {
      const filePath = path.join(__dirname, '../../templates', template.getFilename());
      await fs.unlink(filePath);
    } catch (fileError) {
      console.warn('Impossibile eliminare il file del template:', fileError);
      // Continua anche se il file non può essere eliminato
    }
    
    return { success: true, message: 'Template eliminato con successo' };
  } catch (error) {
    console.error('Errore nell\'eliminazione del template:', error);
    throw new Error(`Impossibile eliminare il template: ${error.message}`);
  }
};

/**
 * Importa un template da file HTML
 * @param {string} filePath - Percorso del file HTML
 * @param {Object} templateData - Metadati del template
 * @returns {Promise<Object>} - Template importato
 */
exports.importTemplateFromFile = async (filePath, templateData) => {
  try {
    // Leggi il contenuto del file
    const content = await fs.readFile(filePath, 'utf8');
    
    // Estrai CSS dal file HTML (opzionale, implementazione semplificata)
    let css = '';
    const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch && styleMatch[1]) {
      css = styleMatch[1].trim();
    }
    
    // Crea il template
    const newTemplate = new Template({
      ...templateData,
      content,
      css
    });
    
    // Estrai i campi richiesti
    newTemplate.requiredFields = newTemplate.extractRequiredFields();
    
    // Salva il template
    await newTemplate.save();
    
    return newTemplate;
  } catch (error) {
    console.error('Errore nell\'importazione del template:', error);
    throw new Error(`Impossibile importare il template: ${error.message}`);
  }
};

/**
 * Salva un template come file
 * @param {Object} template - Template da salvare
 * @returns {Promise<void>}
 */
async function saveTemplateToFile(template) {
  try {
    // Costruisci il percorso di output
    const outputPath = path.join(__dirname, '../../templates', template.getFilename());
    
    // Scrivi il file
    await fs.writeFile(outputPath, template.content);
    
    return outputPath;
  } catch (error) {
    console.error('Errore nel salvataggio del template su file:', error);
    throw new Error(`Impossibile salvare il template su file: ${error.message}`);
  }
}

/**
 * Sincronizza i template tra database e filesystem
 * @returns {Promise<Object>} - Risultato della sincronizzazione
 */
exports.syncTemplates = async () => {
  try {
    const templatesDir = path.join(__dirname, '../../templates');
    const files = await fs.readdir(templatesDir);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    const result = {
      added: 0,
      updated: 0,
      errors: []
    };
    
    // Per ogni file HTML, controlla se esiste nel DB e aggiornalo, altrimenti crealo
    for (const htmlFile of htmlFiles) {
      const templateName = htmlFile.replace('.html', '');
      
      try {
        // Cerca nel DB
        const existingTemplate = await Template.findOne({ name: templateName });
        
        // Leggi il contenuto del file
        const filePath = path.join(templatesDir, htmlFile);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (existingTemplate) {
          // Se il contenuto è diverso, aggiorna
          if (existingTemplate.content !== content) {
            existingTemplate.content = content;
            existingTemplate.requiredFields = existingTemplate.extractRequiredFields();
            await existingTemplate.save();
            result.updated++;
          }
        } else {
          // Crea un nuovo template
          const newTemplate = new Template({
            name: templateName,
            displayName: templateName.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' '),
            description: `Template importato da ${htmlFile}`,
            type: 'letter', // Valore predefinito
            category: 'other', // Valore predefinito
            content
          });
          
          newTemplate.requiredFields = newTemplate.extractRequiredFields();
          await newTemplate.save();
          result.added++;
        }
      } catch (error) {
        result.errors.push({ file: htmlFile, error: error.message });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Errore nella sincronizzazione dei template:', error);
    throw new Error(`Impossibile sincronizzare i template: ${error.message}`);
  }
};