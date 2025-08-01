import BaseAbility from './BaseAbility';

export default class JumpAbility extends BaseAbility {
    constructor(worm, config = {}) {
        super(worm, config);
        
        // Jump configuration
        this.springLengthMultiplier = config.springLengthMultiplier || 1.3;
        this.triggerThreshold = config.triggerThreshold || 0.01;
        this.stiffness = config.stiffness || 0.0375;
        
        // Compression spring parameters
        this.baseCompressionStiffness = config.baseCompressionStiffness || 0.05;
        this.maxCompressionStiffness = config.maxCompressionStiffness || 0.7;
        this.compressionTriggerSensitivity = config.compressionTriggerSensitivity || 1.0;
        
        // Ground anchor settings
        this.useGroundAnchor = config.useGroundAnchor || false;
        
        // Laser guidance visuals
        this.laserConfig = config.laser || {
            lineWidth: 4,
            glowWidth: 8,
            glowAlpha: 0.5,
            length: 200,
            arrowSize: 15,
            arrowOffset: 10,
            fadeDuration: 1000
        };
        
        // Colors for head/tail (passed from parent config)
        this.headColor = this.worm.config.headColor || 0xff6b6b;
        this.tailColor = this.worm.config.tailColor || 0x74b9ff;
        
        // Initialize spring system
        this.jumpSprings = {
            head: {
                spring: null,
                attached: false,
                length: 0,
                laser: null,
                color: this.headColor,
                getSegments: () => ({
                    from: this.worm.segments[0],
                    to: this.worm.segments[this.worm.segments.length - 2]
                })
            },
            tail: {
                spring: null,
                attached: false,
                length: 0,
                laser: null,
                color: this.tailColor,
                getSegments: () => ({
                    from: this.worm.segments[this.worm.segments.length - 1],
                    to: this.worm.segments[1]
                })
            }
        };
        
        // Grounding ranges for smart anchoring
        this.groundingRanges = {
            head: { start: 0.7, end: 1.0 },
            tail: { start: 0.0, end: 0.3 }
        };
    }
    
    onActivate() {
        // Create laser graphics
        this.jumpSprings.head.laser = this.scene.add.graphics();
        this.jumpSprings.head.laser.setDepth(100);
        this.addGraphics(this.jumpSprings.head.laser);
        
        this.jumpSprings.tail.laser = this.scene.add.graphics();
        this.jumpSprings.tail.laser.setDepth(100);
        this.addGraphics(this.jumpSprings.tail.laser);
    }
    
    onDeactivate() {
        // Detach any active springs
        if (this.jumpSprings.head.attached) {
            this.detachSpring('head');
        }
        if (this.jumpSprings.tail.attached) {
            this.detachSpring('tail');
        }
        
        // Extra cleanup for any remaining ground bodies
        ['head', 'tail'].forEach(type => {
            const springData = this.jumpSprings[type];
            if (springData.groundBody && this.matter && this.matter.world && this.matter.world.localWorld) {
                try {
                    this.Matter.World.remove(this.matter.world.localWorld, springData.groundBody);
                } catch (error) {
                    // Silently ignore - world might already be destroyed
                }
                springData.groundBody = null;
            }
        });
    }
    
    calculateInitialLengths() {
        const segments = this.worm.segments;
        
        if (segments.length > 2) {
            const headA = segments[0];
            const headB = segments[segments.length - 2];
            const headDistance = Phaser.Math.Distance.BetweenPoints(
                headA.position, headB.position
            );
            this.jumpSprings.head.length = headDistance * this.springLengthMultiplier;
            
            const tailA = segments[1];
            const tailB = segments[segments.length - 1];
            const tailDistance = Phaser.Math.Distance.BetweenPoints(
                tailA.position, tailB.position
            );
            this.jumpSprings.tail.length = tailDistance * this.springLengthMultiplier;
        }
    }
    
