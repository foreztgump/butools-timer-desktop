# BuTools-Timer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Optional: Add build status badges here if you set up CI/CD -->

A cross-platform desktop application built with Electron and React for launching multiple, customizable, stay-on-top timers for Bless Unleashed. More info at [butools.xyz](https://butools.xyz)


## Key Features

*   **Multiple Timers:** Launch as many independent timers as you need.
*   **Preset Based:** Quickly start timers from predefined configurations (e.g., Backflow, Fire, Reflect).
*   **Stay-on-Top Windows:** Timer windows always remain visible above other applications.
*   **Visual Cues:** Timers change border color (yellow -> red) and pulse when time is low.
*   **Audio Cues:**
    *   Selectable modes: Voice countdowns or simple Beeps.
    *   Distinct warning and completion sounds per preset.
*   **Individual Controls:** Each timer has its own play/pause, reset, volume, and mute controls.
*   **Global Controls:** Manage master volume or mute/unmute all timers simultaneously from the Launcher.
*   **Customizable Appearance:** Transparent background, draggable, and resizable windows.
*   **Position Memory:** Remembers the last position and size for each *type* of timer preset.
*   **Launcher UI:** Centralized window to add new timers and manage active ones.
*   **Keyboard Shortcuts:** Launch specific timer presets instantly.
*   **Cross-Platform:** Works on Windows, macOS, and Linux.

## Installation

You can download the latest pre-built version for your operating system from the **[GitHub Releases Page]([https://github.com/foreztgump/butools-timer-desktop/releases])**.

*   **Windows:** Download the `.exe`.

## Usage Guide

1.  **Launch:** Open the `BuTools-Timer` application to display the main **Launcher** window.
2.  **Add Timer:** Click the `(+) Add Timer` button and select a timer preset (e.g., `Backflow`, `Fire`) from the dropdown. A small, stay-on-top timer window will appear.
3.  **Control Timer Window:**
    *   Use the **Play/Pause/Reset** buttons for basic control.
    *   Adjust **Audio** using the volume icon (mute/unmute), the slider (volume level), and the mic/bell icons (switch between Voice/Beep modes).
    *   Watch the border for **Visual Cues** (yellow/red) as time decreases.
    *   Click the `X` in the top-right corner to **Close** the timer.
    *   **Move/Resize** the window by dragging the top bar or its edges. The position/size is saved for the next time you launch that preset.
4.  **Manage in Launcher:**
    *   View all running timers in the **Active Timers** list.
    *   Click `Focus` to bring a specific timer window to the front.
    *   Click the `X` next to a timer name to close it from the Launcher.
    *   Use the **Global Audio Controls** (volume icon and slider at the top-right of the list) to adjust the master volume or mute/unmute *all* timers at once.
5.  **Use Shortcuts:** Quickly launch timers without the Launcher (see below).

## Keyboard Shortcuts

Launch timer presets instantly using these global shortcuts:

*   `Ctrl+Shift+B`: Backflow
*   `Ctrl+Shift+F`: Fire
*   `Ctrl+Shift+L`: Lightning
*   `Ctrl+Shift+R`: Reflect
*   `Ctrl+Shift+S`: Fuse Storm

## Built With

*   [Electron](https://www.electronjs.org/) - Cross-platform desktop app framework
*   [React](https://reactjs.org/) - UI library
*   [TypeScript](https://www.typescriptlang.org/) - Strongly typed JavaScript
*   [Vite](https://vitejs.dev/) - Frontend tooling (build & dev server)
*   [Electron Forge](https://www.electronforge.io/) - Build, package, and distribute Electron apps
*   [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
*   [Shadcn/ui](https://ui.shadcn.com/) - UI components
*   [Framer Motion](https://www.framer.com/motion/) - Animations
*   [Electron Store](https://github.com/sindresorhus/electron-store) - Simple data persistence

## Development

Want to run the project from the source or contribute?

**Prerequisites:**

*   [Node.js](https://nodejs.org/) (includes npm) or [Yarn](https://yarnpkg.com/)

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/foreztgump/butools-timer-desktop.git
    cd BuTools-Timer
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Run the app in development mode:**
    ```bash
    npm start
    # or
    yarn start
    ```
    This will launch the app with hot-reloading enabled for the renderer process.

## Building the App

To create distributable packages for different platforms:

```bash
npm run make
# or
yarn make
```

This command uses Electron Forge to build the application based on the configuration in forge.config.js. The output packages will be located in the out directory.

## Contributing

Contributions are welcome! If you have suggestions, bug reports, or want to contribute code:

*   Please check the [Issues]([https://github.com/foreztgump/butools-timer-desktop/issues]) tab to see if your issue or suggestion already exists.
*   If not, feel free to open a new issue.
*   For code contributions, please fork the repository and submit a pull request.


## License

This project is licensed under the MIT License - see the LICENSE file for details.

Need more help? Check out the BuTools Timer FAQ.
Find more tools and consider supporting development at [butools.xyz](https://butools.xyz). 