import PlatformBase from './PlatformBase.js';

export default class SimpleMovingPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, color = 0x4444ff, physics = {}) {
        // Prepare config for parent class
        const config = {
            color: color,
            ...physics,
            // Normal friction
            friction: physics.friction || 0.8,
            frictionStatic: physics.frictionStatic || 0.9,
            restitution: physics.restitution || 0.1,
            isStatic: true
        };
        
        super(scene, x, y, width, height, config);
        
        // Movement properties
        this.moveType = physics.moveType || 'horizontal';
        this.moveDistance = physics.moveDistance || 200;
        this.moveSpeed = physics.moveSpeed || 100;
        
        // Force multiplier - how much of the platform's movement is transferred to bodies
        // 1.0 = perfect transfer, >1.0 = extra push, <1.0 = partial transfer
        this.forceMultiplier = physics.forceMultiplier || 1.0;
        
        // Movement state
        this.startPosition = { x, y };
        this.centerPosition = { x, y };
        
        // Visual indicator
        this.createMovementIndicator();
    }
    
    createMovementIndicator() {
        // Add subtle visual effect
        const glowGraphics = this.scene.add.graphics();
        glowGraphics.lineStyle(3, 0xffffff, 0.2);
        glowGraphics.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
        this.container.add(glowGraphics);
        this.glowGraphics = glowGraphics;
    }

    // Override parent's setupCollisionDetection
    setupCollisionDetection() {
        super.setupCollisionDetection();
        if (this.body) {
            this.body.platformInstance = this;
            this.body.label = 'simpleMovingPlatform';
        }
    }

    update(time, delta) {
        if (!this.body || !this.container) return;
        
        // Store old position
        const oldX = this.body.position.x;
        const oldY = this.body.position.y;
        
        // Calculate new position with smooth sinusoidal movement
        let newX = oldX;
        let newY = oldY;
        
        const t = time * 0.001 * this.moveSpeed / 50;
        
        if (this.moveType === 'horizontal') {
            newX = this.centerPosition.x + Math.sin(t) * this.moveDistance / 2;
        } else if (this.moveType === 'vertical') {
            newY = this.centerPosition.y + Math.sin(t) * this.moveDistance / 2;
        }
        
        // Calculate the movement delta
        const dx = newX - oldX;
        const dy = newY - oldY;
        
        // Move the platform
        this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });
        
        // The key: Check for bodies that are in contact with the TOP of the platform
        // and manually adjust their position
        if (this.scene.matter.world && this.scene.matter.world.engine) {
            const engine = this.scene.matter.world.engine;
            const allPairs = engine.pairs.list;
            
            allPairs.forEach(pair => {
                if (pair.bodyA === this.body || pair.bodyB === this.body) {
                    const otherBody = pair.bodyA === this.body ? pair.bodyB : pair.bodyA;
                    
                    // Check if the other body is above the platform
                    if (otherBody.position.y < this.body.position.y - this.height/4) {
                        // Only move if contact is active
                        if (pair.isActive && !pair.isSensor) {
                            // Apply platform movement to the body with force multiplier
                            this.scene.matter.body.setPosition(otherBody, {
                                x: otherBody.position.x + dx * this.forceMultiplier,
                                y: otherBody.position.y + dy * this.forceMultiplier
                            });
                        }
                    }
                }
            });
        }
        
        // Update container position
        this.container.x = newX;
        this.container.y = newY;
        
        // Update glow effect
        if (this.glowGraphics) {
            this.glowGraphics.alpha = 0.2 + Math.sin(time * 0.003) * 0.1;
        }
    }

    destroy() {
        super.destroy();
    }
}