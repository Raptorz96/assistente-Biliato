/**
 * HTML Export Service
 * 
 * Servizio per l'esportazione di documenti in formato HTML
 * con supporto per CSS, metadati, e layout di stampa.
 */

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const { logger } = require('../../src/utils/logger');

class HtmlExportService {
  /**
   * Genera un documento HTML
   * @param {Object} options - Opzioni per la generazione
   * @returns {Promise<string>} - Il contenuto HTML generato
   */
  async generate(options) {
    const {
      content,
      title = 'Documento',
      metadata = {},
      css = '',
      pageSettings = {},
      headers = {},
      footers = {},
      watermark = null,
      outputPath = null
    } = options;
    
    try {
      // Prepara i metadati
      const metaTags = [
        `<meta charset="UTF-8">`,
        `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
        `<meta name="generator" content="HtmlExportService">`,
        `<meta name="author" content="${metadata.author || ''}">`,
        `<meta name="description" content="${metadata.description || ''}">`,
        `<meta name="creation-date" content="${metadata.date || moment().format('YYYY-MM-DD HH:mm')}">`,
      ];
      
      // Aggiungi keywords se presenti
      if (metadata.keywords && Array.isArray(metadata.keywords) && metadata.keywords.length > 0) {
        metaTags.push(`<meta name="keywords" content="${metadata.keywords.join(', ')}">`);
      }
      
      // Aggiungi metadati personalizzati
      if (metadata.custom && typeof metadata.custom === 'object') {
        for (const [key, value] of Object.entries(metadata.custom)) {
          metaTags.push(`<meta name="${key}" content="${value}">`);
        }
      }
      
      // Prepara CSS, incluso CSS per la stampa
      const styles = `
<style>
  /* Stili di base */
  body {
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 20px;
  }
  
  /* CSS personalizzato */
  ${css}
  
  /* Filigrana */
  ${watermark ? `
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
  ` : ''}
  
  /* Stili per la stampa */
  @media print {
    @page {
      size: ${pageSettings.format || 'A4'} ${pageSettings.landscape ? 'landscape' : 'portrait'};
      margin: ${pageSettings.margins?.top || '2cm'} ${pageSettings.margins?.right || '2cm'} ${pageSettings.margins?.bottom || '2cm'} ${pageSettings.margins?.left || '2cm'};
    }
    
    body {
      font-size: 12pt;
      line-height: 1.3;
    }
    
    a {
      text-decoration: none;
      color: #000;
    }
    
    .no-print {
      display: none !important;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    .header, .footer {
      position: fixed;
      width: 100%;
      left: 0;
    }
    
    .header {
      top: 0;
    }
    
    .footer {
      bottom: 0;
    }
    
    /* Aggiungi spazio per header e footer */
    ${headers.enabled ? 'body { padding-top: 50px; }' : ''}
    ${footers.enabled ? 'body { padding-bottom: 50px; }' : ''}
  }
</style>`;

      // Prepara header se abilitato
      const headerHtml = headers.enabled ? `
<div class="header">
  ${headers.content || ''}
  ${headers.showSeparator ? '<hr>' : ''}
</div>` : '';

      // Prepara footer se abilitato
      const footerHtml = footers.enabled ? `
<div class="footer">
  ${footers.showSeparator ? '<hr>' : ''}
  ${footers.content || ''}
  ${footers.showPageNumbers ? '<div class="page-number" style="text-align: center; font-size: 0.9em;">Pagina <span class="pageNumber"></span></div>' : ''}
</div>` : '';

      // Prepara filigrana se richiesta
      const watermarkHtml = watermark ? `<div class="watermark">${watermark}</div>` : '';

      // Componi il documento HTML completo
      const htmlContent = `<!DOCTYPE html>
<html lang="${metadata.language || 'it'}">
<head>
  ${metaTags.join('\n  ')}
  <title>${title}</title>
  ${styles}
</head>
<body>
  ${headerHtml}
  
  ${watermarkHtml}
  
  <div class="content">
    ${content}
  </div>
  
  ${footerHtml}
</body>
</html>`;

      // Se è specificato un percorso di output, salva il file
      if (outputPath) {
        await fs.writeFile(outputPath, htmlContent, 'utf8');
        logger.info(`HTML salvato con successo: ${outputPath}`);
      }
      
      return htmlContent;
    } catch (error) {
      logger.error('Errore nella generazione dell\'HTML:', error);
      throw new Error(`Errore nella generazione dell'HTML: ${error.message}`);
    }
  }
  
  /**
   * Genera un documento HTML con intestazioni e piè di pagina per la stampa
   * @param {Object} options - Opzioni per la generazione
   * @returns {Promise<string>} - Il contenuto HTML generato
   */
  async generatePrintable(options) {
    // Configura opzioni per una versione ottimizzata per la stampa
    const printOptions = {
      ...options,
      headers: {
        enabled: true,
        ...options.headers
      },
      footers: {
        enabled: true,
        showPageNumbers: true,
        ...options.footers
      },
      // Aggiungi CSS specifico per la stampa
      css: `
${options.css || ''}

/* Stili aggiuntivi per la stampa */
@media print {
  .page-container {
    page-break-after: always;
  }
  
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
  }
  
  table, figure, img {
    page-break-inside: avoid;
  }
}
`
    };
    
    return await this.generate(printOptions);
  }
  
  /**
   * Converte Markdown in HTML
   * @param {string} markdown - Testo markdown da convertire
   * @param {Object} options - Opzioni per la conversione
   * @returns {Promise<string>} - Il contenuto HTML generato
   */
  async markdownToHtml(markdown, options = {}) {
    try {
      // Se non è installato marked, lancia un errore
      let marked;
      try {
        marked = require('marked');
      } catch (err) {
        throw new Error('Libreria marked non installata. Installarla con npm install marked');
      }
      
      // Configura marked
      marked.setOptions({
        gfm: true,
        breaks: true,
        sanitize: options.sanitize !== false, // Sanitizza di default
        ...options.markedOptions
      });
      
      // Converti markdown in HTML
      const htmlContent = marked.parse(markdown);
      
      // Genera documento HTML completo se richiesto
      if (options.generateDocument !== false) {
        return await this.generate({
          content: htmlContent,
          title: options.title || 'Documento Markdown',
          metadata: options.metadata || {},
          css: options.css || '',
          pageSettings: options.pageSettings || {},
          headers: options.headers || {},
          footers: options.footers || {},
          watermark: options.watermark || null,
          outputPath: options.outputPath || null
        });
      }
      
      return htmlContent;
    } catch (error) {
      logger.error('Errore nella conversione del Markdown in HTML:', error);
      throw new Error(`Errore nella conversione del Markdown: ${error.message}`);
    }
  }
  
  /**
   * Aggiunge una filigrana a un documento HTML
   * @param {string} html - Contenuto HTML
   * @param {string} watermarkText - Testo della filigrana
   * @param {Object} options - Opzioni per la filigrana
   * @returns {string} - HTML con filigrana
   */
  addWatermark(html, watermarkText, options = {}) {
    try {
      const {
        fontSize = '100px',
        color = 'rgba(200, 50, 50, 0.1)',
        angle = '-45deg'
      } = options;
      
      // Crea lo stile per la filigrana
      const watermarkStyle = `
<style>
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(${angle});
    font-size: ${fontSize};
    color: ${color};
    z-index: -1000;
    pointer-events: none;
  }
</style>`;
      
      // Crea l'elemento della filigrana
      const watermarkHtml = `<div class="watermark">${watermarkText}</div>`;
      
      // Verifica se l'HTML contiene già un tag style, e aggiunge lo stile
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${watermarkStyle}</head>`);
      } else if (html.includes('<body')) {
        html = html.replace('<body', `<head>${watermarkStyle}</head><body`);
      } else {
        html = `<head>${watermarkStyle}</head>${html}`;
      }
      
      // Aggiunge l'elemento di filigrana all'inizio del corpo
      if (html.includes('<body>')) {
        html = html.replace('<body>', `<body>${watermarkHtml}`);
      } else if (html.includes('</body>')) {
        html = html.replace('</body>', `${watermarkHtml}</body>`);
      } else {
        html = `${html}${watermarkHtml}`;
      }
      
      return html;
    } catch (error) {
      logger.error('Errore nell\'aggiunta della filigrana all\'HTML:', error);
      throw new Error(`Errore nell'aggiunta della filigrana: ${error.message}`);
    }
  }
}

module.exports = new HtmlExportService();