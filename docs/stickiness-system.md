# Worm Stickiness System

## Overview

The stickiness system provides independent head/tail grip control for enhanced platforming mechanics. When segments are touching solid surfaces and the player presses down on the sticks, those segments can "stick" to surfaces using constraint attachment.

## Core Design Principles

### 1. Independent Head/Tail Control
- **Left stick down** → Activates head section stickiness
- **Right stick down** → Activates tail section stickiness  
- Each stick controls its respective worm section independently
- Mirrors the existing anchor force system architecture

### 2. Pure Constraint Strategy
- **NO friction modification** - Preserves existing segment friction values
- **NO velocity damping** - Maintains natural momentum and movement feel
- **Constraint-based only** - Uses Matter.js pin constraints for attachment
- **Physics preservation** - All existing physics properties remain unchanged

### 3. Section-Based Targeting
- **Head section**: First 30% of segments (controlled by left stick)
- **Tail section**: Last 30% of segments (controlled by right stick)
- **Middle section**: Unaffected by stickiness (maintains worm flexibility)

## Implementation Architecture

### Configuration Parameters

```javascript
// Stickiness Physics - Constraint-based surface grip system
stickinessActivationThreshold: 0.3,  // Minimum downward stick input to activate
stickinessConstraintStiffness: 0.1,  // Strength of sticky constraints (0-1)
stickinessConstraintDamping: 0.5,    // Damping for sticky constraints  
headStickinessSegmentCount: 0.3,     // Fraction of head segments that can stick
tailStickinessSegmentCount: 0.3,     // Fraction of tail segments that can stick
```

### Collision Detection System

The system tracks real-time collision state for each worm segment:

```javascript
// Per-segment collision tracking
segmentCollisions = [
  {
    isColliding: boolean,
    contactPoint: { x, y },
    surfaceBody: Matter.Body,
    surfaceNormal: { x, y }
  },
  // ... for each segment
]
```

### Constraint Management

Sticky constraints are created/destroyed dynamically:

1. **Activation Conditions**:
   - Stick input exceeds threshold (down direction)
   - Target segments are touching solid surfaces
   - Within designated head/tail section boundaries

2. **Constraint Type**: Matter.js pin constraints
3. **Attachment**: Between segment center and surface contact point
4. **Cleanup**: Automatic removal when conditions no longer met

## Usage Examples

### Basic Platform Gripping
```javascript
// Player presses left stick down while head touches platform
// → Head segments create pin constraints to platform
// → Head "sticks" to surface, preventing slide-off

// Player releases left stick or moves away from down
// → Pin constraints removed
// → Head returns to normal physics
```

### Advanced Maneuvering  
```javascript
// Landing on narrow platform:
// 1. Right stick down → Tail grips landing surface
// 2. Left stick movement → Head can swing around while tail anchored
// 3. Left stick down → Head grips new surface
// 4. Right stick release → Tail frees up for continued movement
```

## Integration with Existing Systems

### Anchor Forces Compatibility
- Stickiness works alongside position-based and velocity-based anchor forces
- Sticky constraints supplement existing movement mechanics
- No interference with current dual-force system

### Input System Integration
- Uses same stick detection as anchor system
- Threshold-based activation prevents accidental triggering
- Independent per-stick control maintains precise input handling

## Technical Implementation

### WormBase.js Changes
- Add Matter.js collision event listeners
- Track per-segment surface contact state
- Provide collision detection infrastructure

### DoubleWorm.js Changes  
- Add stickiness configuration parameters
- Implement `updateStickinessSystem(headActive, tailActive)` method
- Add input detection in `updateMovement()`
- Manage sticky constraint lifecycle
- Clean up constraints in `destroy()`

## Benefits for Platforming

1. **Enhanced Control**: Players can actively grip surfaces for complex maneuvers
2. **Platform Jumping**: Prevents bounce-off when landing on platforms
3. **Edge Prevention**: Targeted grip control stops specific sections from sliding off
4. **Tactical Movement**: Independent head/tail control enables advanced techniques
5. **Natural Feel**: Preserves existing physics while adding grip capability

## Performance Considerations

- **Constraint Limits**: Maximum simultaneous sticky constraints per section
- **Event Efficiency**: Collision detection optimized for real-time performance  
- **Memory Management**: Automatic cleanup prevents constraint accumulation
- **Physics Stability**: Sticky constraints designed to not conflict with existing system

## Debug and Visualization

- Debug rendering shows active sticky constraints
- Visual feedback possible through segment color changes
- Console logging available for collision state monitoring
- Integration with existing TestScene dat.GUI controls
