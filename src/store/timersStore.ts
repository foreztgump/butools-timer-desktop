import { create, StateCreator } from 'zustand';
import type { TimerPreset } from '../types/timerTypes'; // Updated import path
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Interface for a single active timer instance in the store
export interface ActiveTimer {
    instanceId: string; // Unique ID for this instance
    preset: TimerPreset; // The preset configuration used
    position: { x: number, y: number }; // Current position on screen
    size: { width: number, height: number }; // Current size
    timeLeft: number; // Current time left in seconds
    isRunning: boolean; // Is the timer currently running?
    // Audio preferences per timer instance
    audioMode: string; // e.g., 'voice', 'beep', 'silent' - could use preset.completionSound as initial?
    volume: number; // 0.0 to 1.0
    isMuted: boolean;
}

// Define the store state and actions
interface TimersState {
    presets: TimerPreset[];
    activeTimers: ActiveTimer[];
    // Global Audio State
    globalAudioMode: string;
    globalVolume: number;
    globalIsMuted: boolean;
    addTimer: (preset: TimerPreset) => void;
    removeTimer: (instanceId: string) => void;
    updateTimerPosition: (instanceId: string, pos: { x: number, y: number }) => void;
    updateTimerSize: (instanceId: string, size: { width: number, height: number }) => void;
    // Timer Control Actions
    startTimer: (instanceId: string) => void;
    pauseTimer: (instanceId: string) => void;
    resetTimer: (instanceId: string) => void;
    // Per-Timer Audio Preference Actions (Keep these)
    setTimerAudioMode: (instanceId: string, mode: string) => void;
    setTimerVolume: (instanceId: string, volume: number) => void;
    setTimerMute: (instanceId: string, muted: boolean) => void;
    // Internal action for countdown
    _tickTimer: (instanceId: string, timeDelta: number) => void;
    // Global Audio Actions
    setGlobalAudioMode: (mode: string) => void;
    setGlobalVolume: (volume: number) => void;
    setGlobalIsMuted: (isMuted: boolean) => void;
    toggleGlobalMute: () => void;
}

// Default size if not provided in preset
const DEFAULT_TIMER_SIZE = { width: 192, height: 130 };
// Default audio settings
const DEFAULT_VOLUME = 1.0;
const DEFAULT_MUTED = false;

// Default Global Audio Settings
const DEFAULT_GLOBAL_AUDIO_MODE: string = 'voice';
const DEFAULT_GLOBAL_VOLUME = 1.0;
const DEFAULT_GLOBAL_IS_MUTED = false;

// Define the state creator function
const timerStateCreator: StateCreator<TimersState> = (set) => ({
    presets: [],
    activeTimers: [],
    // Initialize Global Audio State
    globalAudioMode: DEFAULT_GLOBAL_AUDIO_MODE,
    globalVolume: DEFAULT_GLOBAL_VOLUME,
    globalIsMuted: DEFAULT_GLOBAL_IS_MUTED,

    addTimer: (preset: TimerPreset) => set((state: TimersState) => {
        const instanceId = `${preset.id}-${Date.now()}`; // Changed idPrefix to id
        // Basic staggering of initial positions
        const initialX = (state.activeTimers.length % 5) * 20;
        const initialY = Math.floor(state.activeTimers.length / 5) * 20;
        const newTimer: ActiveTimer = {
            instanceId,
            preset,
            position: { x: initialX, y: initialY },
            size: preset.initialSize || DEFAULT_TIMER_SIZE,
            timeLeft: preset.initialTime || 0, // Use initialTime
            isRunning: false,
            // Initialize audio settings
            audioMode: 'voice', // Default to voice mode
            volume: DEFAULT_VOLUME,
            isMuted: DEFAULT_MUTED,
        };
        console.log(`Adding timer: ${instanceId}`, newTimer);

        return { activeTimers: [...state.activeTimers, newTimer] };
    }),

    removeTimer: (instanceId: string) => set((state: TimersState) => {
        console.log(`Removing timer: ${instanceId}`);
        return {
            activeTimers: state.activeTimers.filter((timer: ActiveTimer) => timer.instanceId !== instanceId),
        };
    }),

    // Updates position, typically called on drag stop
    updateTimerPosition: (instanceId: string, pos: { x: number, y: number }) => set((state: TimersState) => {
         console.log(`Updating position for ${instanceId}:`, pos);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, position: pos } : timer
            ),
        };
    }),

    // Updates size, typically called on resize stop
    updateTimerSize: (instanceId: string, size: { width: number, height: number }) => set((state: TimersState) => {
        console.log(`Updating size for ${instanceId}:`, size);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, size: size } : timer
            ),
        };
    }),

    // Timer Control Actions
    startTimer: (instanceId: string) => set((state: TimersState) => {
        console.log(`Starting timer: ${instanceId}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, isRunning: true } : timer
            ),
        };
    }),

    pauseTimer: (instanceId: string) => set((state: TimersState) => {
        console.log(`Pausing timer: ${instanceId}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, isRunning: false } : timer
            ),
        };
    }),

    resetTimer: (instanceId: string) => set((state: TimersState) => {
        console.log(`Resetting timer: ${instanceId}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, timeLeft: timer.preset.initialTime || 0, isRunning: false } : timer // Use initialTime
            ),
        };
    }),

    // Per-Timer Audio Preference Actions
    setTimerAudioMode: (instanceId: string, mode: string) => set((state: TimersState) => {
        console.log(`Setting audio mode for ${instanceId}: ${mode}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, audioMode: mode } : timer
            ),
        };
    }),

    setTimerVolume: (instanceId: string, volume: number) => set((state: TimersState) => {
        const clampedVolume = Math.max(0, Math.min(1, volume)); // Ensure volume is between 0 and 1
        console.log(`Setting volume for ${instanceId}: ${clampedVolume}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, volume: clampedVolume, isMuted: clampedVolume === 0 } : timer // Also mute if volume is 0
            ),
        };
    }),

    setTimerMute: (instanceId: string, muted: boolean) => set((state: TimersState) => {
        console.log(`Setting mute for ${instanceId}: ${muted}`);
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) =>
                timer.instanceId === instanceId ? { ...timer, isMuted: muted } : timer
            ),
        };
    }),

    // Internal action for countdown
    _tickTimer: (instanceId: string, timeDelta: number) => set((state: TimersState) => {
        // console.log(`Ticking timer: ${instanceId}, timeDelta: ${timeDelta}`); // Reduce console noise
        return {
            activeTimers: state.activeTimers.map((timer: ActiveTimer) => {
                if (timer.instanceId === instanceId && timer.isRunning) {
                    const newTimeLeft = Math.max(timer.timeLeft - timeDelta, 0);
                    // If timer reaches 0, should it auto-reset or stop?
                    // For now, let's just stop it at 0 and keep isRunning true until explicitly paused/reset.
                    // We might need more complex logic later if it needs to auto-loop or auto-pause.
                    return { ...timer, timeLeft: newTimeLeft };
                } else {
                    return timer;
                }
            }),
        };
    }),

    // Global Audio Actions
    setGlobalAudioMode: (mode: string) => set(() => ({ globalAudioMode: mode })),
    setGlobalVolume: (volume: number) => set(() => ({ globalVolume: Math.max(0, Math.min(1, volume)) })),
    setGlobalIsMuted: (isMuted: boolean) => set(() => ({ globalIsMuted: isMuted })),
    toggleGlobalMute: () => set((state) => ({
        globalIsMuted: !state.globalIsMuted,
    })),
});

// Create the Zustand store
const useTimersStore = create<TimersState>(timerStateCreator);

export default useTimersStore; 