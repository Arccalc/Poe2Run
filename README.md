# Path of Exile 2 Speedrun Timer & Route Recorder

A modern, glassmorphic desktop application built with **React**, **TypeScript**, **Rust**, and **Tauri v2** to automate Path of Exile 2 speedrun timing and campaign route creation. It monitors the game client log in real-time to track zone entries, manage split timers, and provide comparisons against your reference routes.

---

## Key Features

- **Automated Real-Time Splits**: Automatically detects zone transitions by parsing Path of Exile 2's `Client.txt` log file in the background (no memory reading, completely TOS compliant).
- **Flexible Run Modes**:
  - **Start Blind Run (Shadow Record)**: Records a new route from scratch as you run the game. Appends segments, saves elapsed times, and exports the final route JSON.
  - **Start Speedrun Mode**: Loads a reference route file, starts a timing run, and compares your actual zone times against reference times in real-time.
  - **Resume Run**: Allows you to load a route file (`.json`) and resume running/recording it from the last recorded segment (either in Speedrun mode or Blind Run mode).
- **Interactive Drag & Drop Route Customization**:
  - Customize the order of zones inside an Act simply by dragging and dropping splits in the UI in **Edit Mode**.
  - **Act boundaries restrictions**: Reordering is locked within acts. You cannot drag splits into different acts.
  - Act triggers (start-of-act zones like Vastiri Outskirts or Sandswept Marsh) are locked from dragging to preserve story progression boundaries.
- **Dynamic Non-Linear Act Grouping**: Automatically handles random progression orders (e.g. playing Interludes in any order like Interlude 2 -> Interlude 1 -> Interlude 3). Groups and displays them in the exact order you run them.
- **Muling Mode Support**: Option to ignore the first mule visit to `The Riverbank` while keeping the global timer running.
- **HUD Interface**:
  - Frameless transparency, window transparency sliders, and `Always on Top` toggling.
  - **Just Timer Mode**: A minimalistic, double-clickable widget to hide splits while tracking.

---

## Tech Stack

- **Frontend**: React 18, TypeScript 5.5, Vite 5.4
- **Backend**: Rust 2021, Tauri v2
- **IPC / Native APIs**: Tauri commands and event emitting (`listen`/`emit`)
- **Key Libraries**: `@tauri-apps/api`, `tokio`, `serde_json`, `chrono`

---

## Setup & Compilation

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (v18+)
2. Install [Rust & Cargo](https://www.rust-lang.org/tools/install) (Rustup)
3. Install WebView2 runtime (pre-installed on Windows 10/11)

### Development Mode
Runs the local dev server and opens the desktop window:
```bash
# Install dependencies
npm install

# Run dev environment
npx tauri dev
```

### Production Build
Builds the optimized web assets and compiles the native `.msi` and `.exe` installers:
```bash
npx tauri build
```
The compiled binaries will be output to:
`src-tauri/target/release/bundle/msi/`

---

## Project Structure

```
├── src/                      # React Frontend Source Code
│   ├── App.tsx               # Main UI component & state machine bindings
│   ├── index.css             # Glassmorphism design tokens & styles
│   └── main.tsx              # React DOM entry point
├── src-tauri/                # Rust Tauri Backend Source Code
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── lib.rs            # Tauri commands & event emission
│   │   ├── fsm.rs            # Split timer & active run State Machine
│   │   ├── parser.rs         # Client.txt log parser loop
│   │   └── models.rs         # Shared Route/Split structures
│   ├── Cargo.toml            # Rust dependency manifest
│   └── tauri.conf.json       # Tauri window & capabilities configuration
├── package.json              # Frontend npm manifest
└── README.md                 # Project description
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
