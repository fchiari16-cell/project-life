# Architettura

## Pacchetti
| Pacchetto | Ruolo | Dipende da |
|-----------|-------|-----------|
| `@project-life/schemas` | Contratti Zod + tipi + registro versioni | zod |
| `@project-life/engine` | Simulazione pura: `Rng`, `createGame`, `simulate`, macchina a stati, invarianti, checksum | schemas |
| `@project-life/persistence` | Dexie: salvataggi, journal, checkpoint, verifica integrità, export/import | schemas, engine |
| `@project-life/content` | `ContentManifest` e validatori di contenuto (vuoto in M0) | schemas |
| `@project-life/services` | Servizi opzionali: sincronizzazione cloud (`planSync`, `syncOne`, adattatori Memory/Supabase) e narrazione (`narrate`, adattatore HTTP). Nessuna dipendenza dal motore né dallo stato | — |
| `@project-life/web` | React + Vite + Tailwind v4 + Zustand + PWA | tutti |

Il motore non importa mai persistence/React/DOM (regole ESLint in `eslint.config.js`).

## Contratti (in `packages/schemas/src/index.ts`)
- `GameState`: stato canonico (id, revision, seed, **rng**, versioni, dynasty, world, simulation.status, protagonist, lastCommandId).
- `SimulationContext`: `{ rulesVersion, contentVersion }`. *Nota:* l'RNG è dentro `GameState` (non un parametro separato): fa parte dell'input e dell'output, quindi la funzione resta pura.
- `EngineCommand`: unione discriminata; M0: `ADVANCE_YEAR {commandId, expectedRevision}`.
- `EngineResult`: `ok` con `state, events, checkpoint, duplicate` oppure `error {code, message}` (stato invariato).
- `DomainEvent`: id stabile `${gameId}:${revision}:${sequence}`. M0: `LIFE_CREATED`, `MONTH_ADVANCED`, `YEAR_COMPLETED`.
- `SimulationCheckpoint`: `{id, gameId, revision, at, reason, stateChecksum}`.
- `SaveSlot`: metadati (versioni schema/motore/contenuti, seed, rng, revision, status, dinastia, timestamp, checksum) + `state`.
- `ContentManifest`: pacchetti con `provenance` e `source` (obbligatoria se non fittizio).

## Flusso di un comando
`UI → store.advanceYear → simulate(state, cmd, ctx) → commit(db, result) [transazione unica] → set(state)`.
Se `commit` fallisce lo stato visibile non cambia. Doppio click: `busy` guard + `commandId` idempotente + `expectedRevision`.

## Macchina a stati
`IDLE → RUNNING → PAUSED_EVENT → RESOLVING → RUNNING → COMPLETED`, più `ERROR → IDLE` (rollback al checkpoint).
Tabella in `engine/src/machine.ts`. M0 esercita `IDLE|COMPLETED → RUNNING → COMPLETED`; le pause evento arrivano in M1.

## Versionamento
- `SCHEMA_VERSION` (int): forma dei dati persistiti. Si incrementa a ogni cambio incompatibile e richiede una migrazione in catena.
- `ENGINE_VERSION`, `RULES_VERSION` (semver): `RULES_VERSION` cambia quando cambiano i risultati della simulazione; un salvataggio con rules diverse viene rifiutato (`INCOMPATIBLE_VERSION`) finché non esiste una migrazione/regola di compatibilità.
- `CONTENT_VERSION`: pacchetti di contenuti.
- Save con `schemaVersion` più nuova dell'app → `INCOMPATIBLE` (non si tenta di leggerlo).

## Persistenza (Dexie, db `project-life`, schema v1 del DB Dexie; i salvataggi hanno `schemaVersion` 2)
Tabelle: `saves` (id, updatedAt), `journal` (id, gameId, [gameId+revision]), `checkpoints` (id, gameId, [gameId+revision]).
Integrità: checksum cyrb53 su JSON canonico (rilevamento corruzione, non sicurezza) + invarianti del motore a ogni load.
Conflitti: revisione più vecchia o contenuto diverso a pari revisione → `SaveConflictError`; import in conflitto → scelta esplicita ("importa come copia").

## Calendario
Data `{year, month, day}`; l'orologio resta sul giorno di nascita (clamp alla lunghezza del mese, 29/02 → 28/02 negli anni comuni). Fusi orari e stagioni: da M4 (mondo).

## Moduli del motore (M1)
`calendar` · `finance` (partita doppia, imposte, scale locali) · `mortality` · `lifecycle` (compleanno: famiglia, istruzione, carriera, statistiche, riepilogo annuale) · `events` (eleggibilità, pausa, risoluzione, effetti) · `simulate` (orchestrazione, mesi, creazione).
Gli eventi autoriali stanno in `@project-life/content`; `SimulationContext.content` li passa al motore.

## Economia (M3)
`economy` (World Engine + regole fiscali per anno) · `assets` (investimenti, immobili, mutui) · `business` (imprese con libro proprio) · `finance` (conti, patrimonio netto totale, imposte).
Conti personali con segno e somma zero; ogni impresa ha un libro con prefisso `b:` che somma anch'esso a zero. `validateState` controlla entrambi e che i registri (immobili, mutui) coincidano coi conti.

## Mondo e società (M4)
`world` (paesi, motore del mondo, demografia, ambiente, politica, riconciliazione tracked) · `society` (carriera politica, giustizia, fama, residenza, migrazione).
Il mondo è nello stato canonico (`world.countries`) e continua tra generazioni; `world.economy`/`priceIndex` rispecchiano il paese corrente.
Invarianti aggiuntive: tracked per paese = persone vive; popolazione ≥ tracked; specchio locale coerente; residenza = località.

## Catalogo globale (M5)
`packages/content/data/` (generato da GeoNames: `countries.json`, `locations.json`, `catalog-stats.json`) · `geography.ts` (documentato + modello per paese) · `professions-catalog.ts` (363 professioni) · `i18n.ts` (20 lingue, 48 stringhe di interfaccia) · `validate-catalog.ts` (validazione completa).
L'interfaccia sostituisce a runtime le stringhe di `t` con la lingua scelta (le etichette si leggono al render); `lang`/`dir` sul documento.

## PWA
`vite-plugin-pwa` (generateSW, autoUpdate), manifest con icone 192/512/maskable. SPA fallback `index.html`; `vercel.json` con rewrite.
