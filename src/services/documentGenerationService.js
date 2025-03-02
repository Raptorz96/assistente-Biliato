/**
 * Document Generation Service
 * 
 * Servizio avanzato per la generazione di documenti professionali in vari formati
 * con supporto per campi dinamici, formattazione condizionale, tabelle
 * e integrazione con firme digitali.
 */

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const crypto = require('crypto');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Document, Paragraph, Table, TableRow, TableCell, TextRun, 
        HeadingLevel, AlignmentType, BorderStyle, Header, Footer,
        PageNumber, PageBreak, ImageRun, ExternalHyperlink } = require('docx');
const ejs = require('ejs');
const marked = require('marked');
const fileStorageService = require('./fileStorageService');
const Template = require('../models/Template');
const FontManager = require('../utils/fontManager');
const { AppError } = require('../utils/errorHandlers');
const { logger } = require('../utils/logger');

// Directory per output temporaneo
const TEMP_DIR = path.join(process.cwd(), 'generated-docs', 'temp');

// Configurazioni per la generazione documenti
const DEFAULT_FONTS = {
  heading: 'Roboto',
  body: 'Open Sans',
  monospace: 'Courier Prime'
};

// Singleton per gestione template cache
let templateCache = new Map();

/**
 * Classe per la gestione della generazione di documenti
 */
class DocumentGenerationService {
  /**
   * Inizializza il servizio di generazione documenti
   * @param {Object} options - Opzioni di configurazione
   */
  constructor(options = {}) {
    this.options = {
      templateCacheTTL: 3600 * 1000, // 1 ora
      defaultFormat: 'pdf',
      defaultAuthor: 'Studio Biliato',
      defaultCompany: 'Studio Biliato',
      maxRevisions: 20,
      ...options
    };
    
    // Inizializza la directory temporanea
    this.initializeTempDir();
  }
  
