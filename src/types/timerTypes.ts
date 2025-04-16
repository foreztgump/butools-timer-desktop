// Define Timer Preset Interface
export interface TimerPreset {
  id: string; // Unique identifier for the preset
  title: string;
  initialTime: number; // Starting time in seconds
  completionSound?: string; // Sound alias to play when timer reaches completionTime
  completionTime?: number; // Time remaining (seconds) when completionSound plays (e.g., 0 for end, 5 for 5s left)
  countdownSounds?: { [key: number]: string }; // Map of time remaining (seconds) -> sound alias
  initialSize?: { width: number; height: number }; // Default size
  warningSound?: string; // Sound alias for warning state transition
  warningTime?: number;  // Time remaining (seconds) when warningSound plays
  // Visual Warning Thresholds (time remaining in seconds)
  yellowThreshold?: number; // Enters yellow state below this time
  redThreshold?: number;    // Enters red state below this time
  tags?: string[];          // Optional tags for filtering/grouping
}

// Type for the audio mode selection
export type AudioMode = 'voice' | 'beep';

// Interface for a single active timer instance
export interface ActiveTimer {
    instanceId: string; // Unique ID for this instance
    preset: TimerPreset; // The preset configuration used
    position: { x: number, y: number }; // Current position on screen
    size: { width: number, height: number }; // Current size
    timeLeft: number; // Current time left in seconds
    isRunning: boolean; // Is the timer currently running?
    // Audio preferences per timer instance
    audioMode: string; // Can be 'voice', 'beep', or other custom modes
    volume: number; // 0.0 to 1.0
    isMuted: boolean;
} 