import Phaser from 'phaser';

export default class Worm {
    constructor(scene, x, y, config = {}) {
        this.scene = scene;
        this.matter = scene.matter;
        this.Matter = Phaser.Physics.Matter.Matter;
        
        // Default configuration
        this.config = {
            baseRadius: 10,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            segmentDensity: 0.03,
            segmentFriction: 1,
            segmentFrictionStatic: 0.8,
            segmentRestitution: 0.0001,
            constraintStiffness: 1,
            constraintDamping: 0.08,
            constraintLength: 1.8,
            motorSpeed: 5,
            motorAxelOffset: 40,
            flattenIdle: 0.000001,
            flattenStiffness: 0.5,
            jumpIdle: 0.000001,
            jumpStiffness: 0.05,
            showDebug: true,
            ...config
        };
        
        // Create the worm
        this.create(x, y);
        
        // Control states
        this.motorDirection = 0;
        this.isFlattenActive = false;
        this.isJumpActive = false;
    }
    
    create(x, y) {
        const segments = [];
        const constraints = [];
        const segmentRadii = [];
        
        // Create segments with variable sizes
        let currentY = y;
        let motorY;
        let motorIndex = 2;
        
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
            
            if (i === motorIndex) {
                motorY = currentY;
            }
            
            segments.push(segment);
            
            if (i < this.config.segmentSizes.length - 1) {
                const nextRadius = this.config.baseRadius * this.config.segmentSizes[i + 1];
                currentY += radius + nextRadius + 2;
            }
        }
        
        // Create motor
        const motor = this.matter.add.circle(x, motorY, this.config.baseRadius * 3, {
            name: 'motor',
            density: 0.001,
            isSensor: true,
            render: {
                visible: this.config.showDebug,
            }
        });
        
        // Attach motor to segment
        const motorMount = this.Matter.Constraint.create({
            bodyA: segments[1],
            bodyB: motor,
            pointB: { x: 0, y: this.config.motorAxelOffset },
            length: this.config.motorAxelOffset * 0.3,
            stiffness: 0.3,
            damping: 0.1,
            render: {
                visible: this.config.showDebug,
            }
        });
        this.Matter.World.add(this.matter.world.localWorld, motorMount);
        
        // Create main constraints between segments
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
        }
        
        // Add minimum distance constraints
        for (let i = 0; i < segments.length - 2; i++) {
            const segA = segments[i];
            const segB = segments[i + 2];
            const minDistance = segmentRadii[i] + segmentRadii[i + 2] + 5;
            
            const spacingConstraint = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: 0 },
                pointB: { x: 0, y: 0 },
                length: minDistance,
                stiffness: 0.005,
                damping: 0.1,
                render: {
                    visible: false,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, spacingConstraint);
            constraints.push(spacingConstraint);
        }
        
        // Add flatten springs
        const flattenSprings = [];
        for (let i = 0; i < segments.length - 1; i++) {
            const segA = segments[i];
            const segB = segments[i + 1];
            
            const dx = segB.position.x - segA.position.x;
            const dy = segB.position.y - segA.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const spring = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                length: distance * 1.25,
                stiffness: this.config.flattenIdle,
                render: {
                    visible: true,
                    strokeStyle: '#ff6b6b',
                    lineWidth: 2,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, spring);
            flattenSprings.push(spring);
        }
        
        // Add jump spring
        let jumpSpring = null;
        if (segments.length > 2) {
            const head = segments[0];
            const jumpTarget = segments[segments.length - 2];
            
            const dx = jumpTarget.position.x - head.position.x;
            const dy = jumpTarget.position.y - head.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            jumpSpring = this.Matter.Constraint.create({
                bodyA: head,
                bodyB: jumpTarget,
                length: distance * 2,
                stiffness: this.config.jumpIdle,
                render: {
                    visible: true,
                    strokeStyle: '#74b9ff',
                    lineWidth: 3,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, jumpSpring);
        }
        
        // Store references
        this.segments = segments;
        this.constraints = constraints;
        this.motor = motor;
        this.motorMount = motorMount;
        this.flattenSprings = flattenSprings;
        this.jumpSpring = jumpSpring;
    }
    
    // Control methods
    setMotorDirection(direction) {
        this.motorDirection = direction; // -1 left, 0 idle, 1 right
    }
    
    setFlatten(active) {
        this.isFlattenActive = active;
        this.flattenSprings.forEach(spring => {
            spring.stiffness = active ? this.config.flattenStiffness : this.config.flattenIdle;
        });
    }
    
    setJump(active) {
        this.isJumpActive = active;
        if (this.jumpSpring) {
            this.jumpSpring.stiffness = active ? this.config.jumpStiffness : this.config.jumpIdle;
        }
    }
    
    update(delta) {
        // Update motor
        if (this.motor) {
            if (this.motorDirection !== 0) {
                this.matter.body.setDensity(this.motor, 0.01);
                const rotationSpeed = Math.PI * 2 * this.config.motorSpeed * this.motorDirection;
                const rotationDelta = (rotationSpeed * delta) / 1000;
                const currentAngle = this.motor.angle;
                
                this.matter.body.setAngle(this.motor, currentAngle + rotationDelta);
                this.matter.body.setAngularVelocity(this.motor, rotationSpeed);
            } else {
                this.matter.body.setDensity(this.motor, 0.0001);
                this.matter.body.setAngularVelocity(this.motor, 0);
            }
        }
        
        // Update segment graphics
        this.segments.forEach((segment) => {
            if (segment.graphics) {
                segment.graphics.x = segment.position.x;
                segment.graphics.y = segment.position.y;
            }
        });
    }
    
    // Utility methods
    getHead() {
        return this.segments[0];
    }
    
    getTail() {
        return this.segments[this.segments.length - 1];
    }
    
    getMotorPosition() {
        return this.motor ? this.motor.position : null;
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
        
        if (this.flattenSprings) {
            this.flattenSprings.forEach(spring => {
                this.matter.world.remove(spring);
            });
        }
        
        if (this.jumpSpring) {
            this.matter.world.remove(this.jumpSpring);
        }
        
        if (this.motor) {
            this.matter.world.remove(this.motor);
        }
        
        if (this.motorMount) {
            this.matter.world.remove(this.motorMount);
        }
    }
}