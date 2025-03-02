# Istruzioni di setup per Assistente Biliato

Per completare la configurazione dell'applicazione, segui queste istruzioni:

## 1. Installazione delle dipendenze

Apri una finestra del prompt dei comandi o PowerShell nella directory del progetto ed esegui:

```bash
npm install moment openai html-to-text
```

Questo installerà:
- `moment`: libreria per la gestione delle date
- `openai`: SDK ufficiale di OpenAI per le API
- `html-to-text`: libreria per la conversione da HTML a testo

## 2. Crea le cartelle richieste

Crea le seguenti cartelle che servono per il funzionamento dell'applicazione:

```bash
mkdir -p D:\assistente-biliato\templates
mkdir -p D:\assistente-biliato\generated-docs
```

## 2. Configura l'API key di OpenAI

1. Vai su https://platform.openai.com/api-keys per ottenere la tua API key
2. Modifica il file `.env` nella radice del progetto 
3. Sostituisci "your_openai_api_key_here" con la tua vera API key

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

## 3. Avvia l'applicazione

Dopo aver installato le dipendenze e configurato l'API key, puoi avviare l'applicazione:

```bash
npm start
```

Per avviare in modalità sviluppo con ricaricamento automatico:

```bash
npm run dev
```

## Problemi comuni

### Error: Cannot find module 'moment'

Se ricevi questo errore, è necessario installare il pacchetto `moment` come indicato sopra.

### Error: Configuration Error: "openaiApiKey" is required

Se ricevi questo errore, significa che non hai configurato correttamente l'API key di OpenAI nel file `.env`.

### Error: Request failed with status code 401

Questo indica che la tua API key di OpenAI non è valida o è scaduta. Verifica la chiave su https://platform.openai.com/api-keys.