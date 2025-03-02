# Backlog Progetto Assistente Biliato

Questo documento contiene il backlog delle user stories per il progetto Assistente Biliato, organizzate per priorità e dipendenze.

## Priorità Alta

### Epic: Sistema di Onboarding Cliente

1. **Registrazione cliente base**  
   Come operatore dello studio,  
   voglio registrare i dati anagrafici di un nuovo cliente (nome, cognome, codice fiscale, P.IVA, contatti),  
   in modo da iniziare il processo di onboarding e avere una scheda cliente completa.  
   *Stima: 3 SP*

2. **Validazione automatica dati fiscali**  
   Come operatore dello studio,  
   voglio che il sistema verifichi automaticamente la validità del codice fiscale e della partita IVA inseriti,  
   in modo da evitare errori nei documenti ufficiali e nelle comunicazioni con l'Agenzia delle Entrate.  
   *Stima: 5 SP*  
   *Dipende da: Registrazione cliente base*

3. **Categorizzazione cliente**  
   Come commercialista,  
   voglio categorizzare i clienti per tipo (persona fisica, ditta individuale, società di persone, società di capitali),  
   in modo da personalizzare il processo di onboarding e i documenti da richiedere.  
   *Stima: 2 SP*  
   *Dipende da: Registrazione cliente base*

4. **Checklist documenti richiesti**  
   Come operatore dello studio,  
   voglio una checklist automatica dei documenti necessari in base alla categoria del cliente,  
   in modo da assicurarmi di raccogliere tutta la documentazione richiesta senza dimenticare nulla.  
   *Stima: 5 SP*  
   *Dipende da: Categorizzazione cliente*

5. **Gestione consensi privacy**  
   Come operatore dello studio,  
   voglio raccogliere e archiviare digitalmente i consensi privacy e GDPR del cliente,  
   in modo da essere conforme alla normativa sulla protezione dei dati.  
   *Stima: 3 SP*  
   *Dipende da: Registrazione cliente base*

### Epic: Generazione Documenti Automatizzati

6. **Generazione lettera di benvenuto**  
   Come operatore dello studio,  
   voglio generare automaticamente una lettera di benvenuto personalizzata per il nuovo cliente,  
   in modo da fornire un'accoglienza professionale e risparmiare tempo nella redazione del documento.  
   *Stima: 3 SP*  
   *Dipende da: Registrazione cliente base*

7. **Generazione contratto di servizio**  
   Come commercialista,  
   voglio generare automaticamente un contratto di servizio basato sui servizi selezionati per il cliente,  
   in modo da avere rapidamente un documento legalmente valido e personalizzato.  
   *Stima: 8 SP*  
   *Dipende da: Registrazione cliente base, Categorizzazione cliente*

8. **Editor template documenti**  
   Come amministratore del sistema,  
   voglio poter creare e modificare i template dei documenti con campi dinamici,  
   in modo da personalizzare i documenti generati senza necessità di intervento tecnico.  
   *Stima: 13 SP*

### Epic: Reportistica e Monitoraggio

9. **Dashboard stato onboarding**  
   Come responsabile dello studio,  
   voglio una dashboard che mostri lo stato di avanzamento dell'onboarding di tutti i clienti,  
   in modo da identificare rapidamente eventuali blocchi e monitorare l'efficienza del processo.  
   *Stima: 8 SP*  
   *Dipende da: Registrazione cliente base, Checklist documenti richiesti*

10. **Notifiche documenti mancanti**  
    Come operatore dello studio,  
    voglio ricevere notifiche quando mancano documenti essenziali per un cliente,  
    in modo da sollecitare tempestivamente il cliente e completare il processo di onboarding.  
    *Stima: 5 SP*  
    *Dipende da: Checklist documenti richiesti*

## Priorità Media

### Epic: Procedure Operative

11. **Generazione procedure operative**  
    Come commercialista,  
    voglio che il sistema generi una procedura operativa personalizzata per ogni cliente basata sul suo profilo fiscale,  
    in modo da standardizzare i processi interni e garantire che tutte le attività necessarie vengano svolte.  
    *Stima: 13 SP*  
    *Dipende da: Categorizzazione cliente*

12. **Definizione scadenze fiscali automatiche**  
    Come commercialista,  
    voglio che il sistema crei automaticamente un calendario di scadenze fiscali per il cliente,  
    in modo da pianificare il lavoro e garantire il rispetto di tutti gli adempimenti.  
    *Stima: 8 SP*  
    *Dipende da: Categorizzazione cliente*

13. **Assegnazione attività al team**  
    Come responsabile dello studio,  
    voglio poter assegnare attività specifiche della procedura operativa ai membri del team,  
    in modo da distribuire il carico di lavoro e monitorare l'avanzamento.  
    *Stima: 5 SP*  
    *Dipende da: Generazione procedure operative*

14. **Notifiche scadenze**  
    Come operatore dello studio,  
    voglio ricevere notifiche per le scadenze imminenti dei clienti in onboarding,  
    in modo da non perdere termini importanti e garantire un servizio puntuale.  
    *Stima: 5 SP*  
    *Dipende da: Definizione scadenze fiscali automatiche*

