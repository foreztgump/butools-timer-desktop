import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import { formatTime } from '../lib/utils';
import { cn } from '../lib/utils';
import { ActiveTimer } from '../types/timerTypes';
import { useLocalAudio } from '../hooks/useLocalAudio';
import useTimersStore from '../store/timersStore';
import { Button } from './ui/button';
import { Slider } from '@/components/ui/slider'; // Use Shadcn Slider (Corrected Path)
import { Settings, X, Play, Pause, RotateCcw, Volume2, VolumeX, Mic, Bell, GripVertical } from 'lucide-react'; // Add GripVertical

// Create motion versions of components
const MotionButton = motion(Button); // Create motion version of Button

interface TimerProps {
  timer: ActiveTimer;
}

const api = window.electronAPI;

// Define stricter variants type
type TimerVisualVariant = "normal" | "yellow" | "red" | "finished";

const Timer: React.FC<TimerProps> = ({ timer }) => {
  // --- Existing State/Hooks (keep as is) ---
  const globalVolume = useTimersStore(state => state.globalVolume);
  const globalIsMuted = useTimersStore(state => state.globalIsMuted);
  const setStoreGlobalVolume = useTimersStore(state => state.setGlobalVolume);
  const setStoreGlobalIsMuted = useTimersStore(state => state.setGlobalIsMuted);

  useEffect(() => {
    const cleanup = api.onGlobalAudioStateChanged((event, newState) => {
      setStoreGlobalVolume(newState.volume);
      setStoreGlobalIsMuted(newState.isMuted);
    });
    // Ensure the returned function matches the expected EffectCallback cleanup signature
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [setStoreGlobalVolume, setStoreGlobalIsMuted, timer.instanceId]);

  const { playAudio, error: audioError } = useLocalAudio({
    volume: timer.volume,
    isMuted: timer.isMuted,
    globalVolume: globalVolume,
    globalIsMuted: globalIsMuted,
  });
  const playedSoundsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Keep audio error log
    if (audioError) console.error(`[Timer ${timer.instanceId}] Audio Error:`, audioError);
  }, [audioError, timer.instanceId]);

  useEffect(() => {
     // --- Audio Playback Logic (keep as is) ---
      if (!timer || !timer.isRunning || timer.audioMode === 'silent') {
          playedSoundsRef.current.clear();
          return;
      }
      // ... (rest of your existing sound playback logic) ...
       const { timeLeft, preset } = timer;
        const { completionSound, warningSound, countdownSounds, warningTime, completionTime } = preset;
        const currentTimeSeconds = Math.floor(timeLeft);

        let soundToPlay: string | undefined = undefined;
        let soundKey: string | undefined = undefined;

        if (timer.audioMode === 'voice') {
            if (completionTime !== undefined && currentTimeSeconds <= completionTime && completionSound) { soundToPlay = completionSound; soundKey = `completion-${soundToPlay}`; }
            else {
                let playedCountdown = false;
                if (countdownSounds) {
                    const countdownSoundName = countdownSounds[currentTimeSeconds];
                    if (countdownSoundName) { soundToPlay = countdownSoundName; soundKey = `countdown-${currentTimeSeconds}-${soundToPlay}`; playedCountdown = true; }
                }
                if (!playedCountdown && warningTime !== undefined && currentTimeSeconds <= warningTime && warningSound) { soundToPlay = warningSound; soundKey = `warning-${soundToPlay}`; }
            }
        }
        else if (timer.audioMode === 'beep') {
            const BEEP_SHORT = 'beep-short'; const BEEP_LONG = 'beep-long';
            if (completionTime !== undefined && currentTimeSeconds <= completionTime) { soundToPlay = BEEP_LONG; soundKey = `completion-beep`; }
            else {
                let playedCountdownBeep = false;
                 if (countdownSounds && countdownSounds[currentTimeSeconds] !== undefined) { soundToPlay = BEEP_SHORT; soundKey = `countdown-${currentTimeSeconds}-beep`; playedCountdownBeep = true; }
                 if (!playedCountdownBeep && warningTime !== undefined && currentTimeSeconds <= warningTime) { soundToPlay = BEEP_SHORT; soundKey = `warning-beep`; }
            }
        }
        if (soundToPlay && soundKey && !playedSoundsRef.current.has(soundKey)) {
          // Comment out the verbose sound playing log
          // console.log(`[TimerAudio ${timer.instanceId} Mode: ${timer.audioMode}] Playing sound: ${soundToPlay} (Key: ${soundKey})`);
          playAudio(soundToPlay);
          playedSoundsRef.current.add(soundKey);
        }
  }, [timer.timeLeft, timer.isRunning, timer.audioMode, timer.preset, playAudio, timer.instanceId]);

  const initialTimeRef = useRef(timer.preset.initialTime);
  useEffect(() => {
    // Clear played sounds whenever the timer resets to its initial time,
    // regardless of running state (handles manual reset AND loops).
    if (timer && timer.timeLeft === timer.preset.initialTime) {
      if (playedSoundsRef.current.size > 0) {
        // Comment out the sound clearing log
        // console.log(`[TimerComponent ${timer.instanceId}] Time reset to initial. Clearing played sounds.`);
        playedSoundsRef.current.clear();
      }
    }
    // Update ref for potential future use if needed
    initialTimeRef.current = timer?.preset.initialTime ?? initialTimeRef.current;
    // Dependencies: timeLeft and initialTime are the key triggers
  }, [timer?.timeLeft, timer?.preset.initialTime, timer?.instanceId]);
  // --- End Existing State/Hooks ---

  if (!timer) return null;

  const displayTime = formatTime(timer.timeLeft);
  const isFinished = timer.timeLeft <= 0; // Explicit finished state

  // Determine background color/pulse state
  const { yellowThreshold = 10, redThreshold = 5 } = timer.preset; // Default thresholds
  const isRed = !isFinished && redThreshold !== undefined && timer.timeLeft <= redThreshold;
  const isYellow = !isFinished && !isRed && yellowThreshold !== undefined && timer.timeLeft <= yellowThreshold;

  // --- Enhanced Motion Variants ---
  const variants: Variants = {
    // Normal state: semi-transparent bg, transparent border
    normal: { 
      backgroundColor: "hsla(240, 10%, 3.9%, 0.4)", 
      borderColor: 'transparent', 
      borderWidth: '2px', // Keep consistent border width 
      color: "hsl(var(--foreground))", 
      scale: 1, 
      transition: { duration: 0.4, ease: "easeOut" } 
    },
    // Yellow state: same bg, yellow border
    yellow: { 
      backgroundColor: "hsla(240, 10%, 3.9%, 0.4)", // Keep background
      borderColor: 'hsl(48, 96%, 59%)', // Yellow border 
      borderWidth: '2px',
      color: "hsl(var(--foreground))", 
      scale: 1, 
      transition: { duration: 0.4, ease: "easeOut" } 
    },
    // Red state: same bg, red border, scale pulse
    red: {
      backgroundColor: "hsla(240, 10%, 3.9%, 0.4)", // Keep background
      borderColor: 'hsl(0, 72%, 51%)', // Red border
      borderWidth: '2px',
      color: "hsl(var(--foreground))",
      scale: [1, 1.01, 1],
      transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
    },
     // Finished state: semi-transparent bg, transparent border
     finished: { 
      backgroundColor: "hsla(240, 10%, 3.9%, 0.4)", 
      borderColor: 'transparent',
      borderWidth: '2px',
      color: "hsl(var(--muted-foreground))",
      scale: 1,
      transition: { duration: 0.4, ease: "easeOut" }
     },
  };

  const currentVariant: TimerVisualVariant = isFinished ? 'finished' : isRed ? 'red' : isYellow ? 'yellow' : 'normal';

  // --- Event Handlers (using api) ---
  const handleStart = useCallback(() => api.startTimer(timer.instanceId), [timer.instanceId]);
  const handlePause = useCallback(() => api.pauseTimer(timer.instanceId), [timer.instanceId]);
  const handleReset = useCallback(() => {
      api.resetTimer(timer.instanceId);
       // Clear played sounds immediately on reset click, regardless of running state
       playedSoundsRef.current.clear();
       // Comment out the reset log
       // console.log(`[TimerComponent ${timer.instanceId}] Reset clicked, cleared played sounds.`);
  }, [timer.instanceId]);
  const handleClose = useCallback(() => api.closeTimerWindow(timer.instanceId), [timer.instanceId]);
  const handleMuteToggle = useCallback(() => api.setTimerMute(timer.instanceId, !timer.isMuted), [timer.instanceId, timer.isMuted]);
  const handleVolumeChange = useCallback((value: number[]) => api.setTimerVolume(timer.instanceId, value[0]), [timer.instanceId]);
  const handleAudioModeChange = useCallback((newMode: 'voice' | 'beep') => api.setTimerAudioMode(timer.instanceId, newMode), [timer.instanceId]);

  return (
    // Root div - Handles layout AND animations now
    <motion.div
      layout // Keep layout for smooth resizing
      className={cn(
          "timer-component h-full w-full flex flex-col rounded-lg overflow-hidden",
          "backdrop-blur-sm border-2" // Add back backdrop-blur, add border-2
      )}
      variants={variants} // Animate this div
      animate={currentVariant}
      initial={false} 
    >
      {/* Header (static) */}
      <div
        className="timer-drag-handle p-1.5 flex justify-between items-center /*bg-black/30 backdrop-blur-sm*/ flex-shrink-0 cursor-grab" // Keep header background removed
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Drag handle icon - Make responsive */}
        <GripVertical className="text-muted-foreground/50 w-[clamp(0.75rem,6vw,1rem)] h-auto flex-shrink-0" /> 
        {/* Title - Make responsive */}
        <span 
           className="font-medium truncate px-2 text-muted-foreground flex-grow text-center text-[clamp(0.6rem,8vw,1.1rem)]" 
           title={timer.preset.title} // Add title attribute for full name on hover
         >
          {timer.preset.title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:bg-destructive/40 hover:text-destructive-foreground flex-shrink-0"
          onClick={handleClose}
          title="Close Timer"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Close icon - Make responsive */}
          <X className="w-[clamp(0.75rem,6vw,1rem)] h-auto" /> 
        </Button>
      </div>

      {/* Inner wrapper - Handles content animation (color, scale) */}
      <motion.div
        className="flex-grow flex flex-col items-center justify-between relative"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        variants={variants} // ADDED variants here
        animate={currentVariant} // ADDED animate here
        initial={false} // Keep initial false for inner too
      >
        {/* Time Display */}
        <div className="font-mono font-bold text-center tabular-nums leading-none tracking-tight text-[clamp(2.5rem,30vw,8rem)]">
          {displayTime}
        </div>

        {/* Controls Container */}
        <div className="w-full flex items-center justify-between px-4"> 
          {/* Playback Controls Group */}
          <div className="flex space-x-2 items-center">
            {/* Use AnimatePresence for smooth transition between Play/Pause */}
            <AnimatePresence mode="wait" initial={false}>
              {timer.isRunning ? (
                <motion.div
                  key="pause"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  whileHover={{ scale: 1.1 }} // Add hover effect to wrapper
                  whileTap={{ scale: 0.95 }}   // Add tap effect to wrapper
                >
                   {/* Responsive Button Size */}
                  <Button variant="secondary" size="icon" onClick={handlePause} title="Pause Timer" className="rounded-full shadow-md h-[clamp(1.75rem,18vw,3rem)] w-[clamp(1.75rem,18vw,3rem)]">
                    {/* Responsive Icon */}
                    <Pause className="w-2/3 h-auto" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                   key="play"
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.8 }}
                   transition={{ duration: 0.15 }}
                   whileHover={{ scale: 1.1 }} // Add hover effect to wrapper
                   whileTap={{ scale: 0.95 }}   // Add tap effect to wrapper
                >
                   {/* Responsive Button Size */}
                  <Button variant="default" size="icon" onClick={handleStart} title="Start Timer" className="rounded-full shadow-md shadow-primary/30 h-[clamp(1.75rem,18vw,3rem)] w-[clamp(1.75rem,18vw,3rem)]">
                    {/* Responsive Icon */}
                    <Play className="w-2/3 h-auto ml-0.5" /> {/* Keep offset */}
                  </Button>
                 </motion.div>
              )}
            </AnimatePresence>
            {/* Reset Button - Use MotionButton */}
            <MotionButton 
               variant="outline" 
               size="icon" 
               onClick={handleReset} 
               title="Reset Timer" 
               className="rounded-full h-[clamp(1.75rem,18vw,3rem)] w-[clamp(1.75rem,18vw,3rem)]"
               whileHover={{ scale: 1.1, transition: { duration: 0.1 } }} // Hover effect
               whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}    // Tap effect
            >
               {/* Reset Icon - Ensure responsive */}
               <RotateCcw className="w-2/3 h-auto" /> 
            </MotionButton>
          </div>

          {/* Audio Controls Group */}
          {/* Removed max-w-[200px], let flex handle spacing */}
          <div className="flex items-center space-x-3"> 
             {/* Mute/Volume Group */}
             <div className="flex items-center space-x-1.5 flex-grow min-w-[80px]"> {/* Add min-width */} 
                {/* Mute/Unmute Button - Use MotionButton */}
                <MotionButton
                  variant="ghost" 
                  size="icon"
                  onClick={handleMuteToggle}
                  className="text-muted-foreground hover:text-foreground h-[clamp(1.25rem,14vw,2rem)] w-[clamp(1.25rem,14vw,2rem)]"
                  title={timer.isMuted ? 'Unmute' : 'Mute'}
                  whileHover={{ scale: 1.15, transition: { duration: 0.1 } }} // Hover effect
                  whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}    // Tap effect
                >
                   {/* Mute/Unmute Icons - Ensure responsive */}
                   {timer.isMuted ? <VolumeX className="w-2/3 h-auto" /> : <Volume2 className="w-2/3 h-auto" />} 
                 </MotionButton>
                {/* Use Shadcn Slider for Volume */}
                <Slider
                  value={[timer.isMuted ? 0 : timer.volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.05}
                  disabled={timer.isMuted}
                  className={cn("w-full flex-grow", timer.isMuted && "opacity-50 cursor-not-allowed")}
                  aria-label="Timer Volume"
                  title={`Volume: ${Math.round(timer.volume * 100)}%`}
                />
             </div>

            {/* Audio Mode Group */}
            <div className="flex items-center border border-input rounded-md p-0.5">
               {/* Mic Button - Use MotionButton */}
               <MotionButton
                  variant={timer.audioMode === 'voice' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => handleAudioModeChange('voice')}
                  className="rounded-sm h-[clamp(1.1rem,12vw,1.75rem)] w-[clamp(1.1rem,12vw,1.75rem)]"
                  title="Voice Mode"
                  whileHover={{ scale: 1.1, backgroundColor: 'hsl(var(--secondary))' , transition: { duration: 0.1 } }} // Hover
                  whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}    // Tap
                >
                   <Mic className="w-2/3 h-auto" /> 
               </MotionButton>
               {/* Bell Button - Use MotionButton */}
               <MotionButton
                  variant={timer.audioMode === 'beep' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => handleAudioModeChange('beep')}
                  className="rounded-sm h-[clamp(1.1rem,12vw,1.75rem)] w-[clamp(1.1rem,12vw,1.75rem)]"
                  title="Beep Mode"
                  whileHover={{ scale: 1.1, backgroundColor: 'hsl(var(--secondary))', transition: { duration: 0.1 } }} // Hover
                  whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}    // Tap
                >
                   <Bell className="w-2/3 h-auto" /> 
               </MotionButton>
             </div>
           </div>
        </div>
      </motion.div> 
    </motion.div>
  );
};

// Wrap the default export with React.memo
export default React.memo(Timer);