# Project Context
## Tech Stack
- Frontend: React 18.3, TypeScript 5.5, Vite 5.4
- Backend: Rust 2021, Tauri v2
- Key Libraries: @tauri-apps/api, tokio, serde, chrono, rfd

## Project Map
- `src/App.tsx` - React UI component managing timers, state, splits, and analytics.
- `src/index.css` - Custom UI styles and themes.
- `src/main.tsx` - React application entry point.
- `src-tauri/src/main.rs` - Tauri desktop application entry point.
- `src-tauri/src/lib.rs` - Core backend bindings and Tauri command registrations.
- `src-tauri/src/fsm.rs` - State machine implementation for managing the speedrun phases.
- `src-tauri/src/models.rs` - Shared data structures between backend modules.
- `src-tauri/src/parser.rs` - Log parser to extract zone transitions from PoE's `Client.txt`.
- `package.json` - Node dependencies and build scripts configuration.
- `src-tauri/Cargo.toml` - Rust dependencies and workspace configuration.

## Architecture Decisions
- Tauri v2 was chosen to provide a lightweight, cross-platform native wrapper with low resource overhead while allowing rich React UI for the timer overlay.
- Speedrun events are detected by continuously parsing Path of Exile 2's `Client.txt` log file via the Rust backend, ensuring compliance by avoiding direct memory reading.
- The application uses transparent, frameless windows (`alwaysOnTop`) for seamless in-game overlay experience.

## Current Task Focus
- NEXT: none
- BLOCKED: none
- DONE: Implemented town timer fixes, caravan zones, scene-loading filters, Sandswept Marsh trigger, Kingsmarch Act 4 transition, Rust FSM reordering, React drag-and-drop reordering with edit mode toggle, React ZONE_ACT_MAPPING act grouping, drag restrictions (fixed WebView2 drag abort cursor bug using refs and disabled native Tauri dragDropEnabled), a unified Resume Run button (purple #8b5cf6) with modal mode selection, detailed Act 4 & Interludes zone mapping, dynamic act sorting for non-linear completion, auto-generated GitHub repository files (.gitignore, .gitattributes, LICENSE, README.md), compiled production release installers (MSI, EXE), and organized the release folder with installers and instructions.
