import WormBase from './WormBase';

export default class DoubleWorm extends WormBase {
    constructor(scene, x, y, config = {}) {
        // Merge swing-specific config with base config
        const swingConfig = {
            // Jump spring defaults
            flattenIdle: 0.000001,
            flattenStiffness: 0.5,
            
            // Colors
            headColor: 0xff6b6b,
            headStrokeColor: 0xe74c3c,
            tailColor: 0x74b9ff,
            tailStrokeColor: 0x3498db,
            dotColor: 0x2c3e50,
            
            // Anchor Physics - Controls how stick input translates to worm movement
            anchorRadius: 50,              // Max distance stick can pull anchor from segment (pixels)
                                          // Higher = wider movement range, more dramatic swings
                                          // Lower = tighter control, smaller movements
            anchorStiffness: 0.5,        // How strongly anchor pulls back to attached segment (0-1)
                                          // Higher = snappier response, less lag, can cause jitter
                                          // Lower = smoother but slower response, more fluid movement
            anchorDamping: 0.05,          // How quickly anchor oscillations fade out (0-1)
                                          // Higher = stops bouncing faster, more controlled
                                          // Lower = more bouncy/springy feel, can cause instability
            anchorSensorRadius: 5,        // Visual/collision size of anchor body (pixels) - debug only
            anchorDensity: 0.0001,        // Mass density of anchor body (affects physics calculations)
                                          // Higher = heavier anchors, different momentum behavior
                                          // Lower = lighter anchors, more responsive
            
            // Movement Physics - Controls dual force system (position + velocity)
            velocityDamping: 0.3,          // How quickly stick velocity decays over time (0-1)
                                          // Higher = velocity fades faster, less momentum carryover
                                          // Lower = longer momentum, more "slippery" feel
            impulseMultiplier: 0.0008,    // Strength multiplier for velocity-based forces (0-0.01 typical)
                                          // Higher = faster stick movements create stronger forces
                                          // Lower = less responsive to quick stick flicks
            stickDeadzone: 0.05,          // Minimum stick input to register movement (0-0.2 typical)
                                          // Higher = larger dead zone, less sensitive to small inputs
                                          // Lower = more sensitive, may cause drift or jitter
            positionForceMagnitude: 0.00001, // Strength of position-based spring forces (0-0.001 typical)
                                          // Higher = stronger pull toward stick position, more responsive
                                          // Lower = gentler positioning, more natural feel
            minForceThreshold: 0.00001,   // Minimum force required to apply impulse (prevents micro-movements)
                                          // Higher = filters out tiny forces, cleaner movement
                                          // Lower = more sensitive to small movements
            minDistanceThreshold: 0.1,    // Minimum distance before position force activates (pixels)
                                          // Higher = larger deadband around target position
                                          // Lower = tighter position control
            
            // Anti-Flying Physics - Prevents unrealistic floating/flying behavior
            groundingForce: 0.01,             // Base downward force applied to middle segments
                                             // Higher = heavier feel, less airborne time
                                             // Lower = more floaty, easier to get airborne
            groundingSegments: 0.1,          // Fraction of segments receiving grounding (0-1)
                                             // Higher = more segments grounded, stiffer feel
                                             // Lower = fewer grounded segments, more flexible
            groundingReactiveMultiplier: 0.8, // Extra grounding when upward forces detected
                                             // Higher = stronger counter to upward movement
                                             // Lower = allows more vertical movement
            groundingCenterWeight: 0.5,      // Extra grounding bias toward center segments
                                             // Higher = center stays down more, ends can lift
                                             // Lower = more uniform grounding distribution
            
            // Visual parameters
            stickIndicatorRadius: 8,
            rangeIndicatorAlpha: 0.4,
            rangeIndicatorLineWidth: 1,
            connectionDotRadius: 0.4,
            
            // Jump Spring Physics - Controls trigger-activated compression springs
            jumpSpringLengthMultiplier: 1,   // How much longer jump springs are vs natural distance
                                            // Higher = more compression potential, stronger jumps
                                            // Lower = less compression, gentler spring effect
            jumpTriggerThreshold: 0.01,     // Minimum trigger value to activate jump springs (0-1)
                                            // Higher = harder to activate, requires fuller trigger press
                                            // Lower = easier to activate, more sensitive triggers
            jumpStiffness: 0.0375,          // Maximum stiffness of jump springs when fully activated
                                            // Higher = more explosive jumps, stronger spring force
                                            // Lower = gentler spring assistance, subtle effect

            // Compression Spring Physics - Controls trigger-responsive body tension
            baseCompressionStiffness: 0.005,    // Base stiffness when no triggers pressed
                                                // Higher = stiffer baseline body, less flexibility
                                                // Lower = more flexible baseline, looser feel
            maxCompressionStiffness: 0.5,      // Maximum stiffness at full trigger activation
                                                // Higher = very rigid body when tensed, precise control
                                                // Lower = moderate stiffening, maintains some flexibility
            compressionTriggerSensitivity: 1.0, // How responsive compression is to trigger input (0-2 typical)
                                                // Higher = more dramatic stiffness changes per trigger input
                                                // Lower = subtle stiffness changes, more gradual response

            // laser guidance
            laserLineWidth: 4,
            laserGlowWidth: 8,
            laserGlowAlpha: 0.5,
            laserLength: 200,
            laserArrowSize: 15,
            laserArrowOffset: 10,
            laserFadeDuration: 1000,
            
            // Stickiness Physics - Constraint-based surface grip system
            stickinessActivationThreshold: 0.3,  // Minimum stick input magnitude to activate
            stickinessConstraintStiffness: 0.3,  // Strength of sticky constraints (0-1)
            stickinessConstraintDamping: 0.5,    // Damping for sticky constraints  
            headStickinessSegmentCount: 0.3,     // Fraction of head segments that can stick
            tailStickinessSegmentCount: 0.3,     // Fraction of tail segments that can stick
            
            // Stickiness Visual Effects - Pulsating circles at grip points
            stickinessVisualConfig: {
                circleRadius: 8,                    // Base radius of pulsating circle
                pulseScale: 0.5,                    // How much bigger it gets when pulsing
                pulseDuration: 1000,                 // Time for one pulse cycle (ms)
                circleColor: 0xff6b6b,              // Red color for grip indication
                circleAlpha: 0.8,                   // Base transparency
                // strokeWidth: 2,                     // Circle outline thickness
                // strokeColor: 0xFF0000               // White outline for contrast
            },
            
            // Attach points
            headAttachIndex: 1,
            tailAttachFromEnd: 2,
            tailSpringAttachPercent: 0.4,
            
            
            ...config
        };
        
        super(scene, x, y, swingConfig);
        
        // Copy config values to instance
        this.anchorRadius = swingConfig.anchorRadius;
        this.anchorStiffness = swingConfig.anchorStiffness;
        this.anchorDamping = swingConfig.anchorDamping;
        this.velocityDamping = swingConfig.velocityDamping;
        this.impulseMultiplier = swingConfig.impulseMultiplier;
        this.groundingForce = swingConfig.groundingForce;
        this.groundingSegments = swingConfig.groundingSegments;
        
        // Stick tracking for momentum
        this.leftStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        this.rightStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        
        // Keyboard Simulation Physics - Controls how keyboard inputs simulate analog sticks
        this.keyboardConfig = {
            maxDuration: 200,             // Time to reach full stick deflection (milliseconds)
                                         // Higher = slower ramp-up, more gradual acceleration
                                         // Lower = faster response, more immediate full power
            curve: 2,                    // Response curve shape (1 = linear, 2+ = exponential)
                                         // Higher = more curved, slower start then rapid acceleration
                                         // Lower = more linear, consistent acceleration rate
            ...config.keyboardConfig
        };
        
        // Keyboard state tracking
        this.keyboardState = {
            left: { w: 0, a: 0, s: 0, d: 0 }, // WASD for left stick
            right: { up: 0, left: 0, down: 0, right: 0 } // Arrows for right stick
        };
        
        // Initialize stickiness system
        this.stickyConstraints = {
            head: [],  // Array of active sticky constraints for head section
            tail: []   // Array of active sticky constraints for tail section
        };
        
        // Initialize pulsating circles for stickiness visual feedback
        this.stickinessCircles = new Map(); // Map constraint → circle graphics
        
        // Initialize anchor system
        this.anchors = {
            head: {
                body: null,
                constraint: null,
                attachIndex: swingConfig.headAttachIndex,
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: this.config.headColor,
                strokeColor: this.config.headStrokeColor,
                stickState: this.leftStickState
            },
            tail: {
                body: null,
                constraint: null,
                attachIndex: 0, // Will be set after segments are created
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: this.config.tailColor,
                strokeColor: this.config.tailStrokeColor,
                stickState: this.rightStickState
            }
        };
        
        // Set correct tail attach index now that segments exist
        this.anchors.tail.attachIndex = this.segments.length - swingConfig.tailAttachFromEnd;
        
        // Create section configuration for systematic processing
        this.sections = {
            head: {
                name: 'head',
                stick: this.leftStickState,
                anchor: this.anchors.head,
                springData: null, // Will be set after jump springs are initialized
                segmentRange: { start: 0, end: this.config.headStickinessSegmentCount },
                stickinessSegmentCount: this.config.headStickinessSegmentCount,
                color: this.config.headColor,
                strokeColor: this.config.headStrokeColor,
                oppositeRangeForGrounding: { start: 0.7, end: 1.0 }
            },
            tail: {
                name: 'tail',
                stick: this.rightStickState,
                anchor: this.anchors.tail,
                springData: null, // Will be set after jump springs are initialized
                segmentRange: { start: 1 - this.config.tailStickinessSegmentCount, end: 1 },
                stickinessSegmentCount: this.config.tailStickinessSegmentCount,
                color: this.config.tailColor,
                strokeColor: this.config.tailStrokeColor,
                oppositeRangeForGrounding: { start: 0.0, end: 0.3 }
            }
        };
        
        // Create anchor system
        this.createAnchors();

        // Initialize spring system
        this.jumpSprings = {
            head: {
                spring: null,
                attached: false,
                length: 0,
                laser: this.scene.add.graphics(),
                color: this.config.headColor,
                getSegments: () => ({
                    from: this.segments[0],
                    to: this.segments[this.segments.length - 2]
                })
            },
            tail: {
                spring: null,
                attached: false,
                length: 0,
                laser: this.scene.add.graphics(),
                color: this.config.tailColor,
                getSegments: () => ({
                    from: this.segments[this.segments.length - 1],
                    to: this.segments[1]
                })
            }
        };
        
        // Set laser depths
        Object.values(this.jumpSprings).forEach(springData => {
            springData.laser.setDepth(100);
        });
        
        // Link sections to their corresponding spring data
        this.sections.head.springData = this.jumpSprings.head;
        this.sections.tail.springData = this.jumpSprings.tail;
        
        // Calculate initial worm lengths for jump springs
        this.calculateInitialLengths();
    }
    
