# Avanzamento verificato

## UI Redesign v3.0 — UI-R2 Nuova vita e GOD MODE (+ binario motore M-R2, schema v8) (completata il 2026-11-04, in attesa di approvazione utente)
Verificato: `npm run check` ✔ (typecheck, lint, 259 test Vitest, build) · `npm run e2e` ✔ (26: 13 test × Chromium e WebKit esecuzioni su Chromium e WebKit).

### Motore (M-R2, schema v8)
- **La scelta GOD MODE è nello stato e non cambia mai**: `config: { godModeEnabled, godModeOrigin }`. Si fissa in `createGame` / `continueDynasty` (parametro `godModeEnabled`, predefinito spento) e nessun comando, azione di gioco, importazione o migrazione può modificarla.
- `GOD_TOGGLE` resta nello schema dei comandi (contratto pubblico) ma risponde **sempre** `INVALID_TRANSITION` ("GOD MODE is chosen when a life is created…"). `GOD_EDIT` richiede `config.godModeEnabled`.
- `godMode` perde il campo `enabled` e tiene solo conteggio e registro; **il registro non si eredita** nella dinastia (ogni vita ha il suo). La cronaca della dinastia registra per informazione se la vita conclusa usava GOD MODE (`godMode` per voce).
- **Personalizzazione alla creazione** (`initialGodPatch`): validata con lo stesso schema rigoroso di `GOD_EDIT` e con lo stesso piano `planGodEdit`; applicata nella creazione stessa (revisione 0, un solo risultato atomico, evento `GOD` e voce di registro). Rifiutata senza GOD MODE; una patch non valida rifiuta l'intera creazione. Non tocca il flusso casuale, quindi l'anteprima del personaggio coincide con la nascita.
- **Invariante di integrità**: una vita che mostra attività GOD MODE (modifiche o registro) ma dichiara di non averla scelta è **non valida**: un file di salvataggio manomesso viene rifiutato all'importazione anche con checksum coerente.
- **Data di nascita**: la creazione accetta solo anni fra `SUPPORTED_BIRTH_YEARS` (1990–2100, epoca contemporanea, decisione 1); è il motore a rifiutare il resto, la UI mostra l'errore.
- **Migrazione v7→v8** (strategia confermata, T72): il valore è ricavato da ciò che il salvataggio dimostra. Registro con attivazione o modifiche registrate → GOD MODE **attiva** e bloccata (`migrated-from-usage`); nessuna traccia → **non attiva** e bloccata (`migrated-no-usage`), anche se l'interruttore vecchio risultava acceso senza tracce d'uso. La storia del registro resta. Verificata su salvataggi v7 (4 casi), sulla catena v6→v8 e v2→v8.

