# Scene Management Improvements

## Overview

This document describes the scene management improvements implemented based on Phaser 3 best practices. The main focus was on separating runtime state from persistent storage and improving scene transitions.

## Key Changes

### 1. GameStateManager Service (`src/services/GameStateManager.js`)

A centralized state management service that:
- Uses `scene.registry` for runtime state sharing across scenes
- Handles localStorage operations for persistent data
- Emits events for state changes (progress updates, map completion, etc.)
- Provides a clean API for accessing and updating game state

**Key Methods:**
- `getMapProgress(mapKey)` - Get progress for a specific map
- `completeMap(mapKey, time)` - Mark a map as completed
- `updateBestTime(mapKey, time)` - Update best time if better
- `getCompletionStats()` - Get overall completion statistics

### 2. Scene Lifecycle Improvements

#### MapSelectScene
- Moved initialization from `create()` to `init()` method
- Uses GameStateManager instead of direct localStorage access
- Proper event cleanup in `cleanup()` method
- Fixed `completeMap()` function to not rely on undefined `game` global

#### JsonMapBase
- Added `init(data)` method for proper initialization
- Uses GameStateManager for best times and completion status
- Changed from `pause()` to `sleep()` when showing victory dialog

#### VictoryDialog
- Changed from `resume()` to `wake()` for better overlay behavior
- Now properly wakes the game scene instead of resuming it

### 3. Scene Debugging Utility (`src/utils/SceneDebugger.js`)

Optional debugging tool for development:
- Logs scene transitions and lifecycle events
- Monitors scene manager operations
- Can log registry contents and scene states
- Enable with: `window.enableSceneDebug()`

## Benefits

1. **Performance**: Reduced localStorage access, faster state lookups
2. **Consistency**: Single source of truth for runtime state
3. **Maintainability**: Clear separation between runtime and persistent state
4. **Reliability**: Proper scene lifecycle management prevents memory leaks
5. **Debugging**: Optional scene transition logging for development

## Usage

### Accessing State from Any Scene

```javascript
// Get state manager
const stateManager = GameStateManager.getFromScene(this);

// Get map progress
const progress = stateManager.getMapProgress('map1');

// Mark map as completed
stateManager.completeMap('map1', completionTime);

// Update best time
stateManager.updateBestTime('map1', newTime);
```

### Listening for State Changes

```javascript
// In scene init()
this.registry.events.on('progressUpdated', this.onProgressUpdated, this);

// In scene cleanup/shutdown
this.registry.events.off('progressUpdated', this.onProgressUpdated, this);
```

### Scene Transitions Best Practices

```javascript
// For overlay scenes (like dialogs)
this.scene.sleep();  // Instead of pause()
this.scene.wake();   // Instead of resume()

// For switching between scenes
this.scene.switch('NextScene', { data: 'to pass' });

// For starting a new scene
this.scene.start('NextScene', { data: 'to pass' });
```

## Migration Notes

- The `completeMap()` function now requires a scene parameter
- Best times are now accessed through GameStateManager, not localStorage directly
- Progress updates trigger registry events for reactive UI updates
- Victory dialog now uses sleep/wake pattern for better performance