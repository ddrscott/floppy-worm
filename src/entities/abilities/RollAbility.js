import BaseAbility from './BaseAbility';

export default class RollAbility extends BaseAbility {
    constructor(worm, config = {}) {
        super(worm, config);
        
        // Roll configuration
        this.chordPatterns = config.chordPatterns || [{ skip: 7, count: 12 }];
        this.startStiffness = config.startStiffness || 0.125;
        this.endStiffness = config.endStiffness || 0.5;
        this.chordDamping = config.chordDamping || 0.9;
        this.chordLengthMultiplier = config.chordLengthMultiplier || 1;
        
        // Transition parameters
        this.formationTime = config.formationTime || 250;
        this.stiffnessEaseType = config.stiffnessEaseType || 'Cubic.easeInOut';
        
        // Control parameters
        this.torqueMultiplier = config.torqueMultiplier || 0.25;
        this.maxAngularVelocity = config.maxAngularVelocity || 20;
        this.exitVelocityBoost = config.exitVelocityBoost || 1.0;
        
        // Anti-slip parameters
        this.slipDetectionThreshold = config.slipDetectionThreshold || 0.1;
        this.antiSlipForce = config.antiSlipForce || 2;
        
        // State tracking
        this.rollMode = {
            active: false,
            transitioning: false,
            chordConstraints: [],
            wheelCenter: { x: 0, y: 0 },
            angularVelocity: 0,
            transitionTween: null,
            lastStickAngle: null,
            accumulatedRotation: 0
        };
        
        // Reference to movement ability for anchor manipulation
        this.movementAbility = null;
    }
    
    setMovementAbility(movementAbility) {
        this.movementAbility = movementAbility;
    }
    
    onActivate() {
        if (this.rollMode.active || this.rollMode.transitioning) return;
        
        this.rollMode.transitioning = true;
        
        // Create chord constraints
        this.rollMode.chordConstraints = this.createWheelConstraints();
        
        // Add constraints to world
        this.rollMode.chordConstraints.forEach(constraintData => {
            this.addConstraint(constraintData.constraint);
        });
        
        // Disable normal movement systems
        this.disableNormalMovement();
        
        // Animate constraint stiffening
        this.rollMode.transitionTween = this.scene.tweens.add({
            targets: this.rollMode,
            duration: this.formationTime,
            ease: this.stiffnessEaseType,
            onUpdate: (tween) => {
                const progress = tween.progress;
                // Update all chord constraint stiffnesses
                this.rollMode.chordConstraints.forEach(constraintData => {
                    constraintData.constraint.stiffness = progress * constraintData.targetStiffness;
                });
            },
            onComplete: () => {
                this.rollMode.active = true;
                this.rollMode.transitioning = false;
                this.rollMode.transitionTween = null;
            }
        });
        
        this.addTween(this.rollMode.transitionTween);
    }
    
    onDeactivate() {
        if (!this.rollMode.active && !this.rollMode.transitioning) return;
        
        // Stop any ongoing transition
        if (this.rollMode.transitionTween) {
            this.rollMode.transitionTween.stop();
            this.rollMode.transitionTween = null;
        }
        
        // Check if we should apply exit boost (e.g., jumping out of roll)
        const shouldBoost = this.worm.stateMachine && 
                          this.worm.stateMachine.getCurrentState() === this.worm.stateMachine.states.JUMPING;
        
        if (shouldBoost && this.rollMode.active) {
            this.applyRollExitBoost();
        }
        
        // Re-enable normal movement
        this.enableNormalMovement();
        
        // Reset state
        this.rollMode.active = false;
        this.rollMode.transitioning = false;
        this.rollMode.angularVelocity = 0;
    }
    
    update(delta) {
        if (!this.isActive || !this.rollMode.active) return;
        
        this.updateRollPhysics(delta);
    }
    
    handleInput(inputs) {
        if (!this.isActive || !this.rollMode.active) return;
        
        const { leftStick, swapControls } = inputs;
        const headStick = swapControls ? inputs.rightStick : leftStick;
        
        this.processCrankingInput(headStick, inputs.delta);
    }
    
