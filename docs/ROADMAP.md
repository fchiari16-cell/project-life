# Roadmap

Ogni milestone richiede: test automatici, build verde, documentazione aggiornata e **approvazione dell'utente** prima della successiva.

| M | Contenuto | Criterio di uscita | Stato |
|---|-----------|--------------------|-------|
| M0 | Fondamenta: monorepo, design system, routing, PWA, motore base, RNG, schemi, IndexedDB, test | Creare, salvare e ripristinare uno stato valido | Completata e approvata |
| M1 | Vertical slice: creazione vita, famiglia essenziale, stat, avanzamento annuale, checkpoint ed eventi, istruzione base, carriera iniziale, finanze essenziali, invecchiamento, morte | Una vita completa dalla nascita alla morte | Completata e approvata |
| M2 | NPC persistenti, personalità, memoria, relazioni, famiglie, figli, successioni, archi narrativi | Più generazioni coerenti | Completata e approvata |
| M3 | Sistema professionale estensibile, archetipi, imprese, contabilità, investimenti, immobili, fiscalità | Economia consistente su simulazioni lunghe | Completata e approvata |
| M4 | Politica, giustizia, fama, migrazioni, mercati globali, demografia, ambiente, istituzioni | Mondo persistente e interconnesso | Completata e approvata |
| M5 | Catalogo globale: tutti i paesi, ≥5.000 località, ≥300 professioni, 20 lingue, validazione completa | Copertura pubblica approvata | Completata e approvata |
| M6 | GOD MODE, backup, import/export, cloud sync opzionale, IA narrativa opzionale | Verificati senza compromettere l'offline | Completata e approvata |
| M7 | Release candidate: bilanciamento, test massivi, accessibilità, prestazioni, compatibilità, migrazioni | Tutti i requisiti bloccanti soddisfatti | **Completata, in attesa di approvazione** (compatibilità parziale: vedi PROGRESS) |

Dipendenze: M1 → M2 → M3 → M4 → M5; M6 dipende da M1 (stato) e M2 (NPC); M7 dopo tutte.
Non pubblicare come versione completa una build che non soddisfa copertura globale e professionale (M5).

## Redesign UI v3.0 (fasi UI-R, non sostituiscono M0–M7)
Dettagli, audit e rischi in `docs/UI_REDESIGN.md`. UI-R0 (audit e design system), UI-R1 (schermata principale) e UI-R2 (nuova vita e GOD MODE, schema v8) e UI-R3 (liste e modali universali, disponibilità delle azioni) completate; UI-R4…R7 in attesa di approvazione una alla volta. Le fasi che aggiungono azioni (R4–R6) richiedono prima un binario motore con schema/versione, migrazione e test.
