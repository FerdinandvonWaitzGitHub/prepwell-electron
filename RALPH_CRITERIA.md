# Ralph Criteria — Electron Best Practices Hardening

## C1: DevTools nur im Dev-Modus
**Problem:** `mainWindow.webContents.openDevTools()` wird in Zeile 51 von `src/main.ts` immer aufgerufen — auch im Production-Build.
**Lösung:** DevTools-Aufruf mit `IS_DEV`-Check wrappen.
**Verifikation:** `npx tsc --noEmit` erfolgreich. Code-Review: `openDevTools` nur innerhalb `if (IS_DEV)`.

## C2: Sandbox explizit aktivieren
**Problem:** `sandbox: true` fehlt in `webPreferences`.
**Lösung:** `sandbox: true` zu den `webPreferences` in `createWindow()` hinzufügen.
**Verifikation:** `npx tsc --noEmit` erfolgreich. Code-Review: `sandbox: true` in webPreferences vorhanden.

## C3: Permission-Handler setzen
**Problem:** Kein `ses.setPermissionRequestHandler()` konfiguriert. Renderer könnte beliebige Permissions (Kamera, Mikro, Geolocation) anfordern.
**Lösung:** Im `app.on('ready')` einen restriktiven Permission-Handler setzen, der alle Permissions denied (oder nur explizit erlaubte durchlässt).
**Verifikation:** `npx tsc --noEmit` erfolgreich. Code-Review: Handler existiert und denied standardmäßig.

## C4: Electron Fuses konfigurieren
**Problem:** Electron Fuses sind nicht konfiguriert. Angreifer könnten `ELECTRON_RUN_AS_NODE` oder Inspector-Argumente missbrauchen.
**Lösung:** `@electron/fuses` als devDependency installieren. Afterpack-Script oder electron-builder Hook erstellen, der kritische Fuses deaktiviert:
- `RunAsNode` → disabled
- `EnableNodeCliInspectArguments` → disabled
- `EnableNodeOptionsEnvironmentVariable` → disabled
**Verifikation:** `npm ls @electron/fuses` zeigt Package. Fuses-Script existiert und wird in Build eingebunden.

## C5: Electron-Version aktualisieren
**Problem:** Electron v33 — aktuell ist v41. Fehlende Sicherheitspatches.
**Lösung:** `electron` in `package.json` auf latest stable updaten. Anschließend `npm install` und sicherstellen dass `tsc` + `npm run dev` noch funktionieren.
**Verifikation:** `npx tsc --noEmit` erfolgreich. `npx electron --version` zeigt v41.x.

---

## Reihenfolge
C1 → C2 → C3 → C4 → C5

## Globale Verifikation (nach allen Criteria)
```bash
npx tsc --noEmit
npm run build
```
