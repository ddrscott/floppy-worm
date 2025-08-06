import Phaser from 'phaser';

/**
 * TouchControlsOverlay2 - Simplified virtual touch controls using global pointer tracking
 * 
 * Based on Phaser's multitouch example for more reliable input handling
 */
export default class TouchControlsOverlay2 {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            // Layout config
            joystickRadius: 60,
            joystickKnobRadius: 25,
            buttonSize: 50,
            opacity: 0.5,
            activeOpacity: 0.8,
            
            // Colors
            joystickColor: 0x4444ff,
            joystickKnobColor: 0x6666ff,
            buttonColor: 0x44ff44,
            buttonActiveColor: 0x66ff66,
            
            // Positioning (as percentage of screen)
            leftJoystickPos: { x: 0.15, y: 0.75 },
            rightJoystickPos: { x: 0.85, y: 0.75 },
            
            // Button positions (relative to screen edges)
            leftTriggerPos: { x: 0.1, y: 0.1 },
            rightTriggerPos: { x: 0.9, y: 0.1 },
            leftShoulderPos: { x: 0.1, y: 0.2 },
            rightShoulderPos: { x: 0.9, y: 0.2 },
            rollButtonPos: { x: 0.5, y: 0.1 },
            
            // Override defaults
            ...config
        };
        
        // State tracking
        this.joystickStates = {
            left: { x: 0, y: 0, active: false, pointerId: -1 },
            right: { x: 0, y: 0, active: false, pointerId: -1 }
        };
        
        this.buttonStates = {
            leftTrigger: false,
            rightTrigger: false,
            leftShoulder: false,
            rightShoulder: false,
            roll: false
        };
        
        // Graphics containers
        this.container = null;
        this.joysticks = {};
        this.buttons = {};
        
        // Only create controls if touch is available
        if (this.isTouchDevice()) {
            this.createControls();
        }
    }
    
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    createControls() {
        console.log('TouchControlsOverlay2: Creating controls');
        
        // Add extra pointers for multitouch (supports up to 10 simultaneous touches)
        this.scene.input.addPointer(9);
        
        // Create main container at high depth
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(9999);
        this.container.setScrollFactor(0);
        
        // Create joysticks
        this.createJoystick('left');
        this.createJoystick('right');
        
        // Create buttons
        this.createButton('leftTrigger', 'LT');
        this.createButton('rightTrigger', 'RT');
        this.createButton('leftShoulder', 'LB');
        this.createButton('rightShoulder', 'RB');
        this.createButton('roll', 'ROLL');
        
        // Update positions on resize
        this.scene.scale.on('resize', this.updatePositions, this);
        this.updatePositions();
        
        // Add update handler to track pointers
        this.scene.events.on('update', this.update, this);
        
        console.log('TouchControlsOverlay2: Controls created successfully');
    }
    
    createJoystick(side) {
        const posConfig = side === 'left' ? 
            this.config.leftJoystickPos : 
            this.config.rightJoystickPos;
        
        // Create joystick base
        const base = this.scene.add.circle(
            0, 0,
            this.config.joystickRadius,
            this.config.joystickColor,
            this.config.opacity
        );
        base.setStrokeStyle(2, this.config.joystickColor);
        
        // Create joystick knob
        const knob = this.scene.add.circle(
            0, 0,
            this.config.joystickKnobRadius,
            this.config.joystickKnobColor,
            this.config.opacity
        );
        
        // Create container for this joystick
        const joystickContainer = this.scene.add.container(0, 0, [base, knob]);
        this.container.add(joystickContainer);
        
        // Store references
        this.joysticks[side] = {
            container: joystickContainer,
            base: base,
            knob: knob,
            posConfig: posConfig,
            worldX: 0,
            worldY: 0
        };
    }
    
    createButton(id, label) {
        // Handle special case for roll button
        const posConfigKey = id === 'roll' ? 'rollButtonPos' : id + 'Pos';
        const posConfig = this.config[posConfigKey];
        
        if (!posConfig) {
            console.error(`No position config found for button: ${id}`);
            return;
        }
        
        // Create button circle
        const button = this.scene.add.circle(
            0, 0,
            this.config.buttonSize,
            this.config.buttonColor,
            this.config.opacity
        );
        button.setStrokeStyle(2, this.config.buttonColor);
        
        // Add label
        const text = this.scene.add.text(0, 0, label, {
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        });
        text.setOrigin(0.5);
        
        // Create container
        const buttonContainer = this.scene.add.container(0, 0, [button, text]);
        this.container.add(buttonContainer);
        
        // Store reference
        this.buttons[id] = {
            container: buttonContainer,
            button: button,
            text: text,
            posConfig: posConfig,
            worldX: 0,
            worldY: 0,
            radius: this.config.buttonSize,
            pointerId: -1
        };
    }
    
    updatePositions() {
        const { width, height } = this.scene.scale;
        
        // Position joysticks and store world positions
        Object.entries(this.joysticks).forEach(([side, joystick]) => {
            const x = joystick.posConfig.x * width;
            const y = joystick.posConfig.y * height;
            joystick.container.setPosition(x, y);
            joystick.worldX = x;
            joystick.worldY = y;
        });
        
        // Position buttons and store world positions
        Object.entries(this.buttons).forEach(([id, button]) => {
            if (button.posConfig) {
                const x = button.posConfig.x * width;
                const y = button.posConfig.y * height;
                button.container.setPosition(x, y);
                button.worldX = x;
                button.worldY = y;
            }
        });
    }
    
    /**
     * Update method called every frame to track pointer positions
     */
    update() {
        // Get all pointers
        const pointers = [
            this.scene.input.pointer1,
            this.scene.input.pointer2,
            this.scene.input.pointer3,
            this.scene.input.pointer4,
            this.scene.input.pointer5,
            this.scene.input.pointer6,
            this.scene.input.pointer7,
            this.scene.input.pointer8,
            this.scene.input.pointer9,
            this.scene.input.pointer10
        ];
        
        // Update joysticks
        this.updateJoystick('left', pointers);
        this.updateJoystick('right', pointers);
        
        // Update buttons
        this.updateButtons(pointers);
    }
    
    updateJoystick(side, pointers) {
        const joystick = this.joysticks[side];
        const state = this.joystickStates[side];
        const { base, knob, worldX, worldY } = joystick;
        
        // Check if we already have an active pointer for this joystick
        if (state.pointerId >= 0) {
            const pointer = pointers[state.pointerId - 1];
            if (pointer && pointer.isDown) {
                // Continue tracking this pointer
                const dx = pointer.x - worldX;
                const dy = pointer.y - worldY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.config.joystickRadius * 1.5) {
                    // Still within range, update position
                    this.setJoystickPosition(side, dx, dy);
                    return;
                }
            }
            // Pointer released or moved too far
            this.resetJoystick(side);
        }
        
        // Look for a new pointer within the joystick area
        for (let i = 0; i < pointers.length; i++) {
            const pointer = pointers[i];
            if (pointer.isDown) {
                const dx = pointer.x - worldX;
                const dy = pointer.y - worldY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.config.joystickRadius) {
                    // Check if this pointer is already used by another joystick
                    const otherSide = side === 'left' ? 'right' : 'left';
                    if (this.joystickStates[otherSide].pointerId !== pointer.id) {
                        // Claim this pointer
                        state.pointerId = pointer.id;
                        state.active = true;
                        base.setAlpha(this.config.activeOpacity);
                        knob.setAlpha(this.config.activeOpacity);
                        this.setJoystickPosition(side, dx, dy);
                        
                        console.log(`TouchControlsOverlay2: ${side} joystick activated by pointer ${pointer.id}`);
                        break;
                    }
                }
            }
        }
    }
    
    setJoystickPosition(side, dx, dy) {
        const joystick = this.joysticks[side];
        const state = this.joystickStates[side];
        const { knob } = joystick;
        
        // Calculate distance and limit to radius
        const distance = Math.sqrt(dx * dx + dy * dy);
        const limitedDistance = Math.min(distance, this.config.joystickRadius);
        
        // Calculate limited position
        let knobX = 0, knobY = 0;
        if (distance > 0) {
            knobX = (dx / distance) * limitedDistance;
            knobY = (dy / distance) * limitedDistance;
        }
        
        // Update knob position
        knob.setPosition(knobX, knobY);
        
        // Update state with normalized values (-1 to 1)
        state.x = knobX / this.config.joystickRadius;
        state.y = knobY / this.config.joystickRadius;
        
        // Log significant movements
        if (Math.abs(state.x) > 0.1 || Math.abs(state.y) > 0.1) {
            console.log(`TouchControlsOverlay2: ${side} joystick at (${state.x.toFixed(2)}, ${state.y.toFixed(2)})`);
        }
    }
    
    resetJoystick(side) {
        const joystick = this.joysticks[side];
        const state = this.joystickStates[side];
        const { base, knob } = joystick;
        
        // Reset visual state
        knob.setPosition(0, 0);
        base.setAlpha(this.config.opacity);
        knob.setAlpha(this.config.opacity);
        
        // Reset state
        state.x = 0;
        state.y = 0;
        state.active = false;
        state.pointerId = -1;
    }
    
    updateButtons(pointers) {
        // Check each button
        Object.entries(this.buttons).forEach(([id, button]) => {
            const wasPressed = this.buttonStates[id];
            let isPressed = false;
            
            // Check if button's current pointer is still down
            if (button.pointerId >= 0) {
                const pointer = pointers[button.pointerId - 1];
                if (pointer && pointer.isDown) {
                    const dx = pointer.x - button.worldX;
                    const dy = pointer.y - button.worldY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= button.radius) {
                        isPressed = true;
                    } else {
                        // Pointer moved away, release
                        button.pointerId = -1;
                    }
                } else {
                    // Pointer released
                    button.pointerId = -1;
                }
            }
            
            // If not pressed, check for new touches
            if (!isPressed) {
                for (let i = 0; i < pointers.length; i++) {
                    const pointer = pointers[i];
                    if (pointer.isDown) {
                        const dx = pointer.x - button.worldX;
                        const dy = pointer.y - button.worldY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= button.radius) {
                            // Check if pointer is already used
                            const pointerInUse = Object.values(this.buttons).some(b => 
                                b.pointerId === pointer.id && b !== button
                            );
                            
                            if (!pointerInUse) {
                                button.pointerId = pointer.id;
                                isPressed = true;
                                console.log(`TouchControlsOverlay2: Button ${id} pressed by pointer ${pointer.id}`);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Update button state and visuals
            this.buttonStates[id] = isPressed;
            
            if (isPressed && !wasPressed) {
                // Just pressed
                button.button.setFillStyle(this.config.buttonActiveColor, this.config.activeOpacity);
                button.button.setScale(0.9);
            } else if (!isPressed && wasPressed) {
                // Just released
                button.button.setFillStyle(this.config.buttonColor, this.config.opacity);
                button.button.setScale(1);
            }
        });
    }
    
    /**
     * Get current touch input state
     */
    getState() {
        return {
            leftStick: { ...this.joystickStates.left },
            rightStick: { ...this.joystickStates.right },
            buttons: { ...this.buttonStates }
        };
    }
    
    /**
     * Show/hide controls
     */
    setVisible(visible) {
        if (this.container) {
            this.container.setVisible(visible);
        }
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.container) {
            this.container.destroy();
        }
        
        // Remove event listeners
        this.scene.scale.off('resize', this.updatePositions, this);
        this.scene.events.off('update', this.update, this);
    }
}