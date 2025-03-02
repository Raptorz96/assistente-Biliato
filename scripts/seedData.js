/**
 * Script di popolamento database con dati di esempio
 * 
 * Questo script genera dati realistici per uno studio commercialista italiano,
 * creando utenti, clienti, template di documenti, procedure standard e assegnazioni.
 * 
 * Utilizzo:
 *   node scripts/seedData.js [opzioni]
 * 
 * Opzioni:
 *   --env                Specifica l'ambiente (development, test, production)
 *   --preserve-users     Mantiene gli utenti esistenti
 *   --clients-only       Rigenera solo i clienti
 *   --yes                Conferma automaticamente senza prompt
 *   --help               Mostra l'help
 */
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker/locale/it');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

// Importa i modelli
const User = require('../src/models/User');
const Client = require('../src/models/Client');
const Document = require('../src/models/Document');
const Template = require('../src/models/Template');
const Procedure = require('../src/models/Procedure');
const ClientProcedure = require('../src/models/ClientProcedure');

// Importa la configurazione del database
const { connectDB } = require('../config/database');

// Utilità per generare codici fiscali validi
const generateValidFiscalCode = (firstName, lastName, birthDate, gender, birthPlace) => {
  // Implementazione semplificata ma realistica di un generatore di CF
  // In un'app reale si userebbe una libreria specializzata
  
  // Estrai consonanti dal cognome
  const getConsonants = (str) => str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  // Estrai vocali dalla stringa
  const getVowels = (str) => str.toUpperCase().replace(/[^AEIOU]/g, '');
  
  // Gestisci nome e cognome
  let lastNameCode = getConsonants(lastName);
  if (lastNameCode.length >= 3) {
    lastNameCode = lastNameCode.substring(0, 3);
  } else {
    lastNameCode += getVowels(lastName);
    lastNameCode = lastNameCode.padEnd(3, 'X').substring(0, 3);
  }
  
  let firstNameCode = getConsonants(firstName);
  if (firstNameCode.length > 3) {
    firstNameCode = firstNameCode[0] + firstNameCode[2] + firstNameCode[3];
  } else if (firstNameCode.length >= 3) {
    firstNameCode = firstNameCode.substring(0, 3);
  } else {
    firstNameCode += getVowels(firstName);
    firstNameCode = firstNameCode.padEnd(3, 'X').substring(0, 3);
  }
  
  // Anno, mese e giorno di nascita
  const year = birthDate.getFullYear().toString().substr(2, 2);
  
  // Codice del mese (da A a T)
  const monthCodes = 'ABCDEHLMPRST';
  const month = monthCodes[birthDate.getMonth()];
  
  // Giorno di nascita (per le femmine si aggiunge 40)
  let day = birthDate.getDate();
  if (gender === 'F') day += 40;
  day = day.toString().padStart(2, '0');
  
  // Codice del comune/stato estero (semplificato)
  // In un'app reale si userebbe un database dei codici catastali
  let placeCode;
  
  // Liste di codici catastali reali di comuni italiani
  const realComuniCodes = [
    'A271', 'F205', 'H501', 'L219', 'L736', 'F839', 'D969', 'A944', 'H294', 'G273',
    'A662', 'C351', 'E063', 'L682', 'L378', 'D612', 'F952', 'G337', 'L049', 'L781'
  ];
  
  placeCode = birthPlace || faker.helpers.arrayElement(realComuniCodes);
  
  // Carattere di controllo (semplificato)
  // In un'app reale si implementerebbe l'algoritmo completo
  const controlChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const controlChar = controlChars[Math.floor(Math.random() * controlChars.length)];
  
  return `${lastNameCode}${firstNameCode}${year}${month}${day}${placeCode}${controlChar}`;
};

// Utilità per generare partite IVA valide
const generateValidVatNumber = () => {
  // Le partite IVA italiane sono composte da 11 cifre
  let vatNumber = '';
  
  // Prime 7 cifre (numero progressivo)
  for (let i = 0; i < 7; i++) {
    vatNumber += Math.floor(Math.random() * 10);
  }
  
  // 3 cifre per il codice dell'ufficio provinciale
  // Userò codici provinciali reali
  const provinceCodes = ['001', '002', '003', '004', '005', '006', '007', '008', '009', 
                         '010', '011', '012', '013', '014', '015', '016', '017', '018'];
  vatNumber += faker.helpers.arrayElement(provinceCodes);
  
  // Calcolo cifra di controllo (algoritmo semplificato)
  // In un'app reale si implementerebbe l'algoritmo completo
  vatNumber += Math.floor(Math.random() * 10);
  
  return vatNumber;
};

