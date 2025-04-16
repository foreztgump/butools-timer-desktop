import React, { useEffect, useState } from 'react';
import { AddTimerButton } from '../components/AddTimerButton'; // Keep this
// Assuming timerPresets is still relevant for AddTimerButton's dropdown
// import { timerPresets } from '../data/timerPresets';
import useTimersStore from '../store/timersStore'; // If needed for displaying active timers eventually
import { Button } from '@/components/ui/button'; // Shadcn Button
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Use Card
import { Slider } from '@/components/ui/slider'; // Assuming you have Shadcn Slider installed
import { Volume2, VolumeX, PlusCircle, TimerIcon, X } from 'lucide-react'; // Add icons
import { cn } from '@/lib/utils';

// No explicit type needed, TS will infer from global Window type
const api = window.electronAPI;

// Define a type for the basic timer info we expect
interface ActiveTimerInfo {
  instanceId: string;
  title: string;
}

export const LauncherPage: React.FC = () => {
  const globalVolume = useTimersStore(state => state.globalVolume);
  const globalIsMuted = useTimersStore(state => state.globalIsMuted);
  const setStoreGlobalVolume = useTimersStore(state => state.setGlobalVolume);
  const setStoreGlobalIsMuted = useTimersStore(state => state.setGlobalIsMuted);

  // State for the active timers list
  const [activeTimers, setActiveTimers] = useState<ActiveTimerInfo[]>([]);

  // Fetch active timers on mount
  useEffect(() => {
    api.getActiveTimers()
      .then(timers => {
        console.log('[LauncherPage] Received active timers:', timers);
        setActiveTimers(timers || []); // Ensure it's an array
      })
      .catch(err => {
        console.error('[LauncherPage] Error fetching active timers:', err);
        setActiveTimers([]); // Set to empty array on error
      });

    // Listener for when a new timer is created
    const cleanupCreated = api.onTimerCreated((event, newTimer) => {
      console.log('[LauncherPage] Received timer-created:', newTimer);
      setActiveTimers(prev => [...prev, newTimer]);
    });

    // Listener for when a timer is closed
    const cleanupClosed = api.onTimerClosed((event, closedInstanceId) => {
      console.log(`[LauncherPage] Received timer-closed: ${closedInstanceId}`);
      setActiveTimers(prev => prev.filter(t => t.instanceId !== closedInstanceId));
    });

    // Cleanup both listeners on unmount
    return () => {
      cleanupCreated();
      cleanupClosed();
    };

  }, []);

  useEffect(() => {
    console.log('[LauncherPage] Setting up global audio state listener...');
    const cleanup = api.onGlobalAudioStateChanged((event, newState) => {
      console.log(`[LauncherPage] IPC Received: global-audio-state-changed - Volume: ${newState.volume}, Muted: ${newState.isMuted}`);
      setStoreGlobalVolume(newState.volume);
      setStoreGlobalIsMuted(newState.isMuted);
    });
    return () => {
      console.log('[LauncherPage] Cleaning up global audio state listener.');
      cleanup();
    };
  }, [setStoreGlobalVolume, setStoreGlobalIsMuted]);

  // Handlers for timer interaction buttons
  const handleFocusTimer = (instanceId: string) => {
      console.log(`[LauncherPage] Requesting focus for ${instanceId}`);
      api.focusTimerWindow(instanceId); // Needs corresponding preload/main setup
  };

  const handleCloseTimer = (instanceId: string) => {
      console.log(`[LauncherPage] Requesting close for ${instanceId}`);
      api.closeTimerWindow(instanceId); // Assumes this already exists in preload/main
      // Optimistically remove from local state
      setActiveTimers(prev => prev.filter(t => t.instanceId !== instanceId));
  };

  const handleVolumeChange = (value: number[]) => {
    api.setGlobalVolumeRequest(value[0]);
  };

  return (
    // Add gradient background and text color directly here
    <div className="p-6 flex flex-col items-center min-h-screen text-foreground bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
           {/* Removed img tag for logo */}
          <h1 className="text-2xl font-semibold tracking-tight">
            Butools Timer Launcher
          </h1>
          <p className="text-sm text-muted-foreground">
            Launch timers or manage global settings.
          </p>
        </div>

        {/* Cards Section - Revert to single column */}
        {/* Removed grid classes, added back space-y-4 */}
        <div className="space-y-4">

          {/* Donate Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Support Butools Timer</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                If you find this timer useful, consider supporting its development!
              </p>
              <Button 
                onClick={() => api.openExternalUrl('https://butools.xyz/donate')}
                variant="secondary"
              >
                Donate via Butools.xyz
              </Button>
            </CardContent>
          </Card>

          {/* Add Timer Section (Back to single column) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlusCircle className="w-5 h-5" />
                Launch New Timer
              </CardTitle>
            </CardHeader>
            {/* Keep reduced padding */}
            <CardContent className="flex justify-center py-4 px-6">
              {/* AddTimerButton handles the dropdown */}
              <AddTimerButton />
            </CardContent>
          </Card>

          {/* Active Timers Section - Now includes Global Audio Controls in Header */}
          <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-lg font-medium">Active Timers</CardTitle>
               {/* Global Audio Controls moved to header actions */}
               <div className="flex items-center gap-2">
                 {/* Global Mute Toggle */}
                 <Button
                   variant={globalIsMuted ? "secondary" : "outline"}
                   size="icon"
                   onClick={() => api.toggleGlobalMuteRequest()}
                   title={globalIsMuted ? 'Unmute All Timers' : 'Mute All Timers'}
                   className="flex-shrink-0 h-7 w-7" // Make header controls slightly smaller
                 >
                   {globalIsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                 </Button>
                 {/* Global Volume Slider */}
                 <Slider
                   value={[globalIsMuted ? 0 : globalVolume]}
                   onValueChange={handleVolumeChange}
                   max={1}
                   step={0.05}
                   disabled={globalIsMuted}
                   className={cn("w-24", globalIsMuted && "opacity-50 cursor-not-allowed")} // Fixed width for header slider
                   aria-label="Global Volume"
                 />
               </div>
             </CardHeader>
            <CardContent>
              {activeTimers.length > 0 ? (
                <div className="space-y-2">
                  {activeTimers.map((timer) => (
                    <div key={timer.instanceId} className="text-sm p-2 border rounded-md flex justify-between items-center gap-2">
                      <span className="font-medium truncate flex-grow" title={timer.title}>{timer.title}</span>
                      <div className="flex-shrink-0 flex gap-1">
                          <Button 
                             variant="outline" 
                             size="sm" 
                             onClick={() => handleFocusTimer(timer.instanceId)}
                             title="Focus Timer"
                          >
                            {/* Replace with an actual icon if desired */}
                            Focus
                          </Button>
                          <Button 
                             variant="ghost" 
                             size="sm" 
                             className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                             onClick={() => handleCloseTimer(timer.instanceId)}
                             title="Close Timer"
                           >
                             <X className="h-4 w-4" />
                           </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active timers found.
                </p>
              )}
            </CardContent>
          </Card>

        </div> { /* End Cards Section */}
      </div>
    </div>
  );
};