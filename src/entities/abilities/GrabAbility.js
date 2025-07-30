import BaseAbility from './BaseAbility';

export default class GrabAbility extends BaseAbility {
    constructor(worm, config = {}) {
        super(worm, config);
        
        // Grab configuration
        this.activationThreshold = config.activationThreshold || 0.2;
        this.constraintStiffness = config.constraintStiffness || 0.2;
        this.constraintDamping = config.constraintDamping || 0.5;
        this.headSegmentCount = config.headSegmentCount || 0.3;
        this.tailSegmentCount = config.tailSegmentCount || 0.3;
        
        // Visual effects configuration
        this.visualConfig = config.visual || {
            circleRadius: 15,
            pulseScale: 0.25,
            pulseDuration: 2500,
            circleColor: 0x3bff2b,
            circleAlpha: 0.9,
            strokeWidth: 2,
            strokeColor: 0xFFFFFF
        };
        
        // Colors for head/tail debug rendering (passed from parent config)
        this.headColor = this.worm.config.headColor || 0xff6b6b;
        this.tailColor = this.worm.config.tailColor || 0x74b9ff;
        
        // Sticky constraints tracking
        this.stickyConstraints = {
            head: [],
            tail: []
        };
        
        // Visual circles tracking
        this.stickinessCircles = new Map();
        
        // Grab disabled flag (for temporary disabling during reset)
        this.grabDisabled = false;
        
        // Section configurations
        this.sections = {
            head: {
                name: 'head',
                segmentRange: { start: 0, end: this.headSegmentCount },
                color: this.headColor
            },
            tail: {
                name: 'tail',
                segmentRange: { start: 1 - this.tailSegmentCount, end: 1 },
                color: this.tailColor
            }
        };
    }
    
    onActivate() {
        // Grab ability doesn't need special activation
        // It's always ready to create constraints when conditions are met
    }
    
    onDeactivate() {
        // Clean up all sticky constraints
        ['head', 'tail'].forEach(section => {
            this.deactivateStickiness(section);
        });
    }
    
    handleInput(inputs) {
        if (!this.isActive) return;
        
        const { leftStick, rightStick, leftGrab, rightGrab, swapControls } = inputs;
        
        // Determine which inputs control which sections
        const headStick = swapControls ? rightStick : leftStick;
        const tailStick = swapControls ? leftStick : rightStick;
        const headGrabActive = swapControls ? rightGrab > 0 : leftGrab > 0;
        const tailGrabActive = swapControls ? leftGrab > 0 : rightGrab > 0;
        
        // Update stickiness for each section
        this.updateStickinessSystem([
            { 
                section: this.sections.head, 
                stick: headStick, 
                active: headGrabActive,
                grabValue: headGrabActive ? (swapControls ? rightGrab : leftGrab) : 0
            },
            { 
                section: this.sections.tail, 
                stick: tailStick, 
                active: tailGrabActive,
                grabValue: tailGrabActive ? (swapControls ? leftGrab : rightGrab) : 0
            }
        ]);
        
        // Clean up invalid constraints
        this.cleanupInvalidStickyConstraints(inputs);
    }
    
    updateStickinessSystem(sectionData) {
        sectionData.forEach(({ section, stick, active }) => {
            // Just check if grab button is pressed - no directional requirement
            if (active) {
                this.activateStickiness(section.name);
            } else {
                this.deactivateStickiness(section.name);
            }
        });
    }
    
    checkDirectionalStickiness(section, stick) {
        const stickMagnitude = this.calculateStickMagnitude(stick);
        if (stickMagnitude < this.activationThreshold) {
            return false;
        }
        
        const stickDirection = this.normalizeStickDirection(stick);
        const { startIndex, endIndex } = this.worm.getSegmentRange(
            section.segmentRange.start,
            section.segmentRange.end
        );
        
        // Check if any segment in range has collision where stick points toward surface
        for (let i = startIndex; i < endIndex && i < this.worm.segments.length; i++) {
            const collision = this.worm.segmentCollisions[i];
            if (collision && collision.isColliding && collision.surfaceBody && collision.surfaceBody.isStatic) {
                // Calculate if stick direction aligns with pushing into the surface
                const surfaceInwardDirection = {
                    x: -collision.surfaceNormal.x,
                    y: -collision.surfaceNormal.y
                };
                
                // Dot product tells us how aligned the stick is with pushing into surface
                const alignment = stickDirection.x * surfaceInwardDirection.x + 
                                stickDirection.y * surfaceInwardDirection.y;
                
                // If stick is pointing toward surface (positive dot product above threshold)
                if (alignment > 0.5) { // 0.5 means ~60 degree cone toward surface
                    return true;
                }
            }
        }
        
        return false;
    }
    
