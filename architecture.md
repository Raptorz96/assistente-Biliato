# Architettura Tecnica - Assistente Biliato

## 1. Scelte Tecnologiche

### 1.1 Framework e Linguaggi

| Componente | Tecnologia | Motivazione |
|------------|------------|-------------|
| **Backend** | Node.js + Express.js | Eccellente per API REST, ecosistema ricco, supporto asincrono |
| **Frontend** | React.js | Performante, componentizzato, ampio supporto |
| **Mobile** | React Native | Condivisione codice con frontend web |
| **API Communication** | REST + GraphQL (per query complesse) | Compatibilità e flessibilità |
| **Real-time Communication** | Socket.io | Supporto WebSocket per notifiche real-time |

### 1.2 Database

| Database | Uso Primario | Motivazione |
|----------|--------------|-------------|
| **MongoDB** | Storage principale dei dati | Flessibilità schema, ottimo per dati strutturati/semi-strutturati, scalabilità |
| **PostgreSQL** | Dati relazionali critici | ACID compliance, integrità referenziale per dati finanziari |
| **Redis** | Caching, code, pub/sub | Performance, supporto per strutture dati distribuite |
| **MinIO** | Object storage documenti | Compatibile S3, gestione efficiente file binari |
| **Elasticsearch** | Ricerca full-text, logging | Capacità di ricerca avanzata, aggregazioni |

### 1.3 Librerie Specializzate

| Categoria | Librerie | Utilizzo |
|-----------|----------|----------|
| **Document Generation** | Puppeteer, DocxTemplater, PDFKit | Generazione PDF/DOCX dai template |
| **Form Management** | Formik, Yup | Gestione form complessi e validazione |
| **State Management** | Redux Toolkit | Gestione stato applicativo |
| **UI Component** | Material-UI | Design system coerente e accessibile |
| **Data Visualization** | D3.js, Chart.js | Dashboard, reportistica |
| **AI Integration** | LangChain, OpenAI SDK | Integrazione con modelli LLM |
| **Workflow** | Node-RED | Gestione flussi di processo visuale |
| **Integration** | Axios, node-soap, Camel.js | Connessione a sistemi esterni |
| **Authentication** | Passport.js, JWT | Gestione autenticazione e sessioni |

## 2. Diagramma dei Componenti

```
┌─────────────────────────────────────────┐
│            PRESENTATION LAYER           │
│  ┌───────────┐  ┌───────────┐  ┌─────┐  │
│  │ Web App   │  │ Admin     │  │ API │  │
│  │ (React)   │  │ Portal    │  │ Docs│  │
│  └─────┬─────┘  └─────┬─────┘  └──┬──┘  │
└────────┼────────────────┼─────────┼─────┘
         │                │         │      
┌────────┼────────────────┼─────────┼─────┐
│        │   API GATEWAY (Express)   │    │
│        └────────────┬──────────────┘    │
│                     │                    │
│ ┌───────────────────┼──────────────────┐ │
│ │                   │  CORE SERVICES   │ │
│ │  ┌────────────┐ ┌─┴──────────┐       │ │
│ │  │ Auth       │ │ Client     │       │ │
│ │  │ Service    │ │ Service    │       │ │
│ │  └────────────┘ └────────────┘       │ │
│ │                                       │ │
│ │  ┌────────────┐ ┌────────────┐       │ │
│ │  │ Document   │ │ Procedure  │       │ │
│ │  │ Service    │ │ Service    │       │ │
│ │  └────────────┘ └────────────┘       │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │            SUPPORT SERVICES           │ │
│ │  ┌────────────┐ ┌────────────┐       │ │
│ │  │ Workflow   │ │ AI         │       │ │
│ │  │ Engine     │ │ Assistant  │       │ │
│ │  └────────────┘ └────────────┘       │ │
│ │                                       │ │
│ │  ┌────────────┐ ┌────────────┐       │ │
│ │  │ Integration│ │ Notification│      │ │
│ │  │ Hub        │ │ Service    │       │ │
│ │  └────────────┘ └────────────┘       │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
                    │                        
┌───────────────────┼───────────────────────┐
│                   ▼                        │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│ │ MongoDB │ │PostgreSQL│ │ Redis   │       │
│ └─────────┘ └─────────┘ └─────────┘       │
│                                           │
│ ┌─────────┐ ┌─────────┐                   │
│ │ MinIO   │ │ElasticSch│                  │
│ └─────────┘ └─────────┘                   │
│               DATA LAYER                   │
└───────────────────────────────────────────┘
                    │                        
┌───────────────────┼───────────────────────┐
│   EXTERNAL INTEGRATIONS                    │
│                                           │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │   ERP   │ │ Document │ │Calendar │      │
│ │ Systems │ │ Signing  │ │Services │      │
│ └─────────┘ └─────────┘ └─────────┘      │
└───────────────────────────────────────────┘
```

## 3. Schema del Database

### 3.1 MongoDB Collections

