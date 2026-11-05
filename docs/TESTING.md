# Strategia e risultati dei test

## Strumenti
Vitest 4 (unit/integrazione; ambiente `node` per i pacchetti, `jsdom` per il web; `fake-indexeddb` per Dexie),
Playwright (e2e su build di produzione), ESLint (con regole di purezza del motore), `tsc` strict.

## Copertura (esito reale, 2026-11-01, fine M1)
**186 test Vitest + 10 esecuzioni Playwright (5 test × Chromium e WebKit) superati (fine M7)**; typecheck, lint e build puliti.

| Area | File | Cosa verifica |
|------|------|---------------|
| RNG | engine/test/rng | determinismo, ripresa da stato serializzato, range, uniformità |
| Calendario e motore | engine/test/simulate | bisestili e 29/02; creazione valida/deterministica; anno = 12 mesi; idempotenza; revisioni stale; pausa evento con checkpoint e ripresa; decisione una sola volta; vita intera nascita→morte con tutti gli invarianti; replay identico; scelte diverse divergono; scuola primaria; minori senza denaro; macchina a stati |
| Simulazione massiva | engine/test/mass | 300 vite complete: nessun errore di integrità, aspettativa di vita, mortalità infantile, istruzione/carriera, distribuzione ricchezza, prestazioni (~0,4 ms/comando) |
| NPC/genealogia (M2) | engine/test/social | grafo valido, relazioni asimmetriche, cicli/genitori troppo giovani rifiutati, autonomia (accetta/rifiuta), eventi sociali, figli, codici di parentela |
| Dinastie (M2) | engine/test/dynasty, mass-dynasty | neonato alla data di morte, antenato, ereditarietà, feud ereditata, 3–4 generazioni, nessun erede, determinismo; 48 vite multi-generazione |
| Migrazione (M2) | engine/test/migration, persistence | v2→v3 valida e giocabile, backup, legacy corrotto rifiutato |
| Economia (M3) | engine/test/economy | motore del mondo (determinismo, ritorno alla media), tassazione versionata e progressiva, investimenti, mutuo fino all'estinzione, pignoramento, vendita casa, imprese (libro bilanciato, fallimento con responsabilità limitata, vendita, eredità), eventi economici end-to-end, determinismo |
| Coerenza di lungo periodo (M3) | engine/test/mass-economy | 150 vite + 10 dinastie × 4 generazioni: tutti i libri a zero, nessun conto che deriva, cassa mai negativa, imprese ereditate |
| Pagina Finanze | web/src/pages/FinancePage.test | rende saldi, immobili, attività ed economia dallo stato canonico |
| Società e mondo (M4) | engine/test/society | mondo per paese, conservazione della popolazione, riconciliazione tracked/aggregato, ciclo globale correlato, elezioni e cambi di governo, feedback ambientale, politica (carica, stipendio, voti, tasse), giustizia (accuse deboli, avvocato, patteggiamento, assoluzione, condanna, carcere, rilascio, precedenti, severità), fama, migrazione (valuta, famiglia, titoli, visti, cittadinanza, distanza), generazioni |
| Coerenza di lungo periodo (M4) | engine/test/mass-society | 150 vite + 6 dinastie × 4 generazioni con tutte le funzioni sociali attive |
| Pagine Mondo/Società | web/src/pages/WorldPage.test | rendering dallo stato canonico, accusa ≠ colpevolezza |
| Catalogo globale (M5) | content/test/catalog, report | ≥200 paesi, ≥5.000 località, ≥300 professioni, 15–20 settori, 20 lingue; validazione di duplicati, riferimenti, fusi orari IANA, eventi impossibili, storie irraggiungibili e circolari, coerenza dei salari, traduzioni; provenienza e licenza nel manifest; il validatore rileva cataloghi rotti |
| Catalogo nel motore (M5) | engine/test/global | vita in tutti i 252 paesi, distribuzione per popolazione, conservazione della popolazione su 252 paesi, vite in tutte le fasce, dinastia globale, gerarchia dei titoli, studi avanzati, fine carriera sportiva, migrazione v5→v6 |
| Lingue (M5) | web/src/pages/WorldPage.test, e2e | cambio lingua, RTL arabo, fallback, persistenza |
| GOD MODE v8 (UI-R2) | engine/test/god, migration; persistence/test | scelta alla creazione e blocco (nessun comando, azione, patch o import la cambia), GOD_TOGGLE sempre rifiutato, invariante su stati manomessi, personalizzazione atomica alla nascita (anteprima = nascita), finestra di date, dinastia (scelta non ereditata, registro non ereditato, cronaca), migrazione v7→v8 (4 casi) e catene v6/v2→v8, import forgiato rifiutato |
| Nuova vita (UI-R2) | web/src/components/life/NewLife.test, game/services.test; e2e god.spec, life.spec, a11y.spec | modalità e opzioni, nessun campo per ricchezza/famiglia, città per paese, data fuori finestra rifiutata dal motore, scelta GOD MODE (predefinito OFF, conferma definitiva, "Indietro"), personalizzazione con anteprima, dinastia con scelta riproposta, GOD MODE sola lettura, audit axe della schermata e della conferma |
| UI-R1 unitari | web/src/components/life/life.test, lib/theme.test | barre statistiche (valore, parola, confini, stress), raggruppamento del diario, diario persistente dopo riavvio, menu (voci, "pianificata", nessun GOD MODE, Nuova/Continua vita), doppio clic sull'avanzamento, finestra evento non chiudibile e ripresa dopo ricaricamento, profilo, init idempotente, tema globale |
| UI-R1 e2e | web/e2e/ui-r1.spec, a11y.spec | layout su telefono/tablet/desktop (menu in alto a sinistra, pulsante raggiungibile, navigazione, nessuno scroll orizzontale, 8 statistiche, diario), diario persistente e decisione bloccante, tastiera del menu, collegamenti; axe su profilo, menu (chiaro/scuro) e finestra evento |
| Design system (UI-R0) | web/src/design/tokens.test | contrasto WCAG ≥ 4,5:1 di tutte le coppie base e delle 7 aree in chiaro e scuro, focus ≥ 3:1, token e aree completi, riduzione del movimento |
| Release candidate (M7) | engine/test/release, migration | 150 vite ridotte + 30 globali (demografia, ricchezza, integrità), budget di prestazioni (ms/comando, KB), catena di migrazione v2→v7 fino alla morte |
| Accessibilità (M7) | web/e2e/a11y.spec | axe-core WCAG 2.1 A/AA su tutte le pagine, chiaro/scuro, 375 px senza scroll orizzontale, editor GOD MODE |
| GOD MODE e obiettivi (M6) | engine/test/god | attivazione/disattivazione, campi ammessi e vietati, atomicità, idempotenza, registro, NPC, decisione in attesa, bersaglio morto, vita identica con GOD acceso e nessuna modifica, obiettivi condivisi ed ereditati, talenti ereditati/deterministici, migrazione v6→v7 |
| Backup/integrità/sync (M6) | persistence/test | backup completo, ripristino con conflitti (copia/ignora/sostituisci), file non validi, integrità, lineage, adozione |
| Servizi opzionali (M6) | services/test | planSync su storia, conflitti, compare-and-set, Supabase con fetch simulato (nessun server reale), narratore (ripiego, timeout, sanificazione, nessuna chiave) |
| Web M6 | web/src/game/services.test | GOD MODE dallo store, anteprima→conferma/annulla, backup, conflitto cloud tra due dispositivi, **garanzia offline (nessuna chiamata di rete)** |
| E2E M6 | web/e2e/god.spec | GOD MODE anteprima→conferma→registro, ricarica e offline, backup e integrità offline, servizi spenti di default |
| Persistenza | persistence/test | salva/ripristina, riapertura DB, idempotenza, rifiuto revisioni vecchie, corruzione, export/import con conflitti, schema vecchio incompatibile |
| Schemi/contenuti | schemas/test | stat, comandi, validatori (duplicati, scelte mancanti, decline, eventi non gated), manifest |
| Store web | web/src/game/store.test | vita intera attraverso lo store con ripristino dopo riavvio; doppio click; decisione pendente ripresa; errori |
| App | web/src/App.test | navigazione e form |
| E2E | web/e2e/life.spec | crea → decisioni → ricarica → offline con SW → pagine reali → vita intera fino alla morte → ricarica dopo la morte; tema/navigazione |

## Non ancora coperto (da M1 in poi)
Test di proprietà, simulazioni da migliaia di vite/multi-generazione, benchmark mobile, audit accessibilità automatico (axe),
Safari/iOS e Firefox, migrazioni tra versioni di schema (esiste solo la v1).