// Funzione per generare indirizzi italiani realistici
const generateItalianAddress = () => {
  // Tipi di vie reali italiane
  const streetTypes = ['Via', 'Viale', 'Piazza', 'Corso', 'Largo', 'Vicolo', 'Borgo', 'Lungomare'];
  
  // Nomi di vie comuni in Italia
  const streetNames = [
    'Roma', 'Dante', 'Garibaldi', 'Vittorio Emanuele', 'Mazzini', 'Cavour', 
    'XX Settembre', 'Marconi', 'Leonardo da Vinci', 'Giuseppe Verdi', 
    'Michelangelo', 'Galileo Galilei', 'Alessandro Manzoni', 'Cristoforo Colombo'
  ];
  
  // Città italiane reali
  const cities = [
    'Milano', 'Roma', 'Napoli', 'Torino', 'Bologna', 'Firenze', 'Bari', 
    'Palermo', 'Catania', 'Venezia', 'Genova', 'Verona', 'Padova', 'Brescia'
  ];
  
  // Province italiane reali (con codice provincia)
  const provinces = [
    'MI', 'RM', 'NA', 'TO', 'BO', 'FI', 'BA', 'PA', 'CT', 'VE', 'GE', 'VR', 'PD', 'BS'
  ];
  
  // CAP reali corrispondenti alle città
  const postalCodes = {
    'Milano': '201', 'Roma': '001', 'Napoli': '801', 'Torino': '101', 
    'Bologna': '401', 'Firenze': '501', 'Bari': '701', 'Palermo': '901', 
    'Catania': '951', 'Venezia': '301', 'Genova': '161', 'Verona': '371', 
    'Padova': '351', 'Brescia': '251'
  };
  
  const streetType = faker.helpers.arrayElement(streetTypes);
  const streetName = faker.helpers.arrayElement(streetNames);
  const streetNumber = faker.number.int({ min: 1, max: 200 });
  
  const city = faker.helpers.arrayElement(cities);
  const province = provinces[cities.indexOf(city)];
  
  // Genera un CAP realistico
  let postalCode = postalCodes[city];
  postalCode += faker.number.int({ min: 10, max: 99 }).toString();
  
  return {
    street: `${streetType} ${streetName}, ${streetNumber}`,
    city: city,
    province: province,
    postalCode: postalCode
  };
};

// Database di nomi e cognomi italiani reali
const italianFirstNames = [
  'Marco', 'Giuseppe', 'Antonio', 'Giovanni', 'Francesco', 'Mario', 'Luigi', 'Roberto',
  'Paolo', 'Salvatore', 'Alessandro', 'Andrea', 'Vincenzo', 'Pietro', 'Domenico',
  'Maria', 'Anna', 'Giovanna', 'Giuseppina', 'Rosa', 'Angela', 'Teresa', 'Lucia',
  'Carmela', 'Francesca', 'Caterina', 'Elena', 'Patrizia', 'Luisa', 'Sofia'
];

const italianLastNames = [
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci',
  'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano',
  'Mancini', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani',
  'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile'
];

// Configura le opzioni del comando
program
  .option('-e, --env <environment>', 'Specifica l\'ambiente (development, test, production)', 'development')
  .option('-p, --preserve-users', 'Mantieni gli utenti esistenti')
  .option('-c, --clients-only', 'Rigenera solo i clienti')
  .option('-y, --yes', 'Conferma automaticamente senza prompt')
  .parse(process.argv);

const options = program.opts();

// Configurazione del database in base all'ambiente
const setupDatabaseConfig = () => {
  if (options.env) {
    process.env.NODE_ENV = options.env;
    console.log(chalk.blue(`Ambiente impostato: ${options.env}`));
  }
};

