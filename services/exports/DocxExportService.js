/**
 * DOCX Export Service
 * 
 * Servizio per l'esportazione di documenti in formato DOCX (Word)
 * con supporto per intestazioni, piè di pagina, e formattazione avanzata.
 */

const { 
  Document, Paragraph, Table, TableRow, TableCell, TextRun, 
  Header, Footer, PageNumber, ImageRun, HeadingLevel, 
  AlignmentType, BorderStyle, WidthType, TableLayoutType
} = require('docx');
const fs = require('fs').promises;
const path = require('path');
const { convert } = require('html-to-text');
const { logger } = require('../../src/utils/logger');

class DocxExportService {
  /**
   * Genera un documento DOCX con opzioni avanzate
   * @param {Object} options - Opzioni per la generazione
   * @returns {Promise<Buffer>} - Il documento DOCX come buffer
   */
  async generate(options) {
    const {
      content,
      metadata = {},
      headerOptions = {},
      footerOptions = {},
      pageSettings = {},
      style = {},
      outputPath = null
    } = options;
    
    try {
      // Crea un documento DOCX
      const doc = new Document({
        title: metadata.title || 'Documento',
        subject: metadata.subject || '',
        creator: metadata.author || 'Studio Biliato',
        description: metadata.description || '',
        keywords: metadata.keywords || [],
        styles: this.createStyles(style),
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: pageSettings.margins?.top || 1133, // 2cm in twip (1cm = 566.9twip)
                  right: pageSettings.margins?.right || 1133,
                  bottom: pageSettings.margins?.bottom || 1133,
                  left: pageSettings.margins?.left || 1133
                },
                size: {
                  width: pageSettings.width || 11906, // A4 width in twip
                  height: pageSettings.height || 16838 // A4 height in twip
                },
                orientation: pageSettings.landscape ? 'landscape' : 'portrait'
              },
              headers: this.createHeader(headerOptions),
              footers: this.createFooter(footerOptions)
            },
            children: this.processContent(content, style)
          }
        ]
      });
      
      // Genera il documento
      const buffer = await doc.save();
      
      // Se è specificato un percorso di output, salva il file
      if (outputPath) {
        await fs.writeFile(outputPath, buffer);
        logger.info(`DOCX salvato con successo: ${outputPath}`);
      }
      
      return buffer;
    } catch (error) {
      logger.error('Errore nella generazione del DOCX:', error);
      throw new Error(`Errore nella generazione del DOCX: ${error.message}`);
    }
  }
  
  /**
   * Crea gli stili per il documento
   * @param {Object} style - Opzioni di stile
   * @returns {Object} - Definizione degli stili
   */
  createStyles(style) {
    return {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            font: style.bodyFont || 'Calibri',
            size: (style.fontSize || 11) * 2, // Dimensione in half-points
            color: style.textColor || '000000'
          },
          paragraph: {
            spacing: {
              line: style.lineSpacing || 276, // 1.15 spacing in twip
              before: style.paragraphSpacingBefore || 0,
              after: style.paragraphSpacingAfter || 0
            }
          }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            font: style.headingFont || 'Calibri',
            size: (style.headingFontSize || 16) * 2, // Dimensione in half-points
            bold: true,
            color: style.headingColor || '2E74B5'
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
            font: style.headingFont || 'Calibri',
            size: (style.headingFontSize || 14) * 2, // Dimensione in half-points
            bold: true,
            color: style.headingColor || '2E74B5'
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120
            }
          }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            font: style.headingFont || 'Calibri',
            size: (style.headingFontSize || 12) * 2, // Dimensione in half-points
            bold: true,
            color: style.headingColor || '2E74B5'
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120
            }
          }
        }
      ]
    };
  }
  
  /**
   * Crea intestazione per il documento
   * @param {Object} options - Opzioni per l'intestazione
   * @returns {Object} - Definizione intestazione
   */
  createHeader(options) {
    if (!options.enabled) {
      return {};
    }
    
    const headerChildren = [];
    
    if (options.text) {
      headerChildren.push(new Paragraph({
        text: options.text,
        style: 'Heading2',
        alignment: AlignmentType.CENTER
      }));
    }
    
    // Aggiungi la riga separatrice
    if (options.showSeparator) {
      headerChildren.push(new Paragraph({
        text: '',
        border: {
          bottom: {
            color: 'auto',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6
          }
        }
      }));
    }
    
    // TODO: Aggiungere supporto per logo
    
    return {
      default: new Header({
        children: headerChildren
      })
    };
  }
  
  /**
   * Crea piè di pagina per il documento
   * @param {Object} options - Opzioni per il piè di pagina
   * @returns {Object} - Definizione piè di pagina
   */
  createFooter(options) {
    if (!options.enabled) {
      return {};
    }
    
    const footerChildren = [];
    
    // Aggiungi numerazione pagina
    if (options.showPageNumbers) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: options.pageNumberPrefix || 'Pagina ',
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
      }));
    }
    
    // Aggiungi testo personalizzato
    if (options.text) {
      footerChildren.push(new Paragraph({
        text: options.text,
        alignment: AlignmentType.CENTER,
        style: 'Normal'
      }));
    }
    
    return {
      default: new Footer({
        children: footerChildren
      })
    };
  }
  
  /**
   * Elabora il contenuto da inserire nel documento
   * @param {Array|Object|string} content - Contenuto da elaborare
   * @param {Object} style - Opzioni di stile
   * @returns {Array} - Elementi elaborati per il documento
   */
  processContent(content, style) {
    if (typeof content === 'string') {
      // Se è HTML, convertilo in testo strutturato
      if (content.trim().startsWith('<') && content.includes('</')) {
        return this.convertHtmlToDocxElements(content, style);
      }
      
      // Se è testo semplice, lo dividiamo in paragrafi
      return content.split('\n\n').map(text => {
        if (!text.trim()) return null;
        
        return new Paragraph({
          text: text.trim(),
          style: 'Normal'
        });
      }).filter(p => p !== null);
    } else if (Array.isArray(content)) {
      // Già un array di elementi, processiamo ogni elemento
      return content.flatMap(item => this.processContentItem(item, style));
    } else if (typeof content === 'object') {
      // Un singolo elemento strutturato
      return [this.processContentItem(content, style)];
    }
    
    return [];
  }
  
  /**
   * Elabora un singolo elemento di contenuto
   * @param {Object} item - Elemento da elaborare
   * @param {Object} style - Opzioni di stile
   * @returns {Object} - Elemento elaborato
   */
  processContentItem(item, style) {
    if (!item || typeof item !== 'object') {
      return new Paragraph({ text: String(item || '') });
    }
    
    switch (item.type) {
      case 'paragraph':
        return new Paragraph({
          text: item.text,
          style: item.style || 'Normal',
          alignment: item.alignment ? this.getAlignment(item.alignment) : undefined,
          bullet: item.bullet ? { level: item.bulletLevel || 0 } : undefined
        });
        
      case 'heading':
        const headingLevel = item.level ? 
          (item.level >= 1 && item.level <= 3 ? item.level : 1) : 1;
        
        return new Paragraph({
          text: item.text,
          heading: HeadingLevel[`HEADING_${headingLevel}`],
          alignment: item.alignment ? this.getAlignment(item.alignment) : undefined
        });
        
      case 'table':
        if (!item.rows || !Array.isArray(item.rows)) {
          return new Paragraph({ text: '' });
        }
        
        const rows = item.rows.map(row => {
          if (!Array.isArray(row)) return null;
          
          return new TableRow({
            children: row.map(cell => {
              return new TableCell({
                children: [new Paragraph({ text: cell })],
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE }
              });
            })
          });
        }).filter(r => r !== null);
        
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows
        });
        
      default:
        return new Paragraph({ text: String(item.text || '') });
    }
  }
  
  /**
   * Converte HTML in elementi DOCX
   * @param {string} html - HTML da convertire
   * @param {Object} style - Opzioni di stile
   * @returns {Array} - Elementi DOCX
   */
  convertHtmlToDocxElements(html, style) {
    // Usiamo html-to-text per una conversione base
    // In una soluzione più completa, si potrebbe utilizzare
    // un parser HTML più robusto
    const textOptions = {
      wordwrap: false,
      selectors: [
        { selector: 'h1', options: { uppercase: false, prefix: '', postfix: '\n\n' } },
        { selector: 'h2', options: { uppercase: false, prefix: '', postfix: '\n\n' } },
        { selector: 'h3', options: { uppercase: false, prefix: '', postfix: '\n\n' } },
        { selector: 'p', options: { prefix: '', postfix: '\n\n' } },
        { selector: 'ul', options: { itemPrefix: '• ' } },
        { selector: 'ol', options: { itemPrefix: function(i) { return `${i}. `; } } },
        { selector: 'table', options: { uppercaseHeaderCells: false } }
      ]
    };
    
    const text = convert(html, textOptions);
    
    // Identifica elementi HTML tramite euristica semplice sul testo
    const elements = [];
    const paragraphs = text.split('\n\n');
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      // Semplice euristica per rilevare intestazioni
      if (/^[A-Z0-9\s]+$/.test(paragraph) && paragraph.length < 100) {
        // Probabile titolo
        elements.push(new Paragraph({
          text: paragraph,
          heading: HeadingLevel.HEADING_1
        }));
      } else if (paragraph.startsWith('•')) {
        // Elemento lista
        elements.push(new Paragraph({
          text: paragraph.replace(/^• /, ''),
          bullet: { level: 0 }
        }));
      } else if (/^\d+\.\s/.test(paragraph)) {
        // Elemento lista numerata
        elements.push(new Paragraph({
          text: paragraph.replace(/^\d+\.\s/, ''),
          numbering: { reference: 1, level: 0 }
        }));
      } else {
        // Paragrafo normale
        elements.push(new Paragraph({
          text: paragraph
        }));
      }
    }
    
    return elements;
  }
  
  /**
   * Converte stringa di allineamento in costante docx
   * @param {string} alignment - Allineamento (left, center, right, justify)
   * @returns {AlignmentType} - Costante AlignmentType
   */
  getAlignment(alignment) {
    switch (alignment.toLowerCase()) {
      case 'left':
        return AlignmentType.LEFT;
      case 'center':
        return AlignmentType.CENTER;
      case 'right':
        return AlignmentType.RIGHT;
      case 'justify':
        return AlignmentType.JUSTIFIED;
      default:
        return AlignmentType.LEFT;
    }
  }
  
  /**
   * Genera un documento DOCX da HTML
   * @param {string} html - Contenuto HTML
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<Buffer>} - Il documento DOCX come buffer
   */
  async generateFromHtml(html, options = {}) {
    try {
      // Converti HTML in elementi DOCX
      const docxElements = this.convertHtmlToDocxElements(html, options.style || {});
      
      // Genera il documento con gli elementi convertiti
      return await this.generate({
        content: docxElements,
        metadata: options.metadata || {},
        headerOptions: options.headerOptions || {},
        footerOptions: options.footerOptions || {},
        pageSettings: options.pageSettings || {},
        style: options.style || {},
        outputPath: options.outputPath
      });
    } catch (error) {
      logger.error('Errore nella generazione del DOCX da HTML:', error);
      throw new Error(`Errore nella generazione del DOCX da HTML: ${error.message}`);
    }
  }
}

module.exports = new DocxExportService();