    handleInput(inputs) {
        if (!this.isActive) return;
        
        const { leftTrigger, rightTrigger, swapControls } = inputs;
        
        // Determine which triggers control which springs
        const headTriggerValue = swapControls ? rightTrigger : leftTrigger;
        const tailTriggerValue = swapControls ? leftTrigger : rightTrigger;
        
        // Handle springs
        this.handleJumpSpring('head', headTriggerValue);
        this.handleJumpSpring('tail', tailTriggerValue);
        
        // Update compression spring stiffness
        const maxTriggerValue = Math.max(headTriggerValue, tailTriggerValue);
        const compressionStiffness = this.baseCompressionStiffness + 
            (maxTriggerValue * this.compressionTriggerSensitivity * 
             (this.maxCompressionStiffness - this.baseCompressionStiffness));
        
        this.worm.updateCompressionStiffness(compressionStiffness);
    }
    
    handleJumpSpring(type, triggerValue) {
        const isActive = triggerValue > this.triggerThreshold;
        const springData = this.jumpSprings[type];
        
        if (isActive) {
            if (!springData.attached) {
                this.attachSpring(type, triggerValue);
            } else if (springData.spring) {
                this.updateSpringStiffness(type, triggerValue);
            }
        } else {
            if (springData.attached) {
                this.detachSpring(type);
            }
        }
    }
    
    attachSpring(type, triggerValue) {
        const springData = this.jumpSprings[type];
        const segments = springData.getSegments();
        const stiffness = this.calculateStiffness(triggerValue);
        
        // Check for ground contact for smart anchoring
        const groundingRange = this.groundingRanges[type];
        const groundedSegments = this.worm.getGroundedSegmentsInRange(
            groundingRange.start,
            groundingRange.end
        );
        
        // Check if any segments are on ice
        const hasIceInGrip = this.worm.hasIceInRange(
            groundingRange.start,
            groundingRange.end
        );
        
        if (this.useGroundAnchor && groundedSegments.length > 0 && !hasIceInGrip) {
            // Use ground-anchored spring
            const jumpingSegment = segments.from;
            const bestGroundContact = groundedSegments[0];
            
            const springResult = this.createGroundAnchoredSpring(
                jumpingSegment,
                bestGroundContact,
                springData.length,
                stiffness
            );
            springData.spring = springResult.constraint;
            springData.isGroundAnchored = true;
            springData.groundBody = springResult.groundBody;
            springData.groundedSegment = springResult.groundedSegment;
            
            this.showJumpTrajectory(type, bestGroundContact.segment, jumpingSegment);
        } else {
            // Use segment-to-segment spring
            springData.spring = this.createJumpSegment(
                segments.from,
                segments.to,
                springData.length,
                stiffness
            );
            springData.isGroundAnchored = false;
            
            
            this.showJumpTrajectory(type, segments.to, segments.from);
        }
        
        this.addConstraint(springData.spring);
        springData.attached = true;
    }
    
    detachSpring(type) {
        const springData = this.jumpSprings[type];
        
        if (springData.spring) {
            this.removeConstraint(springData.spring);
            springData.spring = null;
            springData.attached = false;
            
            // Clean up ground-anchored properties
            if (springData.isGroundAnchored) {
                // Remove the ground body from the world
                if (springData.groundBody && this.matter && this.matter.world && this.matter.world.localWorld) {
                    try {
                        this.Matter.World.remove(this.matter.world.localWorld, springData.groundBody);
                    } catch (error) {
                        console.warn('Failed to remove ground body:', error);
                    }
                }
                springData.isGroundAnchored = false;
                springData.groundBody = null;
                springData.groundedSegment = null;
            }
            
            // Fade out laser
            if (springData.laser) {
                this.fadeLaser(springData.laser);
            }
        }
    }
    
    updateSpringStiffness(type, triggerValue) {
        const springData = this.jumpSprings[type];
        
        if (springData.spring) {
            // Check if ground-anchored spring needs conversion
            if (springData.isGroundAnchored && springData.groundedSegment) {
                const segmentIndex = this.worm.segments.indexOf(springData.groundedSegment);
                const collision = this.worm.segmentCollisions[segmentIndex];
                
                // Convert to segment spring if ground contact lost
                if (!collision || !collision.isColliding || collision.surfaceBody !== springData.groundBody) {
                    this.convertToSegmentSpring(type, triggerValue);
                    return;
                }
            }
            
            springData.spring.stiffness = this.calculateStiffness(triggerValue);
        }
    }
    
