/**
 * DOCX Export Service
 * 
 * Gestisce la generazione di documenti in formato DOCX (Word)
 */

const fs = require('fs').promises;
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  HeadingLevel,
  ImageRun,
  Header,
  Footer,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  TextWrappingType,
  ExternalHyperlink
} = require('docx');
const moment = require('moment');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { convert } = require('html-to-text');

class DocxExportService {
  /**
   * Genera un documento DOCX
   * @param {string} htmlContent - Contenuto HTML da convertire
   * @param {string} outputPath - Percorso di output
   * @param {Object} template - Template utilizzato
   * @param {Object} data - Dati cliente estesi
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<string>} - Percorso al documento generato
   */
  async generateDocument(htmlContent, outputPath, template, data, options = {}) {
    try {
      // Estrai e processa il contenuto HTML
      const { sections, title } = await this.processHtml(htmlContent, template, data);
      
      // Imposta opzioni del documento
      const documentOptions = {
        title: title || template.displayName || template.name,
        description: `Documento generato per ${data.name}`,
        subject: template.category || 'Documento',
        creator: options.creator || 'Studio Biliato',
        keywords: [template.category, template.type, 'documento'],
        styles: this.getDocumentStyles(),
      };
      
      // Crea il documento Word
      const doc = new Document(documentOptions);
      
      // Aggiungi sezioni al documento
      for (const section of sections) {
        doc.addSection(section);
      }
      
      // Crea la directory di output se non esiste
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Genera il file DOCX
      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(outputPath, buffer);
      
      return outputPath;
    } catch (error) {
      console.error('Errore nella generazione DOCX:', error);
      throw new Error(`Impossibile generare il documento DOCX: ${error.message}`);
    }
  }
  
  /**
   * Processa il contenuto HTML e lo converte in elementi DOCX
   * @param {string} htmlContent - Contenuto HTML
   * @param {Object} template - Template utilizzato
   * @param {Object} data - Dati cliente
   * @returns {Promise<Object>} - Sezioni e informazioni del documento DOCX
   */
  async processHtml(htmlContent, template, data) {
    try {
      // Parsifica l'HTML
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      
      // Estrai il titolo
      const titleElement = document.querySelector('title');
      const title = titleElement ? titleElement.textContent : template.displayName || template.name;
      
      // Estrai il corpo
      const bodyElement = document.querySelector('body');
      if (!bodyElement) {
        throw new Error('Impossibile trovare l\'elemento body nell\'HTML');
      }
      
      // Converti il corpo in testo strutturato per una migliore conversione
      const textOptions = {
        selectors: [
          { selector: 'a', options: { ignoreHref: false } },
          { selector: 'img', format: 'skip' },
          { selector: 'table', format: 'dataTable' }
        ],
        wordwrap: false,
        preserveNewlines: true,
        formatters: {
          dataTable: (elem, walk, builder, formatOptions) => {
            // Processiamo le tabelle separatamente
            return ''; // Restituiamo una stringa vuota per ora
          }
        }
      };
      
      const bodyText = convert(bodyElement.innerHTML, textOptions);
      
      // Dividi il testo in paragrafi
      const paragraphs = [];
      const rawParagraphs = bodyText.split('\n\n');
      
      for (const text of rawParagraphs) {
        if (!text.trim()) continue;
        
        // Determina se potrebbe essere un titolo
        const isHeading = text.trim().length < 100 && (
          text.trim().endsWith(':') || 
          text.trim().toUpperCase() === text.trim() ||
          document.querySelector(`h1, h2, h3, h4, h5, h6`)?.textContent.includes(text.trim())
        );
        
        if (isHeading) {
          paragraphs.push(new Paragraph({
            text: text.trim(),
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 240, // 12pt
              after: 120 // 6pt
            }
          }));
        } else {
          paragraphs.push(new Paragraph({
            text: text.trim(),
            spacing: {
              before: 120, // 6pt
              after: 120 // 6pt
            }
          }));
        }
      }
      
      // Estrai le tabelle
      const tables = [];
      const tableElements = bodyElement.querySelectorAll('table');
      for (const tableElement of tableElements) {
        const table = this.processTable(tableElement);
        if (table) {
          tables.push(table);
        }
      }
      
      // Costruisci le sezioni del documento
      const sections = [];
      
      // Prima sezione con intestazione
      const mainSection = {
        properties: {},
        children: [
          // Aggiungi titolo
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 240,
              after: 240
            }
          }),
          
          // Aggiungi data
          new Paragraph({
            text: `Data: ${data.currentDate || moment().format('DD/MM/YYYY')}`,
            alignment: AlignmentType.RIGHT,
            spacing: {
              after: 240
            }
          }),
          