    createWheelConstraints() {
        const wheelRadius = this.calculateWheelRadius();
        const constraints = [];
        const segments = this.worm.segments;
        
        // Process each chord pattern
        this.chordPatterns.forEach(pattern => {
            const { skip, count } = pattern;
            
            for (let i = 0; i < count; i++) {
                const fromIndex = (i * skip) % segments.length;
                const toIndex = ((i + 1) * skip) % segments.length;
                
                if (fromIndex !== toIndex) {
                    const fromSegment = segments[fromIndex];
                    const toSegment = segments[toIndex];
                    const chordLength = this.calculateChordLength(fromIndex, toIndex, wheelRadius);
                    
                    const constraint = this.createChordConstraint(
                        fromSegment,
                        toSegment,
                        chordLength,
                        this.startStiffness
                    );
                    
                    constraints.push({
                        constraint: constraint,
                        fromIndex: fromIndex,
                        toIndex: toIndex,
                        targetStiffness: this.endStiffness
                    });
                }
            }
        });
        
        // Add head-to-tail constraint to ensure closed wheel
        const headSegment = segments[0];
        const tailSegment = segments[segments.length - 1];
        const headRadius = this.worm.segmentRadii[0];
        const tailRadius = this.worm.segmentRadii[segments.length - 1];
        
        const headTailConstraint = this.Matter.Constraint.create({
            bodyA: tailSegment,
            bodyB: headSegment,
            pointA: { x: 0, y: tailRadius + 1 },
            pointB: { x: 0, y: -headRadius - 1 },
            length: this.worm.config.linkConstraint.length,
            stiffness: this.startStiffness,
            damping: this.chordDamping,
        });
        
        constraints.push({
            constraint: headTailConstraint,
            fromIndex: 0,
            toIndex: segments.length - 1,
            targetStiffness: this.endStiffness,
            isHeadTail: true
        });
        
        return constraints;
    }
    
    calculateWheelRadius() {
        let totalPerimeter = 0;
        this.worm.segments.forEach((segment, i) => {
            totalPerimeter += this.worm.segmentRadii[i] * 2;
        });
        return totalPerimeter / (2 * Math.PI);
    }
    
    calculateChordLength(fromIndex, toIndex, wheelRadius) {
        const totalSegments = this.worm.segments.length;
        const skipCount = Math.abs(toIndex - fromIndex);
        const angleRadians = (skipCount / totalSegments) * 2 * Math.PI;
        const geometricLength = 2 * wheelRadius * Math.sin(angleRadians / 2);
        return geometricLength * this.chordLengthMultiplier;
    }
    
    createChordConstraint(fromSegment, toSegment, length, stiffness = 0) {
        return this.Matter.Constraint.create({
            bodyA: fromSegment,
            bodyB: toSegment,
            length: length,
            stiffness: stiffness,
            damping: this.chordDamping,
            render: {
                visible: this.config.showDebug,
            }
        });
    }
    
    disableNormalMovement() {
        if (this.movementAbility) {
            // Disable tail anchor
            this.movementAbility.disableTailAnchor();
            
            // Hide tail anchor visuals
            const tailAnchor = this.movementAbility.anchors.tail;
            if (tailAnchor.rangeGraphics) {
                tailAnchor.rangeGraphics.visible = false;
            }
            if (tailAnchor.stickIndicator) {
                tailAnchor.stickIndicator.visible = false;
            }
            
            // Also reduce head anchor stiffness for roll mode
            const headAnchor = this.movementAbility.anchors.head;
            if (headAnchor.constraint) {
                headAnchor.constraint.stiffness = 0.000001;
            }
        }
    }
    
    enableNormalMovement() {
        if (this.movementAbility) {
            // Reposition anchors to their segments
            Object.values(this.movementAbility.anchors).forEach(anchorData => {
                if (anchorData.body && anchorData.attachIndex < this.worm.segments.length) {
                    const attachSegment = this.worm.segments[anchorData.attachIndex];
                    this.Matter.Body.setPosition(anchorData.body, {
                        x: attachSegment.position.x,
                        y: attachSegment.position.y
                    });
                    anchorData.restPos.x = attachSegment.position.x;
                    anchorData.restPos.y = attachSegment.position.y;
                }
            });
            
            // Re-enable tail anchor
            this.movementAbility.enableTailAnchor();
            
            // Show tail anchor visuals
            const tailAnchor = this.movementAbility.anchors.tail;
            if (tailAnchor.rangeGraphics) {
                tailAnchor.rangeGraphics.visible = true;
            }
            if (tailAnchor.stickIndicator) {
                tailAnchor.stickIndicator.visible = true;
            }
            
            // Restore head anchor stiffness
            const headAnchor = this.movementAbility.anchors.head;
            if (headAnchor.constraint) {
                headAnchor.constraint.stiffness = this.movementAbility.anchorStiffness;
            }
        }
    }
    
