import BaseAbility from './BaseAbility';

export default class MovementAbility extends BaseAbility {
    constructor(worm, config = {}) {
        super(worm, config);
        
        // Anchors configuration
        this.anchors = {
            head: {
                body: null,
                constraint: null,
                attachIndex: config.headAttachIndex || 1,
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: config.headColor || 0xff6b6b,
                strokeColor: config.headStrokeColor || 0xe74c3c
            },
            tail: {
                body: null,
                constraint: null,
                attachIndex: worm.segments.length - (config.tailAttachFromEnd || 2),
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: config.tailColor || 0x74b9ff,
                strokeColor: config.tailStrokeColor || 0x3498db
            }
        };
        
        // Physics parameters
        this.anchorRadius = config.anchorRadius || 60;
        this.anchorStiffness = config.anchorStiffness || 0.5;
        this.anchorDamping = config.anchorDamping || 0.05;
        this.anchorSensorRadius = config.anchorSensorRadius || 5;
        this.anchorDensity = config.anchorDensity || 0.0001;
        
        // Movement parameters
        this.velocityDamping = config.velocityDamping || 1;
        this.maxImpulseForce = config.maxImpulseForce || 0.6;
        this.headImpulseMultiplier = config.headImpulseMultiplier || 0.002;
        this.tailImpulseMultiplier = config.tailImpulseMultiplier || 0.0025;
        this.stickDeadzone = config.stickDeadzone || 0.06;
        this.positionForceMagnitude = config.positionForceMagnitude || 0.00001;
        this.minForceThreshold = config.minForceThreshold || 0.00001;
        this.minDistanceThreshold = config.minDistanceThreshold || 0.1;
        
        // Ground stabilization parameters
        this.groundConfig = config.ground || {
            segments: 0.3,
            centerWeight: 0.5,
            centerOffset: 0.7,
            percentageForce: 0.9
        };
        
        // Visual parameters
        this.stickIndicatorRadius = config.stickIndicatorRadius || 8;
        this.rangeIndicatorAlpha = config.rangeIndicatorAlpha || 0.4;
        this.rangeIndicatorLineWidth = config.rangeIndicatorLineWidth || 1;
        
        // Stick state tracking
        this.leftStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        this.rightStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
    }
    
    onActivate() {
        this.createAnchors();
    }
    
