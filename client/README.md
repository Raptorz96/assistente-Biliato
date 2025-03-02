# Assistente Biliato - Client React

Frontend React per l'applicazione Assistente Biliato, un software per studi commercialisti.

## Funzionalità

- **Login semplice** per autenticazione
- **Dashboard** con riepilogo attività
- **Gestione Clienti** (lista, creazione, modifica)
- **Assistente AI** (interfaccia chat per domande guidate)
- **Gestione Procedure** (visualizzazione, creazione)
- **Generazione Documenti** (selezione template e compilazione)

## Tecnologie utilizzate

- React
- React Router per la navigazione
- Material-UI per i componenti dell'interfaccia
- Axios per le chiamate API
- Context API per la gestione dello stato

## Installazione

1. Assicurati di avere Node.js installato (v14 o superiore)
2. Clona il repository
3. Installa le dipendenze:

```bash
cd client
npm install
```

## Configurazione

1. Crea un file `.env` nella cartella `client` (o modifica quello esistente):

```
REACT_APP_API_URL=http://localhost:3000/api
```

## Avvio dell'applicazione

Per avviare l'applicazione in modalità sviluppo:

```bash
npm start
```

L'applicazione sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000).

## Build per la produzione

Per creare una build ottimizzata per la produzione:

```bash
npm run build
```

I file di build saranno nella cartella `build`.

## Credenziali di test

Per accedere all'applicazione in modalità demo:

- Email: admin@example.com
- Password: password

## Struttura del progetto

```
client/
├── public/              # File statici
├── src/
│   ├── components/      # Componenti React
│   │   ├── auth/        # Componenti di autenticazione
│   │   ├── assistant/   # Componenti dell'assistente AI
│   │   ├── clients/     # Componenti gestione clienti
│   │   ├── common/      # Componenti condivisi
│   │   ├── documents/   # Componenti generazione documenti
│   │   └── procedures/  # Componenti gestione procedure
│   ├── contexts/        # Context API
│   ├── services/        # Servizi API
│   ├── utils/           # Utility e helper
│   ├── App.js           # Componente principale
│   └── index.js         # Entry point
└── package.json         # Dipendenze
```