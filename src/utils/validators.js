/**
 * Validatori per campi fiscali italiani.
 * Implementazione degli algoritmi di controllo per:
 * - Codice Fiscale (16 caratteri alfanumerici)
 * - Partita IVA (11 caratteri numerici)
 * - CAP (5 caratteri numerici)
 * e altre validazioni utili per i modelli dati.
 */

/**
 * Verifica la validità di un codice fiscale italiano.
 * Implementa l'algoritmo ufficiale di validazione che include:
 * - Verifica della lunghezza (16 caratteri)
 * - Verifica del formato (primi 6 caratteri = lettere per cognome e nome)
 * - Verifica della data di nascita (7 caratteri per anno, mese, giorno)
 * - Verifica del codice comune (4 caratteri)
 * - Calcolo e verifica del carattere di controllo
 * 
 * @param {string} cf - Il codice fiscale da validare
 * @returns {boolean} true se il codice fiscale è valido, altrimenti false
 */
const validateCodiceFiscale = (cf) => {
  if (!cf) return false;
  
  // Normalizza: rimuovi spazi e converti in maiuscolo
  cf = cf.replace(/\s/g, '').toUpperCase();
  
  // 1. Verifica lunghezza e formato base
  if (!/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cf)) {
    return false;
  }
  
  // 2. Estrazione e verifica componenti
  const cognome = cf.substring(0, 3); // Prime 3 lettere: cognome
  const nome = cf.substring(3, 6);    // Successive 3 lettere: nome
  const anno = cf.substring(6, 8);    // 2 cifre dell'anno di nascita
  const mese = cf.substring(8, 9);    // 1 lettera per il mese
  const giorno = cf.substring(9, 11); // 2 cifre per il giorno (1-31 maschi, 41-71 femmine)
  const codComune = cf.substring(11, 15); // 1 lettera e 3 numeri per il comune
  const carattereControllo = cf.charAt(15); // Ultimo carattere di controllo
  
  // 3. Verifica del mese (A=Gennaio, B=Febbraio, ..., L=Dicembre)
  const mesi = 'ABCDEHLMPRST';
  if (mesi.indexOf(mese) === -1) {
    return false;
  }
  
  // 4. Verifica del giorno (1-31 per maschi, 41-71 per femmine)
  const g = parseInt(giorno);
  if (!((g >= 1 && g <= 31) || (g >= 41 && g <= 71))) {
    return false;
  }
  
  // 5. Calcolo del carattere di controllo
  // Tabelle di conversione per il calcolo
  const caratteriDispari = {
    '0': 1,  '1': 0,  '2': 5,  '3': 7,  '4': 9,  '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1,  'B': 0,  'C': 5,  'D': 7,  'E': 9,  'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2,  'L': 4,  'M': 18, 'N': 20, 'O': 11, 'P': 3,  'Q': 6,  'R': 8,  'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  };
  
  const caratteriPari = {
    '0': 0,  '1': 1,  '2': 2,  '3': 3,  '4': 4,  '5': 5,  '6': 6,  '7': 7,  '8': 8,  '9': 9,
    'A': 0,  'B': 1,  'C': 2,  'D': 3,  'E': 4,  'F': 5,  'G': 6,  'H': 7,  'I': 8,  'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
    'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  };
  
  const carattereControlloMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  let sum = 0;
  
  // Calcolo del valore di controllo
  for (let i = 0; i < 15; i++) {
    const char = cf.charAt(i);
    // Posizioni dispari (0-based)
    if (i % 2 === 0) {
      sum += caratteriDispari[char];
    } 
    // Posizioni pari (0-based)
    else {
      sum += caratteriPari[char];
    }
  }
  
  // Calcolo del carattere di controllo atteso
  const resto = sum % 26;
  const carattereControlloAtteso = carattereControlloMap.charAt(resto);
  
  // 6. Confronta il carattere di controllo calcolato con quello fornito
  return carattereControlloAtteso === carattereControllo;
};

/**
 * Verifica la validità di una partita IVA italiana.
 * Implementa l'algoritmo ufficiale che include:
 * - Verifica della lunghezza (11 cifre)
 * - Verifica che siano tutti numeri
 * - Verifica della cifra di controllo tramite formula specifica
 * - I primi 7 numeri rappresentano identificazione contribuente
 * - I successivi 3 numeri rappresentano codice ufficio provinciale
 * - L'ultimo è cifra di controllo
 * 
 * @param {string} piva - La partita IVA da validare
 * @returns {boolean} true se la partita IVA è valida, altrimenti false
 */
const validatePartitaIVA = (piva) => {
  if (!piva) return false;
  
  // Normalizza: rimuovi spazi e caratteri non numerici
  piva = piva.replace(/\s/g, '').replace(/\D/g, '');
  
  // 1. Verifica che sia di 11 cifre e contenga solo numeri
  if (!/^\d{11}$/.test(piva)) {
    return false;
  }
  
  // 2. Controllo validità tramite l'algoritmo ufficiale della partita IVA italiana
  let somma = 0;
  
  for (let i = 0; i < 11; i++) {
    let cifra = parseInt(piva.charAt(i));
    
    // Le posizioni dispari (considerando indice 0-based) vengono trattate normalmente
    if (i % 2 === 0) {
      somma += cifra;
    } 
    // Le posizioni pari richiedono un calcolo specifico
    else {
      // Moltiplica per 2 e sottrai 9 se il risultato è > 9
      cifra *= 2;
      if (cifra > 9) {
        cifra -= 9;
      }
      somma += cifra;
    }
  }
  
  // 3. La somma deve essere divisibile per 10 e maggiore di 0
  return somma % 10 === 0 && somma > 0;
};

/**
 * Verifica la validità di un CAP (Codice di Avviamento Postale) italiano.
 * Il CAP italiano è composto da 5 cifre numeriche.
 * 
 * @param {string} cap - Il CAP da validare
 * @returns {boolean} true se il CAP è valido, altrimenti false
 */
const validateCAP = (cap) => {
  if (!cap) return false;
  
  // Normalizza: rimuovi spazi
  cap = cap.replace(/\s/g, '');
  
  // Verifica che sia composto da esattamente 5 cifre
  return /^\d{5}$/.test(cap);
};

/**
 * Verifica se un'email è valida secondo un formato base.
 * 
 * @param {string} email - L'email da validare
 * @returns {boolean} true se l'email è valida, altrimenti false
 */
const validateEmail = (email) => {
  if (!email) return false;
  
  // Regex per validare email - versione con controlli più precisi
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Verifica se un numero di telefono italiano è valido.
 * Supporta formati fissi e mobili con prefisso opzionale.
 * 
 * @param {string} phone - Il numero di telefono da validare
 * @returns {boolean} true se il numero è valido, altrimenti false
 */
const validatePhoneNumber = (phone) => {
  if (!phone) return false;
  
  // Normalizza: rimuovi spazi, trattini e parentesi
  phone = phone.replace(/[\s\-()]/g, '');
  
  // Prefisso italiano opzionale: +39 o 0039
  if (phone.startsWith('+39')) {
    phone = phone.substring(3);
  } else if (phone.startsWith('0039')) {
    phone = phone.substring(4);
  }
  
  // Verifica formato cellulare italiano (3xx) o fisso (0x)
  if (/^3\d{8,9}$/.test(phone)) {
    return true; // Cellulare
  }
  
  if (/^0\d{6,10}$/.test(phone)) {
    return true; // Fisso
  }
  
  return false;
};

module.exports = {
  validateCodiceFiscale,
  validatePartitaIVA,
  validateCAP,
  validateEmail,
  validatePhoneNumber,
  // Mantengo i nomi precedenti per retrocompatibilità
  isValidFiscalCode: validateCodiceFiscale,
  isValidVatNumber: validatePartitaIVA,
  isValidEmail: validateEmail,
  isValidPhone: validatePhoneNumber,
  isValidPostalCode: validateCAP
};