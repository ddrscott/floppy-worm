import PlatformBase from './PlatformBase.js';

export default class ConstraintMovingPlatform extends PlatformBase {
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
        
        // Constraint settings
        this.constraintStiffness = physics.constraintStiffness || 0.8; // How rigid the connection is
        this.constraintLength = physics.constraintLength || 1; // Very short constraint
        
        // Movement state
        this.startPosition = { x, y };
        this.centerPosition = { x, y };
        
        // Track constraints for segments on platform
        this.segmentConstraints = new Map(); // segment -> constraint
        
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
            this.body.label = 'constraintMovingPlatform';
        }
    }
    
    onCollision(segment, collision) {
        // Skip if we already have a constraint for this segment
        if (this.segmentConstraints.has(segment)) return;
        
        // Simple position-based check: is the segment above the platform?
        const segmentBottom = segment.position.y + (segment.circleRadius || 15);
        const platformTop = this.body.bounds.min.y;
        const isAbove = segmentBottom <= platformTop + 10; // 10 pixel tolerance
        
        console.log('Constraint platform collision:', {
            segmentLabel: segment.label,
            isAbove: isAbove,
            segmentBottom: segmentBottom,
            platformTop: platformTop,
            segmentY: segment.position.y,
            platformY: this.body.position.y
        });
        
        // Create constraint if segment is on top of platform
        if (isAbove) {
            // Get the contact point from the collision data
            let contactX, contactY;
            
            if (collision.contactPoint) {
                // WormBase format
                contactX = collision.contactPoint.x;
                contactY = collision.contactPoint.y;
            } else if (collision.supports && collision.supports.length > 0) {
                // Matter.js format - use first support point
                contactX = collision.supports[0].x;
                contactY = collision.supports[0].y;
            } else {
                // Fallback to segment position
                contactX = segment.position.x;
                contactY = segment.position.y + (segment.circleRadius || 15);
            }
            
            const constraint = this.scene.matter.add.constraint(
                this.body,
                segment,
                this.constraintLength,
                this.constraintStiffness,
                {
                    pointA: {
                        x: contactX - this.body.position.x,
                        y: contactY - this.body.position.y
                    },
                    pointB: {
                        x: contactX - segment.position.x,
                        y: contactY - segment.position.y
                    },
                    render: {
                        visible: true // Show the constraint for debugging
                    }
                }
            );
            
            this.segmentConstraints.set(segment, constraint);
        }
    }
    
    onCollisionEnd(segment) {
        // Remove constraint when segment leaves platform
        const constraint = this.segmentConstraints.get(segment);
        if (constraint) {
            this.scene.matter.world.remove(constraint);
            this.segmentConstraints.delete(segment);
        }
    }

    update(time, delta) {
        if (!this.body || !this.container) return;
        
        // Calculate new position with smooth sinusoidal movement
        let newX = this.body.position.x;
        let newY = this.body.position.y;
        
        const t = time * 0.001 * this.moveSpeed / 50;
        
        if (this.moveType === 'horizontal') {
            newX = this.centerPosition.x + Math.sin(t) * this.moveDistance / 2;
        } else if (this.moveType === 'vertical') {
            newY = this.centerPosition.y + Math.sin(t) * this.moveDistance / 2;
        }
        
        // Move the platform - constraints will pull attached bodies along
        this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });
        
        // Update container position
        this.container.x = newX;
        this.container.y = newY;
        
        // Update glow effect
        if (this.glowGraphics) {
            this.glowGraphics.alpha = 0.2 + Math.sin(time * 0.003) * 0.1;
        }
    }

    destroy() {
        // Remove all constraints safely
        if (this.scene && this.scene.matter && this.scene.matter.world) {
            this.segmentConstraints.forEach((constraint) => {
                try {
                    this.scene.matter.world.remove(constraint);
                } catch (e) {
                    // Constraint might already be removed
                }
            });
        }
        this.segmentConstraints.clear();
        
        super.destroy();
    }
}
