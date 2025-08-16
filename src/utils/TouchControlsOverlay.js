import Phaser from 'phaser';

/**
 * TouchControlsOverlay - Virtual touch controls with tap-to-jump support
 * 
 * Features:
 * - Dual joysticks: drag for movement, tap for jump
 * - Shoulder buttons (LB/RB) for grab actions
 * - Multitouch support for simultaneous inputs
 * - Visual feedback with color-coded controls (red=left/head, blue=right/tail)
 * 
 * Controls:
 * - Left/Right Joystick: Drag to move segments, tap to trigger jump
 * - LB/RB Buttons: Grab/release actions
 */
export default class TouchControlsOverlay {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.menuButtonCallback = config.onMenuPress || null;
        this.config = {
            // Layout config
            joystickRadius: 90,
            joystickKnobRadius: 15,
            buttonSize: 36,
            opacity: 0.3,
            activeOpacity: 0.15,
            
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
            padding: 10, // Default padding from screen edges
            
            // Button stacking above joysticks
            buttonStackSpacing: 10, // Space between stacked buttons
            buttonJoystickSpacing: 20, // Space between joystick and first button (reduced for closer placement)
            
            // Roll button position (relative to right stick at 11 o'clock)
            rollButtonAngle: -50, // degrees (11 o'clock position: -150 degrees from right)
            rollButtonDistance: 140, // Distance from right joystick center
            
            // Override defaults
            ...config
        };
        
        // State tracking
        this.joystickStates = {
            left: { x: 0, y: 0, active: false, pointerId: 0, tapStartTime: 0, tapStartX: 0, tapStartY: 0 },
            right: { x: 0, y: 0, active: false, pointerId: 0, tapStartTime: 0, tapStartX: 0, tapStartY: 0 }
        };
        
        // Tap detection and power configuration
        this.tapMaxDuration = 300; // milliseconds
        this.tapMaxMovement = 0.15; // normalized movement threshold
        this.tapPowerConfig = {
            minPower: 0.1,   // Minimum jump power at center
            maxPower: 1.0,   // Maximum jump power at edge
            powerCurve: 1.2  // Exponential curve for power mapping
        };
        
        this.buttonStates = {
            leftTrigger: false,
            rightTrigger: false,
            leftShoulder: false,
            rightShoulder: false,
            roll: false,
            menu: false
        };
        
        // Graphics containers
        this.layer = null;  // Using Phaser layer instead of container
        this.joysticks = {};
        this.buttons = {};
        
