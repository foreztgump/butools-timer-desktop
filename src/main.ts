import { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs'; // Import fs
import type { TimerPreset, ActiveTimer } from './types/timerTypes'; // Import types
import { timerPresets } from './data/timerPresets'; // Import presets
import Store from 'electron-store'; // Import electron-store

// Define the schema for storing window bounds
interface WindowBounds { x: number; y: number; width: number; height: number; }
interface WindowStateStore {
  windowBounds: Record<string, WindowBounds>; // Map instanceId to bounds
}

// Create and initialize the electron-store instance
const store = new Store<WindowStateStore>({
  schema: {
    windowBounds: {
      type: 'object',
      default: {}
    }
  },
  // Optionally configure name, encryptionKey, etc.
  // name: 'butools-timer-config',
});

// Constants provided by Electron Forge Vite Plugin
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Remove the declarations for Webpack constants
// declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
// declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// REMOVE Map to store timer windows
// const timerWindows = new Map<string, BrowserWindow>();

// REMOVE Flag for listener registration - no longer needed if listeners are simple
// let listenersRegistered = false;

// --- Global State for Timers and Windows ---
const activeTimerStates = new Map<string, ActiveTimer>();
const activeTimerWindows = new Map<string, BrowserWindow>();
let launcherWindow: BrowserWindow | null = null; // Variable to store launcher window reference
let lastFocusedTimerInstanceId: string | null = null; // Track the last focused timer
let currentFocusCycleIndex = -1; // Track the index for keyboard cycling

// --- Global Audio State (Managed by Main Process) ---
let globalVolume = 1.0; // Default volume
let globalIsMuted = false; // Default mute state
// let globalAudioMode = 'voice'; // TODO: Add if needed

// --- Timer Interval Logic ---
let mainIntervalId: NodeJS.Timeout | null = null;
let lastTickTime = performance.now();
// Increase interval to reduce frequency (e.g., 100ms = 10Hz)
const INTERVAL_MS = 100; // Changed from 50

// --- Keep On Top Interval Logic ---
let keepOnTopIntervalId: NodeJS.Timeout | null = null;
const KEEP_ON_TOP_INTERVAL_MS = 1000; // Check every 1 second

// Helper to safely send messages to a timer window
function sendToTimerWindow(instanceId: string, channel: string, ...args: any[]) {
  const window = activeTimerWindows.get(instanceId);
  if (window && !window.isDestroyed()) {
    // console.log(`[Main Send] Sending ${channel} to ${instanceId}`); // Very noisy
    window.webContents.send(channel, ...args);
  }
}

function startMainInterval() {
  if (mainIntervalId !== null) return; // Already running
  // console.log('[Main] Starting main timer interval.');
  lastTickTime = performance.now(); // Reset last tick time
  mainIntervalId = setInterval(() => {
    const now = performance.now();
    const deltaSeconds = (now - lastTickTime) / 1000;
    lastTickTime = now;
    let activeTimersRunning = false;

    activeTimerStates.forEach((timerState, instanceId) => {
      if (timerState.isRunning) {
        const newTimeLeft = Math.max(timerState.timeLeft - deltaSeconds, 0);
        timerState.timeLeft = newTimeLeft; // Update the state object in the map
        activeTimersRunning = true;

        // Revert: Send the full updated state to the specific timer window
        sendToTimerWindow(instanceId, 'timer-state-update', timerState);

        if (newTimeLeft === 0) {
          // --- Timer Looping Logic ---
          // console.log(`[Main Interval] Timer ${instanceId} reached zero. Looping.`);
          const initialTime = timerState.preset.initialTime; // Get initial time
          timerState.timeLeft = initialTime; // Reset timeLeft in the state object
          // DO NOT set isRunning to false
          // Revert: Send the full state again with the looped time
          sendToTimerWindow(instanceId, 'timer-state-update', timerState);
          // --- End Looping Logic ---
        }
      }
    });

    // If no timers are running anymore, stop the interval
    if (!activeTimersRunning) {
      stopMainInterval();
    }
  }, INTERVAL_MS);
}

function stopMainInterval() {
  if (mainIntervalId !== null) {
    // console.log('[Main] Stopping main timer interval.');
    clearInterval(mainIntervalId);
    mainIntervalId = null;
  }
}

// Helper function to broadcast the current global audio state to all windows
function broadcastGlobalAudioState() {
  const state = { volume: globalVolume, isMuted: globalIsMuted };
  // console.log('[Main Broadcast] Sending global audio state:', state);

  // Send to all active timer windows
  activeTimerWindows.forEach((window, instanceId) => {
    if (window && !window.isDestroyed()) {
      // console.log(`[Main Broadcast] Sending to Timer Window: ${instanceId}`);
      window.webContents.send('global-audio-state-changed', state);
    } else {
      // console.warn(`[Main Broadcast] Timer window ${instanceId} is destroyed or null.`);
    }
  });

  // Send to the launcher window using the stored reference
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    // console.log('[Main Broadcast] Sending to Launcher Window.');
    launcherWindow.webContents.send('global-audio-state-changed', state);
  } else {
     // console.warn('[Main Broadcast] Launcher window reference is null or destroyed.');
  }
}

