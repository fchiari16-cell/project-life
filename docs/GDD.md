# PROJECT LIFE — Specifica funzionale (sintesi operativa)

Fonte autorevole: Master Prompt v1.0 / GDD consolidato v2.7 dell'utente. Questo file ne è la sintesi
operativa per riprendere il lavoro; in caso di dubbio prevale il testo originale. **Azione consigliata:
salvare il testo integrale in `docs/source/master-prompt-v1.0.md`** (non fatto in M0: non disponibile come file).

## Visione
Simulatore di vita profondo, realistico, multigenerazionale e persistente. Una vita alla volta dalla nascita;
NPC con personalità/memoria/autonomia; mondo che evolve da solo; storie emergenti; gioco base interamente offline;
simulazione deterministica e verificabile. Originale: nessuna copia di BitLife (codice, testi, grafica, meccaniche).

## Decisioni trasversali vincolanti (non reinterpretare senza conferma)
1. Epoca iniziale contemporanea, data configurabile in un intervallo supportato dai dataset.
2. Un solo personaggio giocabile per salvataggio.
3. Dinastia: continuazione con nuova vita dalla nascita.
4. Copertura pubblica globale.
5. Professioni pubbliche: catalogo completo, minimo 300 (15–20 settori), con archetipi riusabili.
6. Geografia pubblica: minimo 5.000 località reali, identificatori stabili, provenienza documentata.
7. Salvataggi: slot multipli, backup, esportazione.
8. Difficoltà emergente, nessun selettore.
9. Offline obbligatorio.
10. Cloud opzionale (Supabase, mai richiesto per giocare).
11. IA generativa opzionale (mai modifica lo stato canonico; niente chiavi nel client).
12. GOD MODE: editor di protagonista e NPC (nome, aspetto, stat, personalità, tratti, predisposizioni, talenti, abilità);
    NON modifica denaro, carriera, titoli, leggi, mondo, eventi futuri, genealogia, cronologia, relazioni; achievement condivisi; log informativo.

## Dipartimenti → milestone
| # | Area | Milestone principale |
|---|------|----------------------|
| 01 | Creazione vita (Random / Custom / Continue Dynasty), genealogia | M1 (random), M2 (dinastie) |
| 02 | Personaggio, 8 stat visibili (0–100, stress: alto = peggio), tratti nascosti | M1 |
| 03 | Tempo: "Avanza di un anno" = 12 mesi interni; macchina a stati; eventi bloccanti con checkpoint | M0 base, M1 eventi |
| 04 | Educazione | M1 base, M3 completa |
| 05 | Carriere e imprese (≥300 professioni) | M1 iniziale, M3 |
| 06 | Economia, contabilità, tasse, inflazione (World Engine) | M1 essenziale, M3 |
| 07 | Relazioni e famiglia (multidimensionali, asimmetriche) | M2 |
| 08 | Società: giustizia, politica, fama | M4 |
| 09 | Mondo, geografia, migrazioni, popolazione ibrida A/B/C | M4, M5 |
| 10 | Eventi e narrativa (ibrido, ID stabili, cooldown, effetti differiti) | M1+ |
| 11 | UI/UX, WCAG 2.2 AA, 20 lingue (arabo RTL) | M0 shell, M5 lingue, M7 audit |
| 12 | Persistenza e infrastruttura | M0 locale, M6 cloud |
| — | GOD MODE | M6 |

## Qualità
Vietati: pulsanti senza funzione, dati demo spacciati per reali, statistiche senza regole, eventi che non cambiano la
simulazione, salvataggi con perdita di dati, test dichiarati ma non eseguiti, UI che muta lo stato canonico,
dipendenze obbligatorie da servizi online. Priorità: Coerenza → Affidabilità → Profondità → Giocabilità → Espansione.
