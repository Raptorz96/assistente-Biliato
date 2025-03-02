/**
 * Export Services Index
 * 
 * Esporta tutti i servizi di export disponibili per una gestione centralizzata.
 */

const PDFExportService = require('./PDFExportService');
const DocxExportService = require('./DocxExportService');
const HtmlExportService = require('./HtmlExportService');

/**
 * Factory per ottenere il servizio di export appropriato in base al formato
 * @param {string} format - Formato di export (pdf, docx, html, markdown)
 * @returns {Object} - Servizio di export corrispondente
 */
const getExportService = (format) => {
  switch (format.toLowerCase()) {
    case 'pdf':
      return PDFExportService;
    case 'docx':
    case 'word':
      return DocxExportService;
    case 'html':
      return HtmlExportService;
    case 'markdown':
    case 'md':
      return {
        generate: (options) => HtmlExportService.markdownToHtml(options.content, {
          generateDocument: false,
          ...options
        })
      };
    default:
      throw new Error(`Formato di export non supportato: ${format}`);
  }
};

module.exports = {
  PDFExportService,
  DocxExportService,
  HtmlExportService,
  getExportService
};