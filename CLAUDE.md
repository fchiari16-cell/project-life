# PROJECT LIFE — istruzioni operative permanenti

Simulatore di vita multigenerazionale, PWA offline-first. Specifica: `docs/GDD.md`. Stato: `docs/PROGRESS.md`.
Lingua di lavoro con l'utente: **italiano**. Codice, commenti e identificatori: inglese. Testi UI: `apps/web/src/i18n/`.

## Come lavorare
- Procedi **per milestone** (`docs/ROADMAP.md`). Non iniziare la milestone successiva senza approvazione esplicita dell'utente.
- Prima di una milestone: leggi questo file, ROADMAP, PROGRESS; verifica `git status`; definisci piano e criteri di accettazione.
- Alla fine: `npm run check` (typecheck + lint + test + build), e2e (`npm run e2e`), aggiorna PROGRESS/DECISIONS/TESTING, elenca problemi residui, chiedi conferma.
- Non dichiarare completo ciò che è solo UI o dati dimostrativi. Non inventare risultati di test. Dichiara ciò che non hai potuto verificare.
- Non eliminare requisiti approvati. Le 12 decisioni trasversali (GDD §Decisioni) non si reinterpretano senza chiedere.
- Sii critico: segnala rischi tecnici e proponi alternative motivate.

## Architettura (vincoli)
- Monorepo npm workspaces: `packages/{schemas,engine,persistence,content,services}`, `apps/web`. Niente pnpm.
- `engine` è puro: niente React/DOM/Dexie, niente `Math.random`, `Date.now`, `new Date` (imposto da ESLint). Solo `Rng` con seed.
- `NextState = simulate(state, command, ctx)`. Lo stato RNG vive dentro `GameState`.
- La UI **non muta mai** lo stato canonico: crea un comando → `simulate` → `commit` (persistenza) → poi aggiorna lo store.
- Comandi idempotenti (`commandId`) con concorrenza ottimistica (`expectedRevision`).
- Persistenza: una transazione Dexie per risultato (save + journal + checkpoint). Mai fusione automatica di salvataggi divergenti: errore esplicito.
- Contenuti data-driven, versionati, con provenienza (`real-documented | estimated-model | fictional`). Mai inventare fonti.
- Persone/famiglie/istituzioni fittizie; paesi e città reali. Meccaniche criminali astratte.

## Comandi
```
npm install
npm run dev          # sviluppo (Vite)
npm run check        # typecheck + lint + test + build
npm test             # Vitest (pacchetti + web)
npm run e2e          # Playwright su build di produzione (Chromium + WebKit; Firefox con E2E_FIREFOX=1)
npm run icons        # rigenera icone PWA
npm run geography    # rigenera il catalogo geografico da data/raw (GeoNames, vedi data/SOURCES.md)
npm run validate:content  # report di validazione completo di contenuti, catalogo e traduzioni
```

## Convenzioni
- TypeScript strict (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Import `type` espliciti.
- I pacchetti esportano direttamente i sorgenti (`exports: ./src/index.ts`); nessuno step di build per i pacchetti.
- Zod v4 per gli schemi; i tipi derivano dagli schemi.
- Ogni nuova regola di simulazione: test unitario + test di determinismo.
- Repo in `C:\dev\project-life` (fuori da Dropbox per non sincronizzare `node_modules`).
