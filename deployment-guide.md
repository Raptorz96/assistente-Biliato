# Guida al Deployment su Render

Questa guida fornisce istruzioni per il deployment di Assistente Biliato sulla piattaforma Render.

## Prerequisiti

- Un account su [Render](https://render.com/)
- Un repository GitHub con il codice dell'applicazione
- Un account MongoDB Atlas per il database in produzione

## Passaggi per il Deployment

### 1. Preparazione del Database

1. Crea un cluster MongoDB su [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Configura un utente database con le autorizzazioni necessarie
3. Ottieni la stringa di connessione URI

### 2. Deployment su Render

#### Opzione 1: Deployment Automatico (consigliato)

1. Accedi al tuo account Render
2. Vai alla dashboard e clicca su "New +"
3. Seleziona "Web Service"
4. Connetti il tuo repository GitHub
5. Configura il servizio:
   - **Nome**: assistente-biliato (o il nome che preferisci)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run client-install && npm run client-build`
   - **Start Command**: `npm start`
   - **Tipo Piano**: Seleziona un piano appropriato (Free ha limiti di inattività)

6. Aggiungi le variabili d'ambiente:
   - `NODE_ENV`: production
   - `PORT`: 10000 (Render assegna automaticamente la porta esterna)
   - `MONGODB_URI`: [La tua stringa di connessione MongoDB Atlas]
   - `JWT_SECRET`: [Una stringa segreta casuale per JWT]
   - `OPENAI_API_KEY`: [La tua chiave API OpenAI]
   - `API_ENABLED`: true

7. Clicca su "Create Web Service"

#### Opzione 2: Deployment tramite Render Blueprint

Se hai incluso il file `render.yaml` nel tuo repository:

1. Accedi al tuo account Render
2. Vai alla dashboard e clicca su "New +"
3. Seleziona "Blueprint"
4. Connetti il tuo repository GitHub
5. Render riconoscerà il file `render.yaml` e configurerà automaticamente il servizio
6. Dovrai comunque fornire i valori per le variabili d'ambiente contrassegnate con `sync: false`

### 3. Verifica del Deployment

1. Render fornirà un URL per il tuo servizio (es. `https://assistente-biliato.onrender.com`)
2. Apri l'URL nel browser per verificare che l'applicazione funzioni correttamente
3. Controlla il log del servizio su Render per eventuali errori

## Risoluzione dei Problemi

Se riscontri problemi durante il deployment:

1. Controlla i log di build e runtime su Render
2. Verifica che tutte le variabili d'ambiente siano configurate correttamente
3. Assicurati che la connessione al database MongoDB Atlas funzioni
4. Se necessario, effettua modifiche al codice e esegui nuovamente il deployment

## Considerazioni di Produzione

- Configura il monitoraggio e gli avvisi su Render
- Considera l'upgrade a un piano a pagamento per evitare i limiti di inattività del piano gratuito
- Implementa un sistema di backup per il database
- Configura domini personalizzati e certificati SSL se necessario
