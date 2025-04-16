import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { ActiveTimer } from '../types/timerTypes';
import Timer from '../components/Timer';
import useTimersStore from '../store/timersStore';
import { motion, Variants, AnimatePresence } from 'framer-motion'; // Import AnimatePresence

// Define variants type (can be simpler than Timer's)
type TimerVisualVariant = "normal" | "yellow" | "red" | "finished";

export const TimerPage: React.FC = () => {
  const { instanceId } = useParams<{ instanceId: string }>();
  // Re-introduce local state for timer data and error
  const [timerState, setTimerState] = useState<ActiveTimer | null>(null);
  const [error, setError] = useState<string | null>(null);
  // State to manage the visual focus indication
  const [isVisuallyFocused, setIsVisuallyFocused] = useState(false);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for timeout

  // --- Restore IPC listeners --- 
  // Fetch initial state on mount
  useEffect(() => {
    if (!instanceId) {
      setError('No timer instance ID provided in URL.');
      return;
    }

    // console.log(`[TimerPage] Fetching initial state for ${instanceId}`);
    window.electronAPI.getTimerState(instanceId)
      .then(initialState => {
        if (initialState) {
          // console.log(`[TimerPage] Received initial state for ${instanceId}:`, initialState);
          setTimerState(initialState);
          setError(null); // Clear previous errors
        } else {
          console.error(`[TimerPage] No initial state found for ${instanceId}`);
          setError(`Timer with ID ${instanceId} not found.`);
        }
      })
      .catch(err => {
        console.error(`[TimerPage] Error fetching initial state for ${instanceId}:`, err);
        setError('Failed to load timer state.');
      });
  }, [instanceId]);

  // Listen for state updates from main process
  useEffect(() => {
    if (!instanceId) return;

    // console.log(`[TimerPage] Setting up state update listener for ${instanceId}`);
    // Revert listener callback to handle full state
    const cleanup = window.electronAPI.onTimerStateUpdate((event, updatedState) => {
      // Only update if the state is for this specific timer instance
      if (updatedState.instanceId === instanceId) {
        // Directly set the full state received from main process
        setTimerState(updatedState);
      }
    });

    // Cleanup the listener when the component unmounts or instanceId changes
    return () => {
      // console.log(`[TimerPage] Cleaning up state update listener for ${instanceId}`);
      if (typeof cleanup === 'function') {
          cleanup();
      }
    };
  }, [instanceId]);
  // --- End Restore IPC listeners ---

  // --- Global Start/Stop Listeners ---
  useEffect(() => {
    if (!instanceId) return;

    console.log(`[TimerPage ${instanceId}] Setting up global start/stop listeners`);

    // Callback for global start: Log receipt. State managed by main process.
    const handleGlobalStart = () => {
      console.log(`[TimerPage ${instanceId}] Received global-start-timer event.`);
      // No need to call startTimer here; main process handles state
      // and sends update via 'timer-state-update'.
    };

    // Callback for global stop: Log receipt. State managed by main process.
    const handleGlobalStop = () => {
      console.log(`[TimerPage ${instanceId}] Received global-stop-timer event.`);
      // No need to call pauseTimer here; main process handles state
      // and sends update via 'timer-state-update'.
    };

    // Use the newly defined listeners from preload
    const cleanupStart = window.electronAPI.onGlobalStartTimer(handleGlobalStart);
    const cleanupStop = window.electronAPI.onGlobalStopTimer(handleGlobalStop);

    return () => {
      console.log(`[TimerPage ${instanceId}] Cleaning up global start/stop listeners`);
      // Ensure cleanup functions are called if they exist
      if (typeof cleanupStart === 'function') cleanupStart();
      if (typeof cleanupStop === 'function') cleanupStop();
    };

  }, [instanceId]); // Dependency array includes instanceId
  // --- End Global Start/Stop Listeners ---

  // --- Listener for Logical Focus Indication --- 
  useEffect(() => {
    if (!instanceId) return;

    const handleGainLogicalFocus = () => {
      console.log(`[TimerPage ${instanceId}] Received logical focus indication.`);
      setIsVisuallyFocused(true);

      // Clear any existing timeout before setting a new one
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }

      // Set a timeout to remove the visual focus after a short period
      focusTimeoutRef.current = setTimeout(() => {
        setIsVisuallyFocused(false);
        focusTimeoutRef.current = null; // Clear the ref after timeout runs
      }, 750); // Duration of the visual indication (e.g., 750ms)
    };

    const cleanup = window.electronAPI.onTimerGainLogicalFocus(handleGainLogicalFocus);

    // Cleanup function for this effect
    return () => {
      console.log(`[TimerPage ${instanceId}] Cleaning up logical focus listener.`);
      if (typeof cleanup === 'function') {
        cleanup();
      }
      // Also clear the timeout if the component unmounts during the focus indication
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, [instanceId]);
  // --- End Listener for Logical Focus Indication ---

  // Recalculate warning state here based on local timerState
  const isFinished = timerState ? timerState.timeLeft <= 0 : false;
  const yellowThreshold = timerState?.preset.yellowThreshold ?? 10;
  const redThreshold = timerState?.preset.redThreshold ?? 5;
  const timeLeft = timerState?.timeLeft ?? Infinity;

  const isRed = !isFinished && redThreshold !== undefined && timeLeft <= redThreshold;
  const isYellow = !isFinished && !isRed && yellowThreshold !== undefined && timeLeft <= yellowThreshold;

  // const currentVariant: TimerVisualVariant = isFinished ? 'finished' : isRed ? 'red' : isYellow ? 'yellow' : 'normal';

  // REMOVE: Define background variants for the page container
  /*
  const pageVariants: Variants = {
    normal: { backgroundColor: 'transparent', transition: { duration: 0.4, ease: "easeOut" } },
    yellow: { backgroundColor: 'hsla(48, 96%, 59%, 0.9)', transition: { duration: 0.4, ease: "easeOut" } }, // Use slightly less transparent bg for border
    red: { backgroundColor: 'hsla(0, 72%, 51%, 0.9)', transition: { duration: 0.4, ease: "easeOut" } }, // Non-pulsing bg for border
    finished: { backgroundColor: 'transparent', transition: { duration: 0.5 } },
  };
  */

  if (error) {
    // Use transparent background for error state as well
    return <div className="p-1 bg-transparent text-red-500">Error: {error}</div>;
  }

  if (!timerState) {
    // Use transparent background for loading state as well
    return <div className="p-1 bg-transparent text-muted-foreground">Loading timer...</div>;
  }

  // Remove the log before render
  // console.log(`[TimerPage ${instanceId}] State before rendering Timer:`, timerState);

  return (
    // Wrap the container with AnimatePresence
    <AnimatePresence>
      {/* Change div to motion.div and add animation props */}
      <motion.div
        key={instanceId} // Add key for AnimatePresence to track
        className={`timer-page-container h-full p-1 cursor-pointer ${isVisuallyFocused ? 'ring-4 ring-blue-500 ring-inset' : ''}`} // Add conditional ring style
        initial={{ opacity: 0, scale: 0.95 }} // Initial state (invisible, slightly smaller)
        animate={{ opacity: 1, scale: 1 }}    // Animate to state (visible, normal size)
        exit={{ opacity: 0, scale: 0.95 }}     // Exit state (invisible, slightly smaller)
        transition={{ duration: 0.2, ease: "easeOut" }} // Animation duration/easing
      >
        {/* Timer component is now visually nested inside the padding area */}
        <Timer timer={timerState} />
      </motion.div>
    </AnimatePresence>
  );
}; 