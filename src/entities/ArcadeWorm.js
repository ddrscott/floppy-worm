import WormBase from './WormBase';

export default class MotorWorm extends WormBase {
    constructor(scene, x, y, config = {}) {
        super(scene, x, y, motorConfig);
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
                const numSegmentsToMove = Math.min(2, this.segments.length - 1);
                const headSegments = this.segments.slice(numSegmentsToMove).reverse();
                const force = -0.04 * this.motorDirection; // Much reduced force for rage game difficulty

                headSegments.forEach((segment, i) => {
                    // Apply torque as well for better turning
                    const segmentForce = force * (1 - i * 0.3);
                    this.matter.body.applyForce(segment, segment.position, { x: segmentForce, y: 0 });
                });
            } else {
                this.matter.body.setDensity(this.motor, 0.0001);
                this.matter.body.setAngularVelocity(this.motor, 0);
            }
        }
        
        // Handle lift action with gentle upward force on head
        if (this.isLiftActive && this.segments.length > 0) {
            const head = this.segments[0];
            const liftForce = 0.07; // Very small upward force
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
