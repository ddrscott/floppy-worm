export default class BaseAbility {
    constructor(worm, config = {}) {
        this.worm = worm;
        this.scene = worm.scene;
        this.matter = worm.matter;
        this.Matter = worm.Matter;
        this.config = config;
        this.isActive = false;
        this.constraints = [];
        this.graphics = [];
        this.tweens = [];
    }
    
    // Lifecycle methods - must be implemented by subclasses
    activate() {
        if (this.isActive) {
            console.warn(`${this.constructor.name} is already active`);
            return;
        }
        
        this.isActive = true;
        this.onActivate();
    }
    
    deactivate() {
        if (!this.isActive) {
            // console.warn(`${this.constructor.name} is not active`);
            return;
        }
        
        this.isActive = false;
        this.cleanupConstraints();
        this.cleanupGraphics();
        this.cleanupTweens();
        this.onDeactivate();
    }
    
    // Abstract methods - must be implemented by subclasses
    onActivate() {
        throw new Error(`${this.constructor.name} must implement onActivate()`);
    }
    
    onDeactivate() {
        throw new Error(`${this.constructor.name} must implement onDeactivate()`);
    }
    
    update(delta) {
        // Override in subclasses if needed
    }
    
    handleInput(inputs) {
        // Override in subclasses if needed
        // inputs = { leftStick, rightStick, leftTrigger, rightTrigger, buttons, ... }
    }
    
    // Utility methods for constraint management
    addConstraint(constraint) {
        this.constraints.push(constraint);
        if (this.matter && this.matter.world && this.matter.world.localWorld) {
            this.Matter.World.add(this.matter.world.localWorld, constraint);
        }
    }
    
    removeConstraint(constraint) {
        const index = this.constraints.indexOf(constraint);
        if (index > -1) {
            this.constraints.splice(index, 1);
            if (this.matter && this.matter.world && this.matter.world.localWorld) {
                try {
                    this.Matter.World.remove(this.matter.world.localWorld, constraint);
                } catch (error) {
                    console.warn('Failed to remove constraint:', error);
                }
            }
        }
    }
    
    cleanupConstraints() {
        if (this.matter && this.matter.world && this.matter.world.localWorld) {
            this.constraints.forEach(constraint => {
                try {
                    this.Matter.World.remove(this.matter.world.localWorld, constraint);
                } catch (error) {
                    console.warn('Failed to remove constraint during cleanup:', error);
                }
            });
        }
        this.constraints = [];
    }
    
    // Utility methods for graphics management
    addGraphics(graphic) {
        this.graphics.push(graphic);
    }
    
    removeGraphics(graphic) {
        const index = this.graphics.indexOf(graphic);
        if (index > -1) {
            this.graphics.splice(index, 1);
            graphic.destroy();
        }
    }
    
    cleanupGraphics() {
        this.graphics.forEach(graphic => {
            graphic.destroy();
        });
        this.graphics = [];
    }
    
    // Utility methods for tween management
    addTween(tween) {
        this.tweens.push(tween);
    }
    
    removeTween(tween) {
        const index = this.tweens.indexOf(tween);
        if (index > -1) {
            this.tweens.splice(index, 1);
            tween.stop();
        }
    }
    
    cleanupTweens() {
        this.tweens.forEach(tween => {
            tween.stop();
        });
        this.tweens = [];
    }
    
    // Helper methods for accessing worm state
    getSegments() {
        return this.worm.segments;
    }
    
    getHead() {
        return this.worm.getHead();
    }
    
    getTail() {
        return this.worm.getTail();
    }
    
    getSegmentCollisions() {
        return this.worm.segmentCollisions;
    }
    
    getTouchingSegments(startPercent, endPercent) {
        return this.worm.getTouchingSegments(startPercent, endPercent);
    }
    
    getGroundedSegmentsInRange(startPercent, endPercent) {
        return this.worm.getGroundedSegmentsInRange(startPercent, endPercent);
    }
    
    // Helper for calculating stick magnitude
    calculateStickMagnitude(stick) {
        return Math.sqrt(stick.x * stick.x + stick.y * stick.y);
    }
    
    // Helper for normalizing stick direction
    normalizeStickDirection(stick) {
        const magnitude = this.calculateStickMagnitude(stick);
        if (magnitude === 0) return { x: 0, y: 0 };
        
        return {
            x: stick.x / magnitude,
            y: stick.y / magnitude
        };
    }
}
