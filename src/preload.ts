// Preload script — runs in renderer context with node access.
// Currently minimal. Extend this when native features are needed
// (e.g., file system access, notifications, protocol handlers).

import { contextBridge } from 'electron';

// Expose a minimal API to the renderer (web app)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
