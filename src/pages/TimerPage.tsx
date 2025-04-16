import React, { useEffect, useState } from 'react';
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
        className="timer-page-container h-full p-1" // Keep padding, ensure no background class
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