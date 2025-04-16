import type { ActiveTimer, TimerPreset } from './timerTypes';
import type { IpcRendererEvent } from 'electron';

// Define the shape of the API exposed by preload.ts
export interface ElectronAPI {
  // Launcher
  addTimerRequest: (preset: TimerPreset) => Promise<string>;

  // Timer Windows
  closeTimerWindow: (instanceId: string) => void;
  getTimerState: (instanceId: string) => Promise<ActiveTimer | null>;
  startTimer: (instanceId: string) => void;
  pauseTimer: (instanceId: string) => void;
  resetTimer: (instanceId: string) => void;
  setTimerAudioMode: (instanceId: string, mode: string) => void;
  setTimerVolume: (instanceId: string, volume: number) => void;
  setTimerMute: (instanceId: string, muted: boolean) => void;
  updateTimerPosition: (instanceId: string, position: { x: number, y: number }) => void;
  updateTimerSize: (instanceId: string, size: { width: number, height: number }) => void;

  // Listeners (Main -> Renderer)
  onTimerStateUpdate: (callback: (event: IpcRendererEvent, timerState: ActiveTimer) => void) => () => void;
}

// Augment the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 