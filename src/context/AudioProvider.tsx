import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

// Define the context shape
interface SharedAudioContextType {
  audioContext: AudioContext | null;
  initializeError: string | null;
}

// Create the context with a default value
const SharedAudioContext = createContext<SharedAudioContextType>({
  audioContext: null,
  initializeError: null,
});

// Custom hook to use the shared audio context
export const useSharedAudioContext = () => {
  return useContext(SharedAudioContext);
};

// Props for the provider
interface AudioProviderProps {
  children: ReactNode;
}

// Provider component
export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const isInitialized = useRef(false); // Prevent multiple initializations

  useEffect(() => {
    if (isInitialized.current || typeof window === 'undefined' || !window.AudioContext) {
      return;
    }
    isInitialized.current = true;
    let context: AudioContext | null = null;

    console.log('[AudioProvider] Attempting to initialize AudioContext...');
    try {
      context = new window.AudioContext();
      console.log(`[AudioProvider] AudioContext created. Initial state: ${context.state}`);

      // Attempt to resume if suspended (often needed after initial load)
      if (context.state === 'suspended') {
        context.resume().then(() => {
          console.log(`[AudioProvider] AudioContext resumed. Current state: ${context?.state}`);
          setAudioContext(context); // Set state after successful resume
        }).catch(err => {
          console.error('[AudioProvider] Error resuming AudioContext:', err);
          setInitializeError('Could not resume audio context. User interaction might be required.');
          // Set the context anyway, the error state will indicate the issue.
          setAudioContext(context);
        });
      } else {
         // Set state if already running
         setAudioContext(context);
      }

    } catch (e) {
      console.error('[AudioProvider] Error creating AudioContext:', e);
      setInitializeError('Could not initialize audio system.');
      context = null; // Ensure context is null on error
      setAudioContext(null);
    }

    // Store the context in a ref to access it in the cleanup function
    // without causing the effect to re-run if the context instance changes state internally.
    const contextRef = { current: context };

    // Cleanup function: close the context when the provider unmounts
    return () => {
      const currentContext = contextRef.current;
      if (currentContext) {
        console.log('[AudioProvider] Closing AudioContext...');
        currentContext.close().then(() => {
          console.log('[AudioProvider] AudioContext closed successfully.');
        }).catch(err => {
          console.error('[AudioProvider] Error closing AudioContext:', err);
        });
        isInitialized.current = false; // Reset initialization flag if needed
        setAudioContext(null); // Clear state on unmount
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <SharedAudioContext.Provider value={{ audioContext, initializeError }}>
      {children}
    </SharedAudioContext.Provider>
  );
};