          // Aggiungi intestazione cliente
          new Paragraph({
            children: [
              new TextRun({
                text: data.name,
                bold: true
              }),
              new TextRun({
                text: `\nCodice Fiscale: ${data.fiscalCode || ''}`,
                break: 1
              }),
              new TextRun({
                text: `Email: ${data.email || ''}`,
                break: 1
              })
            ],
            spacing: {
              after: 240
            }
          }),
          
          // Aggiungi contenuto
          ...paragraphs,
          ...tables,
          
          // Aggiungi firma
          new Paragraph({
            children: [
              new TextRun({
                text: 'Cordiali saluti,',
                break: 1
              }),
              new TextRun({
                text: 'Studio Biliato',
                break: 1,
                bold: true
              })
            ],
            spacing: {
              before: 360,
              after: 240
            }
          }),
          
          // Aggiungi piè di pagina
          new Paragraph({
            text: 'Studio Biliato - P.IVA 12345678901 - www.studiobiliato.it',
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 240
            }
          })
        ]
      };
      
      sections.push(mainSection);
      
      return { sections, title };
    } catch (error) {
      console.error('Errore nel processamento HTML per DOCX:', error);
      throw error;
    }
  }
  
  /**
   * Processa una tabella HTML e la converte in tabella DOCX
   * @param {HTMLElement} tableElement - Elemento tabella HTML
   * @returns {Table} - Tabella DOCX
   */
  processTable(tableElement) {
    // Estrai righe
    const rows = [];
    const trElements = tableElement.querySelectorAll('tr');
    
    if (trElements.length === 0) {
      return null;
    }
    
    // Determina se la prima riga è un'intestazione
    const hasHeader = tableElement.querySelector('th') !== null;
    
    for (let i = 0; i < trElements.length; i++) {
      const trElement = trElements[i];
      const isHeader = i === 0 && hasHeader;
      
      // Estrai celle
      const cells = [];
      const cellElements = trElement.querySelectorAll('th, td');
      
      for (const cellElement of cellElements) {
        // Ottieni contenuto testuale
        const textContent = cellElement.textContent.trim();
        
        // Crea la cella
        const cell = new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: textContent,
                  bold: isHeader
                })
              ],
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
            })
          ],
          shading: isHeader 
            ? { fill: "F2F2F2" } 
            : undefined
        });
        
        cells.push(cell);
      }
      
      // Aggiungi la riga
      rows.push(new TableRow({ children: cells }));
    }
    
    // Crea la tabella
    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      margins: {
        top: 120,
        bottom: 120,
        left: 120,
        right: 120
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" }
      }
    });
  }
  
  /**
   * Definisce gli stili del documento DOCX
   * @returns {Object} - Stili del documento
   */
  getDocumentStyles() {
    return {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: {
            font: 'Arial',
            size: 24, // 12pt
            color: '000000'
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15x line spacing
            },
          },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          run: {
            font: 'Arial',
            size: 32, // 16pt
            bold: true,
            color: '2c3e50'
          },
          paragraph: {
            spacing: {
              before: 240, // 12pt spacing before
              after: 120, // 6pt spacing after
            },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          run: {
            font: 'Arial',
            size: 28, // 14pt
            bold: true,
            color: '2c3e50'
          },
          paragraph: {
            spacing: {
              before: 200, // 10pt spacing before
              after: 100, // 5pt spacing after
            },
          },
        },
        {
          id: 'TableHeader',
          name: 'Table Header',
          run: {
            font: 'Arial',
            size: 24, // 12pt
            bold: true,
            color: '000000'
          },
          paragraph: {
            spacing: {
              line: 240, // 1x line spacing
            },
          },
        },
      ],
    };
  }
  
  /**
   * Converte un documento HTML esistente in DOCX
   * @param {string} htmlPath - Percorso al file HTML
   * @param {string} outputPath - Percorso di output
   * @param {Object} options - Opzioni di conversione
   * @returns {Promise<string>} - Percorso al documento DOCX generato
   */
  async convertToDocx(htmlPath, outputPath, options = {}) {
    try {
      // Leggi il contenuto HTML
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      // Estrai titolo dal HTML per i metadati
      let title = 'Documento';
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
      
      // Template e dati minimi per i metadati
      const templateInfo = {
        displayName: title,
        name: title,
        category: options.category || 'document',
        type: options.type || 'letter'
      };
      
      const dataInfo = {
        name: options.name || 'Cliente',
        fiscalCode: options.fiscalCode || '',
        email: options.email || '',
        currentDate: moment().format('DD/MM/YYYY')
      };
      
      // Genera il DOCX con le opzioni fornite
      return await this.generateDocument(
        htmlContent,
        outputPath,
        templateInfo,
        dataInfo,
        options
      );
    } catch (error) {
      console.error('Errore nella conversione a DOCX:', error);
      throw new Error(`Impossibile convertire il documento in DOCX: ${error.message}`);
    }
  }
}

module.exports = new DocxExportService();