### Interfaccia
- **Schermata Nuova vita** (`/nuova-vita`, raggiungibile anche con una vita aperta; anche dentro *Vita* quando non c'è nulla di aperto): modalità **Casuale** (solo il nome), **Personalizzata** (nome, paese, città, data di nascita) e **Continuazione dinastica** (vita conclusa + genitore + nome; non disponibile, con il motivo, finché nessuna vita è conclusa). **Ricchezza e condizione familiare non si scelgono** (la UI lo spiega).
- **Selettore "GOD MODE: ATTIVA / DISATTIVA"** (predefinito DISATTIVA, con la spiegazione del blocco). Con ATTIVA compare "Personalizza il personaggio" (statistiche visibili, tratti, predisposizioni, abilità, talenti) sul personaggio che il seed genera, con l'anteprima del motore delle modifiche. Senza GOD MODE le statistiche generate non vengono mostrate (evita di rigenerare il seed finché non piacciono).
- **Conferma definitiva** (finestra modale): riepilogo e "GOD MODE: ATTIVA/DISATTIVA — resterà così per tutta questa vita"; "Indietro" non cambia nulla e fino alla conferma si può cambiare anche la scelta.
- **Dinastia**: la scheda di fine vita porta alla stessa schermata con la scelta riproposta (mai ereditata).
- **Altro → GOD MODE** è di **sola lettura**: stato, nota di blocco, origine se il valore è stato ricavato da una migrazione, registro, e (se attiva) "Modifica profilo". **Nessun interruttore in nessuna parte dell'app** né nel menu.
- Editor GOD MODE diviso in `GodFields` (campi + anteprima, riusati alla creazione) e `GodEditor` (modifica dal vivo).
- `store.godToggle` rimosso; `createLife`/`continueLife` prendono input completi; `previewNewLife`/`previewDynastyLife` pure per l'anteprima.

### Difetti trovati e corretti durante il lavoro
1. Due cicli di rendering infiniti scritti da me (un `useDeferredValue` su un oggetto nuovo a ogni render e le dipendenze di `GodFields`): trovati perché i test non terminavano; corretti (la UI non si blocca).
2. Test M6 che davano per buono l'interruttore: riscritti per la regola nuova (non erano più veri).

### Non fatto / limiti (onesti)
- **Genere**: non aggiunto. Il motore non lo modella (nomi in un elenco unico, nessun ruolo che ne dipenda): un campo senza effetto sarebbe decorativo (regole 6–7). Serve una decisione di GDD.
- **Aspetto, talenti e caratteristiche iniziali** sono personalizzabili **solo con GOD MODE** (nel prompt erano elencati fra i campi, ma senza GOD MODE sarebbero libertà di costruire il personaggio fuori dalle regole).
- **Intervallo delle date di nascita** (1990–oggi): scelta prudente mia, da confermare; i dati del gioco sono modelli contemporanei e non ho verificato date più antiche.
- **Salvataggi già in uso**: la regola di migrazione può portare un salvataggio a "GOD MODE attiva" anche se era stata spenta (se era stata usata); è la strategia che hai approvato, ma è irreversibile per quel salvataggio.
- Le nuove stringhe sono solo in italiano; Firefox, Safari/iPhone reali e screen reader non sono verificati.
- La personalizzazione alla nascita mostra l'anteprima del motore ma le anteprime richiedono ~decine di ms per cambio di scelta (misurato solo a sensazione, non con un benchmark).

## UI Redesign v3.0 — UI-R1 Schermata principale (completata il 2026-11-03, in attesa di approvazione utente)
Verificato: `npm run check` ✔ (typecheck, lint, 225 test Vitest, build) · `npm run e2e` ✔ (24 esecuzioni: 12 test × Chromium e WebKit) · axe-core WCAG 2.1 A/AA senza violazioni sulle nuove superfici.

### Cosa c'è (solo dati e comandi già esistenti nel motore)
- **Header persistente** (`LifeCharacterHeader`): menu in alto a sinistra, avatar generato (iniziali, nessuna risorsa esterna), nome, città e paese, età, professione, patrimonio netto dal libro contabile, data; il nome apre il **profilo** (`/profilo`, solo fatti visibili: i tratti nascosti restano nascosti).
- **Menu impostazioni** (`LifeMenu`, drawer Radix con focus trap, Esc e ripristino del focus): Nuova vita, Continua vita, Gestione salvataggi, Cronologia delle vite, Lingua, Tema, Importazione/esportazione, Informazioni (collegamenti alle sezioni di *Altro*). **Albero genealogico, Accessibilità, Audio e notifiche** esistono come righe "Pianificata", non operative. **Nessun controllo GOD MODE** nel menu (T71).
- **Diario** (`LifeDiary`): eventi reali del giornale, raggruppati per età, anni vuoti dichiarati come tali, persistente dopo il ricaricamento, "Mostra gli anni precedenti".
- **Pulsante "+ AVANZA DI UN ANNO"** fisso sopra la navigazione su telefono e fisso in alto nella colonna su schermi larghi; disabilitato durante l'elaborazione e con una decisione in attesa; un doppio clic applica un solo anno.
- **Finestra evento** (`LifeEventModal`, Radix Dialog): una decisione obbligatoria non si può chiudere (Esc e clic esterni ignorati), riprende dopo il ricaricamento, focus gestito.
- **Statistiche** (`LifeStatBar`): etichetta, numero e parola (alto/medio/basso) oltre al colore; `meter` accessibile; stress letto come "più alto = peggio".
- **Layout**: telefono (navigazione inferiore), tablet e desktop (sidebar; diario centrale e pannello statistiche/economia a lato).
- Componenti nuovi: `LifeAvatar`, `LifeStatBar`/`LifeStatList`, `LifeMoneyDisplay`, `LifeSectionHeader`, `LifeCharacterHeader`, `LifeMenu`, `LifeEventModal`, `LifeDiary`. Rimossi `EventCard` e `StatMeter`.
- Nuova dipendenza approvata (T75): `@radix-ui/react-dialog`.

### Difetti trovati durante il lavoro e corretti
1. `store.init()` poteva rieseguirsi (rimontaggio, React StrictMode) e **riaprire il salvataggio sopra un comando in corso**: ora è idempotente (test dedicato).
2. Axe ha rilevato che il link del profilo non conteneva il testo visibile nel proprio nome accessibile (WCAG 2.5.3): corretto.
3. Il caricamento del diario bloccava l'apertura di vite lunghe: ora è in background con stato "Carico il diario…".
4. Il blocco "librerie" del bundle superava 500 kB con Radix: diviso in `ui` e `vendor` (4 blocchi, massimo 435 kB).
5. Con il nuovo layout "Generazione N" non era più mostrata: ripristinata sotto il titolo.
6. Test e2e di accessibilità: l'attesa che il tema scuro fosse applicato ora controlla anche i colori del testo (WebKit aggiorna sfondo e testo in momenti diversi).

### Problemi noti / rischi (onesti)
- **Prestazioni del diario su vite molto lunghe**: leggere il giornale filtrando migliaia di righe è lento in WebKit (una scrittura che si accoda dietro la lettura ritardò il passo "nuova generazione" oltre 5 s). Mitigazioni: caricamento in background, pagina iniziale di 40 voci, aggiornamento incrementale a ogni anno. Soluzione strutturale proposta per UI-R7: tabella `diary` dedicata in Dexie (schema v3 con backfill).
- Il diario non mostra i "risultati economici" annuali (`FINANCE_YEAR` non ha ancora una descrizione leggibile); gli aspetti economici appaiono solo attraverso eventi di lavoro, patrimonio ed eventi.
- Nel test jsdom il dialogo Radix non si smonta dopo la chiusura (artefatto del test: nel browser reale funziona, verificato a mano e in e2e).
- L'elenco paesi contiene voci doppie ("Curaçao" AN/CW, "Serbia" CS/RS): codici GeoNames storici. Preesistente, non toccato (da correggere nel catalogo).
- Le nuove stringhe sono solo in italiano (le altre 19 lingue ripiegano sull'italiano).
- GOD MODE: il vecchio interruttore resta in *Altro → GOD MODE* fino a UI-R2 (T71).
- Non verificato: Firefox, Safari/iPhone reali, screen reader, zoom 200–400 %.

## UI Redesign v3.0 — UI-R0 Audit e design system (completata il 2026-11-03, in attesa di approvazione utente)
Dettagli in `docs/UI_REDESIGN.md`. Nessuna schermata è cambiata: UI-R0 è audit, documentazione e design system.
- **Audit**: mappa delle schermate, inventario componenti, capacità reali del motore. Esito principale: il motore ha 4 comandi (`ADVANCE_YEAR`, `RESOLVE_EVENT`, `GOD_TOGGLE`, `GOD_EDIT`) e nessun comando di attività/acquisto/relazione/carriera, né `ActionAvailability`: la UI "ricca di attività" richiede nuovi binari motore (M-R2, M-R4, M-R5, M-R6), non solo componenti.
- **Design system**: `apps/web/src/design/tokens.css` (scale di tipografia, spazio, raggi, ombre, movimento, layer, touch target; sette temi di area chiaro/scuro) e `areas.ts`. Test `tokens.test.ts` (22): contrasto ≥ 4,5:1 per ogni area in chiaro e scuro, focus ≥ 3:1, completezza dei token; verificato anche in negativo.
- **Decisioni** T71–T76: nuova regola GOD MODE (solo alla creazione, bloccata, riproposta per ogni dinastia), strategia di migrazione v7→v8 da confermare, piano a due binari, dipendenza Radix prevista.
- **Contraddizione nota e temporanea**: l'app contiene ancora l'interruttore GOD MODE di M6 (Altro → GOD MODE), perché la sua rimozione è prevista in UI-R2 e non in UI-R0.
- **Difetto trovato e corretto (e correzione di M7)**: il tema "sistema" seguiva il sistema operativo solo mentre la pagina Altro era aperta (il listener era nell'hook usato solo lì). Ora il tema è uno stato condiviso con un listener globale (`lib/theme.ts`, 4 test). Conseguenza: **l'audit di accessibilità di M7 in tema scuro non era davvero scuro** per Vita, Relazioni, Carriera e Finanze (il test cambiava il tema del sistema a pagina già aperta). Il test e2e ora verifica che il tema sia applicato (classe e colore di sfondo) prima di ogni audit scuro, stampa i colori misurati da axe e passa 12/12 su Chromium e WebKit. Il difetto causava un'instabilità intermittente (circa 1 esecuzione su 8).
- **Verifica**: `npm run check` ✔ (212 test Vitest, lint, build), e2e 10/10 (Chromium e WebKit).
- **Non verificato**: nessun test del layout nuovo (non esiste ancora); il redesign non è stato provato su dispositivi reali; la direzione "Luxury Editorial" citata nel prompt non esiste nel repository.

## M7 — Release candidate (completata il 2026-11-02, in attesa di approvazione utente)
Verificato: `npm run check` ✔ (typecheck, lint, 186 test Vitest, build) · `npm run e2e` ✔ (10 test: 5 su Chromium e 5 su WebKit) · `npm run validate:content` ✔.

### Cosa è stato fatto e misurato
| Area | Esito misurato |
|------|----------------|
| **Bilanciamento** (`engine/test/release`) | 150 vite complete nel mondo ridotto e 30 nel mondo da 252 paesi, zero errori di integrità. Età media alla morte 81,7 (ridotto) e 79,9 (globale); 5° percentile 62/58, 95° 93/95; mortalità sotto i 5 anni 0,7 % / 0 %; centenari 0 %; 4,1–4,3 obiettivi per vita. Soglie di sicurezza larghe (età media 62–88, mortalità infantile < 6 %, centenari < 5 %): intercettano un modello rotto, non dimostrano realismo. |
| **Prestazioni** | 13,6 ms per comando con validazione completa e 252 paesi (budget 50 ms); stato salvato 135 KB (budget 400 KB). Bundle: da un file da 877 kB a tre blocchi (app 179 kB, contenuti 211 kB, librerie 492 kB; 53+71+153 kB gzip) senza avviso di Vite; i blocchi stabili restano in cache al prossimo aggiornamento. |
| **Migrazioni** | La catena v2→v7 è testata end-to-end: deterministica, non modifica l'originale, produce uno stato valido e **giocabile fino alla morte**; v6→v7 testata (M6). |
| **Accessibilità** | Audit automatico axe-core WCAG 2.0/2.1 A e AA su tutte le pagine (Vita, Relazioni, Carriera, Finanze, Altro, Mondo, Società, form di nuova vita, editor GOD MODE) in chiaro e scuro, e a 375 px senza scroll orizzontale: 0 violazioni. Ha trovato un difetto reale che ho corretto (contrasto degli obiettivi bloccati, introdotto in M6). |
| **Compatibilità** | e2e completo (vita intera, offline con service worker, GOD MODE, backup, lingua RTL, accessibilità) su Chromium **e WebKit** di Playwright: 10/10. |

### Problemi noti / limiti (onesti)
- **Firefox non verificato**: Windows ha rifiutato di eseguire il Firefox scaricato da Playwright ("Permission denied", probabile politica di sicurezza; non ho aggirato il blocco). Il progetto è disponibile con `E2E_FIREFOX=1 npm run e2e` ma non è mai passato su questa macchina.
- **Safari reale e iOS non verificati**: WebKit di Playwright su Windows non è Safari su iPhone/iPad (storage, installazione PWA e service worker possono differire). Nessun test su dispositivi mobili reali; i tempi su telefono sono stimati, non misurati.
- **Audit axe parziale**: gli strumenti automatici coprono una parte dei requisiti WCAG; non ho fatto test con screen reader, solo navigazione da tastiera implicita dai ruoli. Non coperti: carta di decisione aperta e schermata di morte.
- **Bilanciamento non tarato su dati reali**: il coefficiente di Gini della ricchezza alla morte è 0,88–0,90 (alto) e il 100 % degli adulti simulati è stato assunto almeno una volta: la politica di gioco automatica sceglie sempre l'opzione attiva, quindi non misura la disoccupazione reale. Longevità, redditi e soglie restano valori di bilanciamento, non statistiche ufficiali.
- Le sessioni di test massivo sono di centinaia di vite, non decine di migliaia: ho ridotto da 400/60 a 150/30 perché una vita costa circa 0,8 s.
- Eredità dei limiti M6: cloud e AI mai provati contro servizi reali; traduzioni delle 19 lingue automatiche e non verificate; `backups` senza interfaccia.
- Nessun commit git; nessuna pubblicazione/deploy eseguita.

### Criteri bloccanti del master prompt
Offline completo ✔ (e2e con rete spenta) · determinismo/replay ✔ · salvataggi con checksum e migrazioni ✔ · copertura globale (252 paesi, 6.171 località, 363 professioni) ✔ · accessibilità automatica ✔ · prestazioni entro il budget ✔ · **compatibilità: parziale** (Chromium e WebKit sì; Firefox e dispositivi reali no) · cloud/AI opzionali non verificati su servizi reali.

## M6 — GOD MODE e servizi opzionali (completata e approvata)
Verificato: `npm run check` ✔ (typecheck, lint, 180 test Vitest, build) · `npm run e2e` ✔ (4 test Playwright) · `npm run validate:content` ✔.

### Cosa c'è
- **GOD MODE** (comandi `GOD_TOGGLE` e `GOD_EDIT` del motore): attivabile e disattivabile in qualsiasi momento (anche con una decisione in attesa). Modificabili solo: nome/cognome, statistiche visibili, personalità e tratti nascosti, predisposizioni, talenti, abilità. L'NPC non ha statistiche né abilità da modificare. Tutto il resto (denaro, carriera, titoli, leggi, mondo, eventi futuri, genealogia, storia, relazioni, obiettivi) è rifiutato già dallo schema (`GodPatchSchema` strict) e di nuovo dal motore.
- Flusso **anteprima → conferma → validazione → salvataggio**: l'anteprima è il piano del motore (`planGodEdit`, puro), lo stesso che il comando applica; modifica atomica (tutto o niente), idempotente (stesso `commandId` o stessi valori = nessun effetto), registrata (registro modifiche con valori prima/dopo, ultimi 200), con checkpoint. Spegnere GOD MODE non annulla nulla. Il flusso casuale (RNG), il mondo e le relazioni non vengono toccati.
- **Obiettivi** (13) condivisi con GOD MODE: valutati solo dallo stato, mai disattivati, solo sbloccati e mai rimossi, ereditati dalla dinastia.
- **Talenti, abilità e predisposizioni** (schema v7) come meccaniche vere, non decorazione: 10 talenti ereditabili, longevità (±20 % sulla mortalità), robustezza (salute annua), talento accademico (+ rendimento nello studio), abilità che crescono con il lavoro e pesano sulle promozioni.
- **Backup completo** (tutte le vite in un file), **ripristino con piano** (nuova / identica / diversa / non valida) e scelta esplicita per ogni conflitto: *conserva entrambe* (predefinito), *ignora*, *sostituisci* (la versione sostituita resta in `backups`). **Verifica di integrità** (schema, checksum, invarianti, righe orfane) senza modificare nulla.
- **Cloud opzionale** (`@project-life/services`, `supabase/migrations`, `docs/CLOUD.md`): spento di default; Supabase via REST con URL e chiave pubblica inseriti a runtime, token solo in memoria, RLS per proprietario. La decisione push/pull/conflitto si basa sulla **storia** (checksum dei checkpoint), non sugli orari; la scrittura è compare-and-set; in caso di divergenza non si modifica nulla, la versione cloud viene salvata come copia locale e serve una scelta esplicita.
- **Narrazione AI opzionale**: spenta di default; riceve solo un riassunto testuale, restituisce solo testo (sanificato, ≤ 600 caratteri, timeout 4 s, ripiego sul testo standard), non ha accesso allo stato; nessuna chiave API nel client (si usa un proxy dell'utente).
- Migrazione **v6→v7** (talenti/abilità/predisposizioni neutri, GOD MODE spento, obiettivi vuoti).

### Test aggiunti (40)
GOD MODE (campi ammessi, ogni categoria vietata rifiutata, atomicità, idempotenza, registro, spegnimento che conserva le modifiche, NPC con memoria/relazioni intatte, modifica durante una decisione, bersaglio morto, GOD acceso senza modifiche = vita identica, obiettivi in entrambe le modalità e tra generazioni, migrazione v6→v7, talenti ereditati/deterministici), persistenza (backup, ripristino con conflitti, integrità, lineage, adopt), servizi (planSync su storia, conflitti, compare-and-set, Supabase con fetch simulato, narratore: ripiego, timeout, sanificazione), web (store GOD MODE, anteprima→conferma, annulla, backup, conflitto cloud tra due dispositivi, **garanzia offline**: nessuna chiamata di rete), e2e GOD MODE + backup offline, validatore dei talenti.

### Problemi noti / limiti (onesti)
- **Cloud e AI non sono stati verificati contro servizi reali.** Il codice è provato con un backend in memoria e con `fetch` simulato: la forma delle richieste REST di Supabase, il codice 409 sull'inserimento duplicato, l'atomicità del PATCH condizionale e le policy RLS (SQL mai eseguito su PostgreSQL) sono **ipotesi non verificate**. Il proxy dell'AI non è fornito.
- L'accesso al cloud usa email e password del tuo progetto Supabase digitate nell'app (mai salvate); nessun OAuth.
- La storia usata per distinguere "avanti" da "divergente" conserva gli ultimi 500 checkpoint: un dispositivo rimasto indietro di più di 500 revisioni vedrà un conflitto (lato sicuro).
- Le nuove stringhe M6 sono solo in italiano (le altre 19 lingue ripiegano sull'italiano, come già dichiarato).
- Il pulsante "Modifica profilo" del protagonista è in *Altro → GOD MODE* (e quello degli NPC in *Relazioni*), non nella scheda identità della pagina Vita.
- La tabella `backups` (copie prima di migrazioni, sostituzioni e adozioni) non ha ancora interfaccia di consultazione né pulizia.
- Soglie degli obiettivi, effetti di talenti e longevità sono valori di bilanciamento non tarati.
- La suite Vitest richiede ~4 minuti (252 paesi, centinaia di vite); il timeout del progetto `packages` è stato portato a 30 s perché con il carico parallelo 4 test superavano i 5 s.
- Bundle JS ancora > 500 kB (avviso di Vite). Nessun commit git.

## M5 — Catalogo globale (completata e approvata)
Verificato: `npm run check` ✔ (typecheck, lint, 140 test Vitest, build) · `npm run e2e` ✔ (3 test Playwright) · `npm run validate:content` ✔ (0 problemi).

Copertura raggiunta (numeri misurati dal validatore, non dichiarati):
| Requisito | Richiesto | Raggiunto |
|-----------|-----------|-----------|
| Paesi e territori | catalogo adottato | **252** (tutti quelli di GeoNames `countryInfo`) |
| Località reali | ≥ 5.000 | **6.171** (id GeoNames, coordinate, popolazione, fuso IANA; 335 fusi) |
| Professioni | ≥ 300 | **363** in **18 settori**, 16 archetipi |
| Lingue | 20 | **20** dichiarate, con RTL per l'arabo (vedi limiti: solo interfaccia principale) |
| Validazione | completa | duplicati, riferimenti, eventi impossibili/irraggiungibili, dipendenze circolari tra storie, dati economici incoerenti, traduzioni mancanti |

Implementato:
- **Fonte dati documentata**: GeoNames (CC BY 4.0), scaricato il 2026-11-02 con consenso esplicito; file, dimensioni e SHA-256 in `data/SOURCES.md` e nel manifest; `npm run geography` rigenera il catalogo. Attribuzione mostrata in Altro → Informazioni.
- **Separazione documentato / modello**: popolazione, codici ISO, capitali, valute, lingue, fusi = documentati; fasce di reddito, fattori salariali, cambi indicativi, tassi demografici, istituzioni, emissioni, regole fiscali = `estimated-model` dichiarati tali nel manifest.
- **Tutti i paesi giocabili**: ognuno ha economia, politica, popolazione e ambiente propri nel mondo persistente, una regola fiscale e città di nascita. Random Life estrae il paese in proporzione alla popolazione reale.
- **Unità monetaria**: le valute ad alto valore nominale usano unità intere (evita il superamento dei numeri interi sicuri); conversione al trasferimento.
- **Professioni**: catalogo di 363 mestieri con requisiti (nuovi titoli **laurea magistrale** e **dottorato**, con gerarchia: un titolo superiore vale per gli inferiori), età minime coerenti, 16 archetipi.
- **Carriere speciali**: sport (carriera che finisce a 38 anni, reddito molto variabile), spettacolo (rischio alto, redditi instabili), medicina, giustizia, ricerca, direzione, pubblica amministrazione; studi avanzati (master 2 anni, dottorato 4) con retta e borsa.
- **Narrativa approfondita**: 74 eventi (da 48) con eventi di carriera specifici per archetipo, 2 nuovi archi pluriennali (mentore in 3 tappe, svolta creativa), eventi di vita (crisi di mezza età, pensione, lascito, riunione con un amico, malattia lunga…).
- **Localizzazione**: infrastruttura completa (selezione, persistenza, sostituzione a runtime, `lang`/`dir`, nomi dei paesi e formati numerici via `Intl`), tool per le traduzioni mancanti.
- **Mondo**: pagina con ricerca fra i 252 paesi; cronaca globale limitata ai paesi grandi e al tuo.
- **Migrazione v5→v6**: aggiunge i nuovi paesi al mondo senza toccare quelli esistenti.

Bug trovati e corretti con i nuovi test: (1) le migrazioni tra paesi accumulavano il resto degli arrotondamenti sul primo paese in ordine alfabetico, svuotandolo (ora media pesata per popolazione e resto al paese più grande); (2) overflow dei numeri interi sicuri nelle valute ad alto valore nominale e nelle imprese senza limiti (ora unità intere, tetto di 250 dipendenti e rendimenti decrescenti).

### Problemi noti / limiti
- **Traduzioni**: solo Italiano è completo. Le altre 19 lingue coprono **48 stringhe dell'interfaccia principale** (navigazione, azioni, statistiche, impostazioni), sono **automatiche e non verificate da madrelingua**, e così sono etichettate in app e nel manifest. Eventi, professioni, la maggior parte delle schermate restano in italiano. Non è una localizzazione professionale completata.
- **Fusi orari**: i dati ci sono (335 fusi sulle località) ma il calendario non li usa ancora.
- **Località**: GeoNames `cities15000` (luoghi sopra i 15.000 abitanti): i 6.000 più grandi più i 3 più grandi di ogni paese; 9 territori minuscoli hanno solo la capitale.
- **Dati di modello per paese**: fasce di reddito, cambi e punteggi sono assegnazioni grossolane da conoscenza generale, non classificazioni ufficiali; per ~170 valute i cambi sono ordini di grandezza.
- **Professioni**: salari e stress sono modelli; le specializzazioni esistono solo per 36 professioni; nessuna differenza salariale per paese oltre al fattore di reddito.
- **Prestazioni**: 4,9 ms per comando con il catalogo completo (era 1 ms con 12 paesi); lo stato pesa ~90 KB. La suite usa per default un mondo ridotto a 12 paesi per restare rapida; la copertura globale ha test dedicati.
- **Bundle JS** 838 kB (264 kB gzip); le 6.171 località non sono nel bundle (caricate solo da validatore/test).
- Nessun commit git; testo integrale del master prompt non nel repo.

## M4 — Società e mondo (completata e approvata)
## M3 — Economia e professioni (completata e approvata)
## M2 — NPC e dinastie (completata e approvata)
## M1 — Vertical slice (completata e approvata)
## M0 — Fondamenta (completata e approvata)