        // Always create controls when instantiated (InputManager handles platform detection)
        this.createControls();
    }
    
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    createControls() {
        // Add extra pointers for multitouch (supports up to 10 simultaneous touches)
        this.scene.input.addPointer(9);
        
        // Create a layer for all touch controls
        // Layer automatically manages depth for all its children
        this.layer = this.scene.add.layer();
        // Set to very high depth - higher than minimap border (1001)
        this.layer.setDepth(10000);
        
        // Create joysticks
        this.createJoystick('left');
        this.createJoystick('right');
        
        // Create buttons
        this.createButton('leftShoulder', 'G');
        this.createButton('rightShoulder', 'G');
        this.createButton('roll', 'ROLL');
        
        // Don't create menu button here - it will be added by the game scene
        
        // Update positions on resize
        this.scene.scale.on('resize', this.updatePositions, this);
        this.updatePositions();
        
        // Add update handler to track pointers
        // Use preupdate to run before the scene's update
        this.scene.events.on('preupdate', this.update, this);
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
        base.setAlpha(this.config.opacity);
        base.setScrollFactor(0);
        
        // Create joystick knob
        const knob = this.scene.add.circle(
            0, 0,
            this.config.joystickKnobRadius,
            knobColor,
            this.config.opacity
        );
        knob.setAlpha(this.config.opacity);
        knob.setScrollFactor(0);
        
        // Add to layer instead of container
        this.layer.add([base, knob]);
        
        // Store references
        this.joysticks[side] = {
            base: base,
            knob: knob,
            side: side,
            worldX: 0,
            worldY: 0,
            baseX: 0,  // Store base position separately
            baseY: 0
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
        button.setAlpha(this.config.opacity);
        button.setScrollFactor(0);
        
        // Add label
        const text = this.scene.add.text(0, 0, label, {
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        });
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        
        // Add to layer
        this.layer.add([button, text]);
        // Store reference
        this.buttons[id] = {
            button: button,
            text: text,
            id: id,
            worldX: 0,
            worldY: 0,
            radius: this.config.buttonSize,
            pointerId: 0,
            buttonColor: buttonColor,
            buttonActiveColor: buttonActiveColor
        };
    }
    
    // Menu button creation removed - now handled by the game scene
    
    updatePositions() {
        const { width, height } = this.scene.scale;
        const { padding } = this.config;
        
        // Position joysticks from bottom corners
        const leftJoystickX = padding + this.config.joystickRadius * 1;
        const rightJoystickX = width - padding - this.config.joystickRadius * 1;
        const joystickY = height - padding - this.config.joystickRadius * 1;
        
        Object.entries(this.joysticks).forEach(([side, joystick]) => {
            const x = side === 'left' ? leftJoystickX : rightJoystickX;
            const y = joystickY;
            
            // Position base and knob
            joystick.base.setPosition(x, y);
            joystick.knob.setPosition(x, y);  // Knob starts at center
            
            // Store positions
            joystick.worldX = x;
            joystick.worldY = y;
            joystick.baseX = x;
            joystick.baseY = y;
        });
        
        // Position buttons stacked above joysticks
        Object.entries(this.buttons).forEach(([id, button]) => {
            let x, y;
            
            switch(id) {
                case 'leftShoulder':
                    x = leftJoystickX - this.config.padding * 2;
                    // Stack above joystick (closer now)
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize;
                    break;
                case 'rightShoulder':
                    x = rightJoystickX + this.config.padding * 2;
                    y = joystickY - this.config.joystickRadius - this.config.buttonJoystickSpacing - this.config.buttonSize;
                    break;
                case 'roll':
                    // Position at 11 o'clock relative to right joystick
                    const angleRad = (this.config.rollButtonAngle * Math.PI) / 180;
                    x = rightJoystickX + Math.cos(angleRad) * this.config.rollButtonDistance;
                    y = joystickY + Math.sin(angleRad) * this.config.rollButtonDistance;
                    break;
            }
            
            // Position button and text
            button.button.setPosition(x, y);
            if (button.text) {
                button.text.setPosition(x, y);
            }
            if (button.graphics) {
                button.graphics.setPosition(x, y);
            }
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
        const { base, knob, baseX, baseY, worldX, worldY } = joystick;
        
        // Check if we already have an active pointer for this joystick
        if (state.pointerId > 0) {
            const pointer = pointers[state.pointerId - 1];
            if (pointer && pointer.isDown) {
                // Continue tracking this pointer regardless of distance
                const dx = pointer.x - worldX;
                const dy = pointer.y - worldY;
                this.setJoystickPosition(side, dx, dy);
                
                // Update tap tracking - check if finger moved too much
                if (state.tapStartTime > 0) {
                    const fingerMovement = Math.sqrt(
                        Math.pow(pointer.x - state.tapStartX, 2) + 
                        Math.pow(pointer.y - state.tapStartY, 2)
                    );
                    // Cancel tap if finger moved too far
                    if (fingerMovement > this.config.joystickRadius * this.tapMaxMovement) {
                        state.tapStartTime = 0;
                    }
                }
                return;
            }
            // Pointer released - check for tap
            this.handleJoystickRelease(side);
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
                        // Record tap start info
                        state.tapStartTime = Date.now();
                        state.tapStartX = pointer.x;
                        state.tapStartY = pointer.y;
                        base.setAlpha(this.config.activeOpacity);
                        knob.setAlpha(this.config.activeOpacity);
                        this.setJoystickPosition(side, dx, dy);
                        break;
                    }
                }
            }
        }
    }
    
    handleJoystickRelease(side) {
        const state = this.joystickStates[side];
        
        // Check if this was a tap
        if (state.tapStartTime > 0) {
            const duration = Date.now() - state.tapStartTime;
            
            if (duration <= this.tapMaxDuration) {
                // Calculate distance from center for analog power
                const dx = state.tapStartX - this.joysticks[side].worldX;
                const dy = state.tapStartY - this.joysticks[side].worldY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const normalizedDistance = Math.min(1, distance / this.config.joystickRadius);
                
                // Apply power curve for better control
                const rawPower = Math.pow(normalizedDistance, this.tapPowerConfig.powerCurve);
                const power = this.tapPowerConfig.minPower + 
                             (this.tapPowerConfig.maxPower - this.tapPowerConfig.minPower) * rawPower;
                
                // Trigger jump with analog power
                const triggerButton = side === 'left' ? 'leftTrigger' : 'rightTrigger';
                this.simulateButtonPress(triggerButton, power);
            }
        }
        
        this.resetJoystick(side);
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
        
        // Update knob position (relative to base position)
        knob.setPosition(joystick.baseX + knobX, joystick.baseY + knobY);
        
        // Update state with normalized values (-1 to 1)
        state.x = knobX / this.config.joystickRadius;
        state.y = knobY / this.config.joystickRadius;
    }
    
    resetJoystick(side) {
        const joystick = this.joysticks[side];
        const state = this.joystickStates[side];
        const { base, knob } = joystick;
        
        // Reset visual state
        knob.setPosition(joystick.baseX, joystick.baseY);  // Return to base center
        base.setAlpha(this.config.opacity);
        knob.setAlpha(this.config.opacity);
        
        // Reset state
        state.x = 0;
        state.y = 0;
        state.active = false;
        state.pointerId = 0;
        state.tapStartTime = 0;
        state.tapStartX = 0;
        state.tapStartY = 0;
    }
    
    simulateButtonPress(buttonId, analogValue = 1.0) {
        // Don't simulate if already pressed (avoid conflicts with real presses)
        if (this.buttonStates[buttonId]) {
            return;
        }
        
        // Set the button state with analog value
        this.buttonStates[buttonId] = analogValue;
        
        // Note: No visual feedback needed since trigger buttons are not visible
        // Hold the button for 150ms to ensure it's detected by InputManager
        this.scene.time.delayedCall(150, () => {
            this.buttonStates[buttonId] = false;
        });
    }
    
    updateButtons(pointers) {
        // Check each button
        Object.entries(this.buttons).forEach(([id, button]) => {
            const wasPressed = this.buttonStates[id];
            
            // Skip updating if this button is being simulated
            // Check if the button was set by simulateButtonPress (no pointer assigned)
            if (this.buttonStates[id] && button.pointerId === 0) {
                // This button is being simulated, don't override its state
                return;
            }
            
            let isPressed = false;
            
            // Check if button's current pointer is still down
            if (button.pointerId > 0) {
                const pointer = pointers[button.pointerId - 1];
                if (pointer && pointer.isDown) {
                    const dx = pointer.x - button.worldX;
                    const dy = pointer.y - button.worldY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= button.radius) {
                        isPressed = true;
                    } else {
                        // Pointer moved away, release
                        button.pointerId = 0;
                    }
                } else {
                    // Pointer released
                    button.pointerId = 0;
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
        if (this.layer) {
            this.layer.setVisible(visible);
        }
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.layer) {
            this.layer.destroy();
        }
        
        // Remove event listeners
        this.scene.scale.off('resize', this.updatePositions, this);
        this.scene.events.off('preupdate', this.update, this);
    }
}