// Generatori di dati
const dataGenerators = {
  // Genera utenti con ruoli diversi
  generateUsers: async () => {
    console.log(chalk.yellow('🧑 Generazione utenti...'));
    
    const roles = ['admin', 'operator', 'customer'];
    const permissions = {
      admin: ['manage_users', 'manage_clients', 'manage_procedures', 'manage_templates', 'view_analytics'],
      operator: ['manage_clients', 'manage_procedures', 'view_analytics'],
      customer: ['view_documents', 'view_procedures']
    };
    
    const usersData = [
      {
        username: 'admin',
        email: 'admin@studiobiliato.it',
        passwordHash: '$2a$10$XH1jxkED3Z3wSRRxlJChUu9vwkO3N6RhXQSaQPABC2QVpGQH8uPHW', // password: admin123
        firstName: 'Mario',
        lastName: 'Rossi',
        role: 'admin',
        permissions: permissions.admin,
        status: 'active',
        lastLogin: new Date()
      },
      {
        username: 'operatore',
        email: 'operatore@studiobiliato.it',
        passwordHash: '$2a$10$A6H8IxOzP1QQ2kMA6aR5/OplGvJkGrHhk9pYv0h03IPO5pIGD6iRK', // password: operatore123
        firstName: 'Giuseppe',
        lastName: 'Verdi',
        role: 'operator',
        permissions: permissions.operator,
        status: 'active',
        lastLogin: faker.date.recent()
      },
      {
        username: 'cliente',
        email: 'cliente@esempio.it',
        passwordHash: '$2a$10$3BdR4iYFBQIRJ5ePo7KJ.eUNPrF8QwbvWvZ9G9xfQQSFtCuoJ7W5m', // password: cliente123
        firstName: 'Anna',
        lastName: 'Bianchi',
        role: 'customer',
        permissions: permissions.customer,
        status: 'active',
        lastLogin: faker.date.recent()
      }
    ];
    
    const users = await User.create(usersData);
    console.log(chalk.green(`✅ Creati ${users.length} utenti`));
    return users;
  },
  
  // Genera clienti con diversi profili fiscali
  generateClients: async (users) => {
    console.log(chalk.yellow('🏢 Generazione clienti...'));
    
    const companyTypes = [
      'Ditta Individuale', 
      'S.r.l.', 
      'S.p.A.', 
      'S.n.c.', 
      'S.a.s.',
      'Persona Fisica'
    ];
    
    const accountingRegimes = ['Ordinario', 'Semplificato', 'Forfettario'];
    const businessSectors = [
      'Commercio', 
      'Servizi', 
      'Edilizia', 
      'IT', 
      'Turismo', 
      'Agricoltura',
      'Manifatturiero',
      'Libero Professionista'
    ];
    
    const clients = [];
    
    for (let i = 0; i < 10; i++) {
      const isCompany = faker.datatype.boolean(0.7); // 70% è azienda
      const companyType = isCompany ? 
        faker.helpers.arrayElement(companyTypes.filter(t => t !== 'Persona Fisica')) : 
        'Persona Fisica';
      
      // Usa nomi italiani realistici
      const firstName = faker.helpers.arrayElement(italianFirstNames);
      const lastName = faker.helpers.arrayElement(italianLastNames);
      
      const companyName = isCompany ? 
        (companyType === 'Ditta Individuale' ? 
          `${firstName} ${lastName}` : 
          `${lastName} ${companyType}`) : 
        `${firstName} ${lastName}`;
      
      // Genera data di nascita realistica per adulti
      const birthDate = faker.date.birthdate({ min: 25, max: 70, mode: 'age' });
      
      // Genera codice fiscale valido
      const gender = faker.helpers.arrayElement(['M', 'F']);
      const fiscalCode = generateValidFiscalCode(firstName, lastName, birthDate, gender);
      
      // Solo le aziende hanno partita IVA
      const vatNumber = isCompany ? generateValidVatNumber() : undefined;
      
      // Genera indirizzo italiano realistico
      const address = generateItalianAddress();
      
      const client = {
        name: companyName,
        fiscalCode: fiscalCode,
        vatNumber: vatNumber,
        companyType: companyType,
        contactInfo: {
          email: faker.internet.email({ firstName: firstName.toLowerCase(), lastName: lastName.toLowerCase() }),
          phone: faker.helpers.arrayElement(['+39 ', '']) + 
                 (faker.helpers.arrayElement(['02', '06', '011', '081', '051', '055', '071', '049', '091', '040', '010', '333', '334', '335', '336', '337', '338', '339', '320', '328', '329', '348', '349', '330', '331', '340', '345']) + 
                 faker.string.numeric({ length: { min: 6, max: 7 }})),
          address: address
        },
        legalRepresentative: {
          firstName: firstName,
          lastName: lastName,
          fiscalCode: fiscalCode
        },
        businessSector: faker.helpers.arrayElement(businessSectors),
        accountingRegime: faker.helpers.arrayElement(accountingRegimes),
        onboarding: {
          status: faker.helpers.arrayElement(['completed', 'in_progress', 'pending']),
          startDate: faker.date.past({ years: 1 }),
          completedDate: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.7 })
        },
        services: []
      };
      
      // Aggiungi servizi random
      const availableServices = [
        'Contabilità', 
        'Dichiarazione dei Redditi', 
        'Consulenza Fiscale', 
        'Buste Paga', 
        'Bilancio',
        'F24',
        'Fatturazione Elettronica',
        'Gestione Cespiti'
      ];
      
      const servicesCount = faker.number.int({ min: 1, max: 4 });
      const selectedServices = faker.helpers.arrayElements(availableServices, servicesCount);
      
      client.services = selectedServices.map(service => ({
        name: service,
        active: true,
        startDate: faker.date.past({ years: 1 }),
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 })
      }));
      
      clients.push(client);
    }
    
    const savedClients = await Client.create(clients);
    console.log(chalk.green(`✅ Creati ${savedClients.length} clienti`));
    return savedClients;
  },
  
  // Genera template per vari tipi di documenti
  generateTemplates: async (users) => {
    console.log(chalk.yellow('📝 Generazione template...'));
    
    const adminUser = users.find(user => user.role === 'admin');
    
    const templateCategories = [
      'welcome',
      'contract',
      'report',
      'invoice',
      'tax',
      'privacy'
    ];
    
    const templateFormats = ['html', 'docx', 'pdf'];
    
    // Template HTML realistico per lettera di benvenuto
    const welcomeTemplateContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Benvenuto in Studio Biliato</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { text-align: center; color: #2c3e50; margin-bottom: 2em; }
    .footer { margin-top: 2em; font-size: 0.9em; color: #7f8c8d; }
    .highlight { color: #3498db; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Studio Biliato</h1>
    <h2>Commercialisti Associati</h2>
  </div>
  
  <p>Gentile {{client.name}},</p>
  
  <p>Siamo lieti di darle il benvenuto come cliente del nostro Studio. 
  La ringraziamo per aver scelto i nostri servizi di consulenza contabile e fiscale.</p>
  
  <p>Il suo consulente dedicato sarà <span class="highlight">{{user.firstName}} {{user.lastName}}</span>, 
  che la contatterà a breve per fissare un incontro iniziale e discutere in dettaglio le sue esigenze.</p>
  
  <p>Di seguito un riepilogo dei servizi attivati:</p>
  <ul>
    {{#each client.services}}
    <li>{{this.name}}</li>
    {{/each}}
  </ul>
  
  <p>Per qualsiasi domanda o necessità, non esiti a contattarci:</p>
  <ul>
    <li>Email: info@studiobiliato.it</li>
    <li>Telefono: 02 1234567</li>
  </ul>
  
  <p>Cordiali saluti,<br>
  Lo Staff di Studio Biliato</p>
  
  <div class="footer">
    <p>Studio Biliato Commercialisti Associati<br>
    Via Milano 123, 20100 Milano<br>
    P.IVA: IT12345678901</p>
  </div>
</body>
</html>`;

    // Template per contratto di servizio
    const contractTemplateContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contratto di Servizio</title>
  <style>
    body { font-family: Times New Roman, serif; line-height: 1.5; }
    h1 { text-align: center; }
    .clause { margin-bottom: 1em; }
    .signatures { margin-top: 3em; display: flex; justify-content: space-between; }
    .signature-line { border-top: 1px solid black; width: 200px; text-align: center; }
  </style>
</head>
<body>
  <h1>CONTRATTO DI SERVIZIO</h1>
  
  <p><strong>TRA</strong></p>
  <p>Studio Biliato Commercialisti Associati, con sede in Via Milano 123, 20100 Milano, 
  P.IVA IT12345678901, in persona del legale rappresentante pro tempore, di seguito denominato "Studio"</p>
  
  <p><strong>E</strong></p>
  <p>{{client.name}}, {{#if client.vatNumber}}P.IVA {{client.vatNumber}}, {{/if}}con sede in 
  {{client.contactInfo.address.street}}, {{client.contactInfo.address.postalCode}} {{client.contactInfo.address.city}}, 
  di seguito denominato "Cliente"</p>
  
  <div class="clause">
    <h3>1. OGGETTO</h3>
    <p>Il presente contratto ha per oggetto la fornitura dei seguenti servizi professionali:</p>
    <ul>
      {{#each client.services}}
      <li>{{this.name}}</li>
      {{/each}}
    </ul>
  </div>
  
  <div class="clause">
    <h3>2. DURATA</h3>
    <p>Il presente contratto ha durata annuale con decorrenza dalla data di sottoscrizione e si rinnoverà tacitamente 
    per periodi di uguale durata salvo disdetta da comunicarsi con preavviso di almeno 30 giorni.</p>
  </div>
  
  <div class="clause">
    <h3>3. COMPENSI</h3>
    <p>Per i servizi di cui all'art. 1, il Cliente corrisponderà allo Studio i compensi come da preventivo allegato, 
    oltre IVA, CPA e spese documentate.</p>
  </div>
  
  <div class="signatures">
    <div>
      <div class="signature-line">Studio Biliato</div>
    </div>
    <div>
      <div class="signature-line">Il Cliente</div>
    </div>
  </div>
</body>
</html>`;

    // Template per informativa privacy
    const privacyTemplateContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Informativa sulla Privacy</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    h1 { text-align: center; }
    .section { margin-bottom: 1.5em; }
  </style>
</head>
<body>
  <h1>INFORMATIVA SULLA PRIVACY</h1>
  <p>Ai sensi dell'art. 13 del Regolamento UE 2016/679</p>
  
  <div class="section">
    <h3>1. Titolare del trattamento</h3>
    <p>Studio Biliato Commercialisti Associati, con sede in Via Milano 123, 20100 Milano, 
    email: privacy@studiobiliato.it, è il Titolare del trattamento dei dati personali.</p>
  </div>
  
  <div class="section">
    <h3>2. Dati oggetto del trattamento</h3>
    <p>I dati personali trattati sono quelli forniti dall'interessato in occasione di:</p>
    <ul>
      <li>visite presso lo studio;</li>
      <li>interazioni attraverso il sito internet;</li>
      <li>richieste di informazioni, anche via mail;</li>
      <li>precedenti transazioni.</li>
    </ul>
  </div>
  
  <div class="section">
    <h3>3. Finalità del trattamento</h3>
    <p>I dati personali sono trattati per le seguenti finalità:</p>
    <ul>
      <li>adempimento di obblighi contrattuali;</li>
      <li>adempimento di obblighi fiscali e contabili;</li>
      <li>gestione dei clienti e amministrazione.</li>
    </ul>
  </div>
  
  <div class="section">
    <h3>4. Consenso</h3>
    <p>Il Cliente {{client.name}}, dichiara di aver ricevuto l'informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 e acconsente al trattamento dei propri dati personali per le finalità indicate.</p>
  </div>
  
  <div class="section">
    <p>Luogo e data _________________________</p>
    <p>Firma _________________________</p>
  </div>
</body>
</html>`;

    // Genera template di esempio
    const templatesData = [
      {
        name: 'Lettera di Benvenuto',
        description: 'Template per la lettera di benvenuto ai nuovi clienti',
        category: 'welcome',
        format: 'html',
        content: welcomeTemplateContent,
        createdBy: adminUser._id,
        variables: ['client.name', 'user.firstName', 'user.lastName', 'client.services'],
        version: 1,
        isActive: true,
        metadata: {
          author: 'Studio Biliato',
          lastModified: new Date()
        },
        previewImage: '/images/templates/welcome-preview.png'
      },
      {
        name: 'Contratto di Servizio',
        description: 'Template per il contratto standard di fornitura servizi',
        category: 'contract',
        format: 'html',
        content: contractTemplateContent,
        createdBy: adminUser._id,
        variables: ['client.name', 'client.vatNumber', 'client.contactInfo.address', 'client.services'],
        version: 1,
        isActive: true,
        metadata: {
          author: 'Ufficio Legale',
          lastModified: new Date()
        },
        previewImage: '/images/templates/contract-preview.png'
      },
      {
        name: 'Informativa Privacy',
        description: 'Template per l\'informativa sulla privacy e trattamento dati',
        category: 'privacy',
        format: 'html',
        content: privacyTemplateContent,
        createdBy: adminUser._id,
        variables: ['client.name'],
        version: 1,
        isActive: true,
        metadata: {
          author: 'Ufficio Legale',
          lastModified: new Date()
        },
        previewImage: '/images/templates/privacy-preview.png'
      }
    ];
    
    // Aggiungi 2 template aggiuntivi con dati più semplici
    for (let i = 0; i < 2; i++) {
      const category = faker.helpers.arrayElement(templateCategories);
      const format = faker.helpers.arrayElement(templateFormats);
      
      templatesData.push({
        name: `Template ${faker.word.adjective()} ${category}`,
        description: faker.lorem.sentence(),
        category,
        format,
        content: faker.lorem.paragraphs(3),
        createdBy: users[faker.number.int({ min: 0, max: users.length - 1 })]._id,
        variables: ['client.name', 'client.fiscalCode'],
        version: 1,
        isActive: faker.datatype.boolean(0.8),
        metadata: {
          author: faker.helpers.arrayElement(italianFirstNames) + ' ' + faker.helpers.arrayElement(italianLastNames),
          lastModified: faker.date.recent()
        }
      });
    }
    
    const templates = await Template.create(templatesData);
    console.log(chalk.green(`✅ Creati ${templates.length} template`));
    return templates;
  },
  
  // Genera procedure standard
  generateProcedures: async () => {
    console.log(chalk.yellow('⚙️ Generazione procedure standard...'));
    
    const proceduresData = [
      {
        name: 'Onboarding Cliente',
        description: 'Procedura standard per l\'accoglienza di un nuovo cliente',
        clientType: 'all',
        isActive: true,
        tasks: [
          {
            name: 'Raccolta documentazione iniziale',
            dueOffset: 3, // 3 giorni dalla data di inizio
            assignedRole: 'operator',
            requiredDocuments: ['Documento d\'identità', 'Codice Fiscale', 'Visura camerale'],
            reminderDays: [1, 2],
            steps: [
              'Richiedere documenti via email',
              'Verificare completezza documenti',
              'Caricare documenti nel sistema'
            ]
          },
          {
            name: 'Incontro conoscitivo',
            dueOffset: 7,
            assignedRole: 'operator',
            requiredDocuments: [],
            reminderDays: [1, 3, 5],
            steps: [
              'Fissare appuntamento',
              'Preparare checklist informazioni',
              'Condurre incontro',
              'Redigere verbale'
            ]
          },
          {
            name: 'Configurazione servizi',
            dueOffset: 10,
            assignedRole: 'admin',
            requiredDocuments: ['Contratto firmato'],
            reminderDays: [2, 5, 8],
            steps: [
              'Definire pacchetto servizi',
              'Preparare contratto',
              'Attivare accessi ai sistemi'
            ]
          }
        ]
      },
      {
        name: 'Apertura Partita IVA',
        description: 'Procedura per l\'apertura di nuova partita IVA',
        clientType: 'all',
        isActive: true,
        tasks: [
          {
            name: 'Consulenza iniziale',
            dueOffset: 3,
            assignedRole: 'admin',
            requiredDocuments: ['Documento d\'identità', 'Codice Fiscale'],
            reminderDays: [1, 2],
            steps: [
              'Analizzare attività da svolgere',
              'Consigliare regime fiscale ottimale',
              'Determinare codice ATECO',
              'Stimare carichi fiscali'
            ]
          },
          {
            name: 'Preparazione documenti',
            dueOffset: 7,
            assignedRole: 'operator',
            requiredDocuments: [],
            reminderDays: [2, 5],
            steps: [
              'Compilare modello AA9/12 (persona fisica) o AA7/10 (società)',
              'Predisporre atto costitutivo se società',
              'Preparare eventuale SCIA o autorizzazioni'
            ]
          },
          {
            name: 'Invio pratiche e attivazione',
            dueOffset: 14,
            assignedRole: 'admin',
            requiredDocuments: ['Modulistica firmata', 'Ricevute di pagamento diritti'],
            reminderDays: [3, 7, 10],
            steps: [
              'Presentare pratica all\'Agenzia delle Entrate',
              'Comunicare apertura alla Camera di Commercio se necessario',
              'Attivare registrazioni INPS/INAIL se necessario',
              'Comunicare dati finali al cliente'
            ]
          }
        ]
      },
      {
        name: 'Costituzione SRL',
        description: 'Procedura per la costituzione di una società a responsabilità limitata',
        clientType: 'company',
        isActive: true,
        tasks: [
          {
            name: 'Consulenza preliminare',
            dueOffset: 5,
            assignedRole: 'admin',
            requiredDocuments: ['Documento d\'identità soci', 'Codice Fiscale soci'],
            reminderDays: [2, 4],
            steps: [
              'Analizzare struttura societaria',
              'Definire oggetto sociale',
              'Valutare opzioni di capitale sociale',
              'Preparare piano economico preliminare'
            ]
          },
          {
            name: 'Redazione atto costitutivo e statuto',
            dueOffset: 15,
            assignedRole: 'admin',
            requiredDocuments: [],
            reminderDays: [5, 10],
            steps: [
              'Redigere statuto sociale',
              'Preparare atto costitutivo',
              'Condividere bozze con i soci',
              'Finalizzare documenti per il notaio'
            ]
          },
          {
            name: 'Costituzione e registrazione',
            dueOffset: 30,
            assignedRole: 'admin',
            requiredDocuments: ['Versamento capitale sociale', 'Ricevuta diritti camerali'],
            reminderDays: [10, 20, 25],
            steps: [
              'Assistere alla stipula presso notaio',
              'Richiedere partita IVA',
              'Registrare la società alla CCIAA',
              'Attivare regimi fiscali e previdenziali'
            ]
          },
          {
            name: 'Setup contabilità',
            dueOffset: 45,
            assignedRole: 'operator',
            requiredDocuments: [],
            reminderDays: [5, 10],
            steps: [
              'Configurare software contabilità',
              'Impostare piano dei conti',
              'Formare amministratori sui sistemi',
              'Programmare prime scadenze fiscali'
            ]
          }
        ]
      },
      {
        name: 'Dichiarazione dei Redditi Persona Fisica',
        description: 'Procedura per la gestione della dichiarazione dei redditi per persone fisiche',
        clientType: 'individual',
        isActive: true,
        tasks: [
          {
            name: 'Raccolta documentazione fiscale',
            dueOffset: 30,
            assignedRole: 'operator',
            requiredDocuments: ['CU', 'Spese detraibili', 'F24 acconti versati'],
            reminderDays: [7, 15, 25],
            steps: [
              'Inviare checklist documenti necessari',
              'Verificare ricezione di tutti i documenti',
              'Organizzare documenti per categoria'
            ]
          },
          {
            name: 'Elaborazione dichiarazione',
            dueOffset: 45,
            assignedRole: 'operator',
            requiredDocuments: [],
            reminderDays: [5, 10],
            steps: [
              'Inserimento dati nel software',
              'Calcolo imposte',
              'Verifica detrazioni e deduzioni'
            ]
          },
          {
            name: 'Revisione e invio',
            dueOffset: 60,
            assignedRole: 'admin',
            requiredDocuments: [],
            reminderDays: [3, 7],
            steps: [
              'Controllo dichiarazione',
              'Firma del commercialista',
              'Invio telematico',
              'Comunicazione esito al cliente'
            ]
          }
        ]
      },
      {
        name: 'Bilancio Annuale',
        description: 'Procedura per la redazione del bilancio annuale',
        clientType: 'company',
        isActive: true,
        tasks: [
          {
            name: 'Chiusura contabilità',
            dueOffset: 30,
            assignedRole: 'operator',
            requiredDocuments: ['Estratti conto', 'Inventario', 'Libro cespiti'],
            reminderDays: [7, 15, 25],
            steps: [
              'Verificare registrazioni contabili',
              'Registrare ratei e risconti',
              'Calcolare ammortamenti',
              'Predisporre scritture di chiusura'
            ]
          },
          {
            name: 'Redazione bozza bilancio',
            dueOffset: 60,
            assignedRole: 'operator',
            requiredDocuments: [],
            reminderDays: [10, 20, 30, 50],
            steps: [
              'Generare stato patrimoniale',
              'Generare conto economico',
              'Redigere nota integrativa',
              'Preparare relazione sulla gestione'
            ]
          },
          {
            name: 'Approvazione e deposito',
            dueOffset: 90,
            assignedRole: 'admin',
            requiredDocuments: ['Verbale assemblea', 'Ricevute di versamento diritti'],
            reminderDays: [10, 20, 30],
            steps: [
              'Revisione finale bilancio',
              'Preparare documentazione per assemblea',
              'Assistere all\'assemblea dei soci',
              'Depositare bilancio alla CCIAA'
            ]
          }
        ]
      }
    ];
    
    const procedures = await Procedure.create(proceduresData);
    console.log(chalk.green(`✅ Create ${procedures.length} procedure standard`));
    return procedures;
  },
  
  // Genera assegnazioni di procedure ai clienti
  generateClientProcedures: async (clients, procedures, users) => {
    console.log(chalk.yellow('🔄 Assegnazione procedure ai clienti...'));
    
    const operatorUser = users.find(user => user.role === 'operator');
    const adminUser = users.find(user => user.role === 'admin');
    
    const clientProceduresData = [];
    
    // Assegna procedure ai clienti
    for (const client of clients) {
      // Determina se il cliente è una società o una persona fisica
      const isCompany = client.companyType !== 'Persona Fisica';
      
      // Filtra le procedure appropriate per il tipo di cliente
      const eligibleProcedures = procedures.filter(proc => 
        proc.clientType === 'all' || 
        (isCompany && proc.clientType === 'company') ||
        (!isCompany && proc.clientType === 'individual')
      );
      
      // Seleziona 1-3 procedure per cliente
      const numProcedures = faker.number.int({ min: 1, max: 3 });
      const selectedProcedures = faker.helpers.arrayElements(eligibleProcedures, numProcedures);
      
      for (const procedure of selectedProcedures) {
        // Genera data di inizio realistica (fino a 60 giorni nel passato)
        const startDate = faker.date.recent({ days: 60 });
        
        // Crea la procedura cliente
        const clientProcedure = {
          clientId: client._id,
          procedureId: procedure._id,
          startDate: startDate,
          status: faker.helpers.weightedArrayElement([
            { value: 'active', weight: 5 },
            { value: 'completed', weight: 3 },
            { value: 'on_hold', weight: 1 }
          ]),
          expectedEndDate: new Date(startDate.getTime() + (procedure.tasks.reduce((max, task) => 
            Math.max(max, task.dueOffset), 0) * 24 * 60 * 60 * 1000))
        };
        
        // Crea i task per la procedura cliente
        clientProcedure.tasks = procedure.tasks.map(task => {
          const dueDate = new Date(startDate.getTime() + (task.dueOffset * 24 * 60 * 60 * 1000));
          
          // Assegna l'utente in base al ruolo richiesto
          const assignedUser = task.assignedRole === 'admin' ? adminUser._id : operatorUser._id;
          
          // Determina lo stato del task in base alla data di scadenza e alla probabilità
          let taskStatus;
          if (dueDate < new Date()) {
            taskStatus = faker.helpers.weightedArrayElement([
              { value: 'completed', weight: 7 },
              { value: 'overdue', weight: 2 },
              { value: 'in_progress', weight: 1 }
            ]);
          } else {
            taskStatus = faker.helpers.weightedArrayElement([
              { value: 'pending', weight: 5 },
              { value: 'in_progress', weight: 3 },
              { value: 'completed', weight: 2 }
            ]);
          }
          
          // Data di completamento solo se il task è completato
          const completedDate = taskStatus === 'completed' ? 
            faker.date.between({ from: startDate, to: new Date() }) : 
            undefined;
          
          return {
            taskId: task._id,
            name: task.name,
            dueDate: dueDate,
            assignedTo: assignedUser,
            status: taskStatus,
            completedDate: completedDate,
            notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
            attachments: []
          };
        });
        
        clientProceduresData.push(clientProcedure);
      }
    }
    
    const clientProcedures = await ClientProcedure.create(clientProceduresData);
    console.log(chalk.green(`✅ Create ${clientProcedures.length} assegnazioni di procedure ai clienti`));
    return clientProcedures;
  },
  
  // Genera documenti di esempio
  generateDocuments: async (clients, templates) => {
    console.log(chalk.yellow('📄 Generazione documenti di esempio...'));
    
    // Assicurati che le directory esistano
    const generatedDocsDir = path.join(__dirname, '..', 'generated-docs');
    if (!fs.existsSync(generatedDocsDir)) {
      fs.mkdirSync(generatedDocsDir, { recursive: true });
    }
    
    // Crea sottodirectory per ogni cliente
    for (const client of clients) {
      const clientDir = path.join(generatedDocsDir, client._id.toString());
      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true });
      }
    }
    
    const documentCategories = [
      'identity', 
      'fiscal', 
      'contract', 
      'report', 
      'invoice', 
      'correspondence'
    ];
    
    const documentStatuses = ['pending', 'processed', 'approved', 'rejected'];
    
    const documentsData = [];
    
    // Date realistiche per documenti fiscali italiani
    const realisticDates = [
      // Date scadenze fiscali italiane
      new Date('2025-01-16'), // Versamento IVA mensile
      new Date('2025-01-31'), // Invio dati fatture (esterometro)
      new Date('2025-02-16'), // Versamento IVA mensile
      new Date('2025-02-28'), // CU
      new Date('2025-03-16'), // Versamento IVA annuale
      new Date('2025-04-30'), // Dichiarazione IVA
      new Date('2025-06-30'), // Versamento imposte da dichiarazione
      new Date('2025-07-31'), // Presentazione modello 770
      new Date('2025-09-30'), // Presentazione dichiarazione redditi
      new Date('2025-11-30'), // Acconti imposte
    ];
    
    // Per ogni cliente genera 2-5 documenti
    for (const client of clients) {
      const numDocuments = faker.number.int({ min: 2, max: 5 });
      
      for (let i = 0; i < numDocuments; i++) {
        const category = faker.helpers.arrayElement(documentCategories);
        const template = faker.helpers.arrayElement(templates);
        
        // Determina il tipo di file in base al formato del template
        let extension, mimeType;
        switch (template.format) {
          case 'html':
            extension = 'html';
            mimeType = 'text/html';
            break;
          case 'docx':
            extension = 'docx';
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
          case 'pdf':
            extension = 'pdf';
            mimeType = 'application/pdf';
            break;
          default:
            extension = 'txt';
            mimeType = 'text/plain';
        }
        
        // Genera nome file più realistico in base alla categoria
        let fileName;
        if (category === 'fiscal') {
          fileName = `${client.fiscalCode}_${faker.helpers.arrayElement(['F24', 'CU2025', 'IVA', 'Redditi2024'])}.${extension}`;
        } else if (category === 'invoice') {
          fileName = `Fattura_${faker.string.numeric(3)}_${new Date().getFullYear()}.${extension}`;
        } else if (category === 'contract') {
          fileName = `Contratto_${client.name.replace(/\s+/g, '_')}.${extension}`;
        } else {
          fileName = `${faker.helpers.slugify(client.name)}_${category}_${i+1}.${extension}`;
        }
        
        const filePath = path.join('generated-docs', client._id.toString(), fileName);
        
        // Crea un file "vuoto" come placeholder
        fs.writeFileSync(path.join(__dirname, '..', filePath), 'Documento di esempio');
        
        documentsData.push({
          clientId: client._id,
          filename: fileName,
          originalName: fileName,
          mimeType: mimeType,
          size: faker.number.int({ min: 10000, max: 5000000 }),
          path: filePath,
          category: category,
          status: faker.helpers.arrayElement(documentStatuses),
          createdAt: category === 'fiscal' 
            ? faker.helpers.arrayElement(realisticDates) 
            : faker.date.recent({ days: 90 }),
          metadata: {
            title: `${category.charAt(0).toUpperCase() + category.slice(1)} - ${client.name}`,
            description: faker.lorem.sentence(),
            templateId: template._id
          },
          tags: faker.helpers.arrayElements(['importante', 'scadenza', 'verificato', 'originale'], 
            faker.number.int({ min: 0, max: 3 })),
          accessPermissions: {
            public: false,
            restrictedTo: ['admin', 'operator']
          }
        });
      }
    }
    
    const documents = await Document.create(documentsData);
    console.log(chalk.green(`✅ Creati ${documents.length} documenti di esempio`));
    
    // Aggiorna i clienti con i riferimenti ai documenti
    for (const client of clients) {
      const clientDocuments = documents
        .filter(doc => doc.clientId.toString() === client._id.toString())
        .map(doc => doc._id);
      
      await Client.findByIdAndUpdate(client._id, { 
        $set: { documents: clientDocuments } 
      });
    }
    
    // Aggiorna le procedure cliente con riferimenti ai documenti
    const clientProcedures = await ClientProcedure.find({});
    for (const clientProc of clientProcedures) {
      const clientDocs = documents.filter(doc => 
        doc.clientId.toString() === clientProc.clientId.toString()
      );
      
      if (clientDocs.length > 0 && clientProc.tasks.length > 0) {
        // Assegna documenti random ai task
        const updatedTasks = clientProc.tasks.map(task => {
          if (faker.datatype.boolean(0.7)) { // 70% di probabilità
            const randomDoc = faker.helpers.arrayElement(clientDocs);
            task.attachments = [randomDoc._id];
          }
          return task;
        });
        
        await ClientProcedure.findByIdAndUpdate(clientProc._id, {
          $set: { tasks: updatedTasks }
        });
      }
    }
    
    return documents;
  }
};

// Funzione principale per il seeding
const seedDatabase = async () => {
  try {
    console.log(chalk.blue('🚀 Inizio processo di seeding database...'));
    
    // Configura l'ambiente
    setupDatabaseConfig();
    
    // Connessione al database
    await connectDB();
    
    // Conferma prima di procedere, a meno che non sia specificato --yes
    if (!options.yes) {
      console.log(chalk.yellow('\n⚠️  ATTENZIONE: Questo script eliminerà i dati esistenti nel database!'));
      console.log('Se desideri preservare gli utenti esistenti, usa l\'opzione --preserve-users');
      console.log('Se desideri rigenerare solo i clienti, usa l\'opzione --clients-only\n');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const continueSeeding = await new Promise(resolve => {
        readline.question('Sei sicuro di voler procedere? (s/n): ', answer => {
          readline.close();
          resolve(answer.toLowerCase() === 's');
        });
      });
      
      if (!continueSeeding) {
        console.log(chalk.red('Operazione annullata.'));
        process.exit(0);
      }
    }
    
    // Esecuzione modalità clients-only
    if (options.clientsOnly) {
      console.log(chalk.blue('📊 Modalità clients-only attivata: verranno rigenerati solo i clienti'));
      
      console.log(chalk.yellow('🧹 Pulizia tabella Clients...'));
      await Client.deleteMany({});
      
      const users = await User.find({});
      await dataGenerators.generateClients(users);
      
      console.log(chalk.green('\n✅ Seed dei clienti completato con successo!'));
      await mongoose.connection.close();
      console.log(chalk.blue('📊 Connessione database chiusa'));
      process.exit(0);
    }
    
    // Pulizia database (rispettando le opzioni)
    if (!options.preserveUsers) {
      console.log(chalk.yellow('🧹 Pulizia tabella Users...'));
      await User.deleteMany({});
    }
    
    console.log(chalk.yellow('🧹 Pulizia tabella Clients...'));
    await Client.deleteMany({});
    
    console.log(chalk.yellow('🧹 Pulizia tabella Templates...'));
    await Template.deleteMany({});
    
    console.log(chalk.yellow('🧹 Pulizia tabella Procedures...'));
    await Procedure.deleteMany({});
    
    console.log(chalk.yellow('🧹 Pulizia tabella ClientProcedures...'));
    await ClientProcedure.deleteMany({});
    
    console.log(chalk.yellow('🧹 Pulizia tabella Documents...'));
    await Document.deleteMany({});
    
    // Generazione dati
    const users = options.preserveUsers ? 
      await User.find({}) : 
      await dataGenerators.generateUsers();
    
    const clients = await dataGenerators.generateClients(users);
    const templates = await dataGenerators.generateTemplates(users);
    const procedures = await dataGenerators.generateProcedures();
    
    await dataGenerators.generateClientProcedures(clients, procedures, users);
    await dataGenerators.generateDocuments(clients, templates);
    
    console.log(chalk.green('\n✅ Seeding database completato con successo!'));
    
    // Statistiche finali
    console.log(chalk.blue('\n📊 Statistiche:'));
    console.log(`- Utenti: ${await User.countDocuments()}`);
    console.log(`- Clienti: ${await Client.countDocuments()}`);
    console.log(`- Template: ${await Template.countDocuments()}`);
    console.log(`- Procedure: ${await Procedure.countDocuments()}`);
    console.log(`- Procedure Clienti: ${await ClientProcedure.countDocuments()}`);
    console.log(`- Documenti: ${await Document.countDocuments()}`);
    
    // Disconnessione dal database
    await mongoose.connection.close();
    console.log(chalk.blue('📊 Connessione database chiusa'));
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Errore durante il seeding del database:'), error);
    process.exit(1);
  }
};

// Avvia il seeding
seedDatabase();