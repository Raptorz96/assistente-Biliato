# Assistente Biliato

Un assistente AI per uno studio commercialista che gestisce l'onboarding dei clienti e automatizza la generazione di procedure e documenti.

## Caratteristiche

- **Onboarding Clienti**: Acquisizione e gestione delle informazioni dei clienti
- **Gestione Documenti**: Generazione automatica di documenti personalizzati
- **Procedure Contabili**: Creazione di procedure contabili basate sul profilo del cliente
- **Assistente AI**: Risposta a domande su contabilità, fiscalità e normative

## Tecnologie

- **Backend**:
  - Node.js
  - Express.js
  - MongoDB
  - Integrazione OpenAI per assistenza automatizzata
- **Frontend**:
  - React
  - Material-UI
  - React Router
  - Axios

## Struttura del Progetto

```
assistente-biliato/
├── app.js               # Main application file
├── package.json         # Project dependencies
├── .env                 # Environment variables
├── public/              # Backend static assets
├── client/              # React frontend application
│   ├── public/          # Frontend static assets
│   └── src/             # React source code
│       ├── components/  # React components
│       ├── contexts/    # React contexts
│       ├── services/    # API services
│       └── utils/       # Utility functions
├── src/                 # Backend source code
│   ├── controllers/     # Request handlers
│   ├── models/          # Data models
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
└── templates/           # Document templates
```

## Installazione

1. Clona il repository:
```bash
git clone https://github.com/tuousername/assistente-biliato.git
cd assistente-biliato
```

2. Installa le dipendenze per il backend e frontend:
```bash
# Installa le dipendenze del backend
npm install

# Installa le dipendenze del frontend
npm run client-install
```

3. Configura le variabili d'ambiente:
```bash
cp .env.example .env
# Modifica il file .env con le tue impostazioni
```

4. Costruisci l'applicazione React per la produzione:
```bash
npm run client-build
```

5. Avvia il server:
```bash
npm start
```

Per la modalità sviluppo con ricaricamento automatico:
```bash
# Per avviare solo il backend con hot reload
npm run dev

# Per sviluppare il frontend React
cd client && npm start
```

## Utilizzo

Accedi all'applicazione all'indirizzo `http://localhost:3001` per:

- Gestire l'onboarding di nuovi clienti
- Generare documenti personalizzati
- Creare procedure contabili
- Interagire con l'assistente AI

In modalità sviluppo, il frontend React è accessibile separatamente su `http://localhost:3000`.

## Contribuire

1. Fai un fork del repository
2. Crea un branch per la tua funzionalità (`git checkout -b feature/nome-funzionalita`)
3. Effettua il commit delle tue modifiche (`git commit -m 'Aggiungi nome-funzionalita'`)
4. Esegui il push sul branch (`git push origin feature/nome-funzionalita`)
5. Apri una Pull Request

## Licenza

Questo progetto è concesso in licenza con i termini della licenza MIT. Vedere il file `LICENSE` per maggiori informazioni.