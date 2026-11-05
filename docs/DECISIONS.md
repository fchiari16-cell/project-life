# Registro delle decisioni tecniche

| ID | Data | Decisione | Motivazione / alternative |
|----|------|-----------|---------------------------|
| T1 | 2026-11-01 | Repo in `C:\dev\project-life`, non nella cartella Dropbox di lavoro | `node_modules` (~700 pacchetti) in Dropbox rallenta/corrompe la sync; coerente con altri progetti dell'utente |
| T2 | 2026-11-01 | npm workspaces (pnpm non installato) | Nessuna installazione globale necessaria; migrabile a pnpm in futuro |
| T3 | 2026-11-01 | Pacchetti esportano i sorgenti TS (`exports: ./src/index.ts`), nessun build per pacchetto | Meno configurazione; Vite/Vitest trasformano i sorgenti. Da rivedere se si pubblicheranno i pacchetti |
| T4 | 2026-11-01 | RNG = sfc32 con stato 4×uint32 serializzato in `GameState.rng`; seed via cyrb128 | Piccolo, veloce, stato banale da salvare. Non crittografico (non serve) |
| T5 | 2026-11-01 | L'RNG è parte di `GameState`, non argomento separato di `simulate` | Mantiene `simulate` pura con firma più semplice; stesso contratto concettuale |
| T6 | 2026-11-01 | Checksum cyrb53 su JSON canonico | Rilevare corruzione accidentale, sincrono, senza WebCrypto; non è anti-cheat |
| T7 | 2026-11-01 | Idempotenza = `commandId` + `lastCommandId` nello stato; concorrenza = `expectedRevision` | Un solo id di ritorno basta per il doppio click; un registro completo degli id sarebbe crescita illimitata |
| T8 | 2026-11-01 | Data simulata a granularità mensile in M0 | Il giorno/bisestile servono dal calendario eventi (M1); evita API da rifare |
| T9 | 2026-11-01 | shadcn/ui adottato per convenzione (CVA + `cn` + Radix Slot, componenti copiati in `components/ui`), senza il CLI | Il CLI genera molto codice non usato in M0; si aggiungono componenti man mano |
| T10 | 2026-11-01 | React Router v7 in modalità libreria (`react-router`, BrowserRouter) | Sufficiente per SPA; rewrite su Vercel |
| T11 | 2026-11-01 | Vite 8 + plugin-react 6 + Tailwind 4 + Vitest 4 + Zod 4 | Versioni correnti alla data; un'unica copia di Vite nel lockfile |
| T12 | 2026-11-01 | Stringhe UI centralizzate in `i18n/it.ts` (solo italiano in M0) | Prepara le 20 lingue (M5) senza refactor; nessun finto supporto multilingua |
| T13 | 2026-11-01 | Regola M0 di generazione stat iniziali: medie 70/50/20 con spread a campana (Irwin–Hall n=4) | Minima e documentata; ereditarietà/contesto arriveranno in M1/M2 |
| T14 | 2026-11-01 | Playwright su build di produzione (`vite preview`) | Il Service Worker esiste solo nel build; permette test offline reale |