    onDeactivate() {
        // Clean up anchors
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.body && this.matter && this.matter.world && this.matter.world.localWorld) {
                try {
                    this.Matter.World.remove(this.matter.world.localWorld, anchorData.body);
                } catch (error) {
                    console.warn('Failed to remove anchor body during cleanup:', error);
                }
            }
            if (anchorData.rangeGraphics) {
                anchorData.rangeGraphics.destroy();
            }
            if (anchorData.stickIndicator) {
                anchorData.stickIndicator.destroy();
            }
        });
    }
    
    createAnchors() {
        Object.entries(this.anchors).forEach(([type, anchorData]) => {
            const attachSegment = this.worm.segments[anchorData.attachIndex];
            
            // Create anchor body
            anchorData.body = this.matter.add.circle(
                attachSegment.position.x,
                attachSegment.position.y,
                this.anchorSensorRadius,
                {
                    label: `worm_anchor_${type}`,
                    isSensor: false,
                    density: this.anchorDensity,
                    collisionFilter: {
                        category: 0x0004,
                        mask: 0x0000
                    },
                    render: {
                        fillStyle: this.colorToHex(anchorData.color),
                        strokeStyle: this.colorToHex(anchorData.strokeColor),
                        lineWidth: 2,
                        visible: this.config.showDebug
                    }
                }
            );
            
            // Create constraint
            anchorData.constraint = this.Matter.Constraint.create({
                bodyA: anchorData.body,
                bodyB: attachSegment,
                stiffness: this.anchorStiffness,
                damping: this.anchorDamping,
                length: 0,
                render: {
                    visible: this.config.showDebug,
                    strokeStyle: this.colorToHex(anchorData.color),
                    lineWidth: 2
                }
            });
            
            this.addConstraint(anchorData.constraint);
            
            // Store rest position
            anchorData.restPos.x = attachSegment.position.x;
            anchorData.restPos.y = attachSegment.position.y;
            
            // Create visual indicators
            anchorData.rangeGraphics = this.scene.add.graphics();
            anchorData.rangeGraphics.lineStyle(this.rangeIndicatorLineWidth, anchorData.color, this.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(anchorData.restPos.x, anchorData.restPos.y, this.anchorRadius);
            this.addGraphics(anchorData.rangeGraphics);
            
            // Create stick position indicators
            anchorData.stickIndicator = this.scene.add.graphics();
            this.addGraphics(anchorData.stickIndicator);
        });
    }
    
    update(delta) {
        if (!this.isActive) return;
        
        // Update visual indicators
        this.updateStickDisplay();
    }
    
    handleInput(inputs) {
        if (!this.isActive) return;
        
        const { leftStick, rightStick, swapControls } = inputs;
        const deltaSeconds = inputs.deltaSeconds || 0.016;
        
        // Update stick states
        this.updateStickState(this.leftStickState, leftStick, deltaSeconds);
        this.updateStickState(this.rightStickState, rightStick, deltaSeconds);
        
        // Check if we're in roll mode (via worm's state machine)
        const isInRollMode = this.worm.stateMachine && 
                           this.worm.stateMachine.isInState(this.worm.stateMachine.states.ROLLING);
        
        if (!isInRollMode) {
            // Normal movement mode
            // Update anchor positions and apply forces
            const sectionForces = this.updateSectionAnchors([
                { anchor: this.anchors.head, stick: swapControls ? this.rightStickState : this.leftStickState, name: 'head' },
                { anchor: this.anchors.tail, stick: swapControls ? this.leftStickState : this.rightStickState, name: 'tail' }
            ], inputs.delta);
            
            // Apply counter-forces to middle segments
            this.applyBodyStabilizationForces(sectionForces.head, sectionForces.tail, inputs.delta);
        } else {
            // In roll mode - handle special anchor movement for head
            const headStick = swapControls ? this.rightStickState : this.leftStickState;
            this.updateRollModeAnchor(headStick, inputs.delta);
        }
    }
    
    updateStickState(stickState, gamepadStick, deltaSeconds) {
        if (!gamepadStick) return;
        
        // Store previous position
        stickState.prevX = stickState.x;
        stickState.prevY = stickState.y;
        
        // Update current position
        stickState.x = gamepadStick.x;
        stickState.y = gamepadStick.y;
        
        // Check if this is a keyboard release
        const isKeyboardRelease = gamepadStick.keyboardRelease || false;
        
        // Calculate current and previous magnitudes for directional momentum detection
        const prevMagnitude = Math.sqrt(stickState.prevX * stickState.prevX + stickState.prevY * stickState.prevY);
        const currentMagnitude = Math.sqrt(stickState.x * stickState.x + stickState.y * stickState.y);
        
        // Detect if stick is truly returning to center (moving toward center AND magnitude decreasing significantly)
        const movingTowardCenter = currentMagnitude < prevMagnitude * 0.85 && 
                                  currentMagnitude < prevMagnitude - 0.1 &&
                                  currentMagnitude > this.stickDeadzone;
        
        // Calculate velocity (change per second)
        const deltaX = stickState.x - stickState.prevX;
        const deltaY = stickState.y - stickState.prevY;
        
        // Velocity is change per second - normalized to target frame rate
        const targetFrameTime = 1000 / (this.config.targetFrameRate || 60);
        if (deltaSeconds > 0 && !isKeyboardRelease && !movingTowardCenter) {
            // Normalize velocity calculation to target frame rate
            const targetDeltaSeconds = targetFrameTime / 1000;
            const velocityScale = deltaSeconds / targetDeltaSeconds;
            stickState.velocity.x = (deltaX / deltaSeconds) * velocityScale;
            stickState.velocity.y = (deltaY / deltaSeconds) * velocityScale;
        } else if (isKeyboardRelease || movingTowardCenter) {
            // On keyboard release or when moving toward center, zero out velocity to prevent snapback
            stickState.velocity.x = 0;
            stickState.velocity.y = 0;
        }
        
        // Track if stick is returning to center
        stickState.returningToCenter = movingTowardCenter;
        
        // Apply damping to velocity (exponential decay over time)
        // Normalize damping to target frame rate for consistent behavior
        const normalizedDeltaSeconds = deltaSeconds * ((this.config.targetFrameRate || 60) / 60);
        const dampingFactor = Math.pow(this.velocityDamping, normalizedDeltaSeconds);
        stickState.velocity.x *= dampingFactor;
        stickState.velocity.y *= dampingFactor;
        
        // Detect release based on deadzone (for impulse system)
        const deadzone = 0.1;
        const wasActive = Math.abs(stickState.prevX) > deadzone || Math.abs(stickState.prevY) > deadzone;
        const isActive = Math.abs(stickState.x) > deadzone || Math.abs(stickState.y) > deadzone;
        stickState.released = wasActive && !isActive;
    }
    
    updateSectionAnchors(sections, delta) {
        const forces = {};
        
        sections.forEach(({ anchor, stick, name }) => {
            forces[name] = this.updateAnchorPosition(anchor, stick, delta);
        });
        
        return forces;
    }
    
    updateAnchorPosition(anchorData, stickState, delta) {
        if (!anchorData.body) return { x: 0, y: 0 };
        
        let totalForce = { x: 0, y: 0 };
        const segment = this.worm.segments[anchorData.attachIndex];
        const restPos = anchorData.restPos;
        
        // Update rest position to follow the attached segment
        restPos.x = segment.position.x;
        restPos.y = segment.position.y;
        
        // When stick is centered, move anchor to segment position
        if (Math.abs(stickState.x) <= this.stickDeadzone && Math.abs(stickState.y) <= this.stickDeadzone) {
            this.Matter.Body.setPosition(anchorData.body, { x: segment.position.x, y: segment.position.y });
        }
        
        // Apply position-based force when stick is moved
        if (Math.abs(stickState.x) > this.stickDeadzone || Math.abs(stickState.y) > this.stickDeadzone) {
            const targetX = restPos.x + (stickState.x * this.anchorRadius);
            const targetY = restPos.y + (stickState.y * this.anchorRadius);
            
            this.Matter.Body.setPosition(anchorData.body, { x: targetX, y: targetY });
            
            const dx = targetX - segment.position.x;
            const dy = targetY - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.minDistanceThreshold) {
                const forceMagnitude = distance * this.positionForceMagnitude;
                const forceX = (dx / distance) * forceMagnitude;
                const forceY = (dy / distance) * forceMagnitude;
                
                this.matter.body.applyForce(segment, segment.position, { x: forceX, y: forceY });
                
                totalForce.x += forceX;
                totalForce.y += forceY;
            }
        }
        
        // Apply velocity-based impulse
        if ((Math.abs(stickState.x) > this.stickDeadzone || Math.abs(stickState.y) > this.stickDeadzone) && 
            !stickState.released && !stickState.returningToCenter) {
            
            const mass = segment.mass;
            const isHead = anchorData === this.anchors.head;
            const impulseMultiplier = isHead ? this.headImpulseMultiplier : this.tailImpulseMultiplier;
            
            let impulseX = stickState.velocity.x * impulseMultiplier * mass;
            let impulseY = stickState.velocity.y * impulseMultiplier * mass;
            
            const impulseMagnitude = Math.sqrt(impulseX * impulseX + impulseY * impulseY);
            if (impulseMagnitude > this.maxImpulseForce) {
                const scale = this.maxImpulseForce / impulseMagnitude;
                impulseX *= scale;
                impulseY *= scale;
            }
            
            if (Math.abs(impulseX) > this.minForceThreshold || Math.abs(impulseY) > this.minForceThreshold) {
                this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
                totalForce.x += impulseX;
                totalForce.y += impulseY;
            }
        }
        
        return totalForce;
    }
    
    applyBodyStabilizationForces(headForces, tailForces, delta) {
        if (!headForces || !tailForces || 
            !Number.isFinite(headForces.x) || !Number.isFinite(headForces.y) ||
            !Number.isFinite(tailForces.x) || !Number.isFinite(tailForces.y)) {
            return;
        }
        
        const totalForceX = headForces.x + tailForces.x;
        const totalForceY = headForces.y + tailForces.y;
        
        const groundedSegments = this.worm.getGroundedSegmentsInRange(0, 1);
        
        if (groundedSegments.length === 0) {
            const totalSegments = this.worm.segments.length;
            const numGroundingSegments = Math.max(1, Math.floor(totalSegments * this.groundConfig.segments));
            const startIdx = Math.floor(totalSegments / 2 - numGroundingSegments / 2);
            
            let totalWeight = 0;
            const segmentWeights = [];
            
            for (let i = 0; i < numGroundingSegments; i++) {
                const segIdx = startIdx + i;
                if (segIdx >= 0 && segIdx < totalSegments) {
                    const progress = i / (numGroundingSegments - 1);
                    const adjustedProgress = (progress * (1 - this.groundConfig.centerOffset)) + 
                                           (this.groundConfig.centerOffset / 2);
                    const baseWeight = Math.sin(adjustedProgress * Math.PI);
                    const centerBoost = 1 + (this.groundConfig.centerWeight * 
                                           (1 - Math.abs(adjustedProgress - 0.5) * 2));
                    const weight = baseWeight * centerBoost;
                    
                    segmentWeights.push({ index: segIdx, weight });
                    totalWeight += weight;
                }
            }
            
            if (totalWeight > 0) {
                segmentWeights.forEach(({ index, weight }) => {
                    const segment = this.worm.segments[index];
                    const normalizedWeight = weight / totalWeight;
                    const counterForceX = -totalForceX * normalizedWeight * this.groundConfig.percentageForce;
                    const counterForceY = -totalForceY * normalizedWeight * this.groundConfig.percentageForce;
                    
                    this.scene.matter.body.applyForce(segment, segment.position, {
                        x: counterForceX,
                        y: counterForceY
                    });
                });
            }
        }
    }
    
    updateStickDisplay() {
        Object.entries(this.anchors).forEach(([type, anchorData]) => {
            if (!anchorData.rangeGraphics || !anchorData.stickIndicator) return;
            
            const segment = this.worm.segments[anchorData.attachIndex];
            
            anchorData.rangeGraphics.clear();
            anchorData.rangeGraphics.lineStyle(this.rangeIndicatorLineWidth, anchorData.color, this.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(segment.position.x, segment.position.y, this.anchorRadius);
            
            const stick = type === 'head' ? this.leftStickState : this.rightStickState;
            const stickMagnitude = Math.sqrt(stick.x * stick.x + stick.y * stick.y);
            
            anchorData.stickIndicator.clear();
            if (stickMagnitude > this.stickDeadzone) {
                anchorData.stickIndicator.fillStyle(anchorData.color, 0.8);
                anchorData.stickIndicator.lineStyle(2, anchorData.strokeColor, 1);
                anchorData.stickIndicator.fillCircle(
                    segment.position.x + stick.x * this.anchorRadius,
                    segment.position.y + stick.y * this.anchorRadius,
                    this.stickIndicatorRadius
                );
                anchorData.stickIndicator.strokeCircle(
                    segment.position.x + stick.x * this.anchorRadius,
                    segment.position.y + stick.y * this.anchorRadius,
                    this.stickIndicatorRadius
                );
            }
        });
    }
    
    colorToHex(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    updateRollModeAnchor(stickState, delta) {
        // In roll mode, apply rotation forces through the anchor system
        const anchorData = this.anchors.head;
        if (!anchorData.body) return;
        
        // Get the roll ability to access wheel center
        const rollAbility = this.worm.rollAbility;
        if (!rollAbility || !rollAbility.rollMode.active) return;
        
        const wheelCenter = rollAbility.rollMode.wheelCenter;
        const segment = this.worm.segments[anchorData.attachIndex];
        
        // Update rest position to wheel center
        anchorData.restPos.x = wheelCenter.x;
        anchorData.restPos.y = wheelCenter.y;
        
        // Position the anchor body at the wheel center
        this.Matter.Body.setPosition(anchorData.body, {
            x: wheelCenter.x,
            y: wheelCenter.y
        });
        
        // Apply position-based force when stick is moved
        if (Math.abs(stickState.x) > this.stickDeadzone || Math.abs(stickState.y) > this.stickDeadzone) {
            // Calculate target position based on stick input
            const targetX = anchorData.restPos.x + (stickState.x * this.anchorRadius);
            const targetY = anchorData.restPos.y + (stickState.y * this.anchorRadius);
            
            // Move anchor to target position
            this.Matter.Body.setPosition(anchorData.body, { x: targetX, y: targetY });
            
            // Calculate force toward target position
            const dx = targetX - segment.position.x;
            const dy = targetY - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.minDistanceThreshold) {
                // Apply force proportional to distance
                const forceMagnitude = distance * this.positionForceMagnitude;
                
                // Only apply force if we've detected circular motion
                const rotationThreshold = 0.3;
                const accumulatedRotation = rollAbility.rollMode.accumulatedRotation || 0;
                
                if (Math.abs(accumulatedRotation) > rotationThreshold) {
                    // Apply rotation force based on accumulated rotation direction
                    const rotationDirection = Math.sign(accumulatedRotation);
                    
                    // Apply tangential forces to create rotation
                    this.worm.segments.forEach(seg => {
                        const segDx = seg.position.x - wheelCenter.x;
                        const segDy = seg.position.y - wheelCenter.y;
                        const segDist = Math.sqrt(segDx * segDx + segDy * segDy);
                        
                        if (segDist > 0.1) {
                            // Force perpendicular to radius (creates rotation)
                            const forceMag = forceMagnitude * 0.02 * rotationDirection;
                            const tangentX = -segDy / segDist * forceMag;
                            const tangentY = segDx / segDist * forceMag;
                            
                            this.matter.body.applyForce(seg, seg.position, { x: tangentX, y: tangentY });
                        }
                    });
                    
                    // Decay accumulated rotation
                    rollAbility.rollMode.accumulatedRotation *= 0.9;
                }
            }
        }
    }
    
    // Method to disable tail anchor during roll mode
    disableTailAnchor() {
        const tailAnchor = this.anchors.tail;
        if (tailAnchor.constraint) {
            tailAnchor.constraint.stiffness = 0.000001;
        }
    }
    
    // Method to re-enable tail anchor after roll mode
    enableTailAnchor() {
        const tailAnchor = this.anchors.tail;
        if (tailAnchor.constraint) {
            tailAnchor.constraint.stiffness = this.anchorStiffness;
        }
    }
    
    // Method to manually position tail anchor (used during roll mode)
    positionTailAnchor(x, y) {
        const tailAnchor = this.anchors.tail;
        if (tailAnchor.body) {
            this.Matter.Body.setPosition(tailAnchor.body, { x, y });
        }
    }
}