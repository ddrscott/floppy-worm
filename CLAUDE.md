# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Floppy Worm is a physics-based worm game built with **Phaser 3** and **Matter.js** physics. The project uses **Remix** with **Vite** for development and **Tailwind CSS** for styling. The game features a segmented worm character with realistic physics constraints and multiple game maps.

## Development Commands

### Core Development
- `npm run dev` - Start Remix development server (port 3001)
- `npm run build` - Build for production using vite.config.prod.ts
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run preview` - Preview production build

### Map Editor
The project uses a **Remix-based editor**: Access via `/maps/{filename}/edit` routes after running `npm run dev`.

## Architecture

The project has a **dual structure** with legacy game code and modern Remix:

### Remix Application (`/app`)
- **Main entry**: `app/game/main.ts` - Phaser game initialization for Remix
- **Routes**: 
  - `routes/_index.tsx` - Home page with embedded game
  - `routes/maps.$filename._index.tsx` - Individual map play
  - `routes/maps.$filename.edit.tsx` - Map editor interface
  - `routes/api.maps.*` - Map data API endpoints
- **Components**: Game integration via `MainGame.tsx` and `ClientOnly.tsx`

### Legacy Game Structure (`/src`)
- **Main entry**: `src/app.js` - Legacy Phaser game entry point
- **Scenes**: `src/scenes/` - Game scenes including MapSelectScene, MapEditor, JsonMapScene
- **Entities**: `src/entities/` - Game objects (Worm, platforms, etc.)
- **Maps**: `src/scenes/maps/` - Map data registry and JSON map files

### Key Game Components

**Worm Physics** (`src/entities/Worm.js`):
- Multi-segment worm with Matter.js constraints
- Motor-driven movement with configurable physics parameters
- Flatten/jump springs for advanced movement mechanics

**Map System**:
- JSON-based map definitions in `src/scenes/maps/data/`
- Dynamic map loading via `MapDataRegistry.js`
- Editor supports platform placement and physics tuning

**Scene Management**:
- `MapSelectScene.js` - Main menu with progress tracking
- `JsonMapScene.js` - Parameterized level scenes
- `MapEditor.js` - Level creation and editing

## Development Workflow

### Running the Game
1. Use `npm run dev` for full Remix development with server-side map editing
2. Game loads at `http://localhost:3001`
3. Access individual maps at `/maps/{filename}`
4. Edit maps at `/maps/{filename}/edit`

### Physics Configuration
- Core physics parameters in `src/config/physicsParams.js`
- Worm-specific config passed to Worm constructor
- Matter.js debug rendering available in development

### Map Development
- Maps stored as JSON in `src/scenes/maps/data/`
- Use Remix editor routes for full editing with save functionality
- Map metadata managed through `MapDataRegistry.js`

## Important Notes

- **SSR disabled**: Remix runs in SPA mode (`ssr: false` in vite.config.ts)
- **Physics timing**: Game uses Matter.js with 60fps target
- **Asset loading**: Static assets in `/public`, referenced via absolute paths
- **TypeScript paths**: Both `~/*` (app) and `/src/*` (legacy) path aliases configured
- **Documentation sync**: Keep `docs/map-editor.md` and `src/scenes/MapSelectScene.js` synchronized

## File Structure Priorities

When making changes:
1. **Prefer Remix structure** (`/app`) for new features
2. **Legacy structure** (`/src`) contains core game logic and should be maintained
3. **Map data** lives in `/src/scenes/maps/data/` regardless of build system

## Physics Memories
- stiffness 0 and 1 mean 100% stiff, stiffness should be 0.000001 to be negligible.