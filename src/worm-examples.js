import Phaser from 'phaser';
import Worm from './entities/Worm';

// Example 1: Basic Worm Usage
class BasicWormScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BasicWormScene' });
    }

    create() {
        // Set world bounds
        this.matter.world.setBounds(0, 0, 800, 600);
        
        // Create a simple worm with default settings
        this.worm = new Worm(this, 400, 100);
        
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // ESC to return to levels menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('LevelsScene');
        });
    }
    
    update(time, delta) {
        // Handle input
        if (this.cursors.left.isDown) {
            this.worm.setMotorDirection(-1);
        } else if (this.cursors.right.isDown) {
            this.worm.setMotorDirection(1);
        } else {
            this.worm.setMotorDirection(0);
        }
        
        this.worm.setFlatten(this.cursors.down.isDown);
        this.worm.setJump(this.spaceKey.isDown);
        
        // Update the worm
        this.worm.update(delta);
    }
}

// Example 2: Multiple worms in the same scene
class MultiWormScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MultiWormScene' });
    }

    create() {
        this.matter.world.setBounds(0, 0, 1200, 800);
        
        // Create multiple worms with different configurations
        this.worms = [];
        
        // Fast red worm
        this.worms.push(new Worm(this, 200, 200, {
            baseRadius: 8,
            segmentSizes: [0.8, 1, 1, 0.9, 0.8, 0.7],
            motorSpeed: 8,
            segmentDensity: 0.02
        }));
        
        // Large blue worm
        this.worms.push(new Worm(this, 600, 300, {
            baseRadius: 15,
            segmentSizes: [0.7, 1, 1, 1, 0.95, 0.9, 0.85, 0.8, 0.75],
            motorSpeed: 3,
            segmentDensity: 0.05
        }));
        
        // Tiny green worm
        this.worms.push(new Worm(this, 400, 400, {
            baseRadius: 5,
            segmentSizes: [0.8, 1, 0.9, 0.8],
            motorSpeed: 12,
            jumpStiffness: 0.1
        }));
    }
    
    update(time, delta) {
        // Update all worms
        this.worms.forEach(worm => worm.update(delta));
    }
}

// Example 2: Worm with custom controls
class CustomControlWormScene extends Phaser.Scene {
    create() {
        this.worm = new Worm(this, 400, 300);
        
        // Custom control setup - WASD + E for jump
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.eKey = this.input.keyboard.addKey('E');
        
        // Add obstacles
        for (let i = 0; i < 5; i++) {
            this.matter.add.rectangle(
                200 + i * 150, 
                500, 
                100, 
                20, 
                { isStatic: true }
            );
        }
    }
    
    update(time, delta) {
        // Custom controls
        if (this.wasd.A.isDown) {
            this.worm.setMotorDirection(-1);
        } else if (this.wasd.D.isDown) {
            this.worm.setMotorDirection(1);
        } else {
            this.worm.setMotorDirection(0);
        }
        
        this.worm.setFlatten(this.wasd.S.isDown);
        this.worm.setJump(this.eKey.isDown);
        
        this.worm.update(delta);
    }
}

// Example 3: Worm with AI control
class AIWormScene extends Phaser.Scene {
    create() {
        this.worm = new Worm(this, 100, 300);
        this.target = this.add.circle(700, 300, 20, 0x00ff00);
        
        // AI state
        this.aiState = {
            targetReached: false,
            jumpCooldown: 0
        };
    }
    
    update(time, delta) {
        // Simple AI - move towards target
        const head = this.worm.getHead();
        const dx = this.target.x - head.position.x;
        
        // Decide direction
        if (Math.abs(dx) > 50) {
            this.worm.setMotorDirection(dx > 0 ? 1 : -1);
        } else {
            this.worm.setMotorDirection(0);
            this.aiState.targetReached = true;
        }
        
        // Jump occasionally when moving
        this.aiState.jumpCooldown -= delta;
        if (this.aiState.jumpCooldown <= 0 && Math.random() < 0.01) {
            this.worm.setJump(true);
            this.aiState.jumpCooldown = 2000; // 2 second cooldown
            
            // Release jump after 200ms
            this.time.delayedCall(200, () => {
                this.worm.setJump(false);
            });
        }
        
        // Move target when reached
        if (this.aiState.targetReached && Math.abs(dx) < 30) {
            this.target.x = Phaser.Math.Between(100, 700);
            this.target.y = Phaser.Math.Between(200, 400);
            this.aiState.targetReached = false;
        }
        
        this.worm.update(delta);
    }
}

// Example 4: Worm playground with dynamic environment
class WormPlaygroundScene extends Phaser.Scene {
    create() {
        this.worm = new Worm(this, 400, 100);
        
        // Dynamic platforms
        this.platforms = [];
        for (let i = 0; i < 3; i++) {
            const platform = this.matter.add.rectangle(
                200 + i * 200,
                300 + i * 50,
                150,
                20,
                { isStatic: true }
            );
            this.platforms.push({
                body: platform,
                startX: platform.position.x,
                amplitude: 50,
                frequency: 0.001 * (i + 1)
            });
        }
        
        // Rotating obstacle
        this.spinner = this.matter.add.rectangle(600, 400, 200, 20, {
            isStatic: true
        });
    }
    
    update(time, delta) {
        // Move platforms
        this.platforms.forEach(platform => {
            const newX = platform.startX + Math.sin(time * platform.frequency) * platform.amplitude;
            this.matter.body.setPosition(platform.body, { 
                x: newX, 
                y: platform.body.position.y 
            });
        });
        
        // Rotate spinner
        this.matter.body.setAngle(this.spinner, time * 0.001);
        
        // Basic controls
        const cursors = this.input.keyboard.createCursorKeys();
        this.worm.setMotorDirection(
            cursors.left.isDown ? -1 : 
            cursors.right.isDown ? 1 : 0
        );
        this.worm.setFlatten(cursors.down.isDown);
        this.worm.setJump(cursors.space.isDown);
        
        this.worm.update(delta);
    }
}

// Export example scenes
export {
    BasicWormScene,
    MultiWormScene,
    CustomControlWormScene,
    AIWormScene,
    WormPlaygroundScene
};

// Example game configuration
export const exampleGameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: false
        }
    },
    scene: [BasicWormScene, MultiWormScene, CustomControlWormScene, AIWormScene, WormPlaygroundScene]
};

// Usage:
// import { exampleGameConfig } from './worm-examples';
// const game = new Phaser.Game(exampleGameConfig);