// Determine Renderer Base URL using Forge constants
const RENDERER_BASE_URL = app.isPackaged
  ? `file://${path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`
  : MAIN_WINDOW_VITE_DEV_SERVER_URL;

// --- Function to create the Launcher Window ---
function createLauncherWindow(): void {
  // console.log('[Main] Creating Launcher window...');

  // Define potential paths
  const devIconPath = path.join(__dirname, '../../public/logo.png');
  // Assumes 'public' folder is copied to the root of the app resources in production
  const prodIconPath = path.join(app.getAppPath(), 'public', 'logo.png'); 

  // Determine the correct path based on environment
  const iconPath = app.isPackaged ? prodIconPath : devIconPath;

  // Check if the determined path exists, otherwise use a null/default icon (optional)
  let finalIconPath: string | undefined = undefined;
  try {
    if (fs.existsSync(iconPath)) {
      finalIconPath = iconPath;
    }
  } catch (err) {
    console.error(`[Main] Error checking icon path existence (${iconPath}):`, err);
  }

  if (!finalIconPath) {
    console.warn(`[Main] Icon not found at expected path: ${iconPath}. Window will use default icon.`);
    // Optionally set to null or a default Electron icon path if needed
  }

  // console.log(`[Main] Attempting to load icon from: ${finalIconPath}`);

  // Assign the created window to the global reference
  launcherWindow = new BrowserWindow({
    width: 350, // Keep width relatively narrow
    height: 700, // Increase initial height
    icon: finalIconPath, // Use the validated path or undefined
    autoHideMenuBar: true, // Hide the default menu bar
    alwaysOnTop: false, // Not always on top
    frame: true, // Standard frame
    transparent: false, // Not transparent
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  launcherWindow.on('closed', () => {
    // console.log('[Main] Launcher window closed. Clearing reference & Quitting app.');
    launcherWindow = null; // Clear the reference when closed
    app.quit();
  });

  launcherWindow.loadURL(RENDERER_BASE_URL); // Use the determined base URL

  if (!app.isPackaged) {
    launcherWindow.webContents.openDevTools({ mode: 'detach' });
  }
  // console.log('[Main] Launcher window created.');
}

// --- Function to create individual Timer Windows ---
function createTimerWindow(timerState: ActiveTimer): void {
  if (activeTimerWindows.has(timerState.instanceId)) {
    // console.warn(`[Main] Timer window already exists for ${timerState.instanceId}. Focusing.`);
    activeTimerWindows.get(timerState.instanceId)?.focus();
    return;
  }

  // console.log(`[Main] Creating Timer window for ${timerState.instanceId} with state:`, timerState);

  let timerWindow: BrowserWindow | null = null; // Define outside try block
  try {
    timerWindow = new BrowserWindow({
      width: timerState.size?.width || 192,
      height: timerState.size?.height || 130,
      x: timerState.position?.x, // Use position from timerState
      y: timerState.position?.y, // Use position from timerState
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: true,
      show: false, // Create hidden initially
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  } catch (error) {
      // console.error(`[Main] !!! Failed to create BrowserWindow for ${timerState.instanceId}:`, error);
      return; // Stop if window creation failed
  }

  // console.log(`[Main] BrowserWindow object created for ${timerState.instanceId}. Storing reference.`);
  activeTimerWindows.set(timerState.instanceId, timerWindow);

  // --- Window Event Listeners for State Persistence --- 
  let saveBoundsTimeout: NodeJS.Timeout | null = null;
  const saveBounds = () => {
    if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(() => {
      if (timerWindow && !timerWindow.isDestroyed()) {
        const bounds = timerWindow.getBounds();
        const currentBounds = (store as any).get('windowBounds') || {}; // Cast to any
        // Only save if bounds actually changed to minimize writes
        const stored = currentBounds[timerState.preset.id]; // Use preset.id as key
        if (!stored || stored.x !== bounds.x || stored.y !== bounds.y || stored.width !== bounds.width || stored.height !== bounds.height) {
            // console.log(`[Main Store] Saving bounds for preset ${timerState.preset.id}:`, bounds);
            (store as any).set(`windowBounds.${timerState.preset.id}`, bounds); // Use preset.id as key
        }
      }
      saveBoundsTimeout = null;
    }, 100); // Debounce save by 100ms
  };

  timerWindow.on('resize', saveBounds);
  timerWindow.on('move', saveBounds);
  // --- End Window Event Listeners --- 

  timerWindow.on('ready-to-show', () => {
    // console.log(`[Main] Window ${timerState.instanceId} is ready-to-show. Showing now.`);
    timerWindow?.show();
    startKeepOnTopInterval(); // Start keep-on-top interval when a timer shows
  });

  timerWindow.on('closed', () => {
    // console.log(`[Main] Timer window closed for ${timerState.instanceId}. Cleaning up.`);
    
    // Notify the launcher window BEFORE deleting state
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      // console.log(`[Main] Notifying launcher about closed timer: ${timerState.instanceId}`);
      launcherWindow.webContents.send('timer-closed', timerState.instanceId);
    }

    activeTimerWindows.delete(timerState.instanceId);
    activeTimerStates.delete(timerState.instanceId);

    // --- Remove bounds from store on close - NO LONGER NEEDED if storing by preset ---
    // We want to keep the last known position for the *preset*
    // const currentBounds = (store as any).get('windowBounds') || {}; // Cast to any
    // if (currentBounds[timerState.preset.id]) { // Check using preset.id
    //   console.log(`[Main Store] Deleting bounds for closed window ${timerState.instanceId}`);
    //   delete currentBounds[timerState.preset.id];
    //   (store as any).set('windowBounds', currentBounds); // Cast to any
    // }

    // Stop interval if this was the last timer
    if (activeTimerStates.size === 0) {
      stopMainInterval();
      stopKeepOnTopInterval(); // Stop keep-on-top interval
    }
  });

  // Use hash-based routing with the determined base URL
  const timerUrl = `${RENDERER_BASE_URL}#/timer/${timerState.instanceId}`;
  // console.log(`[Main] Loading URL for timer window ${timerState.instanceId}: ${timerUrl}`);
  timerWindow.loadURL(timerUrl)
    .then(() => {
        // console.log(`[Main] Successfully loaded URL for ${timerState.instanceId}`);
        // Optionally force show again if ready-to-show didn't fire or failed
        // if (!timerWindow.isVisible()) { timerWindow.show(); }
         // Automatically open DevTools for debugging this specific window
         if (!app.isPackaged) {
           // console.log(`[Main] Opening DevTools for timer window ${timerState.instanceId}`);
           timerWindow?.webContents.openDevTools({ mode: 'detach' });
         }
    })
    .catch(err => {
        // console.error(`[Main] !!! Failed to load URL for ${timerState.instanceId}: ${timerUrl}`, err);
        // Clean up if URL loading fails
        activeTimerWindows.delete(timerState.instanceId);
        activeTimerStates.delete(timerState.instanceId);
        if (timerWindow && !timerWindow.isDestroyed()) {
            timerWindow.destroy();
        }
    });

  // Send initial global audio state to the new window
  sendToTimerWindow(timerState.instanceId, 'global-audio-state-changed', { volume: globalVolume, isMuted: globalIsMuted });

  // Notify the launcher window about the new timer
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    // console.log(`[Main] Notifying launcher about new timer: ${timerState.instanceId}`);
    launcherWindow.webContents.send('timer-created', {
      instanceId: timerState.instanceId,
      title: timerState.preset.title,
    });
  }
}

// --- Function to Create Timer State and Window from Preset ---
function createTimerFromPreset(preset: TimerPreset | undefined): string | null {
  if (!preset) {
    // console.error('[Main] Attempted to create timer from undefined preset.');
    return null;
  }

  const instanceId = `${preset.id}-${Date.now()}`;
  // console.log(`[Main] Creating timer for preset: ${preset.title}, instanceId: ${instanceId}`);

  // Define default values (Consider moving these to constants)
  const DEFAULT_TIMER_SIZE = { width: 192, height: 130 };
  const DEFAULT_VOLUME = 1.0;
  const DEFAULT_MUTED = false;

  // --- Restore or Calculate Position/Size ---
  const savedBounds = (store as any).get(`windowBounds.${preset.id}`) as WindowBounds | undefined;
  let initialX: number; // Declare type explicitly
  let initialY: number; // Declare type explicitly
  let initialWidth: number;
  let initialHeight: number;
  let useDefaultPosition = false;

  if (savedBounds) {
    // console.log(`[Main Store] Restoring bounds for preset ${preset.id}:`, savedBounds);
    initialWidth = savedBounds.width;
    initialHeight = savedBounds.height;

    // --- Validate restored bounds against screen geometry --- 
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(display => {
      const displayBounds = display.bounds;
      // Simple check: is the top-left corner within this display?
      return (
        savedBounds.x >= displayBounds.x &&
        savedBounds.y >= displayBounds.y &&
        savedBounds.x < displayBounds.x + displayBounds.width &&
        savedBounds.y < displayBounds.y + displayBounds.height
      );
      // More complex check could ensure at least e.g., 10x10 pixels are visible
    });

    if (isVisible) {
      // console.log(`[Main Store] Saved bounds for ${preset.id} are visible.`);
      initialX = savedBounds.x;
      initialY = savedBounds.y;
    } else {
      // console.warn(`[Main Store] Saved bounds for ${preset.id} are off-screen. Using default position.`);
      useDefaultPosition = true;
      // Assign default values here if position is invalid, even if size might be used
      initialX = (activeTimerStates.size % 5) * 200;
      initialY = Math.floor(activeTimerStates.size / 5) * 150;
    }
    // --- End validation --- 

  } else {
    // console.log(`[Main Store] No saved bounds found for preset ${preset.id}. Using default position/size.`);
    useDefaultPosition = true;
    initialWidth = preset.initialSize?.width || DEFAULT_TIMER_SIZE.width;
    initialHeight = preset.initialSize?.height || DEFAULT_TIMER_SIZE.height;
    // Assign default values here as well
    initialX = (activeTimerStates.size % 5) * 200;
    initialY = Math.floor(activeTimerStates.size / 5) * 150;
  }

  // Calculate default position if needed
  // if (useDefaultPosition) {
  //     // Basic staggering logic (needs improvement)
  //     initialX = (activeTimerStates.size % 5) * 200;
  //     initialY = Math.floor(activeTimerStates.size / 5) * 150;
  // }
  // --- End Restore or Calculate ---

  const newTimerState: ActiveTimer = {
    instanceId,
    preset,
    position: { x: initialX, y: initialY },
    size: { width: initialWidth, height: initialHeight }, // Use determined size
    timeLeft: preset.initialTime || 0,
    isRunning: false,
    audioMode: 'voice', // Defaulting to voice - consider using preset value?
    volume: DEFAULT_VOLUME, // Consider using preset value?
    isMuted: DEFAULT_MUTED, // Consider using preset value?
  };

  activeTimerStates.set(instanceId, newTimerState);
  createTimerWindow(newTimerState);

  return instanceId; // Return the new instanceId
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Use app.whenReady() instead of app.on('ready') for modern Electron versions
app.whenReady().then(() => {
  // Create the Launcher window on startup
  createLauncherWindow();

  // --- Register Global IPC Listeners ONCE --- 
  // console.log('[Main] Registering global IPC listeners...');

  // Handler to create a new timer instance and its window (Uses refactored function)
  ipcMain.handle('add-timer-request', (event, preset: TimerPreset) => {
    // console.log(`[Main IPC] Received add-timer-request for preset: ${preset.title}`);
    return createTimerFromPreset(preset);
  });

  // Listener to close a specific timer window
  ipcMain.on('close-timer-window', (event, instanceId: string) => {
    // console.log(`[Main IPC] Received close-timer-window for: ${instanceId}`);
    const windowToClose = activeTimerWindows.get(instanceId);
    if (windowToClose && !windowToClose.isDestroyed()) {
      windowToClose.destroy(); // Use destroy to bypass close event listeners if needed
    }
    // Cleanup of maps happens in the window's 'closed' event handler
  });

  // --- New IPC Handlers for Timer State/Controls ---

  // Get initial state for a specific timer window
  ipcMain.handle('get-timer-state', (event, instanceId: string): ActiveTimer | null => {
    // console.log(`[Main IPC] Received get-timer-state for: ${instanceId}`);
    return activeTimerStates.get(instanceId) || null;
  });

  // Start Timer
  ipcMain.on('start-timer', (event, instanceId: string) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState && !timerState.isRunning) {
      // console.log(`[Main IPC] Starting timer: ${instanceId}`);
      timerState.isRunning = true;
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
      startMainInterval(); // Ensure interval is running
    }
  });

  // Pause Timer
  ipcMain.on('pause-timer', (event, instanceId: string) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState && timerState.isRunning) {
      // console.log(`[Main IPC] Pausing timer: ${instanceId}`);
      timerState.isRunning = false;
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
      // Interval will stop itself if no timers are running
    }
  });

  // Reset Timer
  ipcMain.on('reset-timer', (event, instanceId: string) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      // --- Corrected Reset Logic --- 
      if (timerState.isRunning) {
        // If timer is running, just reset the time and keep it running
        // console.log(`[Main IPC] Resetting running timer: ${instanceId}`);
        timerState.timeLeft = timerState.preset.initialTime || 0;
        // DO NOT change isRunning state
      } else {
        // If timer is stopped, perform a full reset
        // console.log(`[Main IPC] Resetting stopped timer: ${instanceId}`);
        timerState.isRunning = false; // Ensure it's marked as stopped
        timerState.timeLeft = timerState.preset.initialTime || 0;
      }
      // --- End Corrected Reset Logic ---
      
      // Send the updated state back regardless
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
      // Interval will stop itself if no timers are running (no need for explicit check here)
    }
  });

  // Set Timer Audio Mode
  ipcMain.on('set-timer-audio-mode', (event, { instanceId, mode }: { instanceId: string, mode: string }) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      // console.log(`[Main IPC] Setting audio mode for ${instanceId}: ${mode}`);
      timerState.audioMode = mode;
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
    }
  });

  // Set Timer Volume
  ipcMain.on('set-timer-volume', (event, { instanceId, volume }: { instanceId: string, volume: number }) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      // console.log(`[Main IPC] Setting volume for ${instanceId}: ${clampedVolume}`);
      timerState.volume = clampedVolume;
      timerState.isMuted = clampedVolume === 0 ? true : timerState.isMuted; // Mute if volume is 0
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
    }
  });

  // Set Timer Mute
  ipcMain.on('set-timer-mute', (event, { instanceId, muted }: { instanceId: string, muted: boolean }) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      // console.log(`[Main IPC] Setting mute for ${instanceId}: ${muted}`);
      timerState.isMuted = muted;
      sendToTimerWindow(instanceId, 'timer-state-update', timerState);
    }
  });

  // Update Timer Position (from renderer drag)
  ipcMain.on('update-timer-position', (event, { instanceId, position }: { instanceId: string, position: { x: number, y: number } }) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      // console.log(`[Main IPC] Updating position for ${instanceId}:`, position); // Noisy
      timerState.position = position;
      // No need to send update back to the window that sent it
    }
    // Update the actual window position (handle potential mismatch)
    const window = activeTimerWindows.get(instanceId);
    if (window && !window.isDestroyed()) {
      const [currentX, currentY] = window.getPosition();
      if (currentX !== position.x || currentY !== position.y) {
         // console.log(`[Main IPC] Syncing window position for ${instanceId}`); // Noisy
         window.setPosition(position.x, position.y);
      }
    }
  });

  // Update Timer Size (from renderer resize)
  ipcMain.on('update-timer-size', (event, { instanceId, size }: { instanceId: string, size: { width: number, height: number } }) => {
    const timerState = activeTimerStates.get(instanceId);
    if (timerState) {
      // console.log(`[Main IPC] Updating size for ${instanceId}:`, size); // Noisy
      timerState.size = size;
      // No need to send update back to the window that sent it
    }
     // Update the actual window size (handle potential mismatch)
    const window = activeTimerWindows.get(instanceId);
    if (window && !window.isDestroyed()) {
      const [currentWidth, currentHeight] = window.getSize();
      if (currentWidth !== size.width || currentHeight !== size.height) {
        // console.log(`[Main IPC] Syncing window size for ${instanceId}`); // Noisy
        window.setSize(size.width, size.height);
      }
    }
  });

  // --- Global Audio IPC Handlers ---
  ipcMain.on('set-global-volume', (event, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (globalVolume !== clampedVolume) {
      // console.log(`[Main IPC] Received set-global-volume: ${clampedVolume}`);
      globalVolume = clampedVolume;
      // Potentially auto-mute if volume is 0? Decide on desired behavior.
      // if (globalVolume === 0) globalIsMuted = true;
      broadcastGlobalAudioState(); // Broadcast the change to all windows
    }
  });

  ipcMain.on('toggle-global-mute', (event) => {
    // console.log(`[Main IPC] Received toggle-global-mute. Current: ${globalIsMuted}`);
    globalIsMuted = !globalIsMuted;
    // console.log(`[Main IPC] New global mute state: ${globalIsMuted}`);
    broadcastGlobalAudioState(); // Broadcast the change to all windows
  });

  // --- End New IPC Handlers ---

  // --- Global Start/Stop IPC Handlers ---
  // REMOVE - No longer needed as hotkeys trigger specific handlers directly
  /*
  ipcMain.on('global-start-timer', () => {
    console.log('[Main IPC] Received global-start-timer');
    let timerStarted = false;
    activeTimerStates.forEach((timerState, instanceId) => {
      if (timerState && !timerState.isRunning) {
        console.log(`[Main IPC] Global Start: Starting timer: ${instanceId}`);
        timerState.isRunning = true;
        sendToTimerWindow(instanceId, 'timer-state-update', timerState);
        timerStarted = true;
      }
    });
    if (timerStarted) {
      startMainInterval(); // Ensure interval is running if any timer started
    }
  });

  ipcMain.on('global-stop-timer', () => {
    console.log('[Main IPC] Received global-stop-timer');
    activeTimerStates.forEach((timerState, instanceId) => {
      if (timerState && timerState.isRunning) {
        console.log(`[Main IPC] Global Stop: Pausing timer: ${instanceId}`);
        timerState.isRunning = false;
        sendToTimerWindow(instanceId, 'timer-state-update', timerState);
      }
    });
  });
  */
  // --- End Global Start/Stop IPC Handlers ---

  // --- IPC Handler for Timer Focus --- 
  ipcMain.on('timer-window-focused', (event, instanceId: string) => {
    console.log(`[Main IPC] Received 'timer-window-focused' message with instanceId: ${instanceId}`);
    if (typeof instanceId === 'string' && instanceId.length > 0) {
      lastFocusedTimerInstanceId = instanceId;
      console.log(`[Main IPC] Successfully SET lastFocusedTimerInstanceId to: ${lastFocusedTimerInstanceId}`);
    } else {
      console.error(`[Main IPC] Received invalid instanceId (${instanceId}) for timer focus. Ignoring.`);
    }
  });
  // --- End IPC Handler for Timer Focus --- 

  // Remove old listeners for single-window model
  ipcMain.removeHandler('get-window-position'); 
  ipcMain.removeAllListeners('window-move');
  ipcMain.removeAllListeners('window-minimize');
  ipcMain.removeAllListeners('window-close');

  // console.log('[Main] Global IPC listeners registered.');
  // --- End Global IPC Listeners ---

  // --- Register Global Keyboard Shortcuts --- 
  // console.log('[Main] Registering global keyboard shortcuts...');

  // --- Register preset shortcuts ---
  const registerShortcut = (accelerator: string, presetTitle: string) => {
    const success = globalShortcut.register(accelerator, () => {
      // console.log(`[Main Shortcut] ${accelerator} pressed. Finding preset: ${presetTitle}`);
      // console.log('[Main Shortcut] Available presets at time of check:', timerPresets.map(p => p.title)); // Log available titles
      const preset = timerPresets.find(p => p.title === presetTitle);
      if (preset) {
        createTimerFromPreset(preset);
      } else {
        // console.error(`[Main Shortcut] Preset titled "${presetTitle}" not found!');
      }
    });
    if (!success) {
      // console.error(`[Main Shortcut] Failed to register shortcut: ${accelerator}`);
    } else {
       // console.log(`[Main Shortcut] Registered: ${accelerator} -> ${presetTitle}`);
    }
  };

  registerShortcut('CommandOrControl+Shift+B', 'Backflow');
  registerShortcut('CommandOrControl+Shift+F', 'Fire');
  registerShortcut('CommandOrControl+Shift+L', 'Lightning');
  registerShortcut('CommandOrControl+Shift+R', 'Reflect');
  registerShortcut('CommandOrControl+Shift+S', 'Fuse Storm');
  // --- End preset shortcuts ---


  // --- Global Hotkeys for Start/Stop --- (Focus-based)
  const registerControlShortcut = (accelerator: string, action: 'start' | 'stop') => {
    const success = globalShortcut.register(accelerator, () => {
      console.log(`[Main Shortcut] ${accelerator} pressed for action: ${action}`);
      if (!lastFocusedTimerInstanceId) {
        console.log('[Main Shortcut] No timer window focused. Ignoring action.');
        return;
      }

      const targetInstanceId = lastFocusedTimerInstanceId;
      const timerState = activeTimerStates.get(targetInstanceId);
      
      if (!timerState) {
          console.error(`[Main Shortcut] State for focused timer ${targetInstanceId} not found!`);
          return;
      }

      if (action === 'start') {
        if (!timerState.isRunning) {
            console.log(`[Main Shortcut] Starting focused timer: ${targetInstanceId}`);
            timerState.isRunning = true;
            sendToTimerWindow(targetInstanceId, 'timer-state-update', timerState);
            startMainInterval(); // Ensure interval is running
        } else {
            console.log(`[Main Shortcut] Focused timer ${targetInstanceId} already running.`);
        }
      } else { // action === 'stop'
        if (timerState.isRunning) {
            console.log(`[Main Shortcut] Pausing focused timer: ${targetInstanceId}`);
            timerState.isRunning = false;
            sendToTimerWindow(targetInstanceId, 'timer-state-update', timerState);
        } else {
            console.log(`[Main Shortcut] Focused timer ${targetInstanceId} already paused.`);
        }
      }
    });

    if (!success) {
      console.error(`[Main Shortcut] Failed to register control shortcut: ${accelerator}`);
    } else {
      console.log(`[Main Shortcut] Registered Control: ${accelerator} -> ${action} (Focus-based)`);
    }
  };

  // --- Global Hotkey for Reset --- (Focus-based)
  const registerResetShortcut = (accelerator: string) => {
    const success = globalShortcut.register(accelerator, () => {
      console.log(`[Main Shortcut] Reset (${accelerator}) pressed.`);
      if (!lastFocusedTimerInstanceId) {
        console.log('[Main Shortcut] No timer window focused for reset. Ignoring action.');
        return;
      }
  
      const targetInstanceId = lastFocusedTimerInstanceId;
      const timerState = activeTimerStates.get(targetInstanceId);
  
      if (!timerState) {
        console.error(`[Main Shortcut] State for focused timer ${targetInstanceId} not found for reset!`);
        return;
      }
  
      console.log(`[Main Shortcut] Resetting focused timer: ${targetInstanceId}`);
      // Call the existing reset logic
      if (timerState.isRunning) {
        timerState.timeLeft = timerState.preset.initialTime || 0;
      } else {
        timerState.isRunning = false;
        timerState.timeLeft = timerState.preset.initialTime || 0;
      }
      sendToTimerWindow(targetInstanceId, 'timer-state-update', timerState);
    });
  
    if (!success) {
      console.error(`[Main Shortcut] Failed to register reset shortcut: ${accelerator}`);
    } else {
      console.log(`[Main Shortcut] Registered Reset: ${accelerator} (Focus-based)`);
    }
  };

  // --- Global Hotkeys for Cycling Focus ---
  const registerCycleShortcut = (accelerator: string, direction: 'next' | 'prev') => {
    const success = globalShortcut.register(accelerator, () => {
      console.log(`[Main Shortcut] Cycle ${direction} pressed.`);
      const openTimerIds = Array.from(activeTimerWindows.keys());
      const numTimers = openTimerIds.length;
  
      if (numTimers === 0) {
        console.log('[Main Shortcut] No timers open to cycle through.');
        lastFocusedTimerInstanceId = null;
        currentFocusCycleIndex = -1;
        return;
      }
  
      const currentIndex = lastFocusedTimerInstanceId ? openTimerIds.indexOf(lastFocusedTimerInstanceId) : -1;
      let nextIndex;
  
      if (currentIndex === -1) {
        nextIndex = 0;
      } else {
        if (direction === 'next') {
          nextIndex = (currentIndex + 1) % numTimers;
        } else { // direction === 'prev'
          nextIndex = (currentIndex - 1 + numTimers) % numTimers;
        }
      }
  
      lastFocusedTimerInstanceId = openTimerIds[nextIndex];
      currentFocusCycleIndex = nextIndex; // Update index tracking
      console.log(`[Main Shortcut] Cycled focus to index ${nextIndex}: ${lastFocusedTimerInstanceId}`);
  
      indicateFocus(lastFocusedTimerInstanceId);
    });
  
    if (!success) {
      console.error(`[Main Shortcut] Failed to register cycle shortcut: ${accelerator}`);
    } else {
      console.log(`[Main Shortcut] Registered Cycle: ${accelerator} -> ${direction}`);
    }
  };

  // --- Register the Control/Cycle/Reset Shortcuts ---
  registerControlShortcut('CommandOrControl+Shift+Up', 'start');
  registerControlShortcut('CommandOrControl+Shift+Down', 'stop');
  registerResetShortcut('CommandOrControl+Shift+End');
  registerCycleShortcut('CommandOrControl+Shift+Right', 'next');
  registerCycleShortcut('CommandOrControl+Shift+Left', 'prev');
  // --- End Shortcut Registrations ---

  // --- End Global Keyboard Shortcuts --- 

  app.on('activate', () => {
    // Recreate launcher if no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

// --- App Lifecycle Event for Shortcut Cleanup ---
app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
  // console.log('[Main] Global shortcuts unregistered.');
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // On macOS it's common to stay active until Cmd + Q
  // On other platforms, quit when all windows (including launcher) are closed.
  stopMainInterval(); // Ensure interval stops on quit
  stopKeepOnTopInterval(); // Ensure keep-on-top interval stops on quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---

// Handle request to get the list of active timers for the launcher
ipcMain.handle('get-active-timers', () => {
  // console.log('[IPC Handle] get-active-timers invoked');
  // console.log('[IPC Handle] Current activeTimerStates keys:', Array.from(activeTimerStates.keys())); // Log keys
  // console.log('[IPC Handle] Current activeTimerStates values:', Array.from(activeTimerStates.values())); // Log values
  const timerList = Array.from(activeTimerStates.values()).map(timer => ({
    instanceId: timer.instanceId,
    title: timer.preset.title,
    // Add other basic info if needed, but keep it minimal
  }));
  // console.log('[IPC Handle] Returning active timers:', timerList);
  return timerList;
});

// Handle request to focus a specific timer window
ipcMain.on('focus-timer-window', (event, instanceId: string) => {
  // console.log(`[IPC On] focus-timer-window received for ${instanceId}`);
  const window = activeTimerWindows.get(instanceId);
  if (window && !window.isDestroyed()) {
    // console.log(`[IPC On] Focusing window ${instanceId}`);
    window.focus();
  } else {
    // console.warn(`[IPC On] focus-timer-window: Window ${instanceId} not found or destroyed.`);
  }
});

// Handle request to launch a new timer
ipcMain.handle('launch-timer', (event, preset: TimerPreset) => {
  // console.log(`[IPC Handle] launch-timer received for preset: ${preset.title}`);
  createTimerFromPreset(preset);
});

// Handle request to open an external URL
ipcMain.on('open-external-url', (event, url: string) => {
  // console.log(`[IPC On] Received request to open external URL: ${url}`);
  // Basic validation
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url)
      .then(() => console.log(`[Shell] Successfully opened ${url}`))
      .catch(err => console.error(`[Shell] Failed to open ${url}:`, err));
  } else {
    // console.warn(`[IPC On] Invalid or disallowed URL for open-external-url: ${url}`);
  }
});

