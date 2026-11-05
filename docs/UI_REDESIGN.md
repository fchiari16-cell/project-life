# UI Redesign v3.0 — PROJECT LIFE UI SYSTEM

Specifica: master prompt "UI/UX REDESIGN v3.0" (2026-11-03). Questo documento è l'audit, il piano e le regole del redesign. Le fasi UI-R0…UI-R7 sono fasi del redesign UI e **non sostituiscono** i milestone M0–M7 (tutti completati e approvati).
Stato: **UI-R0, UI-R1, UI-R2 e UI-R3 completate**. UI-R4 non iniziata, in attesa di approvazione.

## 1. Audit (stato effettivo al 2026-11-03)

### Progetto
- M0–M7 completati e approvati; commit `1bbd23b` + correzioni di pubblicazione; online su Cloudflare Pages (`project-life-acl.pages.dev`), repository `fchiari16-cell/project-life`.
- Verifica più recente: 186 test Vitest, 10 esecuzioni e2e (5 × Chromium e WebKit), axe-core WCAG 2.1 A/AA senza violazioni. Firefox e Safari/iOS reali, cloud e AI su servizi reali: **non verificati**.

### Stack UI
React 19, TypeScript strict, Vite 8, Tailwind 4, Zustand, Dexie, react-router. "shadcn/ui" è adottato **per convenzione** (T9: CVA + `cn` + Radix Slot): in `components/ui` esiste solo `button.tsx`. Non c'è `@radix-ui/react-dialog`: finestre e pannelli attuali sono scritti a mano (`EventCard`).

### Mappa delle schermate attuali
| Percorso | File | Contenuto reale | Dati dal motore |
|---|---|---|---|
| `/` Vita | `LifePage.tsx` | nuova vita (form), identità, statistiche, economia, ultimi eventi, pulsante "Avanza di un anno" | stato + giornale |
| `/relazioni` | `RelationshipsPage.tsx` | gruppi famiglia/partner/amici/altri, dimensioni del rapporto, ricordi; modifica GOD MODE | NPC, relazioni |
| `/carriera` | `CareerPage.tsx` | istruzione, titoli, lavoro | stato |
| `/finanze` | `FinancePage.tsx` | conti, immobili, attività, economia (sola lettura) | libro contabile |
| `/altro` | `MorePage.tsx` | sezioni Mondo/Società, tema, lingua, salvataggi, obiettivi, GOD MODE, backup, cloud, AI, cronaca, storia, informazioni | vari |
| `/mondo`, `/societa` | `WorldPage`, `SocietyPage` | mondo per paese, politica, giustizia, residenza | stato |
| (modale) | `EventCard.tsx` | decisione bloccante, ripresa dopo ricarica | `simulation.pending` |

### Componenti esistenti e riuso verso il nuovo sistema
| Esistente | Diventa |
|---|---|
| `StatMeter` | `LifeStatBar` (aggiungere etichetta testuale "alto/basso", non solo colore) |
| `EventCard` | base di `LifeEventModal` (da migrare su `@radix-ui/react-dialog` per focus trap) |
| `EventFeed` | base del diario annuale (raggruppare per età) |
| `DynastyCard`, `SaveList` | restano; spostati nel drawer |
| `Layout` (nav) | resta, con header e drawer nuovi |
| `ui/button` | resta; aggiungere `LifeDecisionButton` |
| tutto il resto (`LifeList*`, `LifeAvatar`, `LifeCharacterHeader`, `LifeMoneyDisplay`, `LifeDisabledAction`, `LifeProgressIndicator`, `LifeActionMenu`, `LifeSectionHeader`, `LifeCategoryDivider`) | **da creare** |

