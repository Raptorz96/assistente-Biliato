/**
 * PDF Export Service
 * 
 * Gestisce la generazione di documenti in formato PDF
 */

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const moment = require('moment');

class PDFExportService {
  /**
   * Genera un documento PDF
   * @param {string} htmlContent - Contenuto HTML da convertire
   * @param {string} outputPath - Percorso di output
   * @param {Object} template - Template utilizzato
   * @param {Object} data - Dati cliente estesi
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<string>} - Percorso al documento generato
   */
  async generateDocument(htmlContent, outputPath, template, data, options = {}) {
    // Configura Puppeteer con opzioni appropriate
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none'
      ],
      defaultViewport: {
        width: 1200,
        height: 1600
      }
    });
    
    try {
      const page = await browser.newPage();
      
      // Imposta metadati del PDF
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'it-IT' // Imposta locale italiano
      });
      
      // Intercetta le richieste per gestire problemi di risorse esterne
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        // Blocca richieste a risorse esterne, tranne font e immagini
        const resourceType = req.resourceType();
        if (
          resourceType === 'font' || 
          resourceType === 'image' || 
          req.url().startsWith('data:') || 
          req.url().startsWith('file:')
        ) {
          req.continue();
        } else if (resourceType === 'stylesheet') {
          req.continue();
        } else {
          req.abort();
        }
      });
      
      // Carica il contenuto HTML
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Aggiungi stili per la pagina e formattazione per la stampa
      await page.addStyleTag({
        content: `
          @page {
            margin: ${options.margins?.top || '20mm'} ${options.margins?.right || '15mm'} 
                    ${options.margins?.bottom || '20mm'} ${options.margins?.left || '15mm'};
            size: ${options.pageSize || 'A4'};
          }
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            line-height: 1.5;
            color: #333;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          ${template.css || ''}
          ${options.extraCss || ''}
        `
      });
      
      // Attendi che i font e le immagini siano caricati
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      });
      
      // Prepara opzioni PDF
      const pdfOptions = {
        path: outputPath,
        format: options.pageSize || 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: options.margins?.top || '20mm',
          right: options.margins?.right || '15mm',
          bottom: options.margins?.bottom || '20mm',
          left: options.margins?.left || '15mm'
        },
        preferCSSPageSize: true,
        
        // Metadati del documento
        metadata: {
          Title: template.displayName || template.name,
          Author: options.author || 'Studio Biliato',
          Subject: options.subject || `Documento per ${data.name}`,
          Keywords: `${template.category || ''}, ${template.type || ''}, ${data.fiscalCode || ''}`,
          Producer: options.producer || 'Studio Biliato Document Generator',
          Creator: options.creator || 'Studio Biliato'
        }
      };
      
      // Aggiungi header e footer se specificati
      if (options.headerTemplate) {
        pdfOptions.headerTemplate = options.headerTemplate;
        pdfOptions.displayHeaderFooter = true;
      }
      
      if (options.footerTemplate) {
        pdfOptions.footerTemplate = options.footerTemplate;
        pdfOptions.displayHeaderFooter = true;
      }
      
      // Aggiungi footer con paginazione se richiesto
      if (options.addPageNumbers && !options.footerTemplate) {
        pdfOptions.footerTemplate = `
          <div style="width: 100%; font-size: 8px; text-align: center; color: #777; padding: 0 20px;">
            <span>Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span>
          </div>
        `;
        pdfOptions.displayHeaderFooter = true;
      }
      
      // Genera il PDF
      await page.pdf(pdfOptions);
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      return outputPath;
    } catch (error) {
      console.error('Errore nella generazione PDF:', error);
      throw new Error(`Impossibile generare il documento PDF: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Converte un documento HTML esistente in PDF
   * @param {string} htmlPath - Percorso al file HTML
   * @param {string} outputPath - Percorso di output
   * @param {Object} options - Opzioni di conversione
   * @returns {Promise<string>} - Percorso al documento PDF generato
   */
  async convertToPdf(htmlPath, outputPath, options = {}) {
    try {
      // Leggi il contenuto HTML
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      // Estrai titolo dal HTML per i metadati
      let title = 'Documento';
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
      
      // Estrai CSS dal HTML
      let css = '';
      const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch && styleMatch[1]) {
        css = styleMatch[1].trim();
      }
      
      // Template e dati minimi per i metadati
      const templateInfo = {
        displayName: title,
        name: title,
        css: css
      };
      
      const dataInfo = {
        name: options.name || 'Cliente',
        fiscalCode: options.fiscalCode || ''
      };
      
      // Genera il PDF con le opzioni fornite
      return await this.generateDocument(
        htmlContent,
        outputPath,
        templateInfo,
        dataInfo,
        options
      );
    } catch (error) {
      console.error('Errore nella conversione a PDF:', error);
      throw new Error(`Impossibile convertire il documento in PDF: ${error.message}`);
    }
  }
  
  /**
   * Unisce più PDF in un unico documento
   * @param {Array<string>} pdfPaths - Array di percorsi ai PDF da unire
   * @param {string} outputPath - Percorso al PDF unito
   * @param {Object} options - Opzioni di unione
   * @returns {Promise<string>} - Percorso al PDF unito
   */
  async mergePdfs(pdfPaths, outputPath, options = {}) {
    try {
      // Controlla che puppeteer-merge sia stato installato
      let PDFMerger;
      try {
        PDFMerger = require('pdf-merger-js');
      } catch (err) {
        throw new Error('La libreria pdf-merger-js non è installata. Esegui: npm install pdf-merger-js');
      }
      
      // Verifica che tutti i file esistano
      for (const pdfPath of pdfPaths) {
        await fs.access(pdfPath).catch(() => {
          throw new Error(`Il file ${pdfPath} non esiste`);
        });
      }
      
      // Crea il merger
      const merger = new PDFMerger();
      
      // Aggiungi ogni PDF
      for (const pdfPath of pdfPaths) {
        await merger.add(pdfPath);
      }
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Salva il PDF unito
      await merger.save(outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Errore nell\'unione dei PDF:', error);
      throw new Error(`Impossibile unire i PDF: ${error.message}`);
    }
  }
  
  /**
   * Aggiunge un timbro o filigrana al PDF
   * @param {string} pdfPath - Percorso al PDF
   * @param {string} outputPath - Percorso di output
   * @param {Object} options - Opzioni per il timbro
   * @returns {Promise<string>} - Percorso al PDF con timbro
   */
  async addWatermark(pdfPath, outputPath, options = {}) {
    try {
      // Controlla che pdf-lib sia stato installato
      let PDFLib;
      try {
        PDFLib = require('pdf-lib');
      } catch (err) {
        throw new Error('La libreria pdf-lib non è installata. Esegui: npm install pdf-lib');
      }
      
      // Leggi il PDF
      const pdfBytes = await fs.readFile(pdfPath);
      
      // Carica il documento
      const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      
      // Per ogni pagina, aggiungi il timbro
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        
        // Posizione e rotazione del timbro
        const watermarkText = options.text || 'COPIA';
        const fontSize = options.fontSize || 60;
        const opacity = options.opacity || 0.2;
        const color = options.color || PDFLib.rgb(0.75, 0.75, 0.75);
        const angle = options.angle || -45 * (Math.PI / 180); // -45 gradi in radianti
        
        // Aggiungi il testo
        page.drawText(watermarkText, {
          x: width / 2 - font.widthOfTextAtSize(watermarkText, fontSize) / 2,
          y: height / 2,
          size: fontSize,
          font: font,
          color: color,
          opacity: opacity,
          rotate: { type: 'degrees', angle: angle * (180 / Math.PI) }
        });
      }
      
      // Salva il documento
      const pdfBytesWithWatermark = await pdfDoc.save();
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Scrivi il PDF modificato
      await fs.writeFile(outputPath, pdfBytesWithWatermark);
      
      return outputPath;
    } catch (error) {
      console.error('Errore nell\'aggiunta del timbro:', error);
      throw new Error(`Impossibile aggiungere il timbro: ${error.message}`);
    }
  }
}

module.exports = new PDFExportService();