    updateRollPhysics(delta) {
        // Update wheel center
        let centerX = 0, centerY = 0;
        this.worm.segments.forEach(segment => {
            centerX += segment.position.x;
            centerY += segment.position.y;
        });
        this.rollMode.wheelCenter.x = centerX / this.worm.segments.length;
        this.rollMode.wheelCenter.y = centerY / this.worm.segments.length;
        
        // Move head anchor to wheel center if movement ability is available
        if (this.movementAbility) {
            const headAnchor = this.movementAbility.anchors.head;
            if (headAnchor.body) {
                headAnchor.restPos.x = this.rollMode.wheelCenter.x;
                headAnchor.restPos.y = this.rollMode.wheelCenter.y;
                this.Matter.Body.setPosition(headAnchor.body, {
                    x: this.rollMode.wheelCenter.x,
                    y: this.rollMode.wheelCenter.y
                });
            }
            
            // Keep tail anchor with its segment
            const tailAnchor = this.movementAbility.anchors.tail;
            if (tailAnchor.body && tailAnchor.attachIndex < this.worm.segments.length) {
                const tailSegment = this.worm.segments[tailAnchor.attachIndex];
                this.movementAbility.positionTailAnchor(tailSegment.position.x, tailSegment.position.y);
                tailAnchor.restPos.x = tailSegment.position.x;
                tailAnchor.restPos.y = tailSegment.position.y;
            }
        }
        
        // Calculate angular velocity
        let totalAngularMomentum = 0;
        let totalInertia = 0;
        
        this.worm.segments.forEach(segment => {
            const dx = segment.position.x - this.rollMode.wheelCenter.x;
            const dy = segment.position.y - this.rollMode.wheelCenter.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            
            const angularMomentum = (dx * segment.velocity.y - dy * segment.velocity.x);
            totalAngularMomentum += angularMomentum;
            totalInertia += segment.mass * r * r;
        });
        
        if (totalInertia > 0) {
            this.rollMode.angularVelocity = totalAngularMomentum / totalInertia;
            
            // Limit angular velocity
            if (Math.abs(this.rollMode.angularVelocity) > this.maxAngularVelocity) {
                this.rollMode.angularVelocity = Math.sign(this.rollMode.angularVelocity) * this.maxAngularVelocity;
                
                // Apply damping forces
                this.worm.segments.forEach(segment => {
                    const dampingFactor = 0.98;
                    const fx = -segment.velocity.x * (1 - dampingFactor);
                    const fy = -segment.velocity.y * (1 - dampingFactor);
                    this.matter.body.applyForce(segment, segment.position, { x: fx, y: fy });
                });
            }
            
            // Anti-slip system
            this.applyAntiSlipCorrection();
        }
    }
    
    applyAntiSlipCorrection() {
        let groundedSegments = [];
        let avgRadius = 0;
        let radiusCount = 0;
        
        this.worm.segments.forEach((segment, index) => {
            const dx = segment.position.x - this.rollMode.wheelCenter.x;
            const dy = segment.position.y - this.rollMode.wheelCenter.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > 0.1) {
                avgRadius += r;
                radiusCount++;
            }
            
            const collision = this.worm.segmentCollisions[index];
            if (collision && collision.isColliding && collision.surfaceBody && collision.surfaceBody.isStatic) {
                groundedSegments.push({ segment, collision });
            }
        });
        