| T15 | 2026-11-01 | Schema v2: il contenuto (eventi, professioni, paesi) arriva al motore via `SimulationContext.content`, mai caricato dal motore | Motore puro e testabile; contenuti versionati e validabili a parte |
| T16 | 2026-11-01 | Eventi: pausa a fine mese (dopo tutti gli aggiornamenti), ripresa dal mese successivo; evento di compleanno forzato prima dei casuali; probabilità casuale 17%/mese tra gli eleggibili | Stato coerente al checkpoint; ~2 eventi/anno senza quote |
| T17 | 2026-11-01 | Contabilità: conti con segno (attività/spese +, passività/ricavi/patrimonio −), somma sempre 0, un solo `transfer` atomico; la cassa non va mai sotto zero (fabbisogno → debito) | Invariante verificabile a ogni comando |
| T18 | 2026-11-01 | I transfer non sono nel journal: solo evento annuale `FINANCE_YEAR` riepilogativo | Evita ~40 righe/anno di journal; il dettaglio resta nei saldi |
| T19 | 2026-11-01 | Mortalità Gompertz calcolata per moltiplicazione ripetuta (niente Math.exp/pow) | Risultati bit-identici su ogni motore JS (determinismo cross-browser) |
| T20 | 2026-11-01 | Minori senza denaro proprio: costi/regali degli eventi ignorati (a carico della famiglia) fino alla gestione di tutela (M2) | Evita debiti assurdi a 1 anno (bug trovato in verifica visiva) |
| T21 | 2026-11-01 | Salvataggi con schemaVersion < 2 segnalati INCOMPATIBLE senza migrazione | M0 era pre-release; la catena di migrazioni parte dal prossimo cambio di schema |
| T22 | 2026-11-01 | Valute locali con `fxPerEur` e `wageFactor` come valori di modello etichettati `estimated-model` | Servono a bilanciare, non pretendono di essere statistiche (nessuna fonte inventata) |
| T23 | 2026-11-01 | Testi degli eventi in italiano dentro il pacchetto contenuti (campo diretto) | Localizzazione M5 li trasformerà in chiavi; segnato come debito noto |

| T24 | 2026-11-01 | Schema v3: famiglia = grafo NPC (npcs, relationships, unions, stories); relazioni solo col protagonista | Scala con le generazioni; la popolazione aggregata arriva in M4 |
| T25 | 2026-11-01 | Continuazione dinastica = nuovo salvataggio, neonato figlio di un parente adulto vivo (discendente > collaterale > lontano parente) alla data di morte | Rispetta "nuova vita dalla nascita" mantenendo genealogia coerente |
| T26 | 2026-11-01 | Potatura generazionale: restano parenti stretti, antenati e coniugi; amici/conoscenti decadono | Limita la crescita (max ~120 NPC in 4 generazioni) |
| T27 | 2026-11-01 | Migrazioni a catena con backup in tabella Dexie `backups` e controllo checksum del legacy | Nessuna perdita di dati nei cambi di schema |
| T28 | 2026-11-01 | Eventi con attore (`actor`), bias su relazione e tratti dell'NPC, memoria bidirezionale | Autonomia degli NPC: le richieste non sono accettate automaticamente |
| T29 | 2026-11-01 | Romance solo tra adulti (≥18 entrambi), imposto dal motore | Regola su età e consenso del master prompt |

| T30 | 2026-11-02 | Schema v4: `world.economy` (motore del mondo), `properties`, `businesses` con libro proprio, `finance.gainsThisYear`, `job.specialization` | Un solo luogo per i tassi; imprese separate dal patrimonio personale |
| T31 | 2026-11-02 | Il motore del mondo estrae l'economia a gennaio; tutti i moduli finanziari la leggono da stato | Requisito "i tassi vengono dal World Engine" |
| T32 | 2026-11-02 | Fiscalità = insiemi di regole per paese con periodi per anno di entrata in vigore (contenuto, non codice) | Versionamento per territorio e periodo; i valori sono di modello |
| T33 | 2026-11-02 | Archetipi di carriera (9) + professioni che li referenziano + specializzazioni | Non 300 motori: si scala con i dati (M5) |
| T34 | 2026-11-02 | Impresa = registro a partita doppia proprio; il proprietario risponde solo del capitale versato; patrimonio netto personale include la quota a valore contabile | Non confondere patrimonio personale e aziendale |
| T35 | 2026-11-02 | Mutuo: anticipo 20%, rata costante 300 mesi, prezzo = 4× stipendio, riserva di 6 mesi; pignoramento dopo 24 mesi in debito; annuità calcolata per moltiplicazione ripetuta (determinismo) | Evita che il gioco ti "spinga" in un mutuo insostenibile |
| T36 | 2026-11-02 | Le attività passano al genitore erede nella dinastia e al figlio adulto alla morte del proprietario NPC; altrimenti si sciolgono | Trasmissione della proprietà agli eredi |
| T37 | 2026-11-02 | Plusvalenze tassate annualmente sul maturato, perdite non riportate | Semplificazione dichiarata, documentata |

