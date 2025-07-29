# Worm Ability System

The worm in Floppy Worm has three main abilities that can be toggled at runtime:

## Abilities

### 1. Jump
- **Controls**: Left/Right triggers (gamepad) or Space/Slash keys (keyboard)
- **Description**: Creates spring constraints that compress the worm for jumping
- **Behavior**: When activated, springs attach between opposite ends of the worm

### 2. Roll
- **Controls**: Button 0 (gamepad) or '1' key (keyboard) - Hold to activate
- **Description**: Transforms the worm into a wheel shape using chord constraints
- **Behavior**: Creates internal constraints that form a circular shape

### 3. Grab
- **Controls**: LB/RB buttons (gamepad)
- **Description**: Allows the worm to stick to walls when pushing into them
- **Behavior**: Creates pin constraints at contact points with surfaces

## Mutual Exclusion

Jump and Roll abilities are mutually exclusive:
- **Jump → Roll**: If roll button is pressed while jumping, the jump is cancelled and roll mode begins
- **Roll → Jump**: If jump trigger is pressed while rolling, roll mode exits with a velocity boost

## API Usage

```javascript
// In your scene or game logic:

// Disable an ability
worm.setAbility('jump', false);
worm.setAbility('roll', false);
worm.setAbility('grab', false);

// Enable an ability
worm.setAbility('jump', true);

// Check if ability is enabled
const canJump = worm.getAbility('jump');

// Example: Create a powerup that grants roll ability
class RollPowerup extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'powerup-roll');
        scene.physics.add.existing(this, true);
        
        // Disable roll ability at start
        scene.worm.setAbility('roll', false);
        
        // Grant ability on collision
        scene.physics.add.overlap(scene.worm.segments, this, () => {
            scene.worm.setAbility('roll', true);
            this.destroy();
            
            // Show UI feedback
            scene.showMessage('Roll ability unlocked! Hold 1 to roll');
        });
    }
}
```

## Implementation Notes

- Abilities are stored in the `abilities` object on the DoubleWorm instance
- Disabling an ability will clean up any active state (detach springs, exit roll mode, etc.)
- The ability checks are integrated into the movement update loop
- Powerups can be implemented as physics objects that call `setAbility()` on collision