# Matter.js Body Reference

## Core Properties (set during creation)

### Physics Properties
- **density**: `0.001` (default) - Mass per unit area. Higher = heavier
- **friction**: `0.1` (default, 0-1) - Resistance to sliding motion
- **frictionStatic**: `0.5` (default) - Resistance before sliding starts
- **frictionAir**: `0.01` (default) - Air resistance/damping
- **restitution**: `0` (default, 0-1) - Bounciness. 0 = no bounce, 1 = perfect bounce
- **slop**: `0.05` (default) - Position correction tolerance

### Rotation Properties
- **angle**: `0` (default, radians) - Initial rotation
- **angularVelocity**: `0` - Rotational speed (radians/second)
- **angularSpeed**: Read-only absolute angular velocity
- **torque**: `0` - Rotational force accumulator
- **inertia**: Resistance to rotation (auto-calculated or set manually)

### Movement Properties
- **position**: `{x, y}` - World position
- **velocity**: `{x, y}` - Linear velocity vector
- **speed**: Read-only velocity magnitude
- **force**: `{x, y}` - Force accumulator

### Collision Properties
- **isSensor**: `false` - If true, detects collisions but doesn't react
- **isStatic**: `false` - If true, never moves (infinite mass)
- **isSleeping**: `false` - Temporarily static until disturbed
- **collisionFilter**:
  ```javascript
  {
    category: 0x0001,    // Bit mask for this body's category
    mask: 0xFFFFFFFF,    // Which categories this collides with
    group: 0             // Non-zero for never/always collide
  }
  ```

## Key Methods

### Movement
- `Body.setPosition(body, position)` - Teleport to position
- `Body.setVelocity(body, velocity)` - Set linear velocity
- `Body.setAngularVelocity(body, velocity)` - Set rotation speed
- `Body.applyForce(body, position, force)` - Apply force at point
- `Body.rotate(body, rotation)` - Rotate by angle
- `Body.scale(body, scaleX, scaleY)` - Resize body

### Property Updates
- `Body.setDensity(body, density)` - Update density and mass
- `Body.setMass(body, mass)` - Set total mass
- `Body.setInertia(body, inertia)` - Set rotation resistance
- `Body.setStatic(body, isStatic)` - Toggle static state

## Practical Examples

### Heavy, Non-rotating Ball
```javascript
{
  density: 0.1,
  friction: 0.8,
  frictionStatic: 1.0,
  inertia: Infinity,  // Won't rotate
  restitution: 0
}
```

### Bouncy, Low-friction Ball
```javascript
{
  density: 0.001,
  friction: 0.05,
  restitution: 0.8,
  frictionAir: 0
}
```

### Worm Segment (from original)
```javascript
{
  density: 0.005,
  friction: 0.95,
  frictionStatic: 0.95,
  restitution: 0.0,
  slop: 0.0
}
```

## Tips
- **Mass** = density × area (auto-calculated)
- **Inertia** = mass × radius² (for circles)
- Set `inertia: Infinity` to prevent rotation
- Lower `slop` for tighter collision detection
- `frictionAir` acts as damping for both linear and angular motion