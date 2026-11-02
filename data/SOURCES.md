# Fonti dei dati

## GeoNames (geografia)
- **Fonte**: GeoNames — <https://www.geonames.org/> (file da `https://download.geonames.org/export/dump/`).
- **Licenza**: Creative Commons Attribution 4.0 (CC BY 4.0). L'attribuzione "Geographical data © GeoNames (CC BY 4.0)" è mostrata nell'app (Altro → Informazioni) e riportata nel manifest dei contenuti.
- **File scaricati** il 2026-11-02 (autorizzazione dell'utente):

| File | Byte | SHA-256 |
|------|------|---------|
| `countryInfo.txt` | 32112 | `79F8F59EA01CBB40438BF1856DD6C2FF201F03F8FC72D0530B2646AAF603EF04` |
| `cities15000.zip` | 3365609 | `C7B7482B115463874798824F76381F84103233C0A9DB9D43EFE8501719200DC9` |
| `cities15000.txt` (estratto dallo zip) | — | `15C40ACB067F02528249715F42C21FEB3769192DEBD79B73D6479A1F980B69AE` |

- **Uso**: `scripts/build-geography.mjs` produce `packages/content/data/countries.json` (252 paesi e territori: codici ISO 3166, nome, capitale, area, popolazione, continente, valuta, lingue, confini, fusi) e `locations.json` (località con popolazione superiore a 15.000 abitanti: i 6.000 più grandi del mondo più i 3 più grandi di ogni paese; id GeoNames stabili, coordinate, popolazione, fuso IANA).
- **I file grezzi in `data/raw/` non sono nel repository** (`.gitignore`); per rigenerare i dati scaricarli di nuovo e verificare gli hash.

## Dati di modello (non documentati)
Tutto ciò che il gioco aggiunge a quei dati — fasce di reddito, fattori salariali, tassi di cambio indicativi, tassi demografici, punteggi istituzionali, emissioni, regole fiscali, stipendi delle professioni — è un **modello di bilanciamento** dichiarato `estimated-model` nel manifest; non è una statistica ufficiale né la legge di alcun paese.
