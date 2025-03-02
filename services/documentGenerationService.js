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
const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');
const fileStorageService = require('../src/services/fileStorageService');
const { logger } = require('../src/utils/logger');

// Directory per output temporaneo
const TEMP_DIR = path.join(process.cwd(), 'generated-docs', 'temp');

// Directory per template
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

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
   * @param {string} templateId - ID del template o nome del file template
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
      if (template.supportedFormats && !template.supportedFormats.includes(documentOptions.format)) {
        throw new Error(`Formato '${documentOptions.format}' non supportato per questo template. Formati disponibili: ${template.supportedFormats.join(', ')}`);
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
          throw new Error(`Formato output '${documentOptions.format}' non supportato`);
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
      throw new Error(`Errore nella generazione del documento: ${error.message}`);
    }
  }
  
  /**
   * Carica un template dal database, file system o dalla cache
   * @param {string} templateId - ID del template o nome del file template
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
      
      let template;
      let isFileTemplate = false;
      
      // Prova a caricare dal file system se sembra un percorso o nome file
      if (templateId.includes('.') || templateId.includes('/') || templateId.includes('\\')) {
        try {
          const templatePath = path.isAbsolute(templateId) 
            ? templateId 
            : path.join(TEMPLATES_DIR, templateId);
          
          const content = await fs.readFile(templatePath, 'utf8');
          const extension = path.extname(templatePath).toLowerCase();
          
          let contentType = 'html';
          if (extension === '.md') contentType = 'markdown';
          else if (extension === '.json') contentType = 'json';
          
          template = {
            id: templateId,
            name: path.basename(templatePath, extension),
            displayName: path.basename(templatePath, extension).replace(/[-_]/g, ' '),
            content,
            contentType,
            supportedFormats: ['html', 'pdf', 'docx', 'markdown'],
            css: '',
            pageSettings: {
              margins: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
              pageSize: 'A4',
              orientation: 'portrait'
            }
          };
          
          isFileTemplate = true;
        } catch (fileError) {
          logger.warn(`Template file non trovato, provo database: ${fileError.message}`);
        }
      }
      
      // Se non è stato caricato dal file, prova dal database
      if (!template && !isFileTemplate) {
        // Qui aggiungeremmo la logica per caricare dal DB
        // Per ora lanciamo un errore se non troviamo il template
        throw new Error(`Template con ID '${templateId}' non trovato`);
      }
      
      // Metti in cache il template
      templateCache.set(templateId, {
        template,
        timestamp: now
      });
      
      return template;
    } catch (error) {
      logger.error(`Errore nel caricamento del template ${templateId}:`, error);
      throw new Error(`Errore nel caricamento del template: ${error.message}`);
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
      templateVersion: template.version || '1.0',
      
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
      // Sostituisci variabili nel formato {{var}} con formato EJS <%=var%>
      const ejsTemplate = templateContent.replace(/\{\{([^}]+)\}\}/g, '<%=$1%>');
      
      // Renderizza il template con EJS
      const renderOptions = {
        rmWhitespace: false,
        async: true
      };
      
      const renderedHtml = await ejs.render(ejsTemplate, data, renderOptions);
      
      return renderedHtml;
    } catch (error) {
      logger.error('Errore nella renderizzazione del template HTML:', error);
      throw new Error(`Errore nella renderizzazione del template: ${error.message}`);
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
      // Sostituisci variabili nel formato {{var}} con formato EJS <%=var%>
      const ejsTemplate = templateContent.replace(/\{\{([^}]+)\}\}/g, '<%=$1%>');
      
      // Prima elabora il template con EJS per sostituire le variabili
      const renderedMarkdown = await ejs.render(ejsTemplate, data, { async: true });
      
      // Converti il markdown in HTML
      const renderedHtml = marked.parse(renderedMarkdown);
      
      return renderedHtml;
    } catch (error) {
      logger.error('Errore nella renderizzazione del template Markdown:', error);
      throw new Error(`Errore nella renderizzazione del template Markdown: ${error.message}`);
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
      throw new Error(`Errore nella renderizzazione del template strutturato: ${error.message}`);
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
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.pdf`);
      
      // Aggiungi CSS e header/footer se presenti
      const css = template.css || '';
      const headerHtml = template.headerTemplate ? 
        await this.renderHtmlTemplate(template.headerTemplate, data) : '';
      const footerHtml = template.footerTemplate ?
        await this.renderHtmlTemplate(template.footerTemplate, data) : '';
        
      // Prepara HTML completo
      const htmlContent = `<!DOCTYPE html>
<html lang="${options.language || 'it'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || template.displayName}</title>
  <style>
    ${css}
    @page {
      margin: ${template.pageSettings?.margins?.top || '2cm'} 
              ${template.pageSettings?.margins?.right || '2cm'} 
              ${template.pageSettings?.margins?.bottom || '2cm'} 
              ${template.pageSettings?.margins?.left || '2cm'};
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 100px;
      color: rgba(200, 50, 50, 0.1);
      z-index: -1000;
      pointer-events: none;
    }
  </style>
</head>
<body>
  ${options.addWatermark ? `<div class="watermark">${options.watermarkText}</div>` : ''}
  ${renderedContent}
</body>
</html>`;

      // Usa puppeteer per generare PDF
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Configura opzioni PDF
      const pdfOptions = {
        path: outputPath,
        format: template.pageSettings?.pageSize || 'A4',
        printBackground: true,
        margin: {
          top: template.pageSettings?.margins?.top || '2cm',
          right: template.pageSettings?.margins?.right || '2cm',
          bottom: template.pageSettings?.margins?.bottom || '2cm',
          left: template.pageSettings?.margins?.left || '2cm'
        },
        landscape: template.pageSettings?.orientation === 'landscape',
        displayHeaderFooter: !!(headerHtml || footerHtml),
        headerTemplate: headerHtml,
        footerTemplate: footerHtml || '<div style="text-align: center; width: 100%; font-size: 10px; color: #666;">' +
          '<span>Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span>' +
          '</div>'
      };
      
      await page.pdf(pdfOptions);
      await browser.close();
      
      // Aggiungi metadati al PDF
      const pdfDoc = await PDFDocument.load(await fs.readFile(outputPath));
      pdfDoc.setTitle(options.title || template.displayName);
      pdfDoc.setAuthor(options.author);
      pdfDoc.setSubject(options.subject || `Documento generato per ${data.name || 'cliente'}`);
      pdfDoc.setCreator('DocumentGenerationService');
      pdfDoc.setProducer('Studio Biliato');
      
      // Salva il PDF con metadati
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del PDF:', error);
      throw new Error(`Errore nella generazione del PDF: ${error.message}`);
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
      const header = new Header({
        children: [
          new Paragraph({
            text: options.title || template.displayName,
            style: 'Heading2'
          })
        ]
      });
      
      const footer = new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Documento #${options.documentNumber} - Pagina `,
                size: 18
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                size: 18
              }),
              new TextRun({
                text: " di ",
                size: 18
              }),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES],
                size: 18
              })
            ]
          })
        ]
      });
      
      // Converti HTML in testo strutturato per DOCX
      // Qui dovremmo avere una logica più complessa per convertire HTML in elementi DOCX
      // Per semplicità, usiamo html-to-text per una conversione basica
      const textContent = convert(renderedContent, {
        wordwrap: 130,
        formatters: {
          heading: function(elem, walkParams, options) {
            return `${elem.children}\n\n`;
          },
          paragraph: function(elem, walkParams, options) {
            return `${elem.children}\n\n`;
          },
        }
      });
      
      const paragraphs = textContent.split('\n\n').map(text => {
        if (!text.trim()) return null;
        
        // Semplice euristica per rilevare intestazioni
        let style = 'Normal';
        if (text.startsWith('#')) {
          text = text.replace(/^#+\s*/, '');
          style = 'Heading1';
        } else if (text.toUpperCase() === text && text.length < 100) {
          style = 'Heading2';
        }
        
        return new Paragraph({
          text,
          style
        });
      }).filter(p => p !== null);
      
      // Aggiungi filigrana se richiesto
      if (options.addWatermark) {
        paragraphs.unshift(
          new Paragraph({
            text: options.watermarkText,
            style: 'Normal',
            alignment: AlignmentType.CENTER,
            shading: {
              fill: "EEEEEE",
              val: 'clear',
              color: "FF0000"
            }
          })
        );
      }
      
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
          },
          headers: {
            default: header
          },
          footers: {
            default: footer
          }
        },
        children: paragraphs
      });
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.docx`);
      
      // Salva il documento
      const buffer = await doc.save();
      await fs.writeFile(outputPath, buffer);
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del DOCX:', error);
      throw new Error(`Errore nella generazione del DOCX: ${error.message}`);
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
  <meta name="keywords" content="${[(template.category || ''), (template.type || ''), ...(options.keywords || [])].filter(k => k).join(', ')}">
  <meta name="document-id" content="${options.documentNumber}">
  <meta name="creation-date" content="${data.currentDateTime}">
  <meta name="revision" content="${options.revision}">
  <title>${options.title || template.displayName}</title>
  <style>
    ${css}
    @media print {
      @page {
        size: ${template.pageSettings?.pageSize || 'A4'} ${template.pageSettings?.orientation || 'portrait'};
        margin: ${template.pageSettings?.margins?.top || '2cm'} 
                ${template.pageSettings?.margins?.right || '2cm'} 
                ${template.pageSettings?.margins?.bottom || '2cm'} 
                ${template.pageSettings?.margins?.left || '2cm'};
      }
      body {
        font-family: 'Arial', 'Helvetica', sans-serif;
        line-height: 1.5;
        color: #333;
      }
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 100px;
        color: rgba(200, 50, 50, 0.1);
        z-index: -1000;
        pointer-events: none;
      }
    }
  </style>
</head>
<body>
  ${options.addWatermark ? `<div class="watermark">${options.watermarkText}</div>` : ''}
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
      throw new Error(`Errore nella generazione dell'HTML: ${error.message}`);
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
        `category: "${template.category || ''}"`,
        `type: "${template.type || ''}"`,
        `client: "${data.name || ''}"`,
        '---',
        ''
      ].join('\n');
      
      // Converti l'HTML in markdown se necessario
      let markdownContent;
      
      if (template.contentType === 'markdown') {
        // Se il template è già markdown, usa renderedContent senza HTML wrapper
        markdownContent = renderedContent;
      } else {
        // Qui dovremmo usare una libreria per convertire HTML in markdown
        // Per semplicità, facciamo una conversione basica con html-to-text
        markdownContent = convert(renderedContent, {
          wordwrap: false,
          selectors: [
            { selector: 'h1', options: { uppercase: true, prefix: '# ' } },
            { selector: 'h2', options: { prefix: '## ' } },
            { selector: 'h3', options: { prefix: '### ' } },
            { selector: 'h4', options: { prefix: '#### ' } },
            { selector: 'h5', options: { prefix: '##### ' } },
            { selector: 'h6', options: { prefix: '###### ' } },
            { selector: 'a', options: { baseUrl: '' } },
            { selector: 'ul', options: { itemPrefix: '- ' } },
            { selector: 'ol', options: { itemPrefix: '1. ' } },
            { selector: 'table', options: { uppercaseHeaderCells: true } }
          ]
        });
      }
      
      // Formato finale markdown
      const finalMarkdown = `${frontMatter}

# ${options.title || template.displayName}

${markdownContent}

---

Documento #${options.documentNumber} - Generato il ${data.currentDateTime}${options.addWatermark ? ` - ${options.watermarkText}` : ''}`;
      
      // Definisci il percorso di output
      const outputPath = options.outputPath || path.join(TEMP_DIR, `${options.filename}.md`);
      
      // Salva il documento
      await fs.writeFile(outputPath, finalMarkdown, 'utf8');
      
      return outputPath;
    } catch (error) {
      logger.error('Errore nella generazione del Markdown:', error);
      throw new Error(`Errore nella generazione del Markdown: ${error.message}`);
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
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`);
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