    activateStickiness(sectionName) {
        // Skip if grab system is temporarily disabled
        if (this.grabDisabled) return;
        
        const section = this.sections[sectionName];
        
        // Check if any segments in this section are on ice (prevents stickiness)
        const hasIceInSection = this.worm.hasIceInRange(
            section.segmentRange.start,
            section.segmentRange.end
        );
        
        // Can't stick to ice
        if (hasIceInSection) {
            this.deactivateStickiness(sectionName);
            return;
        }
        
        // Get segments that are touching static surfaces
        const { startIndex, endIndex } = this.worm.getSegmentRange(
            section.segmentRange.start,
            section.segmentRange.end
        );
        
        const touchingSegments = [];
        for (let i = startIndex; i < endIndex && i < this.worm.segments.length; i++) {
            const collision = this.worm.segmentCollisions[i];
            if (collision && collision.isColliding && collision.surfaceBody && collision.surfaceBody.isStatic) {
                touchingSegments.push({
                    index: i,
                    segment: this.worm.segments[i],
                    collision: collision
                });
            }
        }
        
        // Create sticky constraints for new touching segments
        const existingConstraints = this.stickyConstraints[sectionName];
        const existingSegmentIndices = existingConstraints.map(c => c.segmentIndex);
        
        touchingSegments.forEach(touchingData => {
            const { index, segment, collision } = touchingData;
            
            // Skip if already has constraint
            if (existingSegmentIndices.includes(index)) return;
            
            // Create pin constraint at contact point
            const segmentRelativePoint = {
                x: collision.contactPoint.x - segment.position.x,
                y: collision.contactPoint.y - segment.position.y
            };
            const surfaceRelativePoint = {
                x: collision.contactPoint.x - collision.surfaceBody.position.x,
                y: collision.contactPoint.y - collision.surfaceBody.position.y
            };
            
            const constraint = this.Matter.Constraint.create({
                bodyA: segment,
                bodyB: collision.surfaceBody,
                pointA: segmentRelativePoint,
                pointB: surfaceRelativePoint,
                length: 0,
                stiffness: this.constraintStiffness,
                damping: this.constraintDamping,
                render: {
                    visible: this.config.showDebug,
                    strokeStyle: this.colorToHex(section.color),
                    lineWidth: 3
                }
            });
            
            // Add to world and track
            this.addConstraint(constraint);
            existingConstraints.push({
                constraint: constraint,
                segmentIndex: index,
                surfaceBody: collision.surfaceBody
            });
            
            // Create pulsating circle at contact point
            this.createStickinessCircle(constraint, collision.contactPoint);
        });
    }
    
    deactivateStickiness(sectionName) {
        const constraints = this.stickyConstraints[sectionName];
        
        // Remove all constraints and circles for this section
        constraints.forEach(constraintData => {
            this.removeConstraint(constraintData.constraint);
            this.removeStickinessCircle(constraintData.constraint);
        });
        
        // Clear the array
        this.stickyConstraints[sectionName] = [];
    }
    
    cleanupInvalidStickyConstraints(inputs) {
        const { leftGrab, rightGrab, swapControls } = inputs;
        
        ['head', 'tail'].forEach(sectionName => {
            const constraints = this.stickyConstraints[sectionName];
            const validConstraints = [];
            
            // Check if the grab button for this section is still pressed
            const isGrabActive = sectionName === 'head' ? 
                (swapControls ? rightGrab > 0 : leftGrab > 0) :
                (swapControls ? leftGrab > 0 : rightGrab > 0);
            
            constraints.forEach(constraintData => {
                const { constraint } = constraintData;
                
                // Keep constraint if grab button is still pressed
                if (isGrabActive) {
                    validConstraints.push(constraintData);
                } else {
                    // Only remove constraint when button is released
                    this.removeConstraint(constraint);
                    this.removeStickinessCircle(constraint);
                }
            });
            
            this.stickyConstraints[sectionName] = validConstraints;
        });
    }
    
    createStickinessCircle(constraint, contactPoint) {
        const config = this.visualConfig;
        
        // Create a graphics object for the pulsating circle
        const circle = this.scene.add.graphics();
        circle.setPosition(contactPoint.x, contactPoint.y);
        circle.setDepth(100);
        
        // Create the pulsating animation
        const pulseAnimation = this.scene.tweens.add({
            targets: circle,
            scaleX: 1 + config.pulseScale,
            scaleY: 1 + config.pulseScale,
            duration: config.pulseDuration / 2,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Store both the circle and its animation
        this.stickinessCircles.set(constraint, {
            graphics: circle,
            animation: pulseAnimation
        });
        
        // Track graphics and tween for cleanup
        this.addGraphics(circle);
        this.addTween(pulseAnimation);
        
        // Draw the initial circle
        this.drawStickinessCircle(circle, config);
        
        return circle;
    }
    
    drawStickinessCircle(graphics, config) {
        graphics.clear();
        graphics.fillStyle(config.circleColor, config.circleAlpha);
        if (config.strokeWidth && config.strokeColor) {
            graphics.lineStyle(config.strokeWidth, config.strokeColor, 1.0);
        }
        graphics.fillCircle(0, 0, config.circleRadius);
        if (config.strokeWidth && config.strokeColor) {
            graphics.strokeCircle(0, 0, config.circleRadius);
        }
    }
    
    removeStickinessCircle(constraint) {
        const circleData = this.stickinessCircles.get(constraint);
        if (circleData) {
            const { graphics, animation } = circleData;
            
            // Remove from our tracking arrays
            if (animation) {
                this.removeTween(animation);
            }
            if (graphics) {
                this.removeGraphics(graphics);
            }
            
            // Remove from map
            this.stickinessCircles.delete(constraint);
        }
    }
    
    colorToHex(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    // Method to temporarily disable grab (e.g., during reset)
    disableGrab() {
        this.grabDisabled = true;
        // Clean up all active constraints
        ['head', 'tail'].forEach(section => {
            this.deactivateStickiness(section);
        });
    }
    
    // Method to re-enable grab
    enableGrab() {
        this.grabDisabled = false;
    }
}