### Epic: Integrazione Sistemi Gestionali

15. **Sincronizzazione anagrafica clienti**  
    Come operatore dello studio,  
    voglio sincronizzare i dati anagrafici con il gestionale esistente,  
    in modo da evitare il doppio inserimento e mantenere i dati coerenti tra i sistemi.  
    *Stima: 13 SP*  
    *Dipende da: Registrazione cliente base*

16. **Import/export dati contabili**  
    Come commercialista,  
    voglio poter importare ed esportare dati contabili tra l'assistente e il gestionale,  
    in modo da utilizzare le informazioni in entrambi i sistemi senza duplicazione del lavoro.  
    *Stima: 13 SP*  
    *Dipende da: Sincronizzazione anagrafica clienti*

17. **Tracciamento stato pratiche**  
    Come operatore dello studio,  
    voglio visualizzare lo stato delle pratiche in lavorazione anche dal gestionale,  
    in modo da avere una visione unificata dell'avanzamento del lavoro.  
    *Stima: 8 SP*  
    *Dipende da: Import/export dati contabili*

### Epic: Monitoraggio Avanzamento

18. **Upload documenti cliente**  
    Come cliente,  
    voglio poter caricare i documenti richiesti tramite un'area riservata,  
    in modo da velocizzare la condivisione e ridurre l'invio di email con allegati.  
    *Stima: 8 SP*  
    *Dipende da: Checklist documenti richiesti*

19. **Monitoraggio completezza documentale**  
    Come operatore dello studio,  
    voglio monitorare la completezza della documentazione fornita dal cliente,  
    in modo da identificare rapidamente cosa manca e sollecitare il cliente.  
    *Stima: 5 SP*  
    *Dipende da: Upload documenti cliente, Checklist documenti richiesti*

20. **Reportistica periodica**  
    Come titolare dello studio,  
    voglio report periodici sullo stato dell'onboarding dei clienti e sull'efficienza dei processi,  
    in modo da valutare le performance e identificare aree di miglioramento.  
    *Stima: 8 SP*  
    *Dipende da: Dashboard stato onboarding*

## Priorità Bassa

### Epic: AI Assistant e Ottimizzazioni

21. **Assistente virtuale per clienti**  
    Come cliente,  
    voglio poter fare domande semplici a un assistente virtuale,  
    in modo da ottenere risposte immediate senza attendere l'intervento dell'operatore.  
    *Stima: 13 SP*

22. **Assistente virtuale per operatori**  
    Come operatore dello studio,  
    voglio un assistente virtuale che mi suggerisca azioni basate sul contesto del cliente,  
    in modo da velocizzare il lavoro e migliorare la qualità del servizio.  
    *Stima: 13 SP*  
    *Dipende da: Assistente virtuale per clienti*

23. **Analisi predittiva clienti**  
    Come titolare dello studio,  
    voglio che il sistema suggerisca servizi aggiuntivi in base al profilo del cliente,  
    in modo da aumentare le opportunità di business e fornire un servizio più completo.  
    *Stima: 13 SP*  
    *Dipende da: Categorizzazione cliente, Assistente virtuale per operatori*

24. **Firma digitale documenti**  
    Come commercialista,  
    voglio inviare documenti per la firma digitale direttamente dall'applicazione,  
    in modo da velocizzare l'acquisizione dei contratti firmati e ridurre l'uso della carta.  
    *Stima: 13 SP*  
    *Dipende da: Generazione contratto di servizio*

25. **Integrazione calendario**  
    Come operatore dello studio,  
    voglio che il sistema sincronizzi gli appuntamenti con i clienti sul mio calendario,  
    in modo da gestire meglio il tempo e avere una visione unificata degli impegni.  
    *Stima: 8 SP*

26. **App mobile**  
    Come cliente e come operatore,  
    voglio accedere alle funzionalità base tramite app mobile,  
    in modo da utilizzare il sistema anche in mobilità.  
    *Stima: 21 SP*  
    *Dipende da: Dashboard stato onboarding, Upload documenti cliente*

## Legenda

- **SP**: Story Points, stima relativa della complessità
- **Dipende da**: User stories che devono essere completate prima di iniziare questa

## Roadmap di Sviluppo (Trimestri)

### Q1: Fondamenta e Onboarding Base
- Registrazione cliente base
- Validazione automatica dati fiscali
- Categorizzazione cliente
- Checklist documenti richiesti
- Gestione consensi privacy
- Generazione lettera di benvenuto
- Dashboard stato onboarding

### Q2: Documenti e Procedure
- Generazione contratto di servizio
- Editor template documenti
- Notifiche documenti mancanti
- Generazione procedure operative
- Definizione scadenze fiscali automatiche
- Assegnazione attività al team

### Q3: Integrazione e Automazione
- Sincronizzazione anagrafica clienti
- Import/export dati contabili
- Upload documenti cliente
- Monitoraggio completezza documentale
- Notifiche scadenze
- Reportistica periodica

### Q4: AI e Ottimizzazioni
- Assistente virtuale per clienti
- Assistente virtuale per operatori
- Analisi predittiva clienti
- Firma digitale documenti
- Integrazione calendario
- App mobile