# Assistente Biliato - Informazioni Utili per Claude

## Comandi Utili

### Avvio Applicazione
```bash
# Avvio in modalità sviluppo (con ricaricamento automatico)
npm run dev

# Avvio in modalità produzione
npm start
```

### Test
```bash
# Esegui tutti i test con copertura
npm test

# Modalità watch per i test
npm run test:watch
```

### Database
Il progetto utilizza MongoDB come database. Assicurati che MongoDB sia installato e in esecuzione prima di avviare l'applicazione.

## Struttura del Progetto

- `app.js` - File principale dell'applicazione
- `config/` - Configurazioni (database, ecc.)
- `src/` - Codice sorgente dell'applicazione
  - `controllers/` - Gestori delle richieste
  - `models/` - Modelli dati
  - `routes/` - Definizioni delle rotte
  - `services/` - Logica di business
  - `utils/` - Funzioni di utilità
- `public/` - Risorse statiche (CSS, JS, immagini)
- `views/` - Template EJS
- `templates/` - Template per la generazione dei documenti
- `generated-docs/` - Output per i documenti generati
- `tests/` - Test dell'applicazione

## Informazioni sul Codice

### Stile di Codifica
- Indentazione: 2 spazi
- Stile di nomenclatura: camelCase per variabili e funzioni, PascalCase per classi
- Preferire funzioni di esportazione singole per moduli
- Utilizzare async/await per codice asincrono
- Commenti su funzioni e moduli per documentare lo scopo e l'utilizzo

### Dipendenze Principali
- Express.js - Framework web
- MongoDB/Mongoose - Database e ORM
- EJS - Engine di templating
- OpenAI - Integrazione AI per assistenza
- PDF-Lib, Docx - Generazione documenti
- Jest - Framework di test

## Workflow Applicazione

1. **Onboarding Cliente**:
   - Acquisizione dati cliente
   - Validazione e salvataggio
   - Generazione documenti iniziali

2. **Generazione Documenti**:
   - Selezione template
   - Compilazione dati
   - Esportazione in formato desiderato

3. **Procedure Contabili**:
   - Creazione procedure personalizzate
   - Monitoraggio attività
   - Notifiche scadenze

4. **Assistente AI**:
   - Risposta a domande in linguaggio naturale
   - Analisi documenti
   - Suggerimenti automatici