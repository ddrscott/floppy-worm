import Phaser from 'phaser';

export default class WormBase {
    constructor(scene, x, y, config = {}) {
        this.scene = scene;
        this.matter = scene.matter;
        this.Matter = Phaser.Physics.Matter.Matter;
        
        // Default configuration for structure and appearance
        this.config = {
            baseRadius: 10,
            baseColor: 0xff6b6b,
            segmentSizes: [0.75, 1, 1, 0.90, 0.85, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            segmentDensity: 0.015,
            segmentFriction: 1,
            segmentFrictionStatic: 0.8,
            segmentRestitution: 0.0001,
            constraintStiffness: 1,
            constraintDamping: 0.2,
            constraintLength: 1,
            showDebug: true,
            ...config
        };
        
        // Create the worm structure
        this.create(x, y);
    }

    colorToHex(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }

    create(x, y) {
        const segments = [];
        const constraints = [];
        const segmentRadii = [];
        
        // Create segments with variable sizes
        let currentY = y;
        
        for (let i = 0; i < this.config.segmentSizes.length; i++) {
            const radius = this.config.baseRadius * this.config.segmentSizes[i];
            segmentRadii.push(radius);
            
            const segment = this.matter.add.circle(x, currentY, radius, {
                friction: this.config.segmentFriction,
                frictionStatic: this.config.segmentFrictionStatic,
                density: this.config.segmentDensity,
                restitution: this.config.segmentRestitution,
                slop: 0.01,
                render: {
                    fillStyle: '#' + this.getSegmentColor(i, this.config.segmentSizes.length).toString(16).padStart(6, '0'),
                    strokeStyle: '#' + this.getDarkerColor(this.getSegmentColor(i, this.config.segmentSizes.length)).toString(16).padStart(6, '0'),
                    lineWidth: 2,
                    visible: true,
                },
            });
            
            // Add visual circle using Phaser graphics
            const segmentGraphics = this.scene.add.graphics();
            segmentGraphics.fillStyle(this.getSegmentColor(i, this.config.segmentSizes.length), 1);
            segmentGraphics.lineStyle(2, this.getDarkerColor(this.getSegmentColor(i, this.config.segmentSizes.length)), 1);
            segmentGraphics.fillCircle(0, 0, radius);
            segmentGraphics.strokeCircle(0, 0, radius);
            
            segment.graphics = segmentGraphics;
            segments.push(segment);
            
            if (i < this.config.segmentSizes.length - 1) {
                const nextRadius = this.config.baseRadius * this.config.segmentSizes[i + 1];
                currentY += radius + nextRadius + 2;
            }
        }
        
        // Create connection dots at constraint points
        this.connectionDots = [];

        // Create main constraints between segments.
        // Prevents rotation and keeps segments aligned
        for (let i = 0; i < segments.length - 1; i++) {
            const segA = segments[i];
            const segB = segments[i + 1];
            const radiusA = segmentRadii[i];
            const radiusB = segmentRadii[i + 1];
            
            const constraint = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: radiusA + 1 },
                pointB: { x: 0, y: -radiusB - 1 },
                length: this.config.constraintLength,
                stiffness: this.config.constraintStiffness,
                damping: this.config.constraintDamping,
                render: {
                    visible: true,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, constraint);
            constraints.push(constraint);


            // Calculate connection point between segments
            const midX = (segA.position.x + segB.position.x) / 2;
            const midY = (segA.position.y + segB.position.y) / 2;
            
            // Create small dot graphics
            const dot = this.scene.add.graphics();
            dot.fillStyle(this.config.baseColor, 1); // Dark gray color
            dot.fillCircle(0, 0, this.config.baseRadius * 0.4); // Small dot
            dot.setPosition(midX, midY);
            
            this.connectionDots.push(dot);
        }
        
        this.springs = [];
        for (let i = 0; i < segments.length - 1; i++) {
            const segA = segments[i];
            const segB = segments[i + 1];
            const minDistance = segmentRadii[i] + segmentRadii[i + 1];
        
            const spacingConstraint = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: 0 },
                pointB: { x: 0, y: 0 },
                length: minDistance,
                stiffness: 0.005,
                damping: 0.9
            });
            this.springs.push(spacingConstraint);
        }
        this.Matter.World.add(this.matter.world.localWorld, this.springs);
        
        // Store references
        this.segments = segments;
        this.constraints = constraints;
        this.segmentRadii = segmentRadii;
    }
    
    update(delta) {
        this.updateMovement(delta);

        // Update segment graphics
        this.segments.forEach((segment) => {
            if (segment.graphics) {
                segment.graphics.x = segment.position.x;
                segment.graphics.y = segment.position.y;
            }
        });
        
        // Update connection dots positions
        this.connectionDots.forEach((dot, index) => {
            if (index < this.segments.length - 1) {
                const segA = this.segments[index];
                const segB = this.segments[index + 1];
                
                // Update dot position to stay between segments
                dot.x = (segA.position.x + segB.position.x) / 2;
                dot.y = (segA.position.y + segB.position.y) / 2;
            }
        });
    }

    updateMovement(delta) {
        console.error('WormBase.updateMovement() not implemented');
    }
    
    // Utility methods
    getHead() {
        return this.segments[0];
    }
    
    getTail() {
        return this.segments[this.segments.length - 1];
    }
    
    // Color helpers
    getSegmentColor(index, total) {
        if (index === 0) return 0xff6b6b;
        else if (index === 1) return 0xffa502;
        else if (index === 2) return 0xffd93d;
        else if (index < 5) return 0x6bcf7f;
        else if (index < 8) return 0x4ecdc4;
        else if (index < 11) return 0x74b9ff;
        else return 0xa29bfe;
    }
    
    getDarkerColor(color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        return ((r * 0.8) << 16) | ((g * 0.8) << 8) | (b * 0.8);
    }
    
    // Configuration update methods
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Update existing constraints if needed
        if (this.segments) {
            this.segments.forEach((segment, i) => {
                segment.friction = this.config.segmentFriction;
                segment.frictionStatic = this.config.segmentFrictionStatic;
                segment.restitution = this.config.segmentRestitution;
                this.matter.body.setDensity(segment, this.config.segmentDensity);
            });
        }
        
        if (this.constraints) {
            // Update main constraints
            for (let i = 0; i < this.segments.length - 1 && i < this.constraints.length; i++) {
                this.constraints[i].stiffness = this.config.constraintStiffness;
                this.constraints[i].damping = this.config.constraintDamping;
                this.constraints[i].length = this.config.constraintLength;
            }
        }
    }
    
    // Cleanup
    destroy() {
        // Remove all bodies and constraints
        if (this.segments) {
            this.segments.forEach(segment => {
                if (segment.graphics) {
                    segment.graphics.destroy();
                }
                this.matter.world.remove(segment);
            });
        }
        
        if (this.constraints) {
            this.constraints.forEach(constraint => {
                this.matter.world.remove(constraint);
            });
        }
        
        // Clean up connection dots
        if (this.connectionDots) {
            this.connectionDots.forEach(dot => {
                if (dot) {
                    dot.destroy();
                }
            });
        }
    }
}
