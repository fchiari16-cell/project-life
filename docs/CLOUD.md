# Cloud opzionale e narrazione AI

**Il gioco non ne ha bisogno.** Entrambe le funzioni sono spente di default, non fanno nessuna richiesta di rete finché non le attivi e, se falliscono, mostrano un messaggio senza toccare il salvataggio locale.

## Sincronizzazione (Supabase)
1. Crea un tuo progetto Supabase ed esegui `supabase/migrations/0001_saves.sql` (tabella `saves` con RLS: ogni riga appartiene a `auth.uid()`).
2. In *Altro → Cloud* abilita la funzione, inserisci URL del progetto, chiave **pubblica (anon)**, email e password di un utente del progetto. La chiave service-role non va mai usata. Il token resta in memoria; password e token non vengono salvati.
3. *Sincronizza la vita aperta*: il confronto usa la **storia** (checksum dei checkpoint). Se un lato discende dall'altro si carica o si scarica; se le storie divergono **non cambia nulla**: la versione cloud viene conservata come copia locale e devi scegliere esplicitamente quale tenere. La scrittura è condizionata (compare-and-set) e non sovrascrive mai una versione cambiata nel frattempo.

**Non verificato**: l'integrazione non è stata provata contro un server Supabase reale (solo backend in memoria e `fetch` simulato).

## Narrazione AI
Il client invia a un tuo endpoint HTTP (proxy che custodisce la chiave del modello) solo `{ locale, kind, summary, place }` e accetta `{ text }`. Il testo è sanificato (niente HTML, link o caratteri di controllo, massimo 600 caratteri), con timeout di 4 s; in caso di errore o risposta vuota si usa il testo standard. Non ha accesso a `GameState` e non lo modifica.