#### Users Collection
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  passwordHash: String,
  firstName: String,
  lastName: String,
  role: String,          // 'admin', 'operator', 'customer'
  permissions: [String], // array of permission codes
  status: String,        // 'active', 'inactive', 'suspended'
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Clients Collection
```javascript
{
  _id: ObjectId,
  name: String,
  fiscalCode: String,
  vatNumber: String,
  companyType: String,   // 'Individual', 'Partnership', 'Corporation', 'LLC'
  contactInfo: {
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String,
      country: String
    }
  },
  legalRepresentative: {
    firstName: String,
    lastName: String,
    fiscalCode: String,
    role: String
  },
  onboarding: {
    status: String,      // 'new', 'in_progress', 'completed'
    startDate: Date,
    completedDate: Date,
    assignedTo: ObjectId,// reference to Users
    checklist: [
      {
        documentId: String,
        name: String,
        required: Boolean,
        status: String,   // 'pending', 'uploaded', 'verified', 'rejected'
        uploadedAt: Date,
        verifiedAt: Date
      }
    ]
  },
  services: [String],    // array of service codes
  notes: String,
  tags: [String],
  externalIds: {
    erpId: String,
    legacyId: String
  },
  dataConsent: {
    marketing: Boolean,
    thirdParty: Boolean,
    consentDate: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Documents Collection
```javascript
{
  _id: ObjectId,
  clientId: ObjectId,    // reference to Clients
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number,
  path: String,          // path in MinIO/S3
  category: String,      // 'identity', 'fiscal', 'contract', etc.
  tags: [String],
  metadata: {            // extracted metadata
    docType: String,
    issueDate: Date,
    expiryDate: Date,
    extractedData: Object// dynamic structure based on document type
  },
  status: String,        // 'pending', 'processed', 'verified'
  processingResults: {
    confidence: Number,
    errors: [String]
  },
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId    // reference to Users
}
```

#### Templates Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String,      // 'welcome', 'contract', 'report', etc.
  format: String,        // 'html', 'docx', 'pdf'
  content: String,       // HTML or Base64-encoded binary
  variables: [String],   // list of variables used in template
  version: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId    // reference to Users
}
```

#### Procedures Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  clientType: String,    // target client type
  tasks: [
    {
      name: String,
      description: String,
      dueOffset: Number, // days from procedure start
      assignedRole: String,
      requiredDocuments: [String],
      reminderDays: [Number],// reminder days before due
      steps: [String]
    }
  ],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### ClientProcedures Collection
