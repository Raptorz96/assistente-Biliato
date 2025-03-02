/**
 * Export Services
 * 
 * Punto di accesso ai servizi di esportazione documenti in vari formati
 */

const path = require('path');
const HtmlExportService = require('./HtmlExportService');
const PDFExportService = require('./PDFExportService');
const DocxExportService = require('./DocxExportService');

/**
 * Enum per i formati di export supportati
 * @enum {string}
 */
const ExportFormat = {
  HTML: 'html',
  PDF: 'pdf',
  DOCX: 'docx'
};

/**
 * Restituisce il servizio di export appropriato per il formato specificato
 * @param {string} format - Formato di export
 * @returns {Object} - Servizio di export
 */
function getExportService(format) {
  switch (format.toLowerCase()) {
    case ExportFormat.PDF:
      return PDFExportService;
    case ExportFormat.DOCX:
      return DocxExportService;
    case ExportFormat.HTML:
    default:
      return HtmlExportService;
  }
}

/**
 * Genera un documento nel formato specificato
 * @param {string} format - Formato di output (html, pdf, docx)
 * @param {string} htmlContent - Contenuto HTML
 * @param {string} outputPath - Percorso di output
 * @param {Object} template - Template utilizzato
 * @param {Object} data - Dati cliente
 * @param {Object} options - Opzioni di generazione
 * @returns {Promise<string>} - Percorso al documento generato
 */
async function generateDocument(format, htmlContent, outputPath, template, data, options = {}) {
  const service = getExportService(format);
  
  switch (format.toLowerCase()) {
    case ExportFormat.PDF:
      return await service.generateDocument(htmlContent, outputPath, template, data, options);
    case ExportFormat.DOCX:
      return await service.generateDocument(htmlContent, outputPath, template, data, options);
    case ExportFormat.HTML:
    default:
      return await service.generateDocument(template, data, outputPath, options);
  }
}

/**
 * Converte un documento in un altro formato
 * @param {string} inputPath - Percorso al documento originale
 * @param {string} outputPath - Percorso di output
 * @param {string} format - Formato di destinazione (html, pdf, docx)
 * @param {Object} options - Opzioni di conversione
 * @returns {Promise<string>} - Percorso al documento convertito
 */
async function convertDocument(inputPath, outputPath, format, options = {}) {
  const service = getExportService(format);
  const inputFormat = path.extname(inputPath).slice(1).toLowerCase();
  
  // Determina l'operazione di conversione in base all'estensione del file
  switch (format.toLowerCase()) {
    case ExportFormat.PDF:
      return await service.convertToPdf(inputPath, outputPath, options);
    case ExportFormat.DOCX:
      return await service.convertToDocx(inputPath, outputPath, options);
    case ExportFormat.HTML:
    default:
      return await service.convertToHtml(inputPath, outputPath, options);
  }
}

/**
 * Crea un'anteprima HTML di un template
 * @param {string} templateContent - Contenuto HTML del template
 * @param {Object} data - Dati per il rendering
 * @returns {Promise<string>} - HTML renderizzato per anteprima
 */
async function createPreview(templateContent, data) {
  return await HtmlExportService.createPreview(templateContent, data);
}

/**
 * Unisce più PDF in un unico documento
 * @param {Array<string>} pdfPaths - Array di percorsi ai PDF da unire
 * @param {string} outputPath - Percorso al PDF unito
 * @param {Object} options - Opzioni di unione
 * @returns {Promise<string>} - Percorso al PDF unito
 */
async function mergePdfs(pdfPaths, outputPath, options = {}) {
  return await PDFExportService.mergePdfs(pdfPaths, outputPath, options);
}

/**
 * Aggiunge un timbro o filigrana al PDF
 * @param {string} pdfPath - Percorso al PDF
 * @param {string} outputPath - Percorso di output
 * @param {Object} options - Opzioni per il timbro
 * @returns {Promise<string>} - Percorso al PDF con timbro
 */
async function addWatermarkToPdf(pdfPath, outputPath, options = {}) {
  return await PDFExportService.addWatermark(pdfPath, outputPath, options);
}

// Path è già importato all'inizio del file

module.exports = {
  ExportFormat,
  getExportService,
  generateDocument,
  convertDocument,
  createPreview,
  mergePdfs,
  addWatermarkToPdf,
  // Esporta anche i servizi singoli
  HtmlExportService,
  PDFExportService,
  DocxExportService
};