| T38 | 2026-11-02 | Schema v5: `world.countries` (popolazione, economia, prezzi, politica, ambiente per paese), `world.history`, `society` (partito, carica, giustizia, fama, cittadinanze, residenza, titoli non riconosciuti) | Mondo persistente e interconnesso |
| T39 | 2026-11-02 | `world.economy` e `world.priceIndex` restano come **specchio** del paese in cui vivi (invariante verificata) | Il codice finanziario esistente non cambia; l'unica fonte resta per-paese |
| T40 | 2026-11-02 | Popolazione ibrida: totale per paese + `tracked` (persone individuali); promozione = tracked+1, nascita = tracked+1 e totale+1, morte = −1 entrambi, retrocessione = tracked−1 | Evita di simulare miliardi di individui e riconcilia i conteggi |
| T41 | 2026-11-02 | Flussi migratori tra paesi forzati a somma zero; demografia solo sull'aggregato | Conservazione della popolazione, testata |
| T42 | 2026-11-02 | Giustizia a stati espliciti (indagine, rinvio, processo, detenzione); la colpevolezza si stabilisce solo con la sentenza; atti illeciti astratti senza istruzioni operative | Accusa ≠ colpevolezza ≠ condanna; contenuti sicuri |
| T43 | 2026-11-02 | Politica: i voti dell'incaricato modificano parametri nazionali (tasse, welfare, ambiente); moltiplicatore per carica | Le decisioni sociali cambiano il mondo senza simulare un parlamento |
| T44 | 2026-11-02 | Trasferimento: conversione dei saldi al cambio, rounding in `equity:fx`, case e imprese vendute, stipendio riscalato al potere d'acquisto | Nessuna ricchezza creata o distrutta |
| T45 | 2026-11-02 | Riconoscimento titoli per blocchi (stesso blocco = pieno; fuori blocco probabilistico) | Riconoscimento internazionale delle qualifiche |
| T46 | 2026-11-02 | `migrateSlot` riceve il bundle di contenuti (serve a costruire il mondo dai dati) | Migrazioni data-driven |

