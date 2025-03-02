/**
 * PDF Export Service
 * 
 * Servizio per l'esportazione di documenti in formato PDF
 * con supporto per intestazioni, piè di pagina, e metadati.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../../src/utils/logger');

class PDFExportService {
  /**
   * Crea un documento PDF da HTML
   * @param {Object} options - Opzioni per la generazione del PDF
   * @returns {Promise<Buffer>} - Il documento PDF come buffer
   */
  async generateFromHtml(options) {
    const {
      html,
      headerTemplate,
      footerTemplate,
      pageSettings = {},
      metadata = {},
      outputPath = null,
      watermark = null
    } = options;

    try {
      // Aggiungi il watermark al documento se specificato
      let contentWithWatermark = html;
      if (watermark) {
        const watermarkHtml = `
          <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); 
                     font-size: 100px; color: rgba(200, 50, 50, 0.1); z-index: -1000; pointer-events: none;">
            ${watermark}
          </div>
        `;
        contentWithWatermark = html.replace('<body>', `<body>${watermarkHtml}`);
      }

      // Avvia puppeteer per generare il PDF
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(contentWithWatermark, { waitUntil: 'networkidle0' });
      
      // Configura le opzioni per la generazione PDF
      const pdfOptions = {
        format: pageSettings.format || 'A4',
        printBackground: true,
        margin: {
          top: pageSettings.margins?.top || '2cm',
          right: pageSettings.margins?.right || '2cm',
          bottom: pageSettings.margins?.bottom || '2cm',
          left: pageSettings.margins?.left || '2cm'
        },
        landscape: pageSettings.landscape,
        displayHeaderFooter: !!(headerTemplate || footerTemplate),
        headerTemplate: headerTemplate || '',
        footerTemplate: footerTemplate || '<div style="text-align: center; width: 100%; font-size: 10px; color: #666;">' +
          '<span>Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span>' +
          '</div>'
      };
      
      // Se è specificato un percorso di output, salva il file
      if (outputPath) {
        pdfOptions.path = outputPath;
      }
      
      const pdfBuffer = await page.pdf(pdfOptions);
      await browser.close();
      
      // Aggiungi metadati al PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      if (metadata.title) pdfDoc.setTitle(metadata.title);
      if (metadata.author) pdfDoc.setAuthor(metadata.author);
      if (metadata.subject) pdfDoc.setSubject(metadata.subject);
      if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords);
      pdfDoc.setCreator('PDFExportService');
      pdfDoc.setProducer('Studio Biliato');
      
      // Salva il PDF con metadati
      const finalPdfBuffer = await pdfDoc.save();
      
      // Se è stato specificato un percorso, sovrascrivi il file
      if (outputPath) {
        await fs.writeFile(outputPath, finalPdfBuffer);
        logger.info(`PDF salvato con successo: ${outputPath}`);
        return finalPdfBuffer;
      }
      
      return finalPdfBuffer;
    } catch (error) {
      logger.error('Errore nella generazione del PDF:', error);
      throw new Error(`Errore nella generazione del PDF: ${error.message}`);
    }
  }
  
  /**
   * Unisce più PDF in un unico documento
   * @param {Array<Buffer|string>} pdfFiles - Array di buffer PDF o percorsi file
   * @param {Object} options - Opzioni di unione
   * @returns {Promise<Buffer>} - Il documento PDF unito
   */
  async mergePDFs(pdfFiles, options = {}) {
    try {
      if (!pdfFiles || pdfFiles.length === 0) {
        throw new Error('Nessun file PDF fornito per l\'unione');
      }
      
      const mergedPdf = await PDFDocument.create();
      
      // Processa ogni file
      for (const pdfFile of pdfFiles) {
        // Carica il PDF come buffer
        let pdfBuffer;
        if (typeof pdfFile === 'string') {
          // È un percorso file
          pdfBuffer = await fs.readFile(pdfFile);
        } else if (Buffer.isBuffer(pdfFile)) {
          // È un buffer
          pdfBuffer = pdfFile;
        } else {
          throw new Error('Formato file non valido');
        }
        
        // Carica e unisci il PDF
        const pdf = await PDFDocument.load(pdfBuffer);
        const pageIndices = [...Array(pdf.getPageCount()).keys()];
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
        
        // Aggiungi le pagine al documento finale
        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
        });
      }
      
      // Imposta i metadati se forniti
      if (options.metadata) {
        if (options.metadata.title) mergedPdf.setTitle(options.metadata.title);
        if (options.metadata.author) mergedPdf.setAuthor(options.metadata.author);
        if (options.metadata.subject) mergedPdf.setSubject(options.metadata.subject);
        if (options.metadata.keywords) mergedPdf.setKeywords(options.metadata.keywords);
      }
      
      mergedPdf.setCreator('PDFExportService');
      mergedPdf.setProducer('Studio Biliato');
      
      // Salva il PDF unito
      const mergedPdfBuffer = await mergedPdf.save();
      
      // Se è specificato un percorso di output, salva il file
      if (options.outputPath) {
        await fs.writeFile(options.outputPath, mergedPdfBuffer);
        logger.info(`PDF unito salvato con successo: ${options.outputPath}`);
      }
      
      return mergedPdfBuffer;
    } catch (error) {
      logger.error('Errore nell\'unione dei PDF:', error);
      throw new Error(`Errore nell'unione dei PDF: ${error.message}`);
    }
  }
  
  /**
   * Aggiunge una filigrana a un documento PDF
   * @param {Buffer|string} pdfFile - Buffer PDF o percorso file
   * @param {string} watermarkText - Testo della filigrana
   * @param {Object} options - Opzioni per la filigrana
   * @returns {Promise<Buffer>} - Il documento PDF con filigrana
   */
  async addWatermark(pdfFile, watermarkText, options = {}) {
    try {
      // Carica il PDF come buffer
      let pdfBuffer;
      if (typeof pdfFile === 'string') {
        // È un percorso file
        pdfBuffer = await fs.readFile(pdfFile);
      } else if (Buffer.isBuffer(pdfFile)) {
        // È un buffer
        pdfBuffer = pdfFile;
      } else {
        throw new Error('Formato file non valido');
      }
      
      // Carica il PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      
      // Imposta i parametri della filigrana
      const fontSize = options.fontSize || 60;
      const opacity = options.opacity || 0.2;
      const color = options.color || rgb(0.8, 0.2, 0.2);
      const angle = options.angle || -45;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Aggiungi la filigrana a ogni pagina
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 2 - font.widthOfTextAtSize(watermarkText, fontSize) / 2,
          y: height / 2,
          size: fontSize,
          font,
          opacity,
          color,
          rotate: { type: 'degrees', angle }
        });
      }
      
      // Salva il PDF con filigrana
      const watermarkedPdfBuffer = await pdfDoc.save();
      
      // Se è specificato un percorso di output, salva il file
      if (options.outputPath) {
        await fs.writeFile(options.outputPath, watermarkedPdfBuffer);
        logger.info(`PDF con filigrana salvato con successo: ${options.outputPath}`);
      }
      
      return watermarkedPdfBuffer;
    } catch (error) {
      logger.error('Errore nell\'aggiunta della filigrana al PDF:', error);
      throw new Error(`Errore nell'aggiunta della filigrana: ${error.message}`);
    }
  }
}

module.exports = new PDFExportService();