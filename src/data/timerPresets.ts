import type { TimerPreset } from '../types/timerTypes'; // Updated import path

// Ensure sound aliases match filenames in /resources/audio/ (e.g., backflow.mp3, backflow-in.mp3, 5.mp3)
export const timerPresets: TimerPreset[] = [
  {
    id: 'backflow',
    title: 'Backflow',
    initialTime: 30, // seconds
    completionSound: 'backflow', // Plays when time reaches completionTime
    completionTime: 10, // Play 'backflow' sound when timer shows 10.x seconds remaining
    warningSound: 'backflow-in', // Plays when time reaches warningTime
    warningTime: 16, // Play 'backflow-in' sound when timer shows 16.x seconds remaining
    countdownSounds: { // Time remaining -> sound alias
        15: '5', // Play '5.mp3' when timer shows 15.x seconds left
        14: '4',
        13: '3',
        12: '2',
        11: '1'
    },
    yellowThreshold: 15, // Visual yellow state below 15 seconds
    redThreshold: 10,    // Visual red state below 10 seconds
    initialSize: { width: 192, height: 130 }, // Example size
    // Removed tags and category
  },
  {
    id: 'reflect',
    title: 'Reflect',
    initialTime: 35,
    completionSound: 'reflect',
    completionTime: 5,
    warningSound: 'reflect-in',
    warningTime: 11,
    countdownSounds: { 10: '5', 9: '4', 8: '3', 7: '2', 6: '1' },
    yellowThreshold: 10, // Example threshold
    redThreshold: 5,    // Example threshold
    // initialSize: { width: 192, height: 130 } // Optional: Add if needed
  },
  {
    id: 'fire',
    title: 'Fire',
    initialTime: 30,
    completionSound: 'fire',
    completionTime: 0, // Plays at the very end (0 seconds left)
    warningSound: 'fire-in',
    warningTime: 6,
    countdownSounds: { 5: '5', 4: '4', 3: '3', 2: '2', 1: '1' },
    yellowThreshold: 8,
    redThreshold: 4,
  },
  {
    id: 'lightning',
    title: 'Lightning',
    initialTime: 30,
    completionSound: 'lightning',
    completionTime: 0,
    warningSound: 'lightning-in',
    warningTime: 6,
    countdownSounds: { 5: '5', 4: '4', 3: '3', 2: '2', 1: '1' },
     yellowThreshold: 8,
     redThreshold: 4,
  },
  {
    id: 'fusestorm',
    title: 'Fuse Storm',
    initialTime: 25,
    completionSound: 'fuse-storm',
    completionTime: 0,
    warningSound: 'fuse-storm-in',
    warningTime: 6,
    countdownSounds: { 5: '5', 4: '4', 3: '3', 2: '2', 1: '1' },
     yellowThreshold: 8,
     redThreshold: 4,
  },
];

// Remove or comment out the getPresetsByCategory function as the 'category' field is gone
/*
export function getPresetsByCategory() {
  const categorized: { [category: string]: TimerPreset[] } = {};
  timerPresets.forEach(preset => {
    const category = preset.category || 'Uncategorized';
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(preset);
  });
  return categorized;
}
*/ 