| T47 | 2026-11-02 | Catalogo geografico da **GeoNames** (CC BY 4.0), scaricato con consenso dell'utente; hash e licenza nel manifest e in `data/SOURCES.md`; dati grezzi fuori dal repo | Fonte documentata, riproducibile, nessun dato inventato |
| T48 | 2026-11-02 | Località = 6.000 più grandi + 3 più grandi per paese (da `cities15000`); le liste di città per paese e i 252 paesi sono generati da `scripts/build-geography.mjs` | ≥ 5.000 località con copertura di ogni paese |
| T49 | 2026-11-02 | Le 6.171 località sono in un file separato caricato a richiesta; il motore usa solo i nomi delle città per paese | Bundle e stato leggeri |
| T50 | 2026-11-02 | Parametri per paese non documentati (fasce di reddito, cambi, tassi, istituzioni) = modello `estimated-model`, assegnati per fascia + variazione stabile derivata dal codice | Nessun dato presentato come ufficiale |
| T51 | 2026-11-02 | Random Life estrae il paese in proporzione alla popolazione documentata | Distribuzione realistica della nascita |
| T52 | 2026-11-02 | `minorUnits` per paese: valute con cambio > 200 usano unità intere | Rimane entro i numeri interi sicuri |
| T53 | 2026-11-02 | Gerarchia dei titoli (dottorato ⊃ magistrale ⊃ triennale ⊃ secondaria ⊃ primaria); requisiti delle professioni "uno qualsiasi tra" | Catalogo estensibile senza regole speciali |
| T54 | 2026-11-02 | Carriere speciali come dati di archetipo: `maxAge` (sport) e `volatilityPct` (sport, spettacolo) | Non si scrivono motori separati |
| T55 | 2026-11-02 | Traduzioni: 48 stringhe di interfaccia in 20 lingue, automatiche e non verificate, etichettate come tali; fallback all'italiano; sostituzione a runtime nella tabella `t` | Infrastruttura completa senza spacciare traduzioni non verificate per professionali |
| T56 | 2026-11-02 | Nomi dei paesi e formati numerici dalla piattaforma (`Intl`) nella lingua dell'interfaccia | Nessun dato da tradurre a mano per 252 paesi |
| T57 | 2026-11-02 | La suite di test usa per default un mondo di 12 paesi (stessa logica); test dedicati con il catalogo completo | Tempi di test sostenibili (4,9 ms/comando a pieno catalogo) |
| T58 | 2026-11-02 | Flussi migratori pesati per popolazione; cronaca globale solo per paesi > 20 M e il tuo | Conservazione della popolazione; cronaca leggibile |
| T59 | 2026-11-02 | GOD MODE come comandi del motore (`GOD_TOGGLE`, `GOD_EDIT`), non come scrittura diretta dello stato; patch con schema `strict` | Atomicità, idempotenza, registro e checkpoint gratis; i campi vietati sono rifiutati per costruzione |
| T60 | 2026-11-02 | L'anteprima è `planGodEdit` (funzione pura del motore) | L'anteprima non può divergere da ciò che il comando applica |
| T61 | 2026-11-02 | Obiettivi calcolati dallo stato, mai legati alla modalità GOD | Condivisi, non disattivabili, ereditati dalla dinastia |
| T62 | 2026-11-02 | Talenti/abilità/predisposizioni come meccaniche reali (mortalità, salute, studio, promozioni) ed ereditarie | Le modifiche di GOD MODE hanno effetti veri e coerenti |
| T63 | 2026-11-02 | Ripristino di backup: mai merge; predefinito "conserva entrambe"; "sostituisci" solo su scelta esplicita e con copia in `backups` | Nessuna perdita silenziosa di dati |
| T64 | 2026-11-02 | Sincronizzazione decisa dalla storia (checksum dei checkpoint) e non dagli orari; compare-and-set lato server | Gli orologi possono sbagliare; il server non decide chi vince |
| T65 | 2026-11-02 | Cloud: Supabase via REST senza SDK, URL e chiave pubblica a runtime, token in memoria, RLS per proprietario | Nessun segreto nel client; nulla nel bundle che non serva |
| T66 | 2026-11-02 | IA narrativa: riceve solo fatti testuali, restituisce solo testo sanificato, proxy dell'utente, ripiego sul modello offline | Non può cambiare lo stato canonico; il gioco non dipende dall'IA |
| T67 | 2026-11-02 | Bilanciamento verificato con soglie larghe su centinaia di vite, non con obiettivi di realismo | Intercetta modelli rotti senza spacciare i valori per statistiche |
| T68 | 2026-11-02 | Accessibilità: audit axe-core WCAG 2.1 AA come test e2e permanente (chiaro/scuro, 375 px, editor GOD MODE) | Una regressione di contrasto o di etichette rompe la build |
| T69 | 2026-11-02 | Bundle in tre blocchi (app, contenuti, librerie) | Sotto i 500 kB per blocco; gli aggiornamenti non riscaricano le librerie |
| T70 | 2026-11-02 | Playwright: Chromium e WebKit di default, Firefox opt-in (`E2E_FIREFOX=1`) | Firefox non è eseguibile sulla macchina di sviluppo; non si dichiara verificato ciò che non lo è |
| T71 | 2026-11-03 | **GOD MODE si sceglie solo alla creazione della vita e poi è bloccata** (sostituisce l'attivazione in vita di D12/T59); riproposta a ogni nuova vita di dinastia; nessun comando in UI né nel menu | Richiesta dell'utente (UI Redesign v3.0 §6). Contratto: `godModeEnabled` nello stato (schema v8); `GOD_TOGGLE` deprecato, non rimosso |
| T72 | 2026-11-03 | Migrazione v7→v8 di GOD MODE derivata dalle prove nel salvataggio (registro o modifiche = attiva), mai assegnata arbitrariamente; **da confermare** prima di UI-R2 | Il prompt vieta un valore arbitrario senza strategia verificata |
| T73 | 2026-11-03 | Il redesign procede per fasi UI-R0…R7 con **binari motore** prerequisiti (M-R2, M-R4, M-R5, M-R6) | Il motore non ha comandi di attività, acquisto o relazione: senza di essi i pulsanti sarebbero decorativi |
| T74 | 2026-11-03 | PROJECT LIFE UI SYSTEM: token in `design/tokens.css`, sette temi di area con `data-area`, contrasto ≥ 4,5:1 verificato da test in chiaro e scuro | Coerenza e accessibilità senza colori scritti nei componenti |
| T75 | 2026-11-03 | Nuova dipendenza prevista (da approvare in UI-R1): `@radix-ui/react-dialog` per drawer e modali | Focus trap e ripristino del focus corretti invece di codice scritto a mano |
| T76 | 2026-11-03 | Le sezioni per sistemi non ancora sviluppati sono mostrate come "pianificate", mai come operative | Regole 6–8 del master prompt |
| T77 | 2026-11-03 | Header persistente con menu sempre in alto a sinistra; il nome del protagonista apre `/profilo`; le funzioni non costruite sono righe "Pianificata" non attivabili | Requisito del prompt e regole 6–8: nessun pulsante senza comportamento |
| T78 | 2026-11-03 | Diario = eventi reali del giornale, per età, caricato in background, pagina da 40, aggiornamento incrementale; strutturale: tabella `diary` dedicata in UI-R7 | La scansione filtrata del giornale è lenta su vite lunghe (WebKit) |
| T79 | 2026-11-03 | Finestra evento su `@radix-ui/react-dialog`; una decisione obbligatoria non è chiudibile | Focus trap e ripristino del focus corretti; coerenza con la macchina a stati |
| T80 | 2026-11-03 | `store.init()` idempotente; il tema è stato globale con listener unico | Evitare corse di riapertura e tema che non segue il sistema |
| T81 | 2026-11-04 | Schema v8: `config.godModeEnabled` (+ origine) immutabile, fissato solo da `createGame`/`continueDynasty`; `GOD_TOGGLE` risponde sempre con errore; registro non ereditato; invariante "attività senza scelta = stato non valido" | Attua T71; protegge anche da import manomessi |
| T82 | 2026-11-04 | Personalizzazione alla nascita come `initialGodPatch` dentro la creazione (atomica, stesso schema e stesso piano di `GOD_EDIT`) | Un solo risultato salvato; l'anteprima non può divergere da ciò che nasce |
| T83 | 2026-11-04 | Nuova vita in tre modalità con opzioni diverse; ricchezza e famiglia non scelte; statistiche generate mostrate solo con GOD MODE | Regole dell'economia e niente "reroll finché piace" gratuito |
| T84 | 2026-11-04 | Genere non introdotto finché il GDD non gli dà un effetto; date di nascita 1990–2100 (`SUPPORTED_BIRTH_YEARS`) da confermare | Nessun campo decorativo; dati contemporanei |

## Da decidere (non bloccanti per M0)
- Estensione del Web Worker per la simulazione (M1/M3, in base ai benchmark).
- Strategia di migrazione dati contenuti vs. stato (M1).
- Libreria i18n (ICU/Intl-based) per M5.
