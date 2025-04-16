import React, { useState } from 'react';
// Remove Zustand import - no longer needed here
// import useTimersStore from '../store/timersStore';
import { timerPresets } from '../data/timerPresets';
import type { TimerPreset } from '../types/timerTypes';
import { Button } from './ui/button'; // Assuming Shadcn Button is available
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"; // Assuming Shadcn Dropdown is available

// Get reference to the Electron API
// Ensure this runs in an environment where window.electronAPI is defined (i.e., renderer process)
const api = window.electronAPI;

export function AddTimerButton() {
  // Remove state selection
  // const addTimer = useTimersStore(state => state.addTimer);
  const [isOpen, setIsOpen] = useState(false);

  const handleAddTimer = async (preset: TimerPreset) => {
    console.log(`[AddTimerButton] Requesting timer for preset: ${preset.title}`);
    try {
      // Use the Electron API to request a new timer from the main process
      const instanceId = await api.addTimerRequest(preset);
      console.log(`[AddTimerButton] Main process created timer with ID: ${instanceId}`);
      setIsOpen(false); // Close dropdown after successful request
    } catch (error) {
        console.error("[AddTimerButton] Error requesting timer:", error);
        // Optionally show an error message to the user
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          Add Timer
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {timerPresets.map((preset) => (
          <DropdownMenuItem key={preset.id} onClick={() => handleAddTimer(preset)}>
            {preset.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 