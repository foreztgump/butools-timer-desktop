import { useState, useCallback, useRef } from 'react';
import useTimersStore from '../store/timersStore';
import { useSharedAudioContext } from '../context/AudioProvider';

/**
 * Args for the useLocalAudio hook.
 */
interface UseLocalAudioProps {
  volume: number;
  isMuted: boolean;
  globalVolume: number;
  globalIsMuted: boolean;
}

/**
 * Custom hook to manage and play audio locally within Electron, using a shared AudioContext.
 * Takes per-timer volume and mute status as arguments.
 */
export const useLocalAudio = ({ volume, isMuted, globalVolume, globalIsMuted }: UseLocalAudioProps) => {
  const { audioContext, initializeError } = useSharedAudioContext();
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  /**
   * Plays an audio file based on the sound name.
   * Assumes audio files are MP3s located in ./resources/audio/.
   * @param soundName The exact name of the sound file (without extension).
   */
  const playAudio = useCallback(async (soundName: string | undefined) => {
    setPlaybackError(null);

    if (!soundName) {
      console.warn('[useLocalAudio] playAudio called with undefined soundName.');
      return;
    }

    // --- Global Mute Check --- 
    if (globalIsMuted) {
      console.log(`[useLocalAudio Playback] Global mute enabled. Skipping sound: ${soundName}`);
      return;
    }
    // --- Local Mute Check --- 
    if (isMuted) {
      console.log(`[useLocalAudio Playback] Local mute enabled. Skipping sound: ${soundName}`);
      return;
    }
    // --- Volume Check --- 
    const finalVolume = globalVolume * volume; // Calculate final volume
    if (finalVolume <= 0) {
      console.log(`[useLocalAudio Playback] Final volume is zero (Global: ${globalVolume}, Local: ${volume}). Skipping sound: ${soundName}`);
      return;
    }
    // Check context readiness
    if (initializeError) {
      console.error(`[useLocalAudio] Playback skipped due to AudioProvider error: ${initializeError}`);
      setPlaybackError(`Audio system init failed: ${initializeError}`);
      return;
    }
    if (!audioContext) {
      console.error('[useLocalAudio] Playback skipped: Shared AudioContext not available.');
      setPlaybackError('Audio system not ready.');
      return;
    }
    if (audioContext.state !== 'running') {
       console.warn(`[useLocalAudio] Playback skipped: AudioContext state is ${audioContext.state}. Needs user interaction?`);
       setPlaybackError(`Audio context not running (${audioContext.state}).`);
       return;
    }
    // --- End preliminary checks ---

    // --- Direct Audio Fetch and Play Logic --- 
    const audioSrc = `./resources/audio/${soundName}.mp3`;
    console.log(`[useLocalAudio] Attempting to fetch: ${audioSrc}`);
    try {
      const response = await fetch(audioSrc);
      console.log(`[useLocalAudio] Fetch response for ${soundName}.mp3: ${response.status} ${response.statusText}`);
      if (!response.ok) {
         const responseText = await response.text();
         console.error(`[useLocalAudio] Fetch failed content for ${audioSrc}:`, responseText);
         throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = audioContext.createGain();
      // Use the calculated final volume
      gainNode.gain.value = finalVolume; 
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start();
      // Use the calculated final volume in the log message
      console.log(`[useLocalAudio Playback] Playing sound: ${soundName} at final volume: ${finalVolume.toFixed(2)} (Global: ${globalVolume}, Local: ${volume})`);
      
    } catch (err) {
      console.error(`[useLocalAudio] Error processing sound ${soundName}:`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setPlaybackError(`Failed to load/play ${soundName}.mp3: ${errorMessage}`);
    }
    
  // Dependencies: Added globalVolume, globalIsMuted.
  }, [audioContext, initializeError, isMuted, volume, globalVolume, globalIsMuted]);

  return { playAudio, error: playbackError };
};
