# Ralph Scope — Electron Best Practices Hardening

## Ziel
Alle kritischen Findings aus dem Electron Best Practices Audit beheben.

## Erlaubte Dateien

| Datei | Erlaubte Änderungen |
|-------|---------------------|
| `src/main.ts` | DevTools-Guard, sandbox, Permission-Handler |
| `src/preload.ts` | Keine Änderungen erwartet |
| `package.json` | Electron-Version bump, neue devDependencies (z.B. `@electron/fuses`) |
| `electron-builder.yml` | Fuses-Config falls nötig |
| `tsconfig.json` | Nur falls nötig für neue Imports |

## Verbotene Bereiche
- `src/preload.ts` — Inhalt nicht verändern
- `scripts/notarize.js` — funktioniert, nicht anfassen
- `.github/workflows/` — CI bleibt wie es ist
- `resources/` — Icons, Entitlements, offline.html bleiben
- Keine neuen Dateien erstellen (außer ggf. für Fuses-Config)
- Keine neuen npm-Dependencies außer `@electron/fuses`
