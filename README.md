# Floppy Worm

This is a physics-based worm game built with **Phaser 3** and **Matter.js**, featuring realistic segmented worm locomotion with multiple control schemes.

## Development Commands

```bash
# Primary development workflow
npm start                   # Start development server with Parcel (localhost:1234)
npm run build               # Build for production

# The developer typically has `npx parcel src/index.html` running in background
```

## Architecture Overview

### Core Physics System

The game uses a **modular worm entity system** with inheritance:

- **`WormBase`** - Abstract base class providing segmented body physics
  - Creates circular segments connected by Matter.js constraints
  - Handles basic physics properties (friction, density, restitution)
  - Provides constraint systems (main spine, compression springs)
  - All worms inherit from this foundation

- **`DoubleWorm`** - Dual-stick control worm (primary implementation)
  - Anchor-based movement system with head/tail control points
  - Dual force system: position-based + velocity-based forces
  - Jump spring mechanics activated by triggers
  - Gamepad and WASD/arrow keyboard support
  - Anti-flying grounding system

### Physics Configuration System

Physics behavior is controlled through comprehensive config objects with detailed parameter documentation:

- **Anchor Physics**: Controls stick-to-movement translation
- **Movement Physics**: Dual force system (position + velocity)
- **Anti-Flying Physics**: Prevents unrealistic floating
- **Jump Spring Physics**: Trigger-activated compression springs
- **Keyboard Simulation**: Analog stick simulation from digital inputs

Key insight: The system uses **two simultaneous force types** - position-based springs (where you want to go) and velocity-based impulses (how urgently you want to get there).

### Scene Architecture

- **`TestScene`** - Main development/testing environment with dat.GUI integration
- **`TowerScene`** - Level-based gameplay
- **`LevelsScene`** - Level selection interface

### Input System

Sophisticated input handling supporting:
- **Gamepad**: Full analog stick + trigger support
- **Keyboard**: WASD (left stick) + Arrow keys (right stick) with analog simulation
- **Timing-based input**: Keyboard keys ramp up over time to simulate analog deflection
- **Input override**: Keyboard input overrides gamepad when keyboard magnitude is larger

## Key Development Patterns

### Worm Entity Creation
```javascript
// All worms follow this pattern
const worm = new DoubleWorm(scene, x, y, {
    // Physics overrides
    anchorRadius: 50,
    velocityDamping: 0.2,
    // ... other config
});
```

### Physics Parameter Tuning
Physics parameters include detailed comments explaining:
- What each parameter controls
- How increasing/decreasing affects movement
- Typical value ranges
- Interaction effects with other parameters

### Matter.js Integration
- Uses Phaser's Matter.js integration (`scene.matter`)
- Custom constraint systems for worm segments
- Body creation with specific physics properties
- Constraint management for movement mechanics

## Project Structure Notes

- **`src/entities/`** - Worm class implementations (inheritance-based)
- **`src/scenes/`** - Phaser scene implementations
- **`src/components/`** - Reusable UI components (controls, displays)
- **`src/config/`** - Configuration files for physics and game settings
- **`archive/`** - Previous implementation versions (for reference)

## Physics Development Notes

The worm physics system is highly configurable and well-documented. When modifying physics:

1. Check existing parameter documentation in the config objects
2. Understand the dual force system (position + velocity forces can stack)
3. Test with both gamepad and keyboard inputs
4. Use TestScene with dat.GUI for real-time parameter adjustment
5. Consider constraint interactions (main spine + compression springs + anchors)

## Debugging

- Matter.js debug rendering is enabled by default
- dat.GUI integration in TestScene for real-time parameter tweaking
- Debug visuals show constraint connections and anchor positions
- Console logging available for input debugging
