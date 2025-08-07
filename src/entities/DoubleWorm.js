import WormBase from './WormBase';
import AbilityStateMachine from './abilities/AbilityStateMachine';
import MovementAbility from './abilities/MovementAbility';
import JumpAbility from './abilities/JumpAbility';
import RollAbility from './abilities/RollAbility';
import GrabAbility from './abilities/GrabAbility';
import InputManager from '../utils/InputManager';

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
            anchorRadius: 60,
            anchorStiffness: 0.5,
            anchorDamping: 0.05,
            anchorSensorRadius: 5,
            anchorDensity: 0.0001,
            
            // Air resistance
            airFriction: 0.012,
            
            // Movement Physics
            velocityDamping: 1,
            maxImpulseForce: 0.6,
            headImpulseMultiplier: 0.002,
            tailImpulseMultiplier: 0.0025,
            stickDeadzone: 0.06,
            positionForceMagnitude: 0.00001,
            minForceThreshold: 0.00001,
            minDistanceThreshold: 0.1,
            
            // Ground Physics
            ground: {
                segments: 0.3,
                centerWeight: 0.5,
                centerOffset: 0.7,
                percentageForce: 0.9,
            },

            // Visual parameters
            stickIndicatorRadius: 8,
            rangeIndicatorAlpha: 0.4,
            rangeIndicatorLineWidth: 1,
            
            // Jump Physics
            jump: {
                springLengthMultiplier: 1.3,
                triggerThreshold: 0.01,
                stiffness: 0.0375,
                baseCompressionStiffness: 0.05,
                maxCompressionStiffness: 0.7,
                compressionTriggerSensitivity: 1.0,
                useGroundAnchor: false,
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
            
            // Grab Physics
            grab: {
                activationThreshold: 0.2,
                constraintStiffness: 0.2,
                constraintDamping: 0.5,
                headSegmentCount: 0.3,
                tailSegmentCount: 0.3,
                visual: {
                    circleRadius: 15,
                    pulseScale: 0.25,
                    pulseDuration: 2500,
                    circleColor: 0x3bff2b,
                    circleAlpha: 0.9,
                }
            },
            
            // Roll Physics
            roll: {
                chordPatterns: [
                    { skip: 7, count: 12 },
                ],
                startStiffness: 0.125,
                endStiffness: 0.5,
                chordDamping: 0.9,
                chordLengthMultiplier: 1,
                formationTime: 250,
                stiffnessEaseType: 'Cubic.easeInOut',
                torqueMultiplier: 0.125,
                maxAngularVelocity: 2,
                exitVelocityBoost: 1.0,
                slipDetectionThreshold: 0.1,
                antiSlipForce: 2,
            },
            
            // Frame-rate Independence
            targetFrameRate: 60,
            
            // Attach points
            headAttachIndex: 1,
            tailAttachFromEnd: 2,
            tailSpringAttachPercent: 0.4,
            
            // Control swapping
            swapControls: false,
            
            ...config
        };
        
        super(scene, x, y, swingConfig);
        
        // Copy config values to instance for compatibility
        this.anchorRadius = swingConfig.anchorRadius;
        this.anchorStiffness = swingConfig.anchorStiffness;
        this.anchorDamping = swingConfig.anchorDamping;
        this.velocityDamping = swingConfig.velocityDamping;
        this.headImpulseMultiplier = swingConfig.headImpulseMultiplier;
        this.tailImpulseMultiplier = swingConfig.tailImpulseMultiplier;
        this.groundingSegments = swingConfig.ground.segments;
        
        // Ability flags - can be toggled at runtime
        this.abilities = {
            jump: true,
            roll: true,
            grab: true
        };
        
        // Frame-rate independence constants
        this.targetFrameTime = 1000 / swingConfig.targetFrameRate;
        
        // Keyboard Simulation Physics (passed to InputManager)
        this.keyboardConfig = {
            maxDuration: 200,
            curve: 2,
            ...config.keyboardConfig
        };
        
        // Initialize input manager with debug enabled in dev mode
        const urlParams = new URLSearchParams(window.location.search);
        this.inputManager = new InputManager(scene, {
            debug: urlParams.get('debug') === '1' || urlParams.get('inputdebug') === '1',
            swapControls: swingConfig.swapControls,
            keyboardConfig: this.keyboardConfig,
            touchConfig: {
                leftJoystickColor: swingConfig.headColor,
                leftJoystickKnobColor: swingConfig.headColor,
                rightJoystickColor: swingConfig.tailColor,
                rightJoystickKnobColor: swingConfig.tailColor,
                leftButtonColor: swingConfig.headColor,
                leftButtonActiveColor: swingConfig.headStrokeColor,
                rightButtonColor: swingConfig.tailColor,
                rightButtonActiveColor: swingConfig.tailStrokeColor
            }
        });
        
        // Initialize state machine
        this.stateMachine = new AbilityStateMachine();
        
        // Initialize abilities with full config
        this.movementAbility = new MovementAbility(this, swingConfig);
        this.jumpAbility = new JumpAbility(this, { ...swingConfig.jump, ...swingConfig });
        this.rollAbility = new RollAbility(this, { ...swingConfig.roll, ...swingConfig });
        this.grabAbility = new GrabAbility(this, { ...swingConfig.grab, ...swingConfig });
        
        // Set cross-references
        this.rollAbility.setMovementAbility(this.movementAbility);
        
        // Initialize jump spring lengths while worm is in resting position
        this.jumpAbility.initializeSpringLengths();
        
        // Set up state machine listeners
        this.setupStateMachineListeners();
        
        // Initialize button states - we'll set these to actual states on first update
        // to prevent buttons that are already held from triggering
        this.rollButtonDown = undefined;
        this.jumpButtonDown = undefined;
        this.firstUpdate = true;
        
        // Input blocking - wait until all buttons are released before accepting input
        this.inputBlocked = true;
        this.inputBlockReason = 'waiting_for_release';
        this.inputBlockFrameCount = 0;
        this.inputBlockMinFrames = 10; // Wait at least 10 frames before checking
        
        // Activate default abilities
        this.movementAbility.activate();
        this.grabAbility.activate();
    }
    
    setupStateMachineListeners() {
        // Listen for state changes to activate/deactivate abilities
        this.stateMachine.on('enter:default', () => {
            this.jumpAbility.deactivate();
            this.rollAbility.deactivate();
        });
        
        this.stateMachine.on('enter:jumping', () => {
            this.rollAbility.deactivate();
            this.jumpAbility.activate();
        });
        
        this.stateMachine.on('enter:rolling', () => {
            this.jumpAbility.deactivate();
            this.rollAbility.activate();
        });
    }
    
    update(delta) {
        // Call parent update for graphics
        super.update(delta);
    }
    
    updateMovement(delta) {
        // Get input state from InputManager
        const inputState = this.inputManager.getInputState(delta);
        
        // Log input state if there's any movement
        if (inputState.leftStick.x !== 0 || inputState.leftStick.y !== 0 || 
            inputState.rightStick.x !== 0 || inputState.rightStick.y !== 0) {
        }
        
        // Input blocking logic - wait until all relevant buttons are released
        if (this.inputBlocked) {
            this.inputBlockFrameCount++;
            
            // Don't even check buttons until minimum frames have passed
            if (this.inputBlockFrameCount < this.inputBlockMinFrames) {
                // Still in initial wait period
                const neutralInputs = {
                    leftStick: { x: 0, y: 0 },
                    rightStick: { x: 0, y: 0 },
                    leftGrab: 0,
                    rightGrab: 0,
                    leftTrigger: 0,
                    rightTrigger: 0,
                    swapControls: this.config.swapControls,
                    delta,
                    deltaSeconds: inputState.deltaSeconds
                };
                
                // Still update movement ability for visuals
                this.movementAbility.handleInput(neutralInputs);
                this.movementAbility.update(delta);
                return;
            }
            
            // Check if all mode buttons are released
            const anyModeButtonPressed = inputState.rollButton || 
                (inputState.leftTrigger > 0.1 || inputState.rightTrigger > 0.1);
            
            if (!anyModeButtonPressed) {
                // All buttons released, unblock input
                this.inputBlocked = false;
                this.inputBlockReason = null;
            } else {
                // Still blocked, return early with neutral inputs
                const neutralInputs = {
                    leftStick: { x: 0, y: 0 },
                    rightStick: { x: 0, y: 0 },
                    leftGrab: 0,
                    rightGrab: 0,
                    leftTrigger: 0,
                    rightTrigger: 0,
                    swapControls: this.config.swapControls,
                    delta,
                    deltaSeconds: inputState.deltaSeconds
                };
                
                // Still update movement ability for visuals
                this.movementAbility.handleInput(neutralInputs);
                this.movementAbility.update(delta);
                return;
            }
        }
        
        // Check if jump button is pressed
        const jumpButtonPressed = (inputState.leftTrigger > 0.1 || inputState.rightTrigger > 0.1);
        
        // Track previous button states
        let prevRollDown = this.rollButtonDown;
        let prevJumpDown = this.jumpButtonDown;
        
        // On first update, initialize button states to current state to prevent false edges
        if (this.firstUpdate) {
            prevRollDown = inputState.rollButton;
            prevJumpDown = jumpButtonPressed;
            this.firstUpdate = false;
        }
        
        this.rollButtonDown = inputState.rollButton;
        this.jumpButtonDown = jumpButtonPressed;
        
        // Calculate button edges
        const rollJustPressed = inputState.rollButton && !prevRollDown;
        const jumpJustPressed = jumpButtonPressed && !prevJumpDown;
        
        // Update state machine
        this.stateMachine.handleModeInputs(
            inputState.rollButton && this.abilities.roll,
            jumpButtonPressed && this.abilities.jump,
            rollJustPressed,
            jumpJustPressed
        );
        
        // Use input state directly
        const inputs = inputState;
        
        // Update active abilities based on current state
        const currentState = this.stateMachine.getCurrentState();
        
        // Movement is always active (it handles roll mode internally)
        this.movementAbility.handleInput(inputs);
        this.movementAbility.update(delta);
        
        // Grab is active in all states
        if (this.abilities.grab) {
            this.grabAbility.handleInput(inputs);
        }
        
        // State-specific abilities
        switch (currentState) {
            case this.stateMachine.states.JUMPING:
                this.jumpAbility.handleInput(inputs);
                break;
                
            case this.stateMachine.states.ROLLING:
                this.rollAbility.handleInput(inputs);
                this.rollAbility.update(delta);
                break;
                
            case this.stateMachine.states.DEFAULT:
                // In default state, jump ability can still be used without entering jump mode
                if (this.abilities.jump) {
                    this.jumpAbility.handleInput(inputs);
                }
                break;
        }
    }
    
    // Removed simulateStickFromKeyboard - now handled by InputManager
    
    destroy() {
        console.log('DoubleWorm.destroy() - Starting cleanup');
        
        // Clean up input manager
        if (this.inputManager) {
            this.inputManager.destroy();
        }
        
        // Deactivate all abilities
        if (this.movementAbility) {
            this.movementAbility.deactivate();
        }
        if (this.jumpAbility) {
            this.jumpAbility.deactivate();
        }
        if (this.rollAbility) {
            this.rollAbility.deactivate();
        }
        if (this.grabAbility) {
            this.grabAbility.deactivate();
        }
        
        // Reset state machine
        if (this.stateMachine) {
            this.stateMachine.reset();
        }
        
        console.log('DoubleWorm.destroy() - Calling parent destroy');
        super.destroy();
        console.log('DoubleWorm.destroy() completed');
    }
}
