import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ActiveTimer, TimerPreset } from './types/timerTypes'; // Import types

// Define the API we are exposing
const electronAPI = {
  // --- Generic Window Controls (Can be used by Launcher or Timer) ---
  // minimizeWindow: () => ipcRenderer.send('window-minimize'), // Removed - less relevant now
  // closeWindow: () => ipcRenderer.send('window-close'),      // Removed - use specific close handlers
  // moveWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('window-move', { deltaX, deltaY }), // Handled by OS/window manager now
  // getWindowPosition: (): Promise<{ x: number, y: number }> => ipcRenderer.invoke('get-window-position'), // Removed - state handled by main

  // --- Launcher Specific API ---
  addTimerRequest: (preset: TimerPreset): Promise<string> => ipcRenderer.invoke('add-timer-request', preset),

  // --- Timer Window Specific API ---
  closeTimerWindow: (instanceId: string) => ipcRenderer.send('close-timer-window', instanceId),
  getTimerState: (instanceId: string): Promise<ActiveTimer | null> => {
    console.log('[Preload] getTimerState invoked for:', instanceId);
    return ipcRenderer.invoke('get-timer-state', instanceId);
  },
  getActiveTimers: (): Promise<{instanceId: string, title: string}[]> => {
    console.log('[Preload] getActiveTimers invoked');
    return ipcRenderer.invoke('get-active-timers');
  },
  startTimer: (instanceId: string) => ipcRenderer.send('start-timer', instanceId),
  pauseTimer: (instanceId: string) => ipcRenderer.send('pause-timer', instanceId),
  resetTimer: (instanceId: string) => ipcRenderer.send('reset-timer', instanceId),
  setTimerAudioMode: (instanceId: string, mode: string) => ipcRenderer.send('set-timer-audio-mode', { instanceId, mode }),
  setTimerVolume: (instanceId: string, volume: number) => ipcRenderer.send('set-timer-volume', { instanceId, volume }),
  setTimerMute: (instanceId: string, muted: boolean) => ipcRenderer.send('set-timer-mute', { instanceId, muted }),
  updateTimerPosition: (instanceId: string, position: { x: number, y: number }) => ipcRenderer.send('update-timer-position', { instanceId, position }),
  updateTimerSize: (instanceId: string, size: { width: number, height: number }) => ipcRenderer.send('update-timer-size', { instanceId, size }),
  focusTimerWindow: (instanceId: string): void => {
    console.log(`[Preload] focusTimerWindow invoked for: ${instanceId}`);
    ipcRenderer.send('focus-timer-window', instanceId);
  },

  // --- Listener API (Main -> Renderer) ---
  // Listener for state updates (e.g., ticks, control changes)
  onTimerStateUpdate: (callback: (event: IpcRendererEvent, timerState: ActiveTimer) => void) => {
    ipcRenderer.on('timer-state-update', callback);
    // Return cleanup function
    return () => ipcRenderer.removeListener('timer-state-update', callback);
  },

  // --- Global Audio Preferences (Renderer -> Main) ---
  setGlobalVolumeRequest: (volume: number): void => ipcRenderer.send('set-global-volume', volume),
  toggleGlobalMuteRequest: (): void => ipcRenderer.send('toggle-global-mute'),

  // Utility to open external URL
  openExternalUrl: (url: string): void => {
    console.log(`[Preload] Requesting to open external URL: ${url}`);
    ipcRenderer.send('open-external-url', url);
  },

  // --- Listener API (Main -> Renderer) ---
  // Listener for when a timer is closed by main process
  onTimerClosed: (callback: (event: IpcRendererEvent, instanceId: string) => void) => {
    ipcRenderer.on('timer-closed', callback);
    return () => ipcRenderer.removeListener('timer-closed', callback);
  },

  // --- Listener API (Main -> Renderer) ---
  onGlobalAudioStateChanged: (callback: (event: IpcRendererEvent, state: { volume: number; isMuted: boolean }) => void) => {
    ipcRenderer.on('global-audio-state-changed', callback);
    return () => ipcRenderer.removeListener('global-audio-state-changed', callback);
  },

  // Listener for when a new timer is created
  onTimerCreated: (callback: (event: IpcRendererEvent, timerInfo: { instanceId: string; title: string }) => void) => {
    ipcRenderer.on('timer-created', callback);
    return () => ipcRenderer.removeListener('timer-created', callback);
  },
};

// Expose the API to the main world
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export the type for the renderer process (optional but good practice)
export type ElectronAPI = typeof electronAPI;

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts 