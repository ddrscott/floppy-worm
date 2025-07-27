import WormBase from './WormBase';
import Tick from '../utils/Tick.js';

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
            velocityDamping: 0.5,          // How quickly stick velocity decays over time (0-1)
                                          // Higher = velocity fades faster, less momentum carryover
                                          // Lower = longer momentum, more "slippery" feel
            impulseMultiplier: 0.00125,    // Strength multiplier for velocity-based forces (0-0.01 typical)
                                          // Higher = faster stick movements create stronger forces
                                          // Lower = less responsive to quick stick flicks
            stickDeadzone: 0.06,          // Minimum stick input to register movement (0-0.2 typical)
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
            
            // Ground Physics - Prevents unrealistic floating/flying behavior
            ground: {
                force: 0.02,                    // Base downward force applied to middle segments
                                               // Higher = heavier feel, less airborne time
                                               // Lower = more floaty, easier to get airborne
                segments: 0.2,                 // Fraction of segments receiving grounding (0-1)
                                               // Higher = more segments grounded, stiffer feel
                                               // Lower = fewer grounded segments, more flexible
                reactiveMultiplier: 0.8,       // Extra grounding when upward forces detected
                                               // Higher = stronger counter to upward movement
                                               // Lower = allows more vertical movement
                centerWeight: 0.5              // Extra grounding bias toward center segments
                                               // Higher = center stays down more, ends can lift
                                               // Lower = more uniform grounding distribution
            },
            
            // Visual parameters
            stickIndicatorRadius: 8,
            rangeIndicatorAlpha: 0.4,
            rangeIndicatorLineWidth: 1,
            
            // Jump Physics - Controls trigger-activated compression springs and body tension
            jump: {
                // Spring Physics
                springLengthMultiplier: 1.2,       // How much longer jump springs are vs natural distance
                                                 // Higher = more compression potential, stronger jumps
                                                 // Lower = less compression, gentler spring effect
                triggerThreshold: 0.01,          // Minimum trigger value to activate jump springs (0-1)
                                                 // Higher = harder to activate, requires fuller trigger press
                                                 // Lower = easier to activate, more sensitive triggers
                stiffness: 0.0375,               // Maximum stiffness of jump springs when fully activated
                                                 // Higher = more explosive jumps, stronger spring force
                                                 // Lower = gentler spring assistance, subtle effect

                // Compression Spring Physics - Controls trigger-responsive body tension
                baseCompressionStiffness: 0.05,    // Base stiffness when no triggers pressed
                                                    // Higher = stiffer baseline body, less flexibility
                                                    // Lower = more flexible baseline, looser feel
                maxCompressionStiffness: 0.7,      // Maximum stiffness at full trigger activation
                                                    // Higher = very rigid body when tensed, precise control
                                                    // Lower = moderate stiffening, maintains some flexibility
                compressionTriggerSensitivity: 1.0, // How responsive compression is to trigger input (0-2 typical)
                                                    // Higher = more dramatic stiffness changes per trigger input
                                                    // Lower = subtle stiffness changes, more gradual response

                useGroundAnchor: false,          //  Whether to use ground anchor for jump springs
                // Laser guidance visuals
                laser: {
                    lineWidth: 4,
                    glowWidth: 8,
                    glowAlpha: 0.5,
                    length: 200,
                    arrowSize: 15,
                    arrowOffset: 10,
                    fadeDuration: 1000
                }
            },
            
            // Grab Physics - Constraint-based surface grip system when pressing into walls
            grab: {
                activationThreshold: 0.2,        // Minimum stick input magnitude to activate
                constraintStiffness: 0.2,        // Strength of sticky constraints (0-1)
                constraintDamping: 0.5,          // Damping for sticky constraints  
                headSegmentCount: 0.3,           // Fraction of head segments that can stick
                tailSegmentCount: 0.3,           // Fraction of tail segments that can stick
                
                // Visual Effects - Pulsating circles at grip points
                visual: {
                    circleRadius: 15,            // Base radius of pulsating circle
                    pulseScale: 0.25,            // How much bigger it gets when pulsing
                    pulseDuration: 2500,         // Time for one pulse cycle (ms)
                    circleColor: 0x3bff2b,      // Green color for grip indication
                    circleAlpha: 0.9,           // Base transparency
                    // strokeWidth: 2,             // Circle outline thickness
                    // strokeColor: 0xFF0000       // White outline for contrast
                }
            },
            
            // Roll Physics - Transform worm into wheel using chord constraints
            roll: {
                // Chord patterns define which segments to connect
                chordPatterns: [
                    { skip: 7, count: 12 },     // Primary structure: 0→3, 3→6, 6→9, 9→0 (square)
                ],
                startStiffness: 0.125,          // Initial stiffness of chord constraints
                endStiffness: 0.5,              // Stiffness of chord constraints when formed
                chordDamping: 0.9,              // Damping for chord constraints
                chordLengthMultiplier: 1,       // Multiplier for calculated chord length (tune wheel tightness)
                
                // Transition parameters
                formationTime: 250,              // Time to form wheel shape (ms)
                stiffnessEaseType: 'Cubic.easeInOut', // Easing for constraint stiffening
                
                // Control parameters
                torqueMultiplier: 0.125,         // Stick input to torque conversion
                maxAngularVelocity: 2,           // Maximum wheel spin speed (radians/sec)
                exitVelocityBoost: 1.2,          // Multiplier for velocity on jump exit
            },
            
            // Frame-rate Independence - Ensures consistent physics across different refresh rates
            targetFrameRate: 60,          // Target frame rate for physics calculations (fps)
                                         // All time-based calculations normalized to this rate
                                         // Higher = more precise but potentially more expensive
                                         // Lower = less precise but more compatible
            
            // Attach points
            headAttachIndex: 1,
            tailAttachFromEnd: 2,
            tailSpringAttachPercent: 0.4,
            
            // Control swapping - when true, left stick controls tail, right stick controls head
            swapControls: false,
            
            ...config
        };
        
        super(scene, x, y, swingConfig);
        
        // Copy config values to instance
        this.anchorRadius = swingConfig.anchorRadius;
        this.anchorStiffness = swingConfig.anchorStiffness;
        this.anchorDamping = swingConfig.anchorDamping;
        this.velocityDamping = swingConfig.velocityDamping;
        this.impulseMultiplier = swingConfig.impulseMultiplier;
        this.groundingForce = swingConfig.ground.force;
        this.groundingSegments = swingConfig.ground.segments;
        
        // Frame-rate independence constants
        this.targetFrameTime = 1000 / swingConfig.targetFrameRate; // Target time per frame (ms)
        
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
        
        // Initialize roll mode state
        this.rollMode = {
            active: false,                      // Whether roll mode is currently active
            transitioning: false,               // Whether we're transitioning in/out
            chordConstraints: [],               // Active chord constraints
            wheelCenter: { x: 0, y: 0 },        // Calculated center of wheel
            angularVelocity: 0,                 // Current rotational velocity
            transitionTween: null,              // Active transition tween
            stickHistory: [],                   // History of stick positions for circular motion detection
            lastStickAngle: null,              // Last stick angle for rotation tracking
            accumulatedRotation: 0,             // Total rotation accumulated
            buttonWasPressed: false             // Track previous button state for edge detection
        };
        
        // Register the '1' key for roll mode activation
        if (this.scene.input.keyboard) {
            this.rollKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        }
        
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
                stickState: swingConfig.swapControls ? this.rightStickState : this.leftStickState
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
                stickState: swingConfig.swapControls ? this.leftStickState : this.rightStickState
            }
        };
        
        // Set correct tail attach index now that segments exist
        this.anchors.tail.attachIndex = this.segments.length - swingConfig.tailAttachFromEnd;
        
        // Create section configuration for systematic processing
        this.sections = {
            head: {
                name: 'head',
                stick: swingConfig.swapControls ? this.rightStickState : this.leftStickState,
                anchor: this.anchors.head,
                springData: null, // Will be set after jump springs are initialized
                segmentRange: { start: 0, end: this.config.grab.headSegmentCount },
                stickinessSegmentCount: this.config.grab.headSegmentCount,
                color: this.config.headColor,
                strokeColor: this.config.headStrokeColor,
                oppositeRangeForGrounding: { start: 0.7, end: 1.0 }
            },
            tail: {
                name: 'tail',
                stick: swingConfig.swapControls ? this.leftStickState : this.rightStickState,
                anchor: this.anchors.tail,
                springData: null, // Will be set after jump springs are initialized
                segmentRange: { start: 1 - this.config.grab.tailSegmentCount, end: 1 },
                stickinessSegmentCount: this.config.grab.tailSegmentCount,
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
            this.jumpSprings.head.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jump.springLengthMultiplier;
        }
        
        if (this.segments.length > 2) {
            const segA = this.segments[1];
            const segB = this.segments[this.segments.length - 1];
            this.jumpSprings.tail.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jump.springLengthMultiplier;
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
        console.log('DoubleWorm.destroy() - Starting cleanup');
        
        // Clean up anchors
        const anchorCount = Object.keys(this.anchors).length;
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.body && this.matter && this.matter.world) {
                try {
                    this.matter.world.remove(anchorData.body);
                } catch (error) {
                    console.warn('Failed to remove anchor body:', error);
                }
            }
            if (anchorData.constraint && this.matter && this.matter.world) {
                try {
                    this.matter.world.remove(anchorData.constraint);
                } catch (error) {
                    console.warn('Failed to remove anchor constraint:', error);
                }
            }
            if (anchorData.rangeGraphics) {
                try {
                    anchorData.rangeGraphics.destroy();
                } catch (error) {
                    console.warn('Failed to destroy range graphics:', error);
                }
            }
            if (anchorData.stickIndicator) {
                try {
                    anchorData.stickIndicator.destroy();
                } catch (error) {
                    console.warn('Failed to destroy stick indicator:', error);
                }
            }
        });
        console.log(`Cleaned up ${anchorCount} anchor constraints`);
        
        // Clean up jump springs if attached
        let jumpSpringCount = 0;
        Object.values(this.jumpSprings).forEach(springData => {
            if (springData.spring && springData.attached && this.matter && this.matter.world) {
                try {
                    this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
                    jumpSpringCount++;
                } catch (error) {
                    console.warn('Failed to remove jump spring:', error);
                }
            }
            if (springData.laser) {
                try {
                    springData.laser.destroy();
                } catch (error) {
                    console.warn('Failed to destroy spring laser:', error);
                }
            }
            // Clean up ground-anchored spring properties
            if (springData.isGroundAnchored) {
                springData.isGroundAnchored = false;
                springData.groundBody = null;
                springData.groundedSegment = null;
            }
        });
        console.log(`Cleaned up ${jumpSpringCount} jump spring constraints`);
        
        // Clean up sticky constraints and circles
        let stickyConstraintCount = 0;
        if (this.stickyConstraints && this.matter && this.matter.world) {
            Object.values(this.stickyConstraints).forEach(constraints => {
                constraints.forEach(constraintData => {
                    try {
                        if (constraintData.constraint) {
                            this.Matter.World.remove(this.matter.world.localWorld, constraintData.constraint);
                            this.removeStickinessCircle(constraintData.constraint);
                            stickyConstraintCount++;
                        }
                    } catch (error) {
                        console.warn('Failed to remove sticky constraint:', error);
                    }
                });
            });
        }
        console.log(`Cleaned up ${stickyConstraintCount} sticky constraints`);
        
        // Clean up any remaining stickiness circles
        if (this.stickinessCircles) {
            this.stickinessCircles.forEach((circle, constraint) => {
                if (circle && circle.scene) {
                    circle.destroy();
                }
            });
            this.stickinessCircles.clear();
        }
        
        // Clean up roll mode
        if (this.rollMode) {
            // Exit roll mode if active
            if (this.rollMode.active || this.rollMode.transitioning) {
                this.exitRollMode(false);
            }
        }
        
        // Call parent destroy
        console.log('DoubleWorm.destroy() - Calling parent destroy');
        super.destroy();
        console.log('DoubleWorm.destroy() completed');
    }

    updateMovement(delta) {
        this.updateStickDisplay();
        const pad = this.scene?.input?.gamepad?.getPad(0);
        
        const deltaSeconds = delta / 1000; // Convert to seconds
        
        this.leftGrab = pad && pad.buttons[4] ? pad.buttons[4].value : 0;
        this.rightGrab = pad && pad.buttons[5] ? pad.buttons[5].value : 0;
        
        // Check for roll mode activation/deactivation with '1' key or gamepad button 0
        const oneKeyPressed = this.rollKey && this.rollKey.isDown;
        const gamepadButton0 = pad && pad.buttons[0] && pad.buttons[0].pressed;
        const rollButtonPressed = oneKeyPressed || gamepadButton0;
        
        // Detect button press edge (not held)
        if (rollButtonPressed && !this.rollMode.buttonWasPressed && !this.rollMode.transitioning) {
            if (!this.rollMode.active) {
                // Enter roll mode
                this.enterRollMode();
            } else {
                // Exit roll mode without jump boost
                this.exitRollMode(false);
            }
        }
        
        // Update button state for next frame
        this.rollMode.buttonWasPressed = rollButtonPressed;

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
        
        // Determine which sticks control which sections based on swapControls
        const headStick = this.config.swapControls ? rightStick : leftStick;
        const tailStick = this.config.swapControls ? leftStick : rightStick;
        
        // Handle roll mode physics
        if (this.rollMode.active) {
            this.updateRollPhysics(delta);
            this.processCrankingInput(headStick, delta);
            
            // Skip all normal movement in roll mode
        } else if (!this.rollMode.transitioning) {
            // Normal movement mode
            // Update anchor positions using section-based processing
            const sectionForces = this.updateSectionAnchors([
                { section: this.sections.head, stick: headStick },
                { section: this.sections.tail, stick: tailStick }
            ], delta);
            
            // Apply grounding force to middle segments to prevent flying
            // Pass in the forces being applied to head and tail
            this.applyGroundingForce(sectionForces.head, sectionForces.tail, delta);
        }
        
        // Handle triggers to attach/detach and stiffen springs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Always check keyboard keys for jump (works even with gamepad connected)
        const keyboard = this.scene.input.keyboard;
        const spacePressed = keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SPACE]?.isDown;
        const slashPressed = keyboard.keys[191]?.isDown ||
            keyboard.keys[Phaser.Input.Keyboard.KeyCodes.QUESTION_MARK]?.isDown || (keyboard.addKey && keyboard.addKey(191).isDown);
        
        // Determine which triggers control which sections based on swapControls
        const headTriggerValue = this.config.swapControls ? 
            Math.max(rightTrigger, slashPressed ? 1.0 : 0) : 
            Math.max(leftTrigger, spacePressed ? 1.0 : 0);
        const tailTriggerValue = this.config.swapControls ? 
            Math.max(leftTrigger, spacePressed ? 1.0 : 0) : 
            Math.max(rightTrigger, slashPressed ? 1.0 : 0);
        
        // Check if either jump is triggered while in roll mode
        if (this.rollMode.active && (headTriggerValue > 0.1 || tailTriggerValue > 0.1)) {
            // Exit roll mode with jump boost
            this.exitRollMode(true);
        }
        
        // Handle jump springs normally (skip if transitioning out of roll)
        if (!this.rollMode.transitioning) {
            this.handleJumpSpring('head', headTriggerValue);
            this.handleJumpSpring('tail', tailTriggerValue);
        }
        
        // Update compression spring stiffness based on trigger values
        const maxTriggerValue = Math.max(headTriggerValue, tailTriggerValue);
        const compressionStiffness = this.config.jump.baseCompressionStiffness + 
            (maxTriggerValue * this.config.jump.compressionTriggerSensitivity * 
             (this.config.jump.maxCompressionStiffness - this.config.jump.baseCompressionStiffness));
        this.updateCompressionStiffness(compressionStiffness);
        
        // Skip stickiness system when in roll mode
        if (!this.rollMode.active && !this.rollMode.transitioning) {
            // Determine which grab buttons control which sections based on swapControls
            const headGrabActive = this.config.swapControls ? this.rightGrab > 0 : this.leftGrab > 0;
            const tailGrabActive = this.config.swapControls ? this.leftGrab > 0 : this.rightGrab > 0;
            
            // Update stickiness system using section-based processing
            this.updateStickinessSystemSections([
                { section: this.sections.head, stick: headStick, active: headGrabActive },
                { section: this.sections.tail, stick: tailStick, active: tailGrabActive }
            ]);
            
            // Clean up invalid sticky constraints
            this.cleanupInvalidStickyConstraints();
        }
    }
    
    applyGroundingForce(headForces, tailForces, delta) {
        // Calculate delta multiplier for frame-rate independence
        const deltaMultiplier = delta / this.targetFrameTime;
        
        // Calculate total upward force being applied
        const totalUpwardForce = Math.abs(Math.min(0, (headForces?.y || 0) + (tailForces?.y || 0)));
        if (totalUpwardForce <= 0.01) {
            // No upward forces detected, no grounding needed
            return;
        }
        
        // If no upward forces, apply minimal grounding
        const baseGrounding = this.groundingForce;
        const reactiveGrounding = totalUpwardForce * this.config.ground.reactiveMultiplier;
        
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
                y: totalGrounding * (this.config.ground.centerWeight + centerWeight * this.config.ground.centerWeight)
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
    
    updateSectionAnchors(sectionStickPairs, delta) {
        const forces = {};
        
        // Process each section systematically
        sectionStickPairs.forEach(({ section }) => {
            forces[section.name] = this.updateAnchorPositionSection(section, delta);
        });
        
        return forces;
    }
    
    updateAnchorPositionSection(section, delta) {
        const anchorData = section.anchor;
        if (!anchorData.body) return { x: 0, y: 0 };
        
        // Calculate delta multiplier for frame-rate independence
        const deltaMultiplier = delta / this.targetFrameTime;
        
        // Track total forces applied
        let totalForce = { x: 0, y: 0 };
        
        // Get the segment that this anchor is attached to
        const segment = this.segments[anchorData.attachIndex];
        const stickState = section.stick;
        const restPos = anchorData.restPos;
        
        // Update rest position to follow the attached segment
        // Skip this if in roll mode and this is the head anchor (it's already set to wheel center)
        if (!(this.rollMode.active && section.name === 'head')) {
            restPos.x = segment.position.x;
            restPos.y = segment.position.y;
        }
        
        // When stick is centered, move anchor to appropriate position to prevent pullback
        if (Math.abs(stickState.x) <= this.config.stickDeadzone && Math.abs(stickState.y) <= this.config.stickDeadzone) {
            // In roll mode, head anchor should center at wheel center
            if (this.rollMode.active && section.name === 'head') {
                this.Matter.Body.setPosition(anchorData.body, { x: restPos.x, y: restPos.y });
            } else {
                this.Matter.Body.setPosition(anchorData.body, { x: segment.position.x, y: segment.position.y });
            }
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
                
                // In roll mode with head anchor, apply torque to the wheel instead of direct force
                if (this.rollMode.active && section.name === 'head') {
                    // Only apply force if we've detected circular motion
                    const rotationThreshold = 0.3; // Radians of rotation needed
                    
                    if (Math.abs(this.rollMode.accumulatedRotation) > rotationThreshold) {
                        // Apply rotation force based on accumulated rotation direction
                        const rotationDirection = Math.sign(this.rollMode.accumulatedRotation);
                        
                        // Apply tangential forces to create rotation
                        this.segments.forEach(seg => {
                            const segDx = seg.position.x - this.rollMode.wheelCenter.x;
                            const segDy = seg.position.y - this.rollMode.wheelCenter.y;
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
                        this.rollMode.accumulatedRotation *= 0.9;
                    }
                } else {
                    // Normal force application
                    this.matter.body.applyForce(segment, segment.position, { x: forceX, y: forceY });
                }
                
                totalForce.x += forceX;
                totalForce.y += forceY;
            }
        }
        
        // Apply velocity-based impulse only when stick is active and not on release or returning to center
        if ((Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone) && 
            !stickState.released && !stickState.returningToCenter) {
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
        
        // Calculate current and previous magnitudes for directional momentum detection
        const prevMagnitude = Math.sqrt(stickState.prevX * stickState.prevX + stickState.prevY * stickState.prevY);
        const currentMagnitude = Math.sqrt(stickState.x * stickState.x + stickState.y * stickState.y);
        
        // Detect if stick is truly returning to center (moving toward center AND magnitude decreasing significantly)
        // Only trigger when magnitude is decreasing substantially and moving toward deadzone
        const movingTowardCenter = currentMagnitude < prevMagnitude * 0.85 && 
                                  currentMagnitude < prevMagnitude - 0.1 &&
                                  currentMagnitude > this.config.stickDeadzone;
        
        // Calculate velocity (change per second)
        const deltaX = stickState.x - stickState.prevX;
        const deltaY = stickState.y - stickState.prevY;
        
        // Velocity is change per second - normalized to target frame rate
        if (deltaSeconds > 0 && !isKeyboardRelease && !movingTowardCenter) {
            // Normalize velocity calculation to target frame rate
            const targetDeltaSeconds = this.targetFrameTime / 1000;
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
        const normalizedDeltaSeconds = deltaSeconds * (this.config.targetFrameRate / 60);
        const dampingFactor = Math.pow(this.velocityDamping, normalizedDeltaSeconds);
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
            laser.lineStyle(this.config.jump.laser.lineWidth, color, 1);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add glow effect
            laser.lineStyle(this.config.jump.laser.glowWidth, color, this.config.jump.laser.glowAlpha);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add arrow head at the end pointing in the direction of force
            const arrowSize = this.config.jump.laser.arrowSize;
            const arrowX = fromSegment.position.x + dirX * (laserLength - this.config.jump.laser.arrowOffset);
            const arrowY = fromSegment.position.y + dirY * (laserLength - this.config.jump.laser.arrowOffset);
            
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
                duration: this.config.jump.laser.fadeDuration,
                ease: 'Linear',
                onComplete: () => {
                    laser.clear();
                }
            });
        }
    }
    
    handleJumpSpring(type, triggerValue) {
        const threshold = this.config.jump.triggerThreshold;
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
        
        // Check if any segments in the grounding range are on ice (prevents anchoring)
        const hasIceInGrip = this.hasIceInRange(
            section.oppositeRangeForGrounding.start,
            section.oppositeRangeForGrounding.end
        );
        
        if (this.config.jump.useGroundAnchor && groundedSegments.length > 0 && !hasIceInGrip) {
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
        return triggerValue * this.config.jump.stiffness;
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
        sectionStickPairs.forEach(({ section, stick, active }) => {
            // const isActive = this.checkDirectionalStickinessSection(section, stick);
            
            if (active) {
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
        if (stickMagnitude < this.config.grab.activationThreshold) {
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
        
        // Skip if grab system is temporarily disabled (during reset)
        if (this.grabDisabled) return;
        
        // Get section configuration and touching segments using base utilities
        const section = this.sections[sectionName];
        
        // Check if any segments in this section are on ice (prevents stickiness)
        const hasIceInSection = this.hasIceInRange(
            section.segmentRange.start, 
            section.segmentRange.end
        );
        
        // Can't stick to ice - deactivate and return early
        if (hasIceInSection) {
            this.deactivateStickiness(sectionName);
            return;
        }
        
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
                stiffness: this.config.grab.constraintStiffness,
                damping: this.config.grab.constraintDamping,
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
        // Only clean up constraints when buttons are released
        // Constraints should persist even if contact is lost while button is held
        
        ['head', 'tail'].forEach(section => {
            const constraints = this.stickyConstraints[section];
            const validConstraints = [];
            
            // Check if the grab button for this section is still pressed (respect swapControls)
            const isGrabActive = section === 'head' ? 
                (this.config.swapControls ? this.rightGrab > 0 : this.leftGrab > 0) :
                (this.config.swapControls ? this.leftGrab > 0 : this.rightGrab > 0);
            
            constraints.forEach(constraintData => {
                const { constraint } = constraintData;
                
                // Keep constraint if grab button is still pressed
                if (isGrabActive) {
                    validConstraints.push(constraintData);
                } else {
                    // Only remove constraint when button is released
                    this.Matter.World.remove(this.matter.world.localWorld, constraint);
                    this.removeStickinessCircle(constraint);
                }
            });
            
            this.stickyConstraints[section] = validConstraints;
        });
    }
    
    createStickinessCircle(constraint, contactPoint) {
        const config = this.config.grab.visual;
        
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
    
    // Roll mode methods
    calculateWheelRadius() {
        // Calculate ideal radius based on total segment perimeter
        let totalPerimeter = 0;
        this.segments.forEach((segment, i) => {
            totalPerimeter += this.segmentRadii[i] * 2;
        });
        return totalPerimeter / (2 * Math.PI);
    }
    
    calculateChordLength(fromIndex, toIndex, wheelRadius) {
        const totalSegments = this.segments.length;
        const skipCount = Math.abs(toIndex - fromIndex);
        const angleRadians = (skipCount / totalSegments) * 2 * Math.PI;
        // Chord length = 2 * radius * sin(angle/2)
        const geometricLength = 2 * wheelRadius * Math.sin(angleRadians / 2);
        return geometricLength * this.config.roll.chordLengthMultiplier;
    }
    
    createChordConstraint(fromSegment, toSegment, length, stiffness = 0) {
        return this.Matter.Constraint.create({
            bodyA: fromSegment,
            bodyB: toSegment,
            length: length,
            stiffness: stiffness, // Start at 0 for smooth transition
            damping: this.config.roll.chordDamping,
            render: {
                visible: this.config.showDebug,
            }
        });
    }
    
    createWheelConstraints() {
        const wheelRadius = this.calculateWheelRadius();
        const constraints = [];
        
        // Process each chord pattern
        this.config.roll.chordPatterns.forEach(pattern => {
            const { skip, count } = pattern;
            
            for (let i = 0; i < count; i++) {
                const fromIndex = (i * skip) % this.segments.length;
                const toIndex = ((i + 1) * skip) % this.segments.length;
                
                if (fromIndex !== toIndex) {
                    const fromSegment = this.segments[fromIndex];
                    const toSegment = this.segments[toIndex];
                    const chordLength = this.calculateChordLength(fromIndex, toIndex, wheelRadius);
                    
                    const constraint = this.createChordConstraint(
                        fromSegment,
                        toSegment,
                        chordLength,
                        this.config.roll.startStiffness
                    );
                    
                    constraints.push({
                        constraint: constraint,
                        fromIndex: fromIndex,
                        toIndex: toIndex,
                        targetStiffness: this.config.roll.endStiffness
                    });
                }
            }
        });
        
        // Add head-to-tail constraint to ensure closed wheel
        const headSegment = this.segments[0];
        const tailSegment = this.segments[this.segments.length - 1];
        const headRadius = this.segmentRadii[0];
        const tailRadius = this.segmentRadii[this.segments.length - 1];
        
        // Create constraint matching the normal segment connection pattern
        const headTailConstraint = this.Matter.Constraint.create({
            bodyA: tailSegment,
            bodyB: headSegment,
            pointA: { x: 0, y: tailRadius + 1 },  // Bottom of tail
            pointB: { x: 0, y: -headRadius - 1 }, // Top of head
            length: this.config.constraintLength,
            stiffness: this.config.roll.startStiffness,
            damping: this.config.roll.chordDamping,
        });
        
        constraints.push({
            constraint: headTailConstraint,
            fromIndex: 0,
            toIndex: this.segments.length - 1,
            targetStiffness: this.config.roll.endStiffness,
            isHeadTail: true // Mark this as the special head-tail constraint
        });
        
        return constraints;
    }
    
    enterRollMode() {
        if (this.rollMode.active || this.rollMode.transitioning) return;
        
        this.rollMode.transitioning = true;
        
        // Create chord constraints
        this.rollMode.chordConstraints = this.createWheelConstraints();
        
        // Add constraints to world
        this.rollMode.chordConstraints.forEach(constraintData => {
            this.Matter.World.add(this.matter.world.localWorld, constraintData.constraint);
        });

        // Disable normal movement systems
        this.disableNormalMovement();
        
        // Animate constraint stiffening
        this.rollMode.transitionTween = this.scene.tweens.add({
            targets: this.rollMode,
            duration: this.config.roll.formationTime,
            ease: this.config.roll.stiffnessEaseType,
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
    }
    
    exitRollMode(withJump = false) {
        if (!this.rollMode.active && !this.rollMode.transitioning) return;
        
        // Stop any ongoing transition
        if (this.rollMode.transitionTween) {
            this.rollMode.transitionTween.stop();
            this.rollMode.transitionTween = null;
        }
        
        // Calculate exit velocity boost if jumping
        if (withJump && this.rollMode.active) {
            this.applyRollExitBoost();
        }
        
        // Remove all chord constraints
        this.rollMode.chordConstraints.forEach(constraintData => {
            this.Matter.World.remove(this.matter.world.localWorld, constraintData.constraint);
        });
        this.rollMode.chordConstraints = [];
        
        // Re-enable normal movement
        this.enableNormalMovement();
        
        // Reset state
        this.rollMode.active = false;
        this.rollMode.transitioning = false;
        this.rollMode.angularVelocity = 0;
    }
    
    disableNormalMovement() {
        // Hide tail anchor visuals
        if (this.anchors.tail.rangeGraphics) {
            this.anchors.tail.rangeGraphics.visible = false;
        }
        if (this.anchors.tail.stickIndicator) {
            this.anchors.tail.stickIndicator.visible = false;
        }
        
        // Disable anchor constraints to allow free movement
        if (this.anchors.tail.constraint) {
            this.anchors.tail.constraint.stiffness = 0.000001;
        }
        if (this.anchors.head.constraint) {
            this.anchors.head.constraint.stiffness = 0.000001;
        }
    }
    
    enableNormalMovement() {
        // First, reposition anchors to their correct attached segments
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.body && anchorData.attachIndex < this.segments.length) {
                const attachSegment = this.segments[anchorData.attachIndex];
                // Set position to attached segment
                this.Matter.Body.setPosition(anchorData.body, {
                    x: attachSegment.position.x,
                    y: attachSegment.position.y
                });
                // Update rest position
                anchorData.restPos.x = attachSegment.position.x;
                anchorData.restPos.y = attachSegment.position.y;
            }
        });
        
        // Then restore tail anchor visuals (after positioning)
        if (this.anchors.tail.rangeGraphics) {
            this.anchors.tail.rangeGraphics.visible = true;
        }
        if (this.anchors.tail.stickIndicator) {
            this.anchors.tail.stickIndicator.visible = true;
        }
        
        // Finally restore anchor constraint stiffness
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.constraint) {
                anchorData.constraint.stiffness = this.anchorStiffness;
            }
        });
    }
    
    applyRollExitBoost() {
        // Convert angular velocity to linear velocity boost
        const boost = this.config.roll.exitVelocityBoost;
        const angularVel = this.rollMode.angularVelocity;
        
        // Apply tangential forces to maintain momentum
        this.segments.forEach(segment => {
            const dx = segment.position.x - this.rollMode.wheelCenter.x;
            const dy = segment.position.y - this.rollMode.wheelCenter.y;
            
            // Tangential force components
            const forceMagnitude = angularVel * boost * segment.mass * 0.1;
            const fx = -dy * forceMagnitude;
            const fy = dx * forceMagnitude;
            
            this.matter.body.applyForce(segment, segment.position, { x: fx, y: fy });
        });
    }
    
    updateRollPhysics(delta) {
        if (!this.rollMode.active) return;
        
        // Update wheel center
        let centerX = 0, centerY = 0;
        this.segments.forEach(segment => {
            centerX += segment.position.x;
            centerY += segment.position.y;
        });
        this.rollMode.wheelCenter.x = centerX / this.segments.length;
        this.rollMode.wheelCenter.y = centerY / this.segments.length;
        
        // Move the head anchor to the wheel center
        const headAnchor = this.anchors.head;
        if (headAnchor.body) {
            // Update anchor rest position to wheel center
            headAnchor.restPos.x = this.rollMode.wheelCenter.x;
            headAnchor.restPos.y = this.rollMode.wheelCenter.y;
            
            // Position the anchor body at the wheel center
            this.Matter.Body.setPosition(headAnchor.body, {
                x: this.rollMode.wheelCenter.x,
                y: this.rollMode.wheelCenter.y
            });
        }
        
        // Calculate and limit angular velocity
        let totalAngularMomentum = 0;
        let totalInertia = 0;
        
        this.segments.forEach(segment => {
            const dx = segment.position.x - this.rollMode.wheelCenter.x;
            const dy = segment.position.y - this.rollMode.wheelCenter.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            
            // Cross product of position and velocity gives angular momentum contribution
            const angularMomentum = (dx * segment.velocity.y - dy * segment.velocity.x);
            totalAngularMomentum += angularMomentum;
            totalInertia += segment.mass * r * r;
        });
        
        if (totalInertia > 0) {
            this.rollMode.angularVelocity = totalAngularMomentum / totalInertia;
            // Limit angular velocity using forces instead of setVelocity
            // Tick.push('ang vel', this.rollMode.angularVelocity, 0x33ffff);
            
            if (Math.abs(this.rollMode.angularVelocity) > this.config.roll.maxAngularVelocity) {
                this.rollMode.angularVelocity = Math.sign(this.rollMode.angularVelocity) * this.config.roll.maxAngularVelocity;
                
                // Apply opposing forces to slow down rotation naturally
                this.segments.forEach(segment => {
                    const dampingFactor = 0.98;
                    const fx = -segment.velocity.x * (1 - dampingFactor);
                    const fy = -segment.velocity.y * (1 - dampingFactor);
                    this.matter.body.applyForce(segment, segment.position, { x: fx, y: fy });
                });
            }
        }
    }
    
    processCrankingInput(stick, delta) {
        // Only process if stick is outside deadzone
        if (Math.abs(stick.x) <= this.config.stickDeadzone && Math.abs(stick.y) <= this.config.stickDeadzone) {
            // Reset tracking when stick returns to center
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
                // This ensures consistent rotation speed regardless of frame rate
                const rotationRate = angleDiff * (1000 / delta); // radians per second
                const scaledRotation = rotationRate * (delta / 1000) * stickMagnitude * this.config.roll.torqueMultiplier;
                
                // Apply pure torque to the wheel
                this.segments.forEach(seg => {
                    const dx = seg.position.x - this.rollMode.wheelCenter.x;
                    const dy = seg.position.y - this.rollMode.wheelCenter.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0.1) {
                        // Tangential force for rotation
                        const fx = -dy / dist * scaledRotation;
                        const fy = dx / dist * scaledRotation;
                        
                        this.matter.body.applyForce(seg, seg.position, { x: fx, y: fy });
                    }
                });
            }
        }
        
        this.rollMode.lastStickAngle = stickAngle;
    }
    
    /**
     * Reset all dynamic constraints and states when worm is reset
     * Called by BaseLevelScene.resetWorm()
     */
    resetState() {
        // Temporarily disable grab system to prevent immediate re-creation of constraints
        this.grabDisabled = true;
        setTimeout(() => {
            this.grabDisabled = false;
        }, 100); // 100ms disable period
        
        // Force clear all sticky constraints immediately (ignore button state)
        if (this.stickyConstraints) {
            Object.keys(this.stickyConstraints).forEach(sectionName => {
                const constraints = this.stickyConstraints[sectionName];
                // Force remove all constraints regardless of button state
                constraints.forEach(constraintData => {
                    this.Matter.World.remove(this.matter.world.localWorld, constraintData.constraint);
                    this.removeStickinessCircle(constraintData.constraint);
                });
                // Clear the array
                this.stickyConstraints[sectionName] = [];
            });
        }
        
        // Clear any currently active jump springs (but keep the jump system intact)
        if (this.jumpSprings) {
            Object.values(this.jumpSprings).forEach(springData => {
                if (springData.spring) {
                    // Only remove currently active springs, preserve the system
                    this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
                    springData.spring = null;
                    springData.attached = false; // Critical: reset attached state
                    // Reset ground anchoring state but keep the capability
                    springData.isGroundAnchored = false;
                    springData.groundBody = null;
                    springData.groundedSegment = null;
                    // Note: We keep springData itself and other properties for future jumping
                }
            });
        }
        
        // Reset anchor positions to segment positions to prevent pulling
        if (this.anchors) {
            Object.values(this.anchors).forEach(anchorData => {
                if (anchorData.body && anchorData.attachIndex < this.segments.length) {
                    const attachSegment = this.segments[anchorData.attachIndex];
                    this.Matter.Body.setPosition(anchorData.body, {
                        x: attachSegment.position.x,
                        y: attachSegment.position.y
                    });
                    
                    // Reset rest position
                    anchorData.restPos.x = attachSegment.position.x;
                    anchorData.restPos.y = attachSegment.position.y;
                    
                    // Reset stick state
                    anchorData.stickState = { x: 0, y: 0 };
                }
            });
        }
        
        // Reset input processing state (only stick positions, not triggers)
        this.processedInputs = {
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            leftTrigger: false,
            rightTrigger: false
        };
        
        // Reset segment friction to default values (in case segments were on ice)
        if (this.segments) {
            this.segments.forEach(segment => {
                segment.friction = this.config.segmentFriction;
                segment.frictionStatic = this.config.segmentFrictionStatic;
            });
        }
        
        // Exit roll mode if active
        if (this.rollMode && (this.rollMode.active || this.rollMode.transitioning)) {
            this.exitRollMode(false);
        }
    }
}
