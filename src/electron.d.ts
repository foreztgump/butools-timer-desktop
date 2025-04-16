import type { ElectronAPI as PreloadElectronAPI } from './preload'; // Import the type
import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { TimerPreset, ActiveTimer } from './types/timerTypes';

// Extend the type if needed, or just use the imported one
export type ElectronAPI = PreloadElectronAPI;

// No need to redefine the interface here
// export interface IElectronAPI {
//   minimizeWindow: () => void;
//   closeWindow: () => void;
// }

// Define the shape of the API exposed by preload.ts
export interface ElectronAPI {
  // Launcher Specific API
  addTimerRequest: (preset: TimerPreset) => Promise<string>;

  // Timer Window Specific API
  closeTimerWindow: (instanceId: string) => void;
  getTimerState: (instanceId: string) => Promise<ActiveTimer | null>;
  getActiveTimers: () => Promise<{instanceId: string, title: string}[]>;
  startTimer: (instanceId: string) => void;
  pauseTimer: (instanceId: string) => void;
  resetTimer: (instanceId: string) => void;
  setTimerAudioMode: (instanceId: string, mode: string) => void;
  setTimerVolume: (instanceId: string, volume: number) => void;
  setTimerMute: (instanceId: string, muted: boolean) => void;
  updateTimerPosition: (instanceId: string, position: { x: number, y: number }) => void;
  updateTimerSize: (instanceId: string, size: { width: number, height: number }) => void;
  focusTimerWindow: (instanceId: string) => void;

  // Listener API (Main -> Renderer)
  onTimerStateUpdate: (callback: (event: IpcRendererEvent, timerState: ActiveTimer) => void) => () => void;
  onTimerCreated: (callback: (event: IpcRendererEvent, timerInfo: { instanceId: string; title: string }) => void) => () => void;
  onTimerClosed: (callback: (event: IpcRendererEvent, instanceId: string) => void) => () => void;
  onGlobalAudioStateChanged: (callback: (event: IpcRendererEvent, state: { volume: number; isMuted: boolean }) => void) => () => void;

  // Add Global Timer Control Listeners
  onGlobalStartTimer: (callback: (event: IpcRendererEvent) => void) => () => void;
  onGlobalStopTimer: (callback: (event: IpcRendererEvent) => void) => () => void;

  // Global Audio Preferences (Renderer -> Main)
  setGlobalVolumeRequest: (volume: number) => void;
  toggleGlobalMuteRequest: () => void;

  // Utility
  openExternalUrl: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 