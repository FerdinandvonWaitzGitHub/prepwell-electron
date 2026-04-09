// Preload script — runs in isolated renderer context with node access.
// Exposes a typed API to the web app via contextBridge.
// The web app accesses this as window.electronAPI (typed in vite-env.d.ts).

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /** Always true — used by ElectronGate to detect the Electron wrapper */
  isElectron: true,
  /** Current OS: 'darwin' | 'win32' | 'linux' */
  platform: process.platform,
  /** Opens a URL in the system default browser (for Stripe, OAuth, etc.) */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
});
