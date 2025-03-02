/**
 * HTML Export Service
 * 
 * Gestisce la generazione di documenti in formato HTML
 */

const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');

class HtmlExportService {
  /**
   * Genera un documento HTML
   * @param {Object} template - Template caricato
   * @param {Object} enhancedData - Dati cliente estesi
   * @param {string} outputPath - Percorso di output
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<string>} - Percorso al documento generato
   */
  async generateDocument(template, enhancedData, outputPath, options = {}) {
    try {
      // Prepara le opzioni di rendering
      const renderOptions = {
        ...options,
        rmWhitespace: false,
        compileDebug: process.env.NODE_ENV !== 'production'
      };
      
      // Esegui il rendering del template
      let renderedHtml = await ejs.render(template.content, enhancedData, renderOptions);
      
      // Opzionale: aggiungi CSS se specificato nelle opzioni
      if (options.embedCss && template.css) {
        // Verifica se c'è già un tag style nel documento
        if (!/<style[^>]*>/i.test(renderedHtml)) {
          // Inserisci tag style con il CSS del template
          renderedHtml = renderedHtml.replace(
            /<\/head>/i,
            `<style>\n${template.css}\n</style>\n</head>`
          );
        }
      }
      
      // Opzionale: aggiungi metadati al documento
      if (options.addMetadata) {
        const metaTags = this.generateMetaTags(template, enhancedData);
        
        // Inserisci i meta tag nell'head del documento
        renderedHtml = renderedHtml.replace(
          /<head[^>]*>/i,
          `$&\n${metaTags}`
        );
      }
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Scrivi il documento HTML
      await fs.writeFile(outputPath, renderedHtml, 'utf8');
      
      return outputPath;
    } catch (error) {
      console.error('Errore nella generazione HTML:', error);
      throw new Error(`Impossibile generare il documento HTML: ${error.message}`);
    }
  }
  
  /**
   * Genera il codice HTML per i meta tag
   * @param {Object} template - Template utilizzato
   * @param {Object} data - Dati cliente estesi
   * @returns {string} - HTML con i meta tag
   */
  generateMetaTags(template, data) {
    return `
    <meta name="generator" content="Studio Biliato Document Generator">
    <meta name="created" content="${moment().toISOString()}">
    <meta name="template" content="${template.name}">
    <meta name="template-version" content="${template.version || '1.0'}">
    <meta name="document-id" content="${data.documentId || ''}">
    <meta name="client" content="${data.name || ''}">
    <meta name="client-id" content="${data.fiscalCode || ''}">
    `;
  }
  
  /**
   * Crea un documento HTML per anteprima
   * @param {string} templateContent - Contenuto HTML del template
   * @param {Object} data - Dati per il rendering
   * @returns {Promise<string>} - HTML renderizzato
   */
  async createPreview(templateContent, data) {
    try {
      // Aggiungi i dati helper per l'anteprima
      const previewData = {
        ...data,
        currentDate: moment().format('DD/MM/YYYY'),
        formatDate: (date) => date ? moment(date).format('DD/MM/YYYY') : '',
        formatCurrency: (amount) => {
          return amount !== undefined && amount !== null
            ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
            : '';
        }
      };
      
      // Esegui il rendering del template
      const renderedHtml = ejs.render(templateContent, previewData);
      
      // Aggiungi contorno per anteprima e stili di base
      return `
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Anteprima Documento</title>
          <style>
            body {
              padding: 0;
              margin: 0;
              background-color: #f0f0f0;
              font-family: Arial, sans-serif;
            }
            .preview-container {
              width: 21cm;
              min-height: 29.7cm;
              margin: 20px auto;
              padding: 2cm;
              background-color: white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .preview-watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              color: rgba(200, 200, 200, 0.2);
              pointer-events: none;
              z-index: 1000;
            }
            @media print {
              body {
                background-color: white;
              }
              .preview-container {
                width: 100%;
                height: auto;
                margin: 0;
                padding: 0;
                box-shadow: none;
              }
              .preview-watermark {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="preview-watermark">ANTEPRIMA</div>
          <div class="preview-container">
            ${renderedHtml}
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Errore nella creazione dell\'anteprima HTML:', error);
      throw new Error(`Impossibile creare l'anteprima: ${error.message}`);
    }
  }
  
  /**
   * Converte un documento HTML esistente in un altro formato
   * @param {string} htmlPath - Percorso al file HTML
   * @param {string} outputPath - Percorso di output
   * @param {Object} options - Opzioni di conversione
   * @returns {Promise<string>} - Percorso al documento generato
   */
  async convertToHtml(htmlPath, outputPath, options = {}) {
    try {
      // Leggi il contenuto HTML
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      // Esegui eventuali trasformazioni necessarie
      let transformedHtml = htmlContent;
      
      // Pulisci il codice HTML se richiesto
      if (options.cleanHtml) {
        // Rimuovi commenti
        transformedHtml = transformedHtml.replace(/<!--[\s\S]*?-->/g, '');
        
        // Normalizza spazi bianchi
        transformedHtml = transformedHtml.replace(/\s+/g, ' ');
        
        // Minimizza HTML solo in produzione
        if (process.env.NODE_ENV === 'production') {
          transformedHtml = transformedHtml
            .replace(/>\s+</g, '><') // Rimuovi spazi tra tag
            .replace(/^\s+|\s+$/gm, ''); // Rimuovi spazi a inizio/fine riga
        }
      }
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Scrivi il file HTML
      await fs.writeFile(outputPath, transformedHtml, 'utf8');
      
      return outputPath;
    } catch (error) {
      console.error('Errore nella conversione a HTML:', error);
      throw new Error(`Impossibile convertire il documento in HTML: ${error.message}`);
    }
  }
}

module.exports = new HtmlExportService();