  /**
   * Crea la directory temporanea se non esiste
   */
  async initializeTempDir() {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      logger.info(`Directory temporanea inizializzata: ${TEMP_DIR}`);
    } catch (error) {
      logger.error('Errore nella creazione della directory temporanea:', error);
    }
  }
  
  /**
   * Funzione principale per generare un documento
   * @param {string} templateId - ID del template
   * @param {Object} data - Dati per il template
   * @param {Object} options - Opzioni aggiuntive
   * @returns {Promise<Object>} - Informazioni sul documento generato
   */
  async generateDocument(templateId, data, options = {}) {
    try {
      // Opzioni di default
      const documentOptions = {
        format: options.format || this.options.defaultFormat,
        outputPath: options.outputPath,
        filename: options.filename || `document-${Date.now()}`,
        author: options.author || this.options.defaultAuthor,
        title: options.title,
        subject: options.subject,
        keywords: options.keywords || [],
        metadata: options.metadata || {},
        revision: options.revision || 1,
        addWatermark: options.addWatermark || false,
        watermarkText: options.watermarkText || 'BOZZA',
        includeSignatureFields: options.includeSignatureFields || false,
        headerLogo: options.headerLogo || null,
        footerText: options.footerText || null,
        customFonts: options.customFonts || {},
        language: options.language || 'it-IT',
        documentNumber: options.documentNumber || this.generateDocumentNumber(),
        ...options
      };
      
      // Carica il template
      const template = await this.loadTemplate(templateId);
      
      // Verifica la compatibilità del formato richiesto
      if (!template.supportedFormats.includes(documentOptions.format)) {
        throw new AppError(`Formato '${documentOptions.format}' non supportato per questo template. Formati disponibili: ${template.supportedFormats.join(', ')}`, 400);
      }
      
      // Arricchisci i dati con helper e metadati
      const enrichedData = this.enhanceData(data, template, documentOptions);
      
      // Renderizza il contenuto in base al template type
      let renderedContent;
      switch (template.contentType) {
        case 'html':
          renderedContent = await this.renderHtmlTemplate(template.content, enrichedData);
          break;
        case 'markdown':
          renderedContent = await this.renderMarkdownTemplate(template.content, enrichedData);
          break;
        case 'json':
          renderedContent = await this.renderStructuredTemplate(template.content, enrichedData);
          break;
        default:
          renderedContent = await this.renderHtmlTemplate(template.content, enrichedData);
      }
      
      // Genera il documento nel formato richiesto
      let outputPath;
      let documentInfo;
      
      switch (documentOptions.format.toLowerCase()) {
        case 'pdf':
          outputPath = await this.generatePDF(renderedContent, enrichedData, documentOptions, template);
          break;
        case 'docx':
          outputPath = await this.generateDOCX(renderedContent, enrichedData, documentOptions, template);
          break;
        case 'html':
          outputPath = await this.generateHTML(renderedContent, enrichedData, documentOptions, template);
          break;
        case 'markdown':
        case 'md':
          outputPath = await this.generateMarkdown(renderedContent, enrichedData, documentOptions, template);
          break;
        default:
          throw new AppError(`Formato output '${documentOptions.format}' non supportato`, 400);
      }
      
      // Calcola hash del documento per verifica integrità
      const fileContent = await fs.readFile(outputPath);
      const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
      
      // Salva il documento su storage persistente
      const storageResult = await this.saveToStorage(outputPath, enrichedData, documentOptions);
      
      // Prepara informazioni sul documento generato
      documentInfo = {
        templateId: template.id,
        templateName: template.name,
        documentPath: storageResult.key,
        documentUrl: await fileStorageService.getFileUrl(storageResult.key, storageResult.bucket),
        format: documentOptions.format,
        size: storageResult.size,
        documentHash: fileHash,
        documentNumber: documentOptions.documentNumber,
        createdAt: new Date(),
        revision: documentOptions.revision,
        metadata: {
          ...documentOptions.metadata,
          generatedWith: 'DocumentGenerationService',
          engineVersion: '1.0.0',
          clientId: data.id || data.clientId || null
        }
      };
      
      logger.info(`Documento generato con successo: ${storageResult.key}`);
      return documentInfo;
      
    } catch (error) {
      logger.error('Errore nella generazione del documento:', error);
      throw new AppError(`Errore nella generazione del documento: ${error.message}`, 500);
    }
  }
  
  /**
   * Carica un template dal database o dalla cache
   * @param {string} templateId - ID del template
   * @returns {Promise<Object>} - Template caricato
   */
  async loadTemplate(templateId) {
    try {
      // Verifica se il template è in cache e non è scaduto
      const now = Date.now();
      if (templateCache.has(templateId)) {
        const cachedTemplate = templateCache.get(templateId);
        
        if (now - cachedTemplate.timestamp < this.options.templateCacheTTL) {
          return cachedTemplate.template;
        }
      }
      
      // Carica il template dal database
      const template = await Template.findById(templateId);
      
      if (!template) {
        throw new AppError(`Template con ID '${templateId}' non trovato`, 404);
      }
      
      // Determina il tipo di contenuto in base all'estensione o tipo
      let contentType = 'html';
      if (template.contentType) {
        contentType = template.contentType;
      } else if (template.filename && template.filename.toLowerCase().endsWith('.md')) {
        contentType = 'markdown';
      } else if (template.type === 'json' || (template.filename && template.filename.toLowerCase().endsWith('.json'))) {
        contentType = 'json';
      }
      
      // Prepara oggetto template
      const templateObj = {
        id: template._id.toString(),
        name: template.name,
        displayName: template.displayName || template.name,
        content: template.content,
        css: template.css || '',
        contentType,
        type: template.type,
        category: template.category,
        supportedFormats: template.supportedFormats || ['html', 'pdf', 'docx', 'markdown'],
        requiredFields: template.requiredFields || [],
        version: template.version || 1,
        headerTemplate: template.headerTemplate,
        footerTemplate: template.footerTemplate,
        pageSettings: template.pageSettings || {
          margins: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
          pageSize: 'A4',
          orientation: 'portrait'
        },
        metadata: template.metadata || {}
      };
      
      // Metti in cache il template
      templateCache.set(templateId, {
        template: templateObj,
        timestamp: now
      });
      
      return templateObj;
    } catch (error) {
      logger.error(`Errore nel caricamento del template ${templateId}:`, error);
      throw new AppError(`Errore nel caricamento del template: ${error.message}`, error.statusCode || 500);
    }
  }
  
  /**
   * Arricchisce i dati con helper e metadati
   * @param {Object} data - Dati originali
   * @param {Object} template - Template del documento
   * @param {Object} options - Opzioni documento
   * @returns {Object} - Dati arricchiti
   */
  enhanceData(data, template, options) {
    // Crea una copia profonda dei dati
    const enrichedData = JSON.parse(JSON.stringify(data));
    
    // Aggiungi helper per la formattazione
    const helpers = {
      // Funzioni per date
      formatDate: (date, format = 'DD/MM/YYYY') => date ? moment(date).format(format) : '',
      formatDateTime: (date, format = 'DD/MM/YYYY HH:mm') => date ? moment(date).format(format) : '',
      formatTime: (date, format = 'HH:mm') => date ? moment(date).format(format) : '',
      
      // Funzioni per numeri e valute
      formatCurrency: (amount, locale = 'it-IT', currency = 'EUR', decimals = 2) => 
        amount !== undefined && amount !== null 
          ? new Intl.NumberFormat(locale, { 
              style: 'currency', 
              currency,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            }).format(amount)
          : '',
          
      formatNumber: (num, decimals = 2, locale = 'it-IT') => 
        num !== undefined && num !== null 
          ? new Intl.NumberFormat(locale, { 
              minimumFractionDigits: decimals, 
              maximumFractionDigits: decimals 
            }).format(num)
          : '',
          
      formatPercent: (value, decimals = 2, locale = 'it-IT') => 
        value !== undefined && value !== null
          ? new Intl.NumberFormat(locale, { 
              style: 'percent', 
              minimumFractionDigits: decimals, 
              maximumFractionDigits: decimals 
            }).format(value / 100)
          : '',
      
      // Funzioni per testo
      uppercase: (text) => text ? String(text).toUpperCase() : '',
      lowercase: (text) => text ? String(text).toLowerCase() : '',
      capitalize: (text) => text ? String(text).split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ') : '',
      truncate: (text, length = 100, suffix = '...') => 
        text && text.length > length ? text.substring(0, length) + suffix : text || '',
        
      // Funzioni per condizioni
      ifThen: (condition, trueValue, falseValue = '') => condition ? trueValue : falseValue,
      isNullOrEmpty: (value) => value === null || value === undefined || value === '',
      defaultValue: (value, defaultVal = '') => value === null || value === undefined || value === '' ? defaultVal : value,
      
      // Funzioni per array e collezioni
      sum: (array, property = null) => {
        if (!Array.isArray(array)) return 0;
        if (property) {
          return array.reduce((total, item) => total + (parseFloat(item[property]) || 0), 0);
        }
        return array.reduce((total, item) => total + (parseFloat(item) || 0), 0);
      },
      count: (array) => Array.isArray(array) ? array.length : 0,
      join: (array, separator = ', ') => Array.isArray(array) ? array.join(separator) : '',
      sort: (array, property, direction = 'asc') => {
        if (!Array.isArray(array)) return [];
        const sortedArray = [...array];
        if (property) {
          return sortedArray.sort((a, b) => {
            return direction.toLowerCase() === 'asc' 
              ? (a[property] > b[property] ? 1 : -1)
              : (a[property] < b[property] ? 1 : -1);
          });
        }
        return sortedArray.sort((a, b) => direction.toLowerCase() === 'asc' ? (a > b ? 1 : -1) : (a < b ? 1 : -1));
      },
      filter: (array, property, value) => {
        if (!Array.isArray(array)) return [];
        return array.filter(item => item[property] === value);
      }
    };
    
    // Aggiungi metadati e valori di default
    const defaultValues = {
      currentDate: moment().format('DD/MM/YYYY'),
      currentDateTime: moment().format('DD/MM/YYYY HH:mm'),
      currentYear: moment().format('YYYY'),
      
      // Metadati template
      templateName: template.name,
      templateDisplayName: template.displayName,
      templateVersion: template.version,
      
      // Metadati documento
      documentId: options.documentNumber || crypto.randomBytes(4).toString('hex').toUpperCase(),
      documentNumber: options.documentNumber,
      documentTitle: options.title || template.displayName,
      documentAuthor: options.author,
      documentCreationDate: moment().format('DD/MM/YYYY'),
      documentCreationTime: moment().format('HH:mm:ss'),
      revision: options.revision || 1,
      
      // Info azienda
      companyName: this.options.defaultCompany,
      companyLogo: this.options.companyLogo || null,
      
      // Funzioni helper
      ...helpers
    };
    
    // Unisci dati, valori predefiniti e metadata
    return {
      ...defaultValues,
      ...enrichedData,
      metadata: {
        ...defaultValues,
        ...(enrichedData.metadata || {}),
        ...options.metadata
      },
      options
    };
  }
  
  /**
   * Renderizza un template HTML utilizzando EJS
   * @param {string} templateContent - Contenuto del template HTML/EJS
   * @param {Object} data - Dati per la renderizzazione
   * @returns {Promise<string>} - HTML renderizzato
   */
  async renderHtmlTemplate(templateContent, data) {
    try {
      // Renderizza il template con EJS
      const renderOptions = {
        rmWhitespace: false,
        async: true
      };
      
      const renderedHtml = await ejs.render(templateContent, data, renderOptions);
      
      return renderedHtml;
    } catch (error) {
      logger.error('Errore nella renderizzazione del template HTML:', error);
      throw new AppError(`Errore nella renderizzazione del template: ${error.message}`, 500);
    }
  }
  
  /**
   * Renderizza un template markdown
   * @param {string} templateContent - Contenuto del template markdown
   * @param {Object} data - Dati per la renderizzazione
   * @returns {Promise<string>} - HTML renderizzato dal markdown
   */
  async renderMarkdownTemplate(templateContent, data) {
    try {
      // Prima elabora il template con EJS per sostituire le variabili
      const renderedMarkdown = await ejs.render(templateContent, data, { async: true });
      
      // Converti il markdown in HTML
      const renderedHtml = marked.parse(renderedMarkdown);
      
      return renderedHtml;
    } catch (error) {
      logger.error('Errore nella renderizzazione del template Markdown:', error);
      throw new AppError(`Errore nella renderizzazione del template Markdown: ${error.message}`, 500);
    }
  }
  
  /**
   * Renderizza un template strutturato (JSON)
   * @param {string} templateContent - Contenuto del template in formato JSON
   * @param {Object} data - Dati per la renderizzazione
   * @returns {Promise<Object>} - Struttura renderizzata
   */
  async renderStructuredTemplate(templateContent, data) {
    try {
      // Parse del template JSON
      let template;
      if (typeof templateContent === 'string') {
        template = JSON.parse(templateContent);
      } else {
        template = templateContent;
      }
      
      // Funzione ricorsiva per sostituire le variabili
      const processNode = (node) => {
        if (typeof node === 'string') {
          // Sostituisci variabili nel testo con formato ${var}
          return node.replace(/\${([^}]+)}/g, (match, path) => {
            const value = path.split('.').reduce((obj, key) => obj && obj[key], data);
            return value !== undefined ? value : match;
          });
        } else if (Array.isArray(node)) {
          return node.map(item => processNode(item));
        } else if (node !== null && typeof node === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(node)) {
            result[key] = processNode(value);
          }
          return result;
        }
        return node;
      };
      
      return processNode(template);
    } catch (error) {
      logger.error('Errore nella renderizzazione del template strutturato:', error);
      throw new AppError(`Errore nella renderizzazione del template strutturato: ${error.message}`, 500);
    }
  }
  
  /**
   * Genera un file PDF dal contenuto HTML
   * @param {string} renderedContent - Contenuto HTML renderizzato
   * @param {Object} data - Dati utilizzati per il documento
   * @param {Object} options - Opzioni per la generazione
   * @param {Object} template - Template del documento
   * @returns {Promise<string>} - Percorso del file PDF generato
   */
  async generatePDF(renderedContent, data, options, template) {
    try {
      // Crea un documento PDF vuoto
      const pdfDoc = await PDFDocument.create();
      
      // Imposta i metadati del documento
      pdfDoc.setTitle(options.title || template.displayName);
      pdfDoc.setAuthor(options.author);
      pdfDoc.setSubject(options.subject || `Documento generato per ${data.name || 'cliente'}`);
      pdfDoc.setKeywords([template.category, template.type, ...(options.keywords || [])]);
      pdfDoc.setCreator('DocumentGenerationService');
      pdfDoc.setProducer('Studio Biliato');
      
      // Configura la pagina in base alle impostazioni del template
      const { pageSettings } = template;
      
      // TODO: Utilizzare puppeteer o altra libreria per convertire HTML in PDF
      // Per ora creiamo una pagina con un testo di esempio
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      
      // Aggiungi intestazione se presente
      if (options.headerLogo || template.headerTemplate) {
        // Implementazione intestazione
      }
      
      // Aggiungi piè di pagina
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(`Documento #${options.documentNumber} - Generato il ${data.currentDate}`, {
        x: 50,
        y: 30,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      
      // Aggiungi filigrana se richiesto
      if (options.addWatermark) {
        page.drawText(options.watermarkText, {
          x: 200,
          y: 400,
          size: 60,
          font,
          opacity: 0.2,
          color: rgb(0.8, 0.2, 0.2),
          rotate: { type: 'degrees', angle: -45 }
        });
      }
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.pdf`);
      
      // Salva il documento
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del PDF:', error);
      throw new AppError(`Errore nella generazione del PDF: ${error.message}`, 500);
    }
  }
  
  /**
   * Genera un file DOCX dal contenuto HTML
   * @param {string} renderedContent - Contenuto HTML renderizzato
   * @param {Object} data - Dati utilizzati per il documento
   * @param {Object} options - Opzioni per la generazione
   * @param {Object} template - Template del documento
   * @returns {Promise<string>} - Percorso del file DOCX generato
   */
  async generateDOCX(renderedContent, data, options, template) {
    try {
      // Crea un documento DOCX
      const doc = new Document({
        title: options.title || template.displayName,
        author: options.author,
        description: options.subject,
        creator: 'DocumentGenerationService',
        keywords: options.keywords || [],
        styles: {
          paragraphStyles: [
            {
              id: 'Normal',
              name: 'Normal',
              basedOn: 'Normal',
              next: 'Normal',
              run: {
                font: options.customFonts.body || DEFAULT_FONTS.body,
                size: 24,
                color: '000000'
              },
              paragraph: {
                spacing: {
                  line: 276,
                  before: 0,
                  after: 0
                }
              }
            },
            {
              id: 'Heading1',
              name: 'Heading 1',
              basedOn: 'Normal',
              next: 'Normal',
              run: {
                font: options.customFonts.heading || DEFAULT_FONTS.heading,
                size: 32,
                bold: true,
                color: '2E74B5'
              },
              paragraph: {
                spacing: {
                  before: 240,
                  after: 120
                }
              }
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              run: {
                font: options.customFonts.heading || DEFAULT_FONTS.heading,
                size: 28,
                bold: true,
                color: '2E74B5'
              },
              paragraph: {
                spacing: {
                  before: 240,
                  after: 120
                }
              }
            }
          ]
        }
      });
      
      // Configura intestazione e piè di pagina
      if (template.headerTemplate || options.headerLogo) {
        // Implementazione intestazione
      }
      
      if (template.footerTemplate || options.footerText) {
        // Implementazione piè di pagina
      }
      
      // Contenuto da aggiungere al documento
      // NOTA: In un'implementazione reale, convertiremmo l'HTML in elementi docx
      // Per ora, creiamo un documento di esempio
      const sections = [{
        properties: {},
        children: [
          new Paragraph({
            text: options.title || template.displayName,
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph({
            text: `Documento generato per ${data.name || 'cliente'}`
          }),
          new Paragraph({
            text: `Data: ${data.currentDate}`
          }),
          new Paragraph({
            text: `Documento #${options.documentNumber}`
          })
        ]
      }];
      
      // Imposta le sezioni del documento
      doc.addSection({
        properties: {
          page: {
            margin: {
              top: 1133, // 2cm in twip (1cm = 566.9twip)
              right: 1133,
              bottom: 1133,
              left: 1133
            },
            size: {
              width: 11906, // A4 width in twip
              height: 16838 // A4 height in twip
            },
            orientation: template.pageSettings?.orientation === 'landscape' ? 'landscape' : 'portrait'
          }
        },
        children: sections[0].children
      });
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.docx`);
      
      // Salva il documento
      const buffer = await doc.save();
      await fs.writeFile(outputPath, buffer);
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del DOCX:', error);
      throw new AppError(`Errore nella generazione del DOCX: ${error.message}`, 500);
    }
  }
  
  /**
   * Genera un file HTML dal contenuto renderizzato
   * @param {string} renderedContent - Contenuto HTML renderizzato
   * @param {Object} data - Dati utilizzati per il documento
   * @param {Object} options - Opzioni per la generazione
   * @param {Object} template - Template del documento
   * @returns {Promise<string>} - Percorso del file HTML generato
   */
  async generateHTML(renderedContent, data, options, template) {
    try {
      // Aggiungi CSS e metadati HTML
      const css = template.css || '';
      
      const htmlContent = `<!DOCTYPE html>
