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
        
        // Check if we're in roll mode
        const isInRollMode = this.worm.stateMachine && 
                           this.worm.stateMachine.isInState(this.worm.stateMachine.states.ROLLING);
        
        // Disable jump springs during roll mode to prevent trajectory manipulation
        if (isInRollMode) {
            // Detach any active springs when entering roll mode
            if (this.jumpSprings.head.attached) {
                this.detachSpring('head');
            }
            if (this.jumpSprings.tail.attached) {
                this.detachSpring('tail');
            }
            return;
        }
        
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
        
        // Calculate direction vector
        const dx = toSegment.position.x - fromSegment.position.x;
        const dy = toSegment.position.y - fromSegment.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Normalize direction
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            // Calculate laser length inversely proportional to distance
            // When segments are close (compressed spring), laser is longer
            // When segments are far (extended spring), laser is shorter
            const springLength = springData.length;
            const compressionRatio = Math.max(0, Math.min(1, (springLength - distance) / springLength));
            // Laser length ranges based on compression (more compressed = longer arrow)
            const laserLength = springLength * (compressionRatio * 1.3);
            
            // Calculate the end point of the laser
            const endX = fromSegment.position.x + dirX * laserLength;
            const endY = fromSegment.position.y + dirY * laserLength;
            
            // Draw glow effect
            laser.lineStyle(config.glowWidth, springData.color, config.glowAlpha);
            laser.lineBetween(
                fromSegment.position.x,
                fromSegment.position.y,
                endX,
                endY
            );
            
            // Draw main line
            laser.lineStyle(config.lineWidth, springData.color, 1);
            laser.lineBetween(
                fromSegment.position.x,
                fromSegment.position.y,
                endX,
                endY
            );
            
            // Add arrow head at the end pointing in the direction of force
            const arrowSize = config.arrowSize;
            const arrowX = endX - dirX * config.arrowOffset;
            const arrowY = endY - dirY * config.arrowOffset;
            
            laser.fillStyle(springData.color, 1);
            laser.beginPath();
            laser.moveTo(arrowX + dirX * arrowSize, arrowY + dirY * arrowSize);
            laser.lineTo(arrowX - dirY * arrowSize/2, arrowY + dirX * arrowSize/2);
            laser.lineTo(arrowX + dirY * arrowSize/2, arrowY - dirX * arrowSize/2);
            laser.closePath();
            laser.fillPath();
        }
        
        // Start fade timer immediately
        this.fadeLaser(laser);
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
