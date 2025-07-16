import WormBase from './WormBase';

export default class MotorWorm extends WormBase {
    constructor(scene, x, y, config = {}) {
        // Merge motor-specific config with base config
        const motorConfig = {
            motorSpeed: 5,
            motorAxelOffset: 40,
            flattenIdle: 0.000001,
            flattenStiffness: 0.5,
            jumpIdle: 0.000001,
            jumpStiffness: 0.05,
            ...config
        };
        
        super(scene, x, y, motorConfig);
        
        // Control states
        this.motorDirection = 0;
        this.isFlattenActive = false;
        this.isJumpActive = false;
        this.isLiftActive = false;
        
        // Create motor-specific components
        this.createMotorComponents();
    }
    
    createMotorComponents() {
        // Create motor
        let motorY = this.segments[1].position.y;
        const motor = this.matter.add.circle(
            this.segments[1].position.x, 
            motorY, 
            this.config.baseRadius * 3, 
            {
                name: 'motor',
                density: 0.001,
                isSensor: true,
                render: {
                    visible: this.config.showDebug,
                }
            }
        );
        
        // Attach motor to segment
        const motorMount = this.Matter.Constraint.create({
            bodyA: this.segments[1],
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
        
        // Add flatten springs
        const flattenSprings = [];
        for (let i = 0; i < this.segments.length - 1; i++) {
            const segA = this.segments[i];
            const segB = this.segments[i + 1];
            
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
        if (this.segments.length > 2) {
            const head = this.segments[0];
            const jumpTarget = this.segments[this.segments.length - 2];
            
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
        
        // Store motor-specific references
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
    
    setLift(active) {
        this.isLiftActive = active;
    }
    
    update(delta) {
        // Call parent update for graphics
        super.update(delta);
        
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
        
        // Handle lift action with gentle upward force on head
        if (this.isLiftActive && this.segments.length > 0) {
            const head = this.segments[0];
            const liftForce = 0.1; // Very small upward force
            this.matter.body.applyForce(head, head.position, { x: 0, y: -liftForce });
        }
    }
    
    getMotorPosition() {
        return this.motor ? this.motor.position : null;
    }
    
    // Override updateConfig to handle motor-specific configs
    updateConfig(newConfig) {
        super.updateConfig(newConfig);
        
        // Update motor-specific parameters
        if (newConfig.flattenStiffness !== undefined && !this.isFlattenActive) {
            this.config.flattenStiffness = newConfig.flattenStiffness;
        }
        
        if (newConfig.jumpStiffness !== undefined && !this.isJumpActive) {
            this.config.jumpStiffness = newConfig.jumpStiffness;
        }
    }
    
    // Override destroy to clean up motor components
    destroy() {
        // Clean up motor-specific components
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
        
        // Call parent destroy
        super.destroy();
    }
}