<html lang="${options.language || 'it'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="DocumentGenerationService">
  <meta name="author" content="${options.author}">
  <meta name="description" content="${options.subject || ''}">
  <meta name="keywords" content="${[template.category, template.type, ...(options.keywords || [])].join(', ')}">
  <meta name="document-id" content="${options.documentNumber}">
  <meta name="creation-date" content="${data.currentDateTime}">
  <meta name="revision" content="${options.revision}">
  <title>${options.title || template.displayName}</title>
  <style>
    ${css}
  </style>
</head>
<body>
${renderedContent}
<footer>
  <div class="document-info">
    <p>Documento #${options.documentNumber} - Generato il ${data.currentDate}</p>
  </div>
</footer>
</body>
</html>`;
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.html`);
      
      // Salva il documento
      await fs.writeFile(outputPath, htmlContent, 'utf8');
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione dell\'HTML:', error);
      throw new AppError(`Errore nella generazione dell'HTML: ${error.message}`, 500);
    }
  }
  
  /**
   * Genera un file Markdown dal contenuto
   * @param {string} renderedContent - Contenuto HTML renderizzato
   * @param {Object} data - Dati utilizzati per il documento
   * @param {Object} options - Opzioni per la generazione
   * @param {Object} template - Template del documento
   * @returns {Promise<string>} - Percorso del file Markdown generato
   */
  async generateMarkdown(renderedContent, data, options, template) {
    try {
      // Crea un header YAML front matter per i metadati
      const frontMatter = [
        '---',
        `title: "${options.title || template.displayName}"`,
        `author: "${options.author}"`,
        `date: "${data.currentDateTime}"`,
        `document_id: "${options.documentNumber}"`,
        `revision: ${options.revision}`,
        `template: "${template.name}"`,
        `category: "${template.category}"`,
        `type: "${template.type}"`,
        `client: "${data.name || ''}"`,
        '---',
        ''
      ].join('\n');
      
      // Converti l'HTML in markdown (in un'implementazione reale useremmo una libreria come turndown)
      // Per ora, assumiamo che il template sia già in formato markdown
      const markdownContent = `${frontMatter}

# ${options.title || template.displayName}

Documento generato per ${data.name || 'cliente'}

Data: ${data.currentDate}

Documento #${options.documentNumber}

---

${renderedContent}

---

Documento generato automaticamente il ${data.currentDateTime}`;
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.md`);
      
      // Salva il documento
      await fs.writeFile(outputPath, markdownContent, 'utf8');
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del Markdown:', error);
      throw new AppError(`Errore nella generazione del Markdown: ${error.message}`, 500);
    }
  }
  
  /**
   * Salva il documento generato nello storage
   * @param {string} filePath - Percorso del file temporaneo
   * @param {Object} data - Dati del cliente
   * @param {Object} options - Opzioni documento
   * @returns {Promise<Object>} - Informazioni sul file salvato
   */
  async saveToStorage(filePath, data, options) {
    try {
      const clientId = data.id || data.clientId || 'unknown';
      const originalFilename = path.basename(filePath);
      const mimeTypes = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'html': 'text/html',
        'md': 'text/markdown',
        'markdown': 'text/markdown'
      };
      
      const extension = path.extname(filePath).substring(1).toLowerCase();
      const mimeType = mimeTypes[extension] || 'application/octet-stream';
      
      // Carica il file su S3/MinIO
      const uploadResult = await fileStorageService.uploadFile({
        clientId,
        originalFilename,
        fileContent: filePath,
        mimeType,
        category: options.documentCategory || 'documents',
        metadata: {
          templateId: options.templateId,
          documentNumber: options.documentNumber,
          revision: options.revision,
          generatedAt: new Date().toISOString(),
          ...options.metadata
        },
        tags: [
          { key: 'documentType', value: options.documentType || 'general' },
          { key: 'generated', value: 'true' },
          { key: 'format', value: extension }
        ]
      });
      
      return uploadResult;
    } catch (error) {
      logger.error('Errore nel salvataggio del documento nello storage:', error);
      throw new AppError(`Errore nel salvataggio del documento: ${error.message}`, 500);
    }
  }
  
  /**
   * Genera un numero documento sequenziale
   * @param {string} prefix - Prefisso per il numero documento
   * @returns {string} - Numero documento generato
   */
  generateDocumentNumber(prefix = 'DOC') {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const year = new Date().getFullYear();
    
    return `${prefix}-${year}-${timestamp.substr(-6)}-${random}`;
  }
}

// Inizializza ed esporta l'istanza
const documentGenerationService = new DocumentGenerationService();

module.exports = documentGenerationService;