### Cosa il motore sa fare oggi — decisivo per il piano
Comandi pubblici (`EngineCommandSchema`): `ADVANCE_YEAR`, `RESOLVE_EVENT`, `GOD_TOGGLE`, `GOD_EDIT`; più `createGame` e `continueDynasty`. La simulazione è **autonoma**: il giocatore decide solo rispondendo agli eventi e avanzando l'anno. In particolare **non esistono**:
- comandi di attività (palestra, medico, parrucchiere, cinema, viaggi, volontariato…), né un catalogo di attività;
- comandi sulle relazioni (conversare, regalare, litigare, riconciliarsi, cercare un partner);
- comandi di carriera (chiedere aumento/promozione, candidarsi, dimettersi, cambiare orario);
- comandi finanziari (acquistare, vendere, investire, prendere un prestito, fondare un'impresa, fare testamento);
- club e attività extrascolastiche; sport/musica/cinema come percorsi dedicati;
- il concetto di `ActionAvailability` e di budget annuale delle attività;
- campi `genere`, `aspetto` (oltre alla statistica) e scelta di data di nascita nella creazione; la città è un parametro del motore ma non è nel form.
Le pagine Finanze, Carriera, Mondo e Società sono oggi **di sola lettura** (corretto: non c'erano comandi).

Conseguenza: una UI "ricca di attività" **non è solo UI**. Ogni fase che aggiunge azioni richiede prima un livello motore (vedi §5), altrimenti si violano le regole 6, 7 e 8 del master prompt (pulsanti senza comportamento, dati inventati, sezioni dichiarate complete).

### Localizzazione
20 lingue; le 19 non italiane coprono 48 chiavi dell'interfaccia principale, automatiche e non verificate (dichiarato in app). Tutti i testi vivono nell'oggetto `t` di `i18n/it.ts` con sostituzione a runtime. Il master prompt chiede genere grammaticale, plurali e testi lunghi in 20 lingue: richiede un'estensione del pacchetto di traduzioni (nuove chiavi, ICU/`Intl.PluralRules`), con le stesse limitazioni di verifica.

### Direzione visiva precedente
Il prompt cita una direzione "Luxury Editorial" da sostituire: **non esiste nel repository né nei documenti** (T9 e la palette attuale sono un indaco neutro). Nulla da rimuovere; la nuova direzione parte dal tema attuale.

## 2. Direzione visiva e design system (implementato in UI-R0)
`apps/web/src/design/tokens.css` (importato da `index.css`) definisce il **PROJECT LIFE UI SYSTEM**:
- scale: tipografia (`--text-xs…3xl`), spaziatura a 4 px (`--space-*`), raggi, ombre (3 livelli), movimento (`--dur-*`, `--ease-standard`, azzerato con `prefers-reduced-motion`), livelli z, touch target minimo 44 px;
- superfici (`--surface-1/2/3`) e colori di stato per le barre (`--stat-good/warn/bad`);
- **sette temi di area** applicabili con `data-area="…"` (salute turchese, relazioni corallo, istruzione blu, finanze verde, carriera blu intenso, lusso oro, mercati clandestini viola), ciascuno con `--area`, `--area-ink`, `--area-soft`, `--on-area`, in chiaro e in scuro;
- utility Tailwind collegate (`bg-area`, `text-area-ink`, `bg-surface-2`, `shadow-ui-2`, …).
I componenti leggono solo questi token: nessun colore scritto a mano.
`src/design/tokens.test.ts` verifica per ogni area, in chiaro e in scuro, rapporto di contrasto ≥ 4,5:1 (testo/icona su scheda e pagina, inchiostro su superficie tinta, testo su accento pieno) e il focus ≥ 3:1. Il test è stato verificato anche in negativo (un oro con contrasto 2,4 lo fa fallire).
Limite: il colore da solo non basta; le barre e gli stati devono avere sempre numero e testo (regola per UI-R1).

## 3. Architettura della navigazione
- **Mobile**: barra inferiore a 5 voci (Vita, Relazioni, Carriera, Finanze, Altro). **Attività** si raggiunge dalla Vita (azione sotto il pulsante annuale) e da Altro, come richiesto. Header compatto con pulsante **menu in alto a sinistra** (drawer: nuova vita, continua, salvataggi, albero genealogico, cronologia delle vite, lingua, tema, accessibilità, audio/notifiche, import/export, informazioni; **nessun comando GOD MODE**).
- **Tablet**: layout più largo, sidebar opzionale, modali centrate.
- **Desktop**: sidebar adattiva (stessa gerarchia), diario centrale, pannello statistiche laterale.
- **Drawer e modali**: `@radix-ui/react-dialog` (nuova dipendenza da introdurre in UI-R1, con focus trap, ripristino del focus, Esc, `aria-modal`). Il sistema di routing non cambia.
- **Disponibilità delle azioni**: la UI non decide mai. Mostra `ActionAvailability { available, reasons[], requirements[] }` calcolata dal motore (vedi §5).

## 4. Regola GOD MODE (sostituisce quella di M6)
Decisione T71 (2026-11-03), **in sostituzione** di D12/T59 per quanto riguarda l'attivazione:
1. GOD MODE si sceglie **solo alla creazione di una vita** (selettore ATTIVA/DISATTIVA, modificabile fino alla conferma finale). Poi è **bloccata**: persistente nel salvataggio, immutabile in vita, non modificabile da impostazioni, azioni di gioco, importazione o migrazione.
2. Nessun comando di attivazione/disattivazione nell'interfaccia né nel menu.
3. Nella continuazione dinastica la scelta viene **riproposta** per la nuova vita; non si eredita.
4. Resta invariato l'insieme dei campi modificabili e vietati (D12) e il registro modifiche. Gli obiettivi sono condivisi; l'uso di GOD MODE si registra a scopo informativo.
5. Contratto: `LifeConfiguration { godModeEnabled: boolean }` nello stato (schema **v8**) e parametro `godModeEnabled` in `createGame`/`continueDynasty`. Il comando `GOD_TOGGLE` è un contratto pubblico: non si rimuove senza migrazione; verrà **deprecato** (risponde sempre `INVALID_TRANSITION` con motivazione) e tolto dalla UI; `GOD_EDIT` richiede `godModeEnabled === true`.
6. **Migrazione dei salvataggi v7 → v8 (strategia proposta, da confermare)**: non si assegna un valore arbitrario. Si deriva dalle prove contenute nel salvataggio: se il registro `godMode.log` contiene un'attivazione o `godMode.edits > 0` → `godModeEnabled = true` con `godModeOrigin = 'migrated-from-usage'`; altrimenti `false` con `'migrated-no-usage'`. Chi aveva solo acceso e spento senza modifiche resta `true` (la prova esiste). Il valore viene poi bloccato. Test dedicati su salvataggi v6 e v7, con e senza uso.
7. **Stato attuale (UI-R2)**: attuata. Nessun interruttore in nessuna parte dell'app; *Altro → GOD MODE* è di sola lettura.

## 5. Dipendenze tra UI e motore (piano a due binari)
Per rispettare "non duplicare la logica nella UI" ogni fase UI che aggiunge azioni è preceduta da un binario motore (M = motore, U = UI). Le fasi M richiedono nuove regole, schema/versione, migrazioni e test di determinismo: sono lavoro di dimensione paragonabile a un milestone, non a una rifinitura.
| Fase | Binario motore prerequisito | Contenuto |
|---|---|---|
| UI-R1 | nessuno | header, drawer, diario, pulsante annuale, statistiche, navigazione; solo dati esistenti |
| UI-R2 | **M-R2**: schema v8 | `LifeConfiguration`, `godModeEnabled`, migrazione v7→v8, genere/aspetto/città/data in `createGame` dove compatibili con il GDD, deprecazione `GOD_TOGGLE` |
| UI-R3 | piccolo | componenti universali e `LifeEventModal` (usa gli eventi esistenti; costi/benefici solo dove il contenuto li dichiara) |
| UI-R4 | **M-R4**: azioni sociali e scolastiche | `PERFORM_ACTION` + `ActionAvailability`, catalogo azioni (conversare, regalo, litigare, riconciliarsi…), club/attività extrascolastiche come contenuto con effetti reali |
| UI-R5 | **M-R5**: attività e carriera | catalogo attività per categoria, budget annuale, azioni di lavoro (aumento, promozione, candidatura, dimissioni) |
| UI-R6 | **M-R6**: finanza e imprese attive | acquisti/vendite, investimenti, prestiti, imprese gestibili, testamento, azioni criminali astratte, migrazione attiva; tutto nel libro contabile esistente |
| UI-R7 | nessuno | rifinitura, e2e, accessibilità, localizzazione, prestazioni, regressioni, PWA |
In UI-R1…R3 si mostra solo ciò che esiste. Le schermate per sistemi non ancora sviluppati compaiono come **elenco pianificato etichettato**, mai come funzione operativa.

## 6. Piano UI-R0 … UI-R7
| Fase | Stato | Uscita |
|---|---|---|
| UI-R0 Audit e design system | **completata** | questo documento, token, test di contrasto |
| UI-R1 Schermata principale | **completata** (vedi PROGRESS) | header con menu in alto a sinistra, diario annuale, pulsante annuale, statistiche, nav, responsive, modale evento migrata su Radix |
| UI-R2 Nuova vita e GOD MODE | **completata** (vedi PROGRESS) | form completo, selettore bloccato, schema v8, migrazione, test |
| UI-R3 Liste e modali | **completata** (vedi PROGRESS) | componenti `Life*`, azioni bloccate con motivo |
| UI-R4 Relazioni e istruzione | — | richiede M-R4 |
| UI-R5 Carriere e attività | — | richiede M-R5 |
| UI-R6 Finanze, imprese e mondo | — | richiede M-R6 |
| UI-R7 Rifinitura e validazione | — | e2e, WCAG 2.2 AA, 20 lingue, PWA |

## 7. Rischi
1. **Portata del motore** (§5): senza i binari M la UI resterebbe decorativa. Rischio più alto; serve la tua decisione sulla strategia.
2. **Salvataggi**: schema v8 e deprecazione di `GOD_TOGGLE` toccano il contratto pubblico; migrazione e backup obbligatori, test su salvataggi vecchi (esistono fixture solo per v2 e v6/v7).
3. **Localizzazione a 20 lingue** per centinaia di nuove stringhe: traduzioni automatiche non verificabili da madrelingua; plurali e genere grammaticale richiedono l'estensione dell'infrastruttura.
4. **Accessibilità**: WCAG 2.2 AA richiede audit manuale (screen reader, zoom 200–400 %); l'audit automatico copre solo una parte. Firefox e Safari/iOS reali restano non verificati.
5. **Prestazioni**: diario annuale e liste lunghe richiedono virtualizzazione sopra qualche centinaio di righe; il budget attuale è 13,6 ms/comando.
6. **Dipendenze**: `@radix-ui/react-dialog` (focus trap, drawer) è l'unica nuova dipendenza prevista; da approvare in UI-R1.
7. **Contenuti sensibili**: attività illegali e casinò restano astratti; i casinò solo dove legalmente consentiti (richiede dati giuridici per paese che oggi sono modelli).
8. **Regressione estetica**: il cambio di palette tocca tutte le schermate; i test axe e2e esistenti la intercettano per il contrasto, non per l'usabilità.

## 8. Criteri di accettazione (invariati dal master prompt) e verifica
Come in §24 del master prompt. Ogni fase deve chiudersi con typecheck, lint, test, build, e2e e un elenco di ciò che non è verificato. Test obbligatori elencati in §23 del master prompt: UI-R0 non li soddisfa ancora (nessuna schermata nuova); vengono costruiti fase per fase.
