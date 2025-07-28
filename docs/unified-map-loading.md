# Unified Map Loading System

## Overview

The Floppy Worm game now uses a centralized `MapLoader` service to ensure consistent map loading and gameplay across all entry points. This solves the previous issue where maps could behave differently when played from the main game, test mode, or editor.

## Key Components

### MapLoader Service (`src/services/MapLoader.js`)

The central service that handles:
- Loading map data from multiple sources (localStorage, API, registry)
- Creating standardized scene instances
- Managing scene lifecycle

### Unified Scene Creation

All maps now use the same base class (`JsonMapBase`) with consistent:
- Physics settings
- Victory conditions
- UI elements
- Return behaviors

## Entry Points

### 1. Main Game (`MapSelectScene`)
```javascript
await MapLoader.loadAndStart(this, mapKey, {
    returnScene: 'MapSelectScene'
});
```
- Tracks progress
- Returns to map selection
- Shows full victory UI

### 2. Test Mode (`/test/{filename}`)
```javascript
await MapLoader.loadAndStart(this, filename, {
    testMode: true
});
```
- Loads from API
- Shows "TEST MODE" indicator
- Simplified victory screen
- Press R to reload

### 3. Editor Preview (future)
```javascript
await MapLoader.loadAndStart(this, mapKey, {
    editorMode: true
});
```
- Loads from API
- Shows "EDITOR PREVIEW" indicator
- Quick test functionality

## Data Loading Priority

1. **API endpoint** - `/api/maps/{filename}.json` (primary source)
2. **Map Registry** - Built-in maps (fallback)

## Benefits

1. **Consistency** - All entry points use identical game logic
2. **Maintainability** - Single source of truth for map loading
3. **Flexibility** - Easy to add new modes or features
4. **Reliability** - Centralized error handling

## Usage Examples

### Preloading Maps
```javascript
// Preload without starting
await MapLoader.preloadMap(scene, 'level-1');
```

### Custom Options
```javascript
await MapLoader.loadAndStart(scene, mapKey, {
    testMode: false,
    editorMode: false,
    returnScene: 'CustomScene',
    showDebug: true
});
```

## Migration Guide

### Old Way (Direct Scene Creation)
```javascript
// Don't do this anymore
const MapScene = JsonMapScene.create(mapKey, mapData);
this.scene.add(mapKey, MapScene);
this.scene.start(mapKey);
```

### New Way (Unified Loader)
```javascript
// Do this instead
await MapLoader.loadAndStart(this, mapKey, options);
```

## Technical Details

- Scene keys are prefixed based on mode: `test-{mapKey}`, `editor-{mapKey}`
- Scenes are automatically cleaned up and recreated if they already exist
- Error handling ensures graceful fallback to map selection