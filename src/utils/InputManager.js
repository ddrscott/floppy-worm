import Phaser from 'phaser';
import TouchControlsOverlay from './TouchControlsOverlay'; // Using v2 with global pointer tracking

/**
 * InputManager - Centralized input handling with configurable key mappings
 * 
 * This manager provides:
 * - Configurable key bindings
 * - Unified gamepad + keyboard input
 * - Debug visualization
 * - Input recording/playback for testing
 */
export default class InputManager {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            debug: false,
            ...config
        };
        
        // Default key mappings (can be overridden)
        this.keyMappings = {
            // Left stick (head control)
            leftUp: [Phaser.Input.Keyboard.KeyCodes.W],
            leftDown: [Phaser.Input.Keyboard.KeyCodes.S],
            leftLeft: [Phaser.Input.Keyboard.KeyCodes.A],
            leftRight: [Phaser.Input.Keyboard.KeyCodes.D],
            
            // Right stick (tail control)
            rightUp: [Phaser.Input.Keyboard.KeyCodes.UP],
            rightDown: [Phaser.Input.Keyboard.KeyCodes.DOWN],
            rightLeft: [Phaser.Input.Keyboard.KeyCodes.LEFT],
            rightRight: [Phaser.Input.Keyboard.KeyCodes.RIGHT],
            
            // Action buttons
            jump: [Phaser.Input.Keyboard.KeyCodes.SPACE],
            jumpAlt: [191], // Slash key
            roll: [Phaser.Input.Keyboard.KeyCodes.ONE],
            
            // Allow custom mappings
            ...config.keyMappings
        };
        
        // State tracking
        this.stickStates = {
            left: { x: 0, y: 0, magnitude: 0 },
            right: { x: 0, y: 0, magnitude: 0 }
        };
        
        this.buttonStates = {
            jump: false,
            jumpAlt: false,
            roll: false,
            leftGrab: false,
            rightGrab: false
        };
        
        // Keyboard simulation parameters
        this.keyboardSimulation = {
            maxDuration: config.keyboardConfig?.maxDuration || 200,
            curve: config.keyboardConfig?.curve || 2,
            keyStates: {}
        };
        
        // Touch state tracking
        this.touchStates = {
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            buttons: {}
        };
        
        // Initialize keyboard input
        this.initializeKeyboard();
        
        // Initialize touch controls
        this.initializeTouchControls();
        
        // Debug overlay
        if (this.config.debug) {
            this.createDebugOverlay();
        }
    }
    
    initializeKeyboard() {
        if (!this.scene.input.keyboard) {
            console.error('InputManager: No keyboard available in scene');
            return;
        }
        
        // Register all mapped keys
        const allKeys = new Set();
        Object.values(this.keyMappings).forEach(keys => {
            keys.forEach(key => allKeys.add(key));
        });
        
        allKeys.forEach(keyCode => {
            this.scene.input.keyboard.addKey(keyCode);
        });
        
        console.log(`InputManager: Registered ${allKeys.size} keys for input`);
    }
    
    initializeTouchControls() {
        // Create touch overlay if we're on a touch device
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            console.log('InputManager: Touch device detected, creating TouchControlsOverlay');
            this.touchControls = new TouchControlsOverlay(this.scene, {
                ...this.config.touchConfig
            });
            console.log('InputManager: Touch controls initialized');
        } else {
            console.log('InputManager: No touch device detected');
        }
    }
    
    /**
     * Get current input state
     * @returns {Object} Complete input state for the frame
     */
    getInputState(delta) {
        const pad = this.scene?.input?.gamepad?.getPad(0);
        
        // Get stick inputs
        const leftStick = this.getStickInput('left', pad, delta);
        const rightStick = this.getStickInput('right', pad, delta);
        
        // Get button inputs
        const buttons = this.getButtonInputs(pad);
        
        // Get touch button states
        let touchButtons = {};
        if (this.touchControls) {
            touchButtons = this.touchControls.getState().buttons;
        }
        
        // Combine triggers
        const leftTrigger = Math.max(
            buttons.jump && !this.config.swapControls ? 1 : 0,
            pad?.buttons[6]?.value || 0,
            touchButtons.leftTrigger ? 1 : 0
        );
        
        const rightTrigger = Math.max(
            buttons.jumpAlt && !this.config.swapControls ? 1 : 0,
            buttons.jump && this.config.swapControls ? 1 : 0,
            pad?.buttons[7]?.value || 0,
            touchButtons.rightTrigger ? 1 : 0
        );
        
        const state = {
            leftStick,
            rightStick,
            leftTrigger,
            rightTrigger,
            leftGrab: Math.max(
                pad?.buttons[4]?.value || 0,
                touchButtons.leftShoulder ? 1 : 0
            ),
            rightGrab: Math.max(
                pad?.buttons[5]?.value || 0,
                touchButtons.rightShoulder ? 1 : 0
            ),
            rollButton: buttons.roll || pad?.buttons[0]?.pressed || touchButtons.roll || false,
            delta,
            deltaSeconds: delta / 1000,
            swapControls: this.config.swapControls || false
        };
        
        // Update debug display
        if (this.debugText) {
            this.updateDebugDisplay(state);
        }
        
        return state;
    }
    
    /**
     * Get stick input combining gamepad, keyboard, and touch
     */
    getStickInput(stick, pad, delta) {
        // Get gamepad input
        let gamepadStick = { x: 0, y: 0 };
        if (pad) {
            gamepadStick = stick === 'left' ? pad.leftStick : pad.rightStick;
        }
        
        // Get keyboard input
        const keyboardStick = this.simulateStickFromKeyboard(stick, delta);
        
        // Get touch input
        let touchStick = { x: 0, y: 0 };
        if (this.touchControls) {
            const touchState = this.touchControls.getState();
            touchStick = stick === 'left' ? touchState.leftStick : touchState.rightStick;
            
            // Log touch input if active
            if (touchStick.active) {
                console.log(`InputManager: Touch ${stick} stick: (${touchStick.x?.toFixed(2)}, ${touchStick.y?.toFixed(2)})`);
            }
        }
        
        // Use whichever has greatest magnitude
        const padMag = Math.sqrt(gamepadStick.x ** 2 + gamepadStick.y ** 2);
        const keyMag = Math.sqrt(keyboardStick.x ** 2 + keyboardStick.y ** 2);
        const touchMag = Math.sqrt(touchStick.x ** 2 + touchStick.y ** 2);
        
        let result;
        let source = '';
        if (touchMag >= padMag && touchMag >= keyMag) {
            result = touchStick;
            source = 'touch';
        } else if (keyMag >= padMag) {
            result = keyboardStick;
            source = 'keyboard';
        } else {
            result = gamepadStick;
            source = 'gamepad';
        }
        
        // Store state
        this.stickStates[stick] = {
            x: result.x,
            y: result.y,
            magnitude: Math.sqrt(result.x ** 2 + result.y ** 2)
        };
        
        return result;
    }
    
    /**
     * Simulate analog stick from keyboard with smooth acceleration
     */
    simulateStickFromKeyboard(stick, delta) {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard?.keys) return { x: 0, y: 0 };
        
        const prefix = stick === 'left' ? 'left' : 'right';
        const directions = ['Up', 'Down', 'Left', 'Right'];
        
        // Initialize state tracking for this stick
        if (!this.keyboardSimulation.keyStates[stick]) {
            this.keyboardSimulation.keyStates[stick] = {
                up: 0, down: 0, left: 0, right: 0
            };
        }
        
        const state = this.keyboardSimulation.keyStates[stick];
        
        // Update each direction
        directions.forEach(dir => {
            const mappingKey = prefix + dir;
            const keys = this.keyMappings[mappingKey];
            
            // Check if any mapped key is pressed
            const isPressed = keys.some(keyCode => 
                keyboard.keys[keyCode]?.isDown
            );
            
            const stateProp = dir.toLowerCase();
            if (isPressed) {
                state[stateProp] = Math.min(
                    state[stateProp] + delta,
                    this.keyboardSimulation.maxDuration
                );
                
                // Debug first press
                if (state[stateProp] <= delta && this.config.debug) {
                    console.log(`Key pressed: ${mappingKey}`);
                }
            } else {
                state[stateProp] = Math.max(
                    state[stateProp] - delta * 2,
                    0
                );
            }
        });
        
        // Apply response curve
        const curve = (t) => Math.pow(
            t / this.keyboardSimulation.maxDuration,
            this.keyboardSimulation.curve
        );
        
        const x = curve(state.right) - curve(state.left);
        const y = curve(state.down) - curve(state.up);
        
        return { x, y };
    }
    
    /**
     * Get button inputs from keyboard and gamepad
     */
    getButtonInputs(pad) {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard?.keys) return this.buttonStates;
        
        // Check each button mapping
        Object.keys(this.buttonStates).forEach(button => {
            const keys = this.keyMappings[button];
            if (keys) {
                this.buttonStates[button] = keys.some(keyCode =>
                    keyboard.keys[keyCode]?.isDown
                );
            }
        });
        
        return this.buttonStates;
    }
    
    /**
     * Create debug overlay
     */
    createDebugOverlay() {
        const style = {
            font: '14px monospace',
            fill: '#00ff00',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 10 }
        };
        
        this.debugText = this.scene.add.text(10, 10, '', style);
        this.debugText.setScrollFactor(0);
        this.debugText.setDepth(10000);
    }
    
    /**
     * Update debug display
     */
    updateDebugDisplay(state) {
        const lines = [
            'INPUT MANAGER DEBUG',
            '==================',
            `Left Stick: (${state.leftStick.x.toFixed(2)}, ${state.leftStick.y.toFixed(2)})`,
            `Right Stick: (${state.rightStick.x.toFixed(2)}, ${state.rightStick.y.toFixed(2)})`,
            `Triggers: L=${state.leftTrigger.toFixed(2)} R=${state.rightTrigger.toFixed(2)}`,
            `Buttons: Roll=${state.rollButton} Jump=${state.leftTrigger > 0.1 || state.rightTrigger > 0.1}`,
            `Grab: L=${state.leftGrab.toFixed(2)} R=${state.rightGrab.toFixed(2)}`
        ];
        
        // Add touch controls status
        if (this.touchControls) {
            lines.push('Touch: ENABLED');
            
            // Show which input source is active
            const touchState = this.touchControls.getState();
            if (touchState.leftStick.active || touchState.rightStick.active) {
                lines.push('Touch Active: YES');
            }
        }
        
        this.debugText.setText(lines.join('\n'));
    }
    
    /**
     * Show/hide touch controls
     */
    setTouchControlsVisible(visible) {
        if (this.touchControls) {
            this.touchControls.setVisible(visible);
        }
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.debugText) {
            this.debugText.destroy();
        }
        if (this.touchControls) {
            this.touchControls.destroy();
        }
    }
}