    convertToSegmentSpring(type, triggerValue) {
        const springData = this.jumpSprings[type];
        
        // Remove current spring
        if (springData.spring) {
            this.removeConstraint(springData.spring);
        }
        
        // Create new segment spring
        const segments = springData.getSegments();
        const stiffness = this.calculateStiffness(triggerValue);
        
        springData.spring = this.createJumpSegment(
            segments.from,
            segments.to,
            springData.length,
            stiffness
        );
        
        this.addConstraint(springData.spring);
        
        // Clear ground-anchored properties
        springData.isGroundAnchored = false;
        springData.groundBody = null;
        springData.groundedSegment = null;
        
        // Update visualization
        this.showJumpTrajectory(type, segments.to, segments.from);
    }
    
    calculateStiffness(triggerValue) {
        return triggerValue * this.stiffness;
    }
    
    createJumpSegment(from, to, length, stiffness) {
        return this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: length,
            stiffness: stiffness
        });
    }
    
    createGroundAnchoredSpring(jumpingSegment, groundedSegmentData, springLength, stiffness) {
        const { segment: groundedSegment, collision } = groundedSegmentData;
        
        // Create invisible static body at contact point
        const groundBody = this.matter.add.circle(
            collision.contactPoint.x,
            collision.contactPoint.y,
            1,
            {
                isStatic: true,
                isSensor: true,
                render: { visible: false }
            }
        );
        
        // Create spring from jumping segment to ground anchor
        const constraint = this.Matter.Constraint.create({
            bodyA: jumpingSegment,
            bodyB: groundBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: 0, y: 0 },
            length: springLength * 0.7,
            stiffness: stiffness
        });
        
        return {
            constraint,
            groundBody,
            groundedSegment
        };
    }
    
    showJumpTrajectory(type, fromSegment, toSegment) {
        const springData = this.jumpSprings[type];
        const laser = springData.laser;
        const config = this.laserConfig;
        
        if (!laser) return;
        
        // Stop any existing fade tween
        this.scene.tweens.killTweensOf(laser);
        laser.alpha = 1;
        
        // Clear and redraw
        laser.clear();
        
        // Draw glow effect
        laser.lineStyle(config.glowWidth, springData.color, config.glowAlpha);
        laser.lineBetween(
            fromSegment.position.x,
            fromSegment.position.y,
            toSegment.position.x,
            toSegment.position.y
        );
        
        // Draw main line
        laser.lineStyle(config.lineWidth, springData.color, 1);
        laser.lineBetween(
            fromSegment.position.x,
            fromSegment.position.y,
            toSegment.position.x,
            toSegment.position.y
        );
        
        // Calculate direction for arrow
        const dx = toSegment.position.x - fromSegment.position.x;
        const dy = toSegment.position.y - fromSegment.position.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            const dirX = dx / length;
            const dirY = dy / length;
            
            // Position arrow near the target
            const arrowX = toSegment.position.x - dirX * config.arrowOffset;
            const arrowY = toSegment.position.y - dirY * config.arrowOffset;
            
            // Draw arrowhead (using the corrected math from the original implementation)
            laser.fillStyle(springData.color, 1);
            
            // Calculate arrow tip position (pointing toward the target)
            const arrowTipX = arrowX + dirX * config.arrowSize;
            const arrowTipY = arrowY + dirY * config.arrowSize;
            
            // Calculate arrow base points (perpendicular to direction)
            const arrowBase1X = arrowX - dirY * config.arrowSize * 0.5;
            const arrowBase1Y = arrowY + dirX * config.arrowSize * 0.5;
            const arrowBase2X = arrowX + dirY * config.arrowSize * 0.5;
            const arrowBase2Y = arrowY - dirX * config.arrowSize * 0.5;
            
            laser.fillTriangle(
                arrowTipX, arrowTipY,      // Tip of arrow
                arrowBase1X, arrowBase1Y,  // Left base point
                arrowBase2X, arrowBase2Y   // Right base point
            );
        }
    }
    
    fadeLaser(laser) {
        if (!laser) return;
        
        this.scene.tweens.add({
            targets: laser,
            alpha: 0,
            duration: this.laserConfig.fadeDuration,
            ease: 'Linear',
            onComplete: () => {
                laser.clear();
            }
        });
    }
    
    // Initialize spring lengths - should be called from DoubleWorm constructor
    initializeSpringLengths() {
        this.calculateInitialLengths();
    }
}