        if (radiusCount > 0 && groundedSegments.length > 0) {
            avgRadius = avgRadius / radiusCount;
            
            // Calculate wheel's linear velocity
            let totalVelX = 0;
            this.worm.segments.forEach(seg => {
                totalVelX += seg.velocity.x;
            });
            const wheelLinearVel = totalVelX / this.worm.segments.length;
            
            // Expected velocity for perfect rolling: V = ωR
            const expectedLinearVel = this.rollMode.angularVelocity * avgRadius;
            
            // Calculate slip ratio
            const velocityDiff = Math.abs(expectedLinearVel - wheelLinearVel);
            const avgVel = Math.abs(expectedLinearVel) + Math.abs(wheelLinearVel);
            const slipRatio = avgVel > 0.1 ? velocityDiff / avgVel : 0;
            
            // Apply velocity correction if slipping
            if (slipRatio > this.slipDetectionThreshold && Math.abs(this.rollMode.angularVelocity) > 0.1) {
                const targetVelX = expectedLinearVel;
                const currentAvgVelX = wheelLinearVel;
                const velError = targetVelX - currentAvgVelX;
                
                // Gentle correction
                const correctionStrength = 0.05;
                const maxCorrection = 2.0;
                let velAdjustment = velError * correctionStrength;
                velAdjustment = Math.max(-maxCorrection, Math.min(maxCorrection, velAdjustment));
                
                // Only adjust grounded segments
                groundedSegments.forEach(({ segment }) => {
                    const newVelX = segment.velocity.x + velAdjustment;
                    const newVelY = segment.velocity.y;
                    this.Matter.Body.setVelocity(segment, { x: newVelX, y: newVelY });
                });
            }
        }
    }
    
    processCrankingInput(stick, delta) {
        // Only process if stick is outside deadzone
        const deadzone = 0.06;
        if (Math.abs(stick.x) <= deadzone && Math.abs(stick.y) <= deadzone) {
            this.rollMode.lastStickAngle = null;
            this.rollMode.accumulatedRotation = 0;
            return;
        }
        
        // Calculate stick angle
        const stickAngle = Math.atan2(stick.y, stick.x);
        const stickMagnitude = Math.sqrt(stick.x * stick.x + stick.y * stick.y);
        
        if (this.rollMode.lastStickAngle !== null) {
            // Calculate angle difference
            let angleDiff = stickAngle - this.rollMode.lastStickAngle;
            
            // Normalize to [-PI, PI]
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Only count as rotation if the change is significant but not a jump
            if (Math.abs(angleDiff) < Math.PI / 2 && Math.abs(angleDiff) > 0.01) {
                // Accumulate rotation scaled by delta time
                const rotationRate = angleDiff * (1000 / delta);
                const scaledRotation = rotationRate * (delta / 1000) * stickMagnitude * this.torqueMultiplier;
                
                this.rollMode.accumulatedRotation += scaledRotation;
                
                // Apply pure torque to the wheel with balanced forces
                let totalForceX = 0;
                let totalForceY = 0;
                const forces = [];
                
                // Calculate forces for each segment
                this.worm.segments.forEach((segment, index) => {
                    const dx = segment.position.x - this.rollMode.wheelCenter.x;
                    const dy = segment.position.y - this.rollMode.wheelCenter.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0.1) {
                        // Tangential force for rotation
                        const fx = -dy / dist * scaledRotation;
                        const fy = dx / dist * scaledRotation;
                        forces.push({ segment, fx, fy });
                        totalForceX += fx;
                        totalForceY += fy;
                    } else {
                        forces.push({ segment, fx: 0, fy: 0 });
                    }
                });
                
                // Apply forces with correction to ensure they sum to zero
                const correction = forces.length > 0 ? forces.length : 1;
                const correctionX = totalForceX / correction;
                const correctionY = totalForceY / correction;
                
                forces.forEach(({ segment, fx, fy }) => {
                    this.matter.body.applyForce(segment, segment.position, { 
                        x: fx - correctionX, 
                        y: fy - correctionY 
                    });
                });
                
                // Decay accumulated rotation
                this.rollMode.accumulatedRotation *= 0.1;
            }
        }
        
        this.rollMode.lastStickAngle = stickAngle;
    }
    
    applyRollExitBoost() {
        const boost = this.exitVelocityBoost;
        const angularVel = this.rollMode.angularVelocity;
        
        // Apply tangential forces to maintain momentum
        this.worm.segments.forEach(segment => {
            const dx = segment.position.x - this.rollMode.wheelCenter.x;
            const dy = segment.position.y - this.rollMode.wheelCenter.y;
            
            const forceMagnitude = angularVel * boost * segment.mass * 0.1;
            const fx = -dy * forceMagnitude;
            const fy = dx * forceMagnitude;
            
            this.matter.body.applyForce(segment, segment.position, { x: fx, y: fy });
        });
    }
}