```javascript
{
  _id: ObjectId,
  clientId: ObjectId,    // reference to Clients
  procedureId: ObjectId, // reference to Procedures
  startDate: Date,
  expectedEndDate: Date,
  status: String,        // 'active', 'completed', 'on_hold'
  tasks: [
    {
      taskId: String,
      name: String,
      assignedTo: ObjectId,// reference to Users
      status: String,    // 'pending', 'in_progress', 'completed'
      dueDate: Date,
      completedDate: Date,
      notes: String,
      attachments: [ObjectId]// references to Documents
    }
  ],
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 PostgreSQL Schema

#### users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  auth_id VARCHAR(255) UNIQUE,  -- reference to MongoDB user
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### audit_logs Table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### integration_jobs Table
```sql
CREATE TABLE integration_jobs (
  id SERIAL PRIMARY KEY,
  integration_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  payload JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 4. API Principali

### 4.1 Autenticazione e Utenti

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/auth/login` | POST | Autenticazione utente | `email`, `password` |
| `/api/auth/refresh` | POST | Refresh token | `refreshToken` |
| `/api/auth/logout` | POST | Logout utente | `token` |
| `/api/users` | GET | Lista utenti | `page`, `limit`, `role` |
| `/api/users/:id` | GET | Dettaglio utente | - |
| `/api/users` | POST | Crea utente | `email`, `password`, `role`, etc. |
| `/api/users/:id` | PUT | Aggiorna utente | vari campi |

### 4.2 Gestione Clienti

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/clients` | GET | Lista clienti | `page`, `limit`, `status` |
| `/api/clients/:id` | GET | Dettaglio cliente | - |
| `/api/clients` | POST | Crea cliente | vari campi anagrafici |
| `/api/clients/:id` | PUT | Aggiorna cliente | vari campi |
| `/api/clients/:id/onboarding/status` | PUT | Aggiorna stato onboarding | `status` |
| `/api/clients/:id/documents/checklist` | GET | Ottieni checklist documenti | - |
| `/api/clients/:id/documents` | GET | Lista documenti cliente | `category`, `status` |

### 4.3 Gestione Documenti

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/documents/upload` | POST | Upload documento | `file`, `clientId`, `category` |
| `/api/documents/:id` | GET | Ottieni documento | - |
| `/api/documents/:id/metadata` | GET | Ottieni metadata | - |
| `/api/documents/generate/pdf` | POST | Genera PDF | `templateId`, `data` |
| `/api/documents/generate/docx` | POST | Genera DOCX | `templateId`, `data` |
| `/api/templates` | GET | Lista template | `format`, `category` |
| `/api/templates/:id` | GET | Ottieni template | - |
| `/api/templates` | POST | Crea template | `name`, `content`, etc. |

### 4.4 Procedure e Workflow

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/procedures` | GET | Lista procedure | `clientType` |
| `/api/procedures/:id` | GET | Ottieni procedura | - |
| `/api/procedures` | POST | Crea procedura | `name`, `tasks`, etc. |
| `/api/clients/:id/procedures` | GET | Procedure del cliente | `status` |
| `/api/clients/:id/procedures` | POST | Assegna procedura | `procedureId` |
| `/api/clients/:id/procedures/:procId/tasks/:taskId` | PUT | Aggiorna task | `status`, `notes` |
| `/api/tasks/assigned` | GET | Task assegnati | `status`, `dueDate` |

### 4.5 AI Assistant

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/assistant/ask` | POST | Poni domanda | `question`, `clientId` |
| `/api/assistant/suggest` | POST | Ottieni suggerimenti | `clientId`, `context` |
| `/api/assistant/analyze` | POST | Analizza documento | `documentId` |
| `/api/assistant/generate/procedure` | POST | Genera procedura | `clientId` |

### 4.6 Integrazioni

| Endpoint | Metodo | Descrizione | Parametri |
|----------|--------|-------------|-----------|
| `/api/integrations/erp/sync` | POST | Sincronizza con ERP | `clientId`, `direction` |
| `/api/integrations/erp/clients` | GET | Lista clienti ERP | `query` |
| `/api/integrations/signing/prepare` | POST | Prepara documenti per firma | `documentIds`, `signers` |
| `/api/integrations/signing/status/:id` | GET | Stato firma documento | - |

## 5. Integrazione con Servizi Esterni

### 5.1 Sistemi ERP/Contabilità

#### 5.1.1 TeamSystem
- **Modalità di integrazione**: REST API + SFTP per documenti
- **Dati sincronizzati**:
  - Anagrafica clienti (bidirezionale)
  - Documenti fiscali (da ERP verso assistente)
  - Stato pratiche (da assistente verso ERP)
- **Frequenza sincronizzazione**: Automatica (ogni 6 ore) + trigger manuale
- **Strategia gestione conflitti**: Flag di "owner" del dato + notifica in caso di conflitto

#### 5.1.2 Zucchetti
- **Modalità di integrazione**: SOAP Web Services
- **Dati sincronizzati**:
  - Anagrafica clienti (bidirezionale)
  - Documenti fiscali (da ERP verso assistente)
- **Autenticazione**: Certificato client + credenziali
- **Gestione errori**: Retry con backoff esponenziale + notifica fallimenti

### 5.2 Servizi Firma Digitale

#### 5.2.1 InfoCert
- **Modalità integrazione**: REST API
- **Funzionalità**:
  - Invio documenti per firma
  - Verifica stato firma
  - Recupero documenti firmati
  - Validazione firme
- **Flusso di firma**:
  1. Preparazione documento (aggiunta campi firma)
  2. Invio a InfoCert
  3. Notifica email al firmatario
  4. Webhook per aggiornamento stato
  5. Recupero documento firmato

#### 5.2.2 Namirial
- **Modalità integrazione**: REST API
- **Funzionalità**:
  - Firma remota
  - Firma automatica
  - Verifica validità firma
- **Autenticazione**: OAuth2

### 5.3 Servizi AI e NLP

#### 5.3.1 OpenAI
- **Modelli utilizzati**:
  - GPT-4 per assistenza avanzata e generazione procedure
  - GPT-3.5-turbo per classificazione documenti
  - Embedding per ricerca semantica
- **Integrazioni principali**:
  - Generazione procedure personalizzate
  - Estrazione dati da documenti
  - Risposta a domande fiscali/contabili
  - Suggerimenti proattivi

#### 5.3.2 OCR e Document Processing
- **Servizio**: Azure Form Recognizer / Google Document AI
- **Funzionalità**:
  - Estrazione dati da documenti fiscali (fatture, bilanci)
  - Classificazione automatica documenti
  - Validazione dati estratti
- **Integrazione**: API REST con pre-elaborazione locale

### 5.4 Servizi Email e Notifiche

#### 5.4.1 SendGrid / Mailgun
- **Funzionalità**:
  - Email transazionali
  - Template HTML personalizzati
  - Tracciamento aperture e click
- **Eventi tracciati**:
  - Onboarding cliente
  - Richiesta documenti
  - Notifiche scadenze
  - Aggiornamenti stato procedure

#### 5.4.2 Firebase Cloud Messaging
- **Funzionalità**:
  - Notifiche push per app mobile
  - Badge e contatori
- **Eventi notificati**:
  - Nuovi task assegnati
  - Documenti in scadenza
  - Approvazioni richieste