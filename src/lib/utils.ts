import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats time in seconds to SS.T format (seconds and tenths of a second).
 * @param timeInSeconds The time in seconds.
 * @returns The formatted time string.
 */
export function formatTime(timeInSeconds: number): string {
  const seconds = Math.floor(timeInSeconds);
  const tenths = Math.floor((timeInSeconds - seconds) * 10);
  return `${seconds.toString().padStart(2, '0')}.${tenths}`;
} 