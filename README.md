# Eiskanal Augsburg

Das Dashboard ist die unveränderte Benutzeroberfläche der Sites-Version, übertragen auf Next.js für Vercel. Die zwei API-Routen lesen aktuelle Messdaten vom Gewässerkundlichen Dienst Bayern und das Kamerabild vom Eiskanal-Betreiber; Wetterdaten kommen direkt von Open-Meteo.

## Starten

```sh
pnpm install
pnpm dev
```

Für den Betrieb sind keine Umgebungsvariablen erforderlich. Es werden keine Anwendungsdaten gespeichert; die Neon-Datenbank wird deshalb derzeit nicht abgefragt. Die Sites-Version bleibt als eigene Veröffentlichung bestehen.