    createAnchors() {
        const constraints = [];
        
        Object.entries(this.anchors).forEach(([type, anchorData]) => {
            const attachSegment = this.segments[anchorData.attachIndex];
            
            // Create anchor body
            anchorData.body = this.matter.add.circle(
                attachSegment.position.x,
                attachSegment.position.y,
                this.config.anchorSensorRadius,
                {
                    isSensor: true,
                    density: this.config.anchorDensity,
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
            
            constraints.push(anchorData.constraint);
            
            // Store rest position
            anchorData.restPos.x = attachSegment.position.x;
            anchorData.restPos.y = attachSegment.position.y;
            
            // Create visual indicators
            anchorData.rangeGraphics = this.scene.add.graphics();
            anchorData.rangeGraphics.lineStyle(this.config.rangeIndicatorLineWidth, anchorData.color, this.config.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(anchorData.restPos.x, anchorData.restPos.y, this.anchorRadius);
            
            // Create stick position indicators
            anchorData.stickIndicator = this.scene.add.graphics();
            anchorData.stickIndicator.fillStyle(anchorData.color, 0.8);
            anchorData.stickIndicator.fillCircle(0, 0, this.config.stickIndicatorRadius);
        });
        
        // Add all constraints to the world
        this.Matter.World.add(this.matter.world.localWorld, constraints);
    }
    
    calculateInitialLengths() {
        if (this.segments.length > 2) {
            const segA = this.segments[0];
            const segB = this.segments[this.segments.length - 2];
            this.jumpSprings.head.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jumpSpringLengthMultiplier;
        }
        
        if (this.segments.length > 2) {
            const segA = this.segments[1];
            const segB = this.segments[this.segments.length - 1];
            this.jumpSprings.tail.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jumpSpringLengthMultiplier;
        }
    }

    createJumpSegment(from, to, length, stiffness) {
        const spring = this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: length,
            stiffness: stiffness,
        });
        
        return spring;
    }
    
    
    update(delta) {
        // Call parent update for graphics
        super.update(delta);
    }
    
    // Override destroy to clean up swing components
    destroy() {
        // Clean up anchors
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.body) {
                this.matter.world.remove(anchorData.body);
            }
            if (anchorData.constraint) {
                this.matter.world.remove(anchorData.constraint);
            }
            if (anchorData.rangeGraphics) {
                anchorData.rangeGraphics.destroy();
            }
            if (anchorData.stickIndicator) {
                anchorData.stickIndicator.destroy();
            }
        });
        
        // Clean up jump springs if attached
        Object.values(this.jumpSprings).forEach(springData => {
            if (springData.spring && springData.attached) {
                this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
            }
            if (springData.laser) {
                springData.laser.destroy();
            }
            // Clean up ground-anchored spring properties
            if (springData.isGroundAnchored) {
                springData.isGroundAnchored = false;
                springData.groundBody = null;
                springData.groundedSegment = null;
            }
        });
        
        // Clean up sticky constraints and circles
        if (this.stickyConstraints) {
            Object.values(this.stickyConstraints).forEach(constraints => {
                constraints.forEach(constraintData => {
                    this.Matter.World.remove(this.matter.world.localWorld, constraintData.constraint);
                    this.removeStickinessCircle(constraintData.constraint);
                });
            });
        }
        
        // Clean up any remaining stickiness circles
        if (this.stickinessCircles) {
            this.stickinessCircles.forEach((circle, constraint) => {
                if (circle && circle.scene) {
                    circle.destroy();
                }
            });
            this.stickinessCircles.clear();
        }
        
        // Call parent destroy
        super.destroy();
    }

    updateMovement(delta) {
        this.updateStickDisplay();
        const pad = this.scene?.input?.gamepad?.getPad(0);
        const deltaSeconds = delta / 1000; // Convert to seconds
        
        let leftStick, rightStick;
        
        if (pad) {
            // Use gamepad if available
            leftStick = pad.leftStick;
            rightStick = pad.rightStick;
            
            // But also check keyboard and combine inputs
            const keyboardLeft = this.simulateStickFromKeyboard('left', delta);
            const keyboardRight = this.simulateStickFromKeyboard('right', delta);
            
            // Combine gamepad and keyboard inputs (take the one with larger magnitude)
            const padLeftMag = Math.sqrt(leftStick.x * leftStick.x + leftStick.y * leftStick.y);
            const keyLeftMag = Math.sqrt(keyboardLeft.x * keyboardLeft.x + keyboardLeft.y * keyboardLeft.y);
            if (keyLeftMag > padLeftMag) {
                leftStick = keyboardLeft;
            }
            
            const padRightMag = Math.sqrt(rightStick.x * rightStick.x + rightStick.y * rightStick.y);
            const keyRightMag = Math.sqrt(keyboardRight.x * keyboardRight.x + keyboardRight.y * keyboardRight.y);
            if (keyRightMag > padRightMag) {
                rightStick = keyboardRight;
            }
        } else {
            // Fall back to keyboard simulation only
            leftStick = this.simulateStickFromKeyboard('left', delta);
            rightStick = this.simulateStickFromKeyboard('right', delta);
        }
        
        // Update stick states
        this.updateStickState(this.leftStickState, leftStick, deltaSeconds);
        this.updateStickState(this.rightStickState, rightStick, deltaSeconds);
        
        // Update anchor positions using section-based processing
        const sectionForces = this.updateSectionAnchors([
            { section: this.sections.head, stick: leftStick },
            { section: this.sections.tail, stick: rightStick }
        ], deltaSeconds);
        
        // Handle triggers to attach/detach and stiffen springs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Always check keyboard keys for jump (works even with gamepad connected)
        const keyboard = this.scene.input.keyboard;
        const spacePressed = keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SPACE]?.isDown;
        const slashPressed = keyboard.keys[191]?.isDown ||
            keyboard.keys[Phaser.Input.Keyboard.KeyCodes.QUESTION_MARK]?.isDown || (keyboard.addKey && keyboard.addKey(191).isDown);
        
        // Left trigger or spacebar controls head spring
        const headTriggerValue = Math.max(leftTrigger, spacePressed ? 1.0 : 0);
        this.handleJumpSpring('head', headTriggerValue);
        
        // Right trigger or Q controls tail spring
        const tailTriggerValue = Math.max(rightTrigger, slashPressed ? 1.0 : 0);
        this.handleJumpSpring('tail', tailTriggerValue);
        
        // Update compression spring stiffness based on trigger values
        const maxTriggerValue = Math.max(headTriggerValue, tailTriggerValue);
        const compressionStiffness = this.config.baseCompressionStiffness + 
            (maxTriggerValue * this.config.compressionTriggerSensitivity * 
             (this.config.maxCompressionStiffness - this.config.baseCompressionStiffness));
        this.updateCompressionStiffness(compressionStiffness);
        
        // Update stickiness system using section-based processing
        this.updateStickinessSystemSections([
            { section: this.sections.head, stick: leftStick },
            { section: this.sections.tail, stick: rightStick }
        ]);
        
        // Clean up invalid sticky constraints
        this.cleanupInvalidStickyConstraints();
        
        // Apply grounding force to middle segments to prevent flying
        // Pass in the forces being applied to head and tail
        this.applyGroundingForce(sectionForces.head, sectionForces.tail);
    }
    
    applyGroundingForce(headForces, tailForces) {
        // Calculate total upward force being applied
        const totalUpwardForce = Math.abs(Math.min(0, (headForces?.y || 0) + (tailForces?.y || 0)));
        
        // If no upward forces, apply minimal grounding
        const baseGrounding = this.groundingForce;
        const reactiveGrounding = totalUpwardForce * this.config.groundingReactiveMultiplier;
        
        // Calculate which segments are in the middle
        const totalSegments = this.segments.length;
        const middleCount = Math.floor(totalSegments * this.groundingSegments);
        const startIndex = Math.floor((totalSegments - middleCount) / 2);
        const endIndex = startIndex + middleCount;
        
        // Apply downward force to middle segments
        for (let i = startIndex; i < endIndex && i < totalSegments; i++) {
            const segment = this.segments[i];
            
            // Apply stronger force to the very center segments
            const distFromCenter = Math.abs(i - totalSegments / 2);
            const centerWeight = 1 - (distFromCenter / (middleCount / 2));
            
            // Combine base grounding with reactive grounding
            const totalGrounding = baseGrounding + reactiveGrounding;
            const force = { 
                x: 0, 
                y: totalGrounding * (this.config.groundingCenterWeight + centerWeight * this.config.groundingCenterWeight)
            };
            
            this.matter.body.applyForce(segment, segment.position, force);
        }
    }
    updateStickDisplay() {
        Object.values(this.anchors).forEach(anchorData => {
            // Update range graphics
            anchorData.rangeGraphics.clear();
            anchorData.rangeGraphics.lineStyle(this.config.rangeIndicatorLineWidth, anchorData.color, this.config.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(anchorData.restPos.x, anchorData.restPos.y, this.anchorRadius);
            
            // Update stick position indicators
            anchorData.stickIndicator.x = anchorData.restPos.x + (anchorData.stickState.x * this.anchorRadius);
            anchorData.stickIndicator.y = anchorData.restPos.y + (anchorData.stickState.y * this.anchorRadius);
        });
    }
    
    updateSectionAnchors(sectionStickPairs, deltaSeconds) {
        const forces = {};
        
        // Process each section systematically
        sectionStickPairs.forEach(({ section, stick }) => {
            forces[section.name] = this.updateAnchorPositionSection(section, stick, deltaSeconds);
        });
        
        return forces;
    }
    
    updateAnchorPositionSection(section, stick, deltaSeconds) {
        const anchorData = section.anchor;
        if (!anchorData.body) return { x: 0, y: 0 };
        
        // Track total forces applied
        let totalForce = { x: 0, y: 0 };
        
        // Get the segment that this anchor is attached to
        const segment = this.segments[anchorData.attachIndex];
        const stickState = section.stick;
        const restPos = anchorData.restPos;
        
        // Update rest position to follow the attached segment
        restPos.x = segment.position.x;
        restPos.y = segment.position.y;
        
        // When stick is centered, move anchor to segment position to prevent pullback
        if (Math.abs(stickState.x) <= this.config.stickDeadzone && Math.abs(stickState.y) <= this.config.stickDeadzone) {
            this.Matter.Body.setPosition(anchorData.body, { x: segment.position.x, y: segment.position.y });
            this.Matter.Body.setVelocity(anchorData.body, { x: 0, y: 0 });
        }
        
        // Apply position-based force only when stick is actively moved
        if (Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone) {
            // Calculate target position based on stick input
            const targetX = restPos.x + (stickState.x * this.anchorRadius);
            const targetY = restPos.y + (stickState.y * this.anchorRadius);
            
            // Move anchor to target position
            this.Matter.Body.setPosition(anchorData.body, { x: targetX, y: targetY });
            
            // Calculate force toward target position
            const dx = targetX - segment.position.x;
            const dy = targetY - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.config.minDistanceThreshold) {
                // Apply force proportional to distance
                const forceMagnitude = distance * this.config.positionForceMagnitude;
                const forceX = (dx / distance) * forceMagnitude;
                const forceY = (dy / distance) * forceMagnitude;
                
                this.matter.body.applyForce(segment, segment.position, { x: forceX, y: forceY });
                totalForce.x += forceX;
                totalForce.y += forceY;
            }
        }
        
        // Apply velocity-based impulse only when stick is active and not on release
        if ((Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone) && !stickState.released) {
            const mass = segment.mass;
            const impulseX = stickState.velocity.x * this.impulseMultiplier * mass;
            const impulseY = stickState.velocity.y * this.impulseMultiplier * mass;
            
            if (Math.abs(impulseX) > this.config.minForceThreshold || Math.abs(impulseY) > this.config.minForceThreshold) {
                this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
                totalForce.x += impulseX;
                totalForce.y += impulseY;
            }
        }
        
        return totalForce;
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
        
        // Calculate velocity (change per second)
        const deltaX = stickState.x - stickState.prevX;
        const deltaY = stickState.y - stickState.prevY;
        
        // Velocity is change per second - but not on keyboard releases
        if (deltaSeconds > 0 && !isKeyboardRelease) {
            stickState.velocity.x = deltaX / deltaSeconds;
            stickState.velocity.y = deltaY / deltaSeconds;
        } else if (isKeyboardRelease) {
            // On keyboard release, zero out velocity to prevent snapback
            stickState.velocity.x = 0;
            stickState.velocity.y = 0;
        }
        
        // Apply damping to velocity (exponential decay over time)
        const dampingFactor = Math.pow(this.velocityDamping, deltaSeconds);
        stickState.velocity.x *= dampingFactor;
        stickState.velocity.y *= dampingFactor;
        
        // Detect release (stick returning to center)
        const wasActive = Math.abs(stickState.prevX) > this.config.stickDeadzone || Math.abs(stickState.prevY) > this.config.stickDeadzone;
        const isActive = Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone;
        
        if (wasActive && !isActive && !isKeyboardRelease) {
            // Stick was released - apply impulse only for gamepad, not keyboard
            stickState.released = true;
        } else {
            stickState.released = false;
        }
    }
    
    
    simulateStickFromKeyboard(stick, delta) {
        const keyboard = this.scene.input.keyboard;
        const state = this.keyboardState[stick];
        const kc = Phaser.Input.Keyboard.KeyCodes;
        
        // Check each direction using proper Phaser key checking
        let isUpPressed, isLeftPressed, isDownPressed, isRightPressed;
        
        if (stick === 'left') {
            // For WASD, try multiple ways to access the keys
            isUpPressed = keyboard.keys[kc.W]?.isDown || 
                         (this.scene.wasd && this.scene.wasd.W?.isDown) ||
                         keyboard.checkDown(keyboard.addKey(kc.W));
            isLeftPressed = keyboard.keys[kc.A]?.isDown || 
                           (this.scene.wasd && this.scene.wasd.A?.isDown) ||
                           keyboard.checkDown(keyboard.addKey(kc.A));
            isDownPressed = keyboard.keys[kc.S]?.isDown || 
                           (this.scene.wasd && this.scene.wasd.S?.isDown) ||
                           keyboard.checkDown(keyboard.addKey(kc.S));
            isRightPressed = keyboard.keys[kc.D]?.isDown || 
                            (this.scene.wasd && this.scene.wasd.D?.isDown) ||
                            keyboard.checkDown(keyboard.addKey(kc.D));
        } else {
            // Arrow keys work with standard method
            isUpPressed = keyboard.keys[kc.UP]?.isDown;
            isLeftPressed = keyboard.keys[kc.LEFT]?.isDown;
            isDownPressed = keyboard.keys[kc.DOWN]?.isDown;
            isRightPressed = keyboard.keys[kc.RIGHT]?.isDown;
        }
        
        // Track if any key was just released
        let keyboardRelease = false;
        
        // Update press durations
        if (stick === 'left') {
            if (!isUpPressed && state.w > 0) keyboardRelease = true;
            if (!isLeftPressed && state.a > 0) keyboardRelease = true;
            if (!isDownPressed && state.s > 0) keyboardRelease = true;
            if (!isRightPressed && state.d > 0) keyboardRelease = true;
            
            state.w = isUpPressed ? Math.min(state.w + delta, this.keyboardConfig.maxDuration) : 0;
            state.a = isLeftPressed ? Math.min(state.a + delta, this.keyboardConfig.maxDuration) : 0;
            state.s = isDownPressed ? Math.min(state.s + delta, this.keyboardConfig.maxDuration) : 0;
            state.d = isRightPressed ? Math.min(state.d + delta, this.keyboardConfig.maxDuration) : 0;
        } else {
            if (!isUpPressed && state.up > 0) keyboardRelease = true;
            if (!isLeftPressed && state.left > 0) keyboardRelease = true;
            if (!isDownPressed && state.down > 0) keyboardRelease = true;
            if (!isRightPressed && state.right > 0) keyboardRelease = true;
            
            state.up = isUpPressed ? Math.min(state.up + delta, this.keyboardConfig.maxDuration) : 0;
            state.left = isLeftPressed ? Math.min(state.left + delta, this.keyboardConfig.maxDuration) : 0;
            state.down = isDownPressed ? Math.min(state.down + delta, this.keyboardConfig.maxDuration) : 0;
            state.right = isRightPressed ? Math.min(state.right + delta, this.keyboardConfig.maxDuration) : 0;
        }
        
        // Calculate stick values with configurable curve
        const curve = this.keyboardConfig.curve;
        const maxDur = this.keyboardConfig.maxDuration;
        
        const getValue = (duration) => {
            const normalized = duration / maxDur;
            return Math.pow(normalized, 1 / curve);
        };
        
        // Calculate X and Y values
        let x = 0;
        let y = 0;
        
        if (stick === 'left') {
            if (state.a > 0) x -= getValue(state.a);
            if (state.d > 0) x += getValue(state.d);
            if (state.w > 0) y -= getValue(state.w);
            if (state.s > 0) y += getValue(state.s);
        } else {
            if (state.left > 0) x -= getValue(state.left);
            if (state.right > 0) x += getValue(state.right);
            if (state.up > 0) y -= getValue(state.up);
            if (state.down > 0) y += getValue(state.down);
        }
        
        // Normalize diagonal movement
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude > 1) {
            x /= magnitude;
            y /= magnitude;
        }
        
        return { x, y, keyboardRelease };
    }
    
    showJumpTrajectory(type, fromSegment, toSegment) {
        const springData = this.jumpSprings[type];
        const laser = springData.laser;
        const color = springData.color;
        
        // Clear previous drawing
        laser.clear();
        
        // Calculate direction vector (from connection point to head/tail)
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
            const springLength = this.jumpSprings[type].length;
            const compressionRatio = Math.max(0, Math.min(1, (springLength - distance) / springLength));
            // Laser length ranges from 1.1x to 1.5x the spring length
            const laserLength = springLength * (compressionRatio * 1.3);
            
            // Draw laser beam
            laser.lineStyle(this.config.laserLineWidth, color, 1);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add glow effect
            laser.lineStyle(this.config.laserGlowWidth, color, this.config.laserGlowAlpha);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add arrow head at the end pointing in the direction of force
            const arrowSize = this.config.laserArrowSize;
            const arrowX = fromSegment.position.x + dirX * (laserLength - this.config.laserArrowOffset);
            const arrowY = fromSegment.position.y + dirY * (laserLength - this.config.laserArrowOffset);
            
            laser.fillStyle(color, 1);
            laser.beginPath();
            laser.moveTo(arrowX + dirX * arrowSize, arrowY + dirY * arrowSize);
            laser.lineTo(arrowX - dirY * arrowSize/2, arrowY + dirX * arrowSize/2);
            laser.lineTo(arrowX + dirY * arrowSize/2, arrowY - dirX * arrowSize/2);
            laser.closePath();
            laser.fillPath();
            
            // Fade out the laser
            laser.alpha = 1;
            this.scene.tweens.add({
                targets: laser,
                alpha: 0,
                duration: this.config.laserFadeDuration,
                ease: 'Linear',
                onComplete: () => {
                    laser.clear();
                }
            });
        }
    }
    
    handleJumpSpring(type, triggerValue) {
        const threshold = this.config.jumpTriggerThreshold;
        const isActive = triggerValue > threshold;
        
        const springData = this.jumpSprings[type];
        if (!springData) return;
        
        if (isActive && !springData.attached) {
            this.attachSpring(type, triggerValue);
        } else if (!isActive && springData.attached) {
            this.detachSpring(type);
        } else if (isActive && springData.spring) {
            this.updateSpringStiffness(type, triggerValue);
        }
    }
    
    attachSpring(type, triggerValue) {
        const springData = this.jumpSprings[type];
        const segments = springData.getSegments();
        const stiffness = this.calculateStiffness(triggerValue);
        
        // Check for ground contact on opposite end for smarter anchoring using section config
        const section = this.sections[type];
        const groundedSegments = this.getGroundedSegmentsInRange(
            section.oppositeRangeForGrounding.start,
            section.oppositeRangeForGrounding.end
        );
        
        if (groundedSegments.length > 0) {
            // Use ground-anchored spring for better physics
            const jumpingSegment = segments.from;
            const bestGroundContact = groundedSegments[0]; // Already sorted by distance
            
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
            
            // Show trajectory to ground contact point instead of segment
            this.showJumpTrajectory(type, bestGroundContact.segment, jumpingSegment);
        } else {
            // Fallback to traditional segment-to-segment spring
            springData.spring = this.createJumpSegment(segments.from, segments.to, springData.length, stiffness);
            springData.isGroundAnchored = false;
            
            // Show traditional trajectory
            this.showJumpTrajectory(type, segments.to, segments.from);
        }
        
        this.Matter.World.add(this.matter.world.localWorld, springData.spring);
        springData.attached = true;
    }
    
    detachSpring(type) {
        const springData = this.jumpSprings[type];
        
        if (springData.spring) {
            this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
            springData.spring = null;
            springData.attached = false;
            
            // Clean up ground-anchored spring properties
            if (springData.isGroundAnchored) {
                springData.isGroundAnchored = false;
                springData.groundBody = null;
                springData.groundedSegment = null;
            }
        }
    }
    
    updateSpringStiffness(type, triggerValue) {
        const springData = this.jumpSprings[type];
        if (springData.spring) {
            // Check if we need to convert ground-anchored spring back to segment spring
            if (springData.isGroundAnchored && springData.groundedSegment) {
                const segmentIndex = this.segments.indexOf(springData.groundedSegment);
                const collision = this.segmentCollisions[segmentIndex];
                
                // If the grounded segment is no longer touching the ground, convert to segment spring
                if (!collision || !collision.isColliding || collision.surfaceBody !== springData.groundBody) {
                    this.convertToSegmentSpring(type, triggerValue);
                    return;
                }
            }
            
            springData.spring.stiffness = this.calculateStiffness(triggerValue);
        }
    }
    
    calculateStiffness(triggerValue) {
        return triggerValue * this.config.jumpStiffness;
    }
    
    convertToSegmentSpring(type, triggerValue) {
        const springData = this.jumpSprings[type];
        
        // Remove the current ground-anchored spring
        if (springData.spring) {
            this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
        }
        
        // Create new segment-to-segment spring
        const segments = springData.getSegments();
        const stiffness = this.calculateStiffness(triggerValue);
        
        springData.spring = this.createJumpSegment(segments.from, segments.to, springData.length, stiffness);
        this.Matter.World.add(this.matter.world.localWorld, springData.spring);
        
        // Clear ground-anchored properties
        springData.isGroundAnchored = false;
        springData.groundBody = null;
        springData.groundedSegment = null;
        
        // Update trajectory visualization
        this.showJumpTrajectory(type, segments.to, segments.from);
    }
    
    
    updateStickinessSystemSections(sectionStickPairs) {
        // Process each section systematically
        sectionStickPairs.forEach(({ section, stick }) => {
            const isActive = this.checkDirectionalStickinessSection(section, stick);
            
            if (isActive) {
                this.activateStickiness(section.name);
            } else {
                this.deactivateStickiness(section.name);
            }
        });
    }
    
    checkDirectionalStickinessSection(section, stick) {
        if (!this.segments || !this.segmentCollisions) return false;
        
        // Get stick magnitude using base utility
        const stickMagnitude = this.calculateStickMagnitude(stick);
        if (stickMagnitude < this.config.stickinessActivationThreshold) {
            return false;
        }
        
        // Normalize stick direction using base utility
        const stickDirection = this.normalizeStickDirection(stick);
        
        // Get segment range using section configuration
        const { startIndex, endIndex } = this.getSegmentRange(
            section.segmentRange.start, 
            section.segmentRange.end
        );
        
        // Check if any segment in range has collision where stick points toward surface
        for (let i = startIndex; i < endIndex && i < this.segments.length; i++) {
            const collision = this.segmentCollisions[i];
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
        if (!this.segments || !this.segmentCollisions) return;
        
        // Get section configuration and touching segments using base utilities
        const section = this.sections[sectionName];
        const touchingSegments = this.getTouchingSegments(
            section.segmentRange.start, 
            section.segmentRange.end
        );
        
        // Create sticky constraints for new touching segments
        const existingConstraints = this.stickyConstraints[sectionName];
        const existingSegmentIndices = existingConstraints.map(c => c.segmentIndex);
        
        touchingSegments.forEach(touchingData => {
            const { index, segment, collision } = touchingData;
            
            // Skip if already has constraint
            if (existingSegmentIndices.includes(index)) return;
            
            // Create pin constraint at contact point
            // Calculate relative positions on both bodies
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
                stiffness: this.config.stickinessConstraintStiffness,
                damping: this.config.stickinessConstraintDamping,
                render: {
                    visible: this.config.showDebug,
                    strokeStyle: section.name === 'head' ? '#ff6b6b' : '#74b9ff',
                    lineWidth: 3
                }
            });
            
            // Add to world and track
            this.Matter.World.add(this.matter.world.localWorld, constraint);
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
            this.Matter.World.remove(this.matter.world.localWorld, constraintData.constraint);
            this.removeStickinessCircle(constraintData.constraint);
        });
        
        // Clear the array
        this.stickyConstraints[sectionName] = [];
    }
    
    cleanupInvalidStickyConstraints() {
        // Clean up constraints for segments no longer colliding
        ['head', 'tail'].forEach(section => {
            const constraints = this.stickyConstraints[section];
            const validConstraints = [];
            
            constraints.forEach(constraintData => {
                const { segmentIndex, constraint, surfaceBody } = constraintData;
                const collision = this.segmentCollisions[segmentIndex];
                
                // Keep constraint if segment is still colliding with the same surface
                if (collision && collision.isColliding && collision.surfaceBody === surfaceBody) {
                    validConstraints.push(constraintData);
                } else {
                    // Remove invalid constraint and its circle
                    this.Matter.World.remove(this.matter.world.localWorld, constraint);
                    this.removeStickinessCircle(constraint);
                }
            });
            
            this.stickyConstraints[section] = validConstraints;
        });
    }
    
    createStickinessCircle(constraint, contactPoint) {
        const config = this.config.stickinessVisualConfig;
        
        // Create a graphics object for the pulsating circle
        const circle = this.scene.add.graphics();
        circle.setPosition(contactPoint.x, contactPoint.y);
        circle.setDepth(100); // Above segments and constraints
        
        // Create the pulsating animation
        const pulseAnimation = this.scene.tweens.add({
            targets: circle,
            scaleX: config.pulseScale,
            scaleY: config.pulseScale,
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
        
        // Draw the initial circle
        this.drawStickinessCircle(circle, config);
        
        return circle;
    }
    
    drawStickinessCircle(graphics, config) {
        graphics.clear();
        graphics.fillStyle(config.circleColor, config.circleAlpha);
        graphics.lineStyle(config.strokeWidth, config.strokeColor, 1.0);
        graphics.fillCircle(0, 0, config.circleRadius);
        graphics.strokeCircle(0, 0, config.circleRadius);
    }
    
    removeStickinessCircle(constraint) {
        const circleData = this.stickinessCircles.get(constraint);
        if (circleData) {
            const { graphics, animation } = circleData;
            
            // Stop the animation
            if (animation) {
                animation.destroy();
            }
            
            // Destroy the graphics object
            if (graphics && graphics.scene) {
                graphics.destroy();
            }
            
            // Remove from tracking
            this.stickinessCircles.delete(constraint);
        }
    }
    
    updateStickinessCirclePosition(constraint, newContactPoint) {
        const circleData = this.stickinessCircles.get(constraint);
        if (circleData && circleData.graphics) {
            circleData.graphics.setPosition(newContactPoint.x, newContactPoint.y);
        }
    }
    
    
    createGroundAnchoredSpring(jumpingSegment, groundedSegmentData, springLength, stiffness) {
        const { segment: groundedSegment, collision } = groundedSegmentData;
        
        // Calculate relative position on ground body for the anchor point
        const groundRelativePoint = {
            x: collision.contactPoint.x - collision.surfaceBody.position.x,
            y: collision.contactPoint.y - collision.surfaceBody.position.y
        };
        
        // Create constraint from jumping segment to ground contact point
        const spring = this.Matter.Constraint.create({
            bodyA: jumpingSegment,
            bodyB: collision.surfaceBody, // Anchor to static ground body
            pointA: { x: 0, y: 0 }, // Center of jumping segment
            pointB: groundRelativePoint, // Contact point on ground
            length: springLength,
            stiffness: stiffness,
            render: {
                visible: this.config.showDebug,
                strokeStyle: '#00FF00', // Green for ground-anchored springs
                lineWidth: 3
            }
        });
        
        return {
            constraint: spring,
            isGroundAnchored: true,
            groundBody: collision.surfaceBody,
            groundedSegment: groundedSegment
        };
    }
}