// Helper to visually indicate the focused window (optional)
function indicateFocus(instanceId: string) {
  const window = activeTimerWindows.get(instanceId);
  if (window && !window.isDestroyed()) {
    // REMOVE: window.focus(); // Avoid fighting the game for OS focus
    
    // INSTEAD: Send an IPC message for the renderer to handle visual indication
    console.log(`[Main Focus] Sending focus indication IPC to ${instanceId}`);
    sendToTimerWindow(instanceId, 'timer-gain-logical-focus');
  }
} 

// --- End Window Event Listeners --- 

function startKeepOnTopInterval() {
  if (keepOnTopIntervalId !== null || activeTimerWindows.size === 0) return; // Already running or no timers
  console.log('[Main KeepOnTop] Starting interval.');
  keepOnTopIntervalId = setInterval(() => {
    // console.log('[Main KeepOnTop] Interval tick. Re-asserting alwaysOnTop.'); // Very noisy
    activeTimerWindows.forEach((window, instanceId) => {
      if (window && !window.isDestroyed()) {
        // Use a higher level ('screen-saver') for potentially better results with games
        if (!window.isAlwaysOnTop()) { // Only set if it somehow got unset
            console.log(`[Main KeepOnTop] Re-applying alwaysOnTop for ${instanceId}`);
            window.setAlwaysOnTop(true, 'screen-saver');
        }
        // Alternatively, always set it regardless of current state:
        // window.setAlwaysOnTop(true, 'screen-saver');
      }
    });
  }, KEEP_ON_TOP_INTERVAL_MS);
}

function stopKeepOnTopInterval() {
  if (keepOnTopIntervalId !== null) {
    console.log('[Main KeepOnTop] Stopping interval.');
    clearInterval(keepOnTopIntervalId);
    keepOnTopIntervalId = null;
  }
} 