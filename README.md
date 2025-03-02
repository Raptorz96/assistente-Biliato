# Assistente Biliato

Un assistente AI per uno studio commercialista che gestisce l'onboarding dei clienti e automatizza la generazione di procedure e documenti.

## Caratteristiche

- **Onboarding Clienti**: Acquisizione e gestione delle informazioni dei clienti
- **Gestione Documenti**: Generazione automatica di documenti personalizzati
- **Procedure Contabili**: Creazione di procedure contabili basate sul profilo del cliente
- **Assistente AI**: Risposta a domande su contabilità, fiscalità e normative

## Tecnologie

- Node.js
- Express.js
- MongoDB
- EJS (template engine)
- Integrazione AI per assistenza automatizzata

## Struttura del Progetto

```
assistente-biliato/
├── app.js               # Main application file
├── package.json         # Project dependencies
├── .env                 # Environment variables
├── public/              # Static assets
│   ├── css/             # CSS stylesheets
│   └── js/              # Client-side JavaScript
├── src/                 # Application source code
│   ├── controllers/     # Request handlers
│   ├── models/          # Data models
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── templates/           # Document templates
├── views/               # EJS templates
└── generated-docs/      # Output directory for generated documents
```

## Installazione

1. Clona il repository:
```bash
git clone https://github.com/tuousername/assistente-biliato.git
cd assistente-biliato
```

2. Installa le dipendenze:
```bash
npm install
```

3. Configura le variabili d'ambiente:
```bash
cp .env.example .env
# Modifica il file .env con le tue impostazioni
```

4. Avvia il server:
```bash
npm start
```

Per la modalità sviluppo con ricaricamento automatico:
```bash
npm run dev
```

## Utilizzo

Accedi all'applicazione all'indirizzo `http://localhost:3000` per:

- Gestire l'onboarding di nuovi clienti
- Generare documenti personalizzati
- Creare procedure contabili
- Interagire con l'assistente AI

## Contribuire

1. Fai un fork del repository
2. Crea un branch per la tua funzionalità (`git checkout -b feature/nome-funzionalita`)
3. Effettua il commit delle tue modifiche (`git commit -m 'Aggiungi nome-funzionalita'`)
4. Esegui il push sul branch (`git push origin feature/nome-funzionalita`)
5. Apri una Pull Request

## Licenza

Questo progetto è concesso in licenza con i termini della licenza MIT. Vedere il file `LICENSE` per maggiori informazioni.