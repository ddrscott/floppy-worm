import WormBase from './WormBase';
import AbilityStateMachine from './abilities/AbilityStateMachine';
import MovementAbility from './abilities/MovementAbility';
import JumpAbility from './abilities/JumpAbility';
import RollAbility from './abilities/RollAbility';
import GrabAbility from './abilities/GrabAbility';

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
            airFriction: 0.018,
            
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
        
        // Keyboard Simulation Physics
        this.keyboardConfig = {
            maxDuration: 200,
            curve: 2,
            ...config.keyboardConfig
        };
        
        // Keyboard state tracking
        this.keyboardState = {
            left: { w: 0, a: 0, s: 0, d: 0 },
            right: { up: 0, left: 0, down: 0, right: 0 }
        };
        
        // Register the '1' key for roll mode activation
        if (this.scene.input.keyboard) {
            this.rollKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        }
        
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
        const pad = this.scene?.input?.gamepad?.getPad(0);
        const deltaSeconds = delta / 1000;
        
        // Get input states
        const leftGrab = pad && pad.buttons[4] ? pad.buttons[4].value : 0;
        const rightGrab = pad && pad.buttons[5] ? pad.buttons[5].value : 0;
        
        // Check for roll mode activation with '1' key or gamepad button 0
        const oneKeyPressed = this.rollKey && this.rollKey.isDown;
        const gamepadButton0 = pad && pad.buttons[0] && pad.buttons[0].pressed;
        const rollButtonPressed = oneKeyPressed || gamepadButton0;
        
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
                    deltaSeconds
                };
                
                // Still update movement ability for visuals
                this.movementAbility.handleInput(neutralInputs);
                this.movementAbility.update(delta);
                return;
            }
            
            // Check if all mode buttons are released
            const anyModeButtonPressed = rollButtonPressed || 
                (pad && (pad.buttons[6]?.value > 0.1 || pad.buttons[7]?.value > 0.1)) ||
                this.scene.input.keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SPACE]?.isDown ||
                this.scene.input.keyboard.keys[191]?.isDown;
            
            if (!anyModeButtonPressed) {
                // All buttons released, unblock input
                this.inputBlocked = false;
                this.inputBlockReason = null;
                console.log(`Input unblocked after ${this.inputBlockFrameCount} frames - all buttons released`);
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
                    deltaSeconds
                };
                
                // Still update movement ability for visuals
                this.movementAbility.handleInput(neutralInputs);
                this.movementAbility.update(delta);
                return;
            }
        }
        
        // Get stick inputs
        let leftStick, rightStick;
        if (pad) {
            leftStick = pad.leftStick;
            rightStick = pad.rightStick;
            
            // Combine with keyboard inputs
            const keyboardLeft = this.simulateStickFromKeyboard('left', delta);
            const keyboardRight = this.simulateStickFromKeyboard('right', delta);
            
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
            leftStick = this.simulateStickFromKeyboard('left', delta);
            rightStick = this.simulateStickFromKeyboard('right', delta);
        }
        
        // Get trigger inputs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Check keyboard keys for jump
        const keyboard = this.scene.input.keyboard;
        const spacePressed = keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SPACE]?.isDown;
        const slashPressed = keyboard.keys[191]?.isDown ||
            keyboard.keys[Phaser.Input.Keyboard.KeyCodes.QUESTION_MARK]?.isDown || 
            (keyboard.addKey && keyboard.addKey(191).isDown);
        
        // Combine trigger values with keyboard
        const headTriggerValue = this.config.swapControls ? 
            Math.max(rightTrigger, slashPressed ? 1.0 : 0) : 
            Math.max(leftTrigger, spacePressed ? 1.0 : 0);
        const tailTriggerValue = this.config.swapControls ? 
            Math.max(leftTrigger, spacePressed ? 1.0 : 0) : 
            Math.max(rightTrigger, slashPressed ? 1.0 : 0);
        
        // Check if jump button is pressed
        const jumpButtonPressed = (headTriggerValue > 0.1 || tailTriggerValue > 0.1);
        
        // Track previous button states
        let prevRollDown = this.rollButtonDown;
        let prevJumpDown = this.jumpButtonDown;
        
        // On first update, initialize button states to current state to prevent false edges
        if (this.firstUpdate) {
            prevRollDown = rollButtonPressed;
            prevJumpDown = jumpButtonPressed;
            this.firstUpdate = false;
        }
        
        this.rollButtonDown = rollButtonPressed;
        this.jumpButtonDown = jumpButtonPressed;
        
        // Calculate button edges
        const rollJustPressed = rollButtonPressed && !prevRollDown;
        const jumpJustPressed = jumpButtonPressed && !prevJumpDown;
        
        // Update state machine
        this.stateMachine.handleModeInputs(
            rollButtonPressed && this.abilities.roll,
            jumpButtonPressed && this.abilities.jump,
            rollJustPressed,
            jumpJustPressed
        );
        
        // Prepare input object for abilities
        const inputs = {
            leftStick,
            rightStick,
            leftGrab,
            rightGrab,
            leftTrigger: headTriggerValue,
            rightTrigger: tailTriggerValue,
            swapControls: this.config.swapControls,
            delta,
            deltaSeconds
        };
        
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
    
    // Keyboard simulation methods (kept for compatibility)
    simulateStickFromKeyboard(stick, delta) {
        const keyMap = stick === 'left' ? 
            { up: 'w', left: 'a', down: 's', right: 'd' } :
            { up: 'up', left: 'left', down: 'down', right: 'right' };
            
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return { x: 0, y: 0 };
        
        const state = this.keyboardState[stick];
        
        // Update key press durations
        Object.entries(keyMap).forEach(([dir, key]) => {
            const keyCode = key === 'up' ? 38 : key === 'left' ? 37 : key === 'down' ? 40 : key === 'right' ? 39 :
                           key === 'w' ? 87 : key === 'a' ? 65 : key === 's' ? 83 : key === 'd' ? 68 : 0;
            
            const isPressed = keyboard.keys[keyCode]?.isDown || false;
            
            if (isPressed) {
                state[dir] = Math.min(state[dir] + delta, this.keyboardConfig.maxDuration);
            } else {
                state[dir] = Math.max(state[dir] - delta * 2, 0);
            }
        });
        
        // Calculate stick position with response curve
        const curve = (t) => Math.pow(t / this.keyboardConfig.maxDuration, this.keyboardConfig.curve);
        
        const x = curve(state.right) - curve(state.left);
        const y = curve(state.down) - curve(state.up);
        
        return { x, y };
    }
    
    destroy() {
        console.log('DoubleWorm.destroy() - Starting cleanup');
        
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
