import { useEffect, useRef } from 'react';
import useTimersStore from '../store/timersStore';

const INTERVAL_MS = 50; // How often to update timers (in milliseconds)

/**
 * Custom hook to manage the global timer interval.
 * This hook should be called once at a high level in the component tree.
 */
export function useTimerInterval() {
    const lastTickTimeRef = useRef<number>(performance.now());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const deltaSeconds = (now - lastTickTimeRef.current) / 1000;
            lastTickTimeRef.current = now;

            // Get current state and the tick action directly from the store
            const state = useTimersStore.getState();
            const tickAction = state._tickTimer;

            // Tick all running timers
            state.activeTimers.forEach(timer => {
                if (timer.isRunning) {
                    tickAction(timer.instanceId, deltaSeconds);
                    // Optional: Check if timer reached zero and trigger completion logic here
                }
            });
        };

        // Clear any existing interval before starting a new one
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Start the interval
        intervalRef.current = setInterval(tick, INTERVAL_MS);
        console.log('Timer interval started.');

        // Cleanup function to clear the interval when the component unmounts
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                console.log('Timer interval stopped.');
            }
        };
    }, []); // Empty dependency array ensures this effect runs only once on mount

    // This hook doesn't need to return anything, it just sets up the interval
} 