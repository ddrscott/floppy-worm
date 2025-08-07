import Phaser from 'phaser';

/**
 * TouchControlsOverlay2 - Simplified virtual touch controls using global pointer tracking
 * 
 * Based on Phaser's multitouch example for more reliable input handling
 * Joysticks track touch input even when moved outside their visual bounds
 */
export default class TouchControlsOverlay {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            // Layout config
            joystickRadius: 60,
            joystickKnobRadius: 15,
            buttonSize: 48,
            opacity: 0.4,
            activeOpacity: 0.7,
            
            // Colors - match worm head/tail colors
            leftJoystickColor: 0xff6b6b,    // Head color (red)
            leftJoystickKnobColor: 0xff9999, // Lighter red
            rightJoystickColor: 0x74b9ff,   // Tail color (blue)
            rightJoystickKnobColor: 0x99ccff, // Lighter blue
            leftButtonColor: 0xff6b6b,      // Left buttons use head color
            leftButtonActiveColor: 0xff9999,
            rightButtonColor: 0x74b9ff,     // Right buttons use tail color
            rightButtonActiveColor: 0x99ccff,
            rollButtonColor: 0x44ff44,      // Roll button stays green
            rollButtonActiveColor: 0x66ff66,
            
            // Positioning (pixels from edges)
            padding: 30, // Default padding from screen edges
            joystickBottomOffset: 100, // Distance from bottom for joysticks
            
            // Button stacking above joysticks
            buttonStackSpacing: 10, // Space between stacked buttons
            buttonJoystickSpacing: 40, // Space between joystick and first button
            
            // Roll button position
            rollButtonTopOffset: 40, // Distance from top for roll button
            
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
        this.createButton('leftTrigger', 'Jmp');
        this.createButton('rightTrigger', 'Jmp');
        this.createButton('leftShoulder', 'LB');
        this.createButton('rightShoulder', 'RB');
        // this.createButton('roll', 'ROLL');
        
        // Update positions on resize
        this.scene.scale.on('resize', this.updatePositions, this);
        this.updatePositions();
        
        // Add update handler to track pointers
        this.scene.events.on('update', this.update, this);
        
        console.log('TouchControlsOverlay2: Controls created successfully');
    }
    
    createJoystick(side) {
        // Get colors based on side
        const baseColor = side === 'left' ? 
            this.config.leftJoystickColor : 
            this.config.rightJoystickColor;
        const knobColor = side === 'left' ? 
            this.config.leftJoystickKnobColor : 
            this.config.rightJoystickKnobColor;
        
        // Create joystick base
        const base = this.scene.add.circle(
            0, 0,
            this.config.joystickRadius,
            baseColor,
            this.config.opacity
        );
        base.setStrokeStyle(2, baseColor);
        
        // Create joystick knob
        const knob = this.scene.add.circle(
            0, 0,
            this.config.joystickKnobRadius,
            knobColor,
            this.config.opacity
        );
        base.setAlpha(this.config.opacity);
        knob.setAlpha(this.config.opacity);
        
        // Create container for this joystick
        const joystickContainer = this.scene.add.container(0, 0, [base, knob]);
        this.container.add(joystickContainer);
        
        // Store references
        this.joysticks[side] = {
            container: joystickContainer,
            base: base,
            knob: knob,
            side: side,
            worldX: 0,
            worldY: 0
        };
    }
    
    createButton(id, label) {
        // Determine button colors based on side
        let buttonColor, buttonActiveColor;
        if (id.includes('left') || id === 'leftTrigger' || id === 'leftShoulder') {
            buttonColor = this.config.leftButtonColor;
            buttonActiveColor = this.config.leftButtonActiveColor;
        } else if (id.includes('right') || id === 'rightTrigger' || id === 'rightShoulder') {
            buttonColor = this.config.rightButtonColor;
            buttonActiveColor = this.config.rightButtonActiveColor;
        } else {
            // Roll button or other
            buttonColor = this.config.rollButtonColor;
            buttonActiveColor = this.config.rollButtonActiveColor;
        }
        
        // Create button circle
        const button = this.scene.add.circle(
            0, 0,
            this.config.buttonSize,
            buttonColor,
            this.config.opacity
        );
        button.setStrokeStyle(2, buttonColor);
        
        // Add label
        const text = this.scene.add.text(0, 0, label, {
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        });
        text.setOrigin(0.5);
        
        // Create container
        const buttonContainer = this.scene.add.container(0, 0, [button, text]);
        this.container.add(buttonContainer);
        button.setAlpha(this.config.opacity);
        // Store reference
        this.buttons[id] = {
            container: buttonContainer,
            button: button,
            text: text,
            id: id,
            worldX: 0,
            worldY: 0,
            radius: this.config.buttonSize,
            pointerId: -1,
            buttonColor: buttonColor,
            buttonActiveColor: buttonActiveColor
        };
    }
    
    updatePositions() {
        const { width, height } = this.scene.scale;
        const padding = this.config.padding;
        
        // Position joysticks from bottom corners
        const leftJoystickX = padding + this.config.joystickRadius * 1.5;
        const rightJoystickX = width - padding - this.config.joystickRadius * 1.5;
        const joystickY = height - padding - this.config.joystickRadius * 1.5;
        
        Object.entries(this.joysticks).forEach(([side, joystick]) => {
            const x = side === 'left' ? leftJoystickX : rightJoystickX;
            const y = joystickY;
            
            joystick.container.setPosition(x, y);
            joystick.worldX = x;
            joystick.worldY = y;
        });
        
        // Position buttons stacked above joysticks
        Object.entries(this.buttons).forEach(([id, button]) => {
            let x, y;
            
            switch(id) {
                case 'leftTrigger':
                    x = leftJoystickX;
                    // Stack above joystick: joystick top - spacing - button radius
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize;
                    break;
                case 'rightTrigger':
                    x = rightJoystickX;
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize;
                    break;
                case 'leftShoulder':
                    x = leftJoystickX;
                    // Stack above trigger: trigger position - spacing - button radius
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize
                        - this.config.buttonStackSpacing - this.config.buttonSize * 2;
                    break;
                case 'rightShoulder':
                    x = rightJoystickX;
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize
                        - this.config.buttonStackSpacing - this.config.buttonSize * 2;
                    break;
                case 'roll':
                    x = width / 2;
                    y = this.config.rollButtonTopOffset;
                    break;
            }
            
            button.container.setPosition(x, y);
            button.worldX = x;
            button.worldY = y;
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
                // Continue tracking this pointer regardless of distance
                const dx = pointer.x - worldX;
                const dy = pointer.y - worldY;
                this.setJoystickPosition(side, dx, dy);
                return;
            }
            // Pointer released
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
                button.button.setFillStyle(button.buttonActiveColor, this.config.activeOpacity);
                button.button.setScale(0.9);
            } else if (!isPressed && wasPressed) {
                // Just released
                button.button.setFillStyle(button.buttonColor, this.config.opacity);
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
