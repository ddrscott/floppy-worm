import WormBase from './WormBase';

export default class DoubleWorm extends WormBase {
    constructor(scene, x, y, config = {}) {
        // Merge swing-specific config with base config
        const swingConfig = {
            flattenIdle: 0.000001,
            flattenStiffness: 0.5,
            jumpIdle: 0.000001,
            jumpStiffness: 0.05,
            ...config
        };
        
        super(scene, x, y, swingConfig);
        
        // Momentum control parameters
        this.anchorRadius = 45; // Maximum distance anchors can move from rest position
        this.anchorStiffness = 0.15; // Spring stiffness connecting anchors to worm
        this.anchorDamping = 0.05;
        this.velocityDamping = 0.1; // How quickly velocity decays
        this.impulseMultiplier = 0.00175; // Multiplier for release impulse
        
        // Stick tracking for momentum
        this.leftStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        this.rightStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        
        // Keyboard simulation config
        this.keyboardConfig = {
            maxDuration: 200, // milliseconds to reach full value
            curve: 2, // exponential curve (1 = linear, 2 = quadratic, etc)
            ...config.keyboardConfig
        };
        
        // Keyboard state tracking
        this.keyboardState = {
            left: { w: 0, a: 0, s: 0, d: 0 }, // WASD for left stick
            right: { up: 0, left: 0, down: 0, right: 0 } // Arrows for right stick
        };
        
        // Create anchor system
        this.createAnchors();

        if (this.segments.length > 2) {
            const head = this.segments[0];
            const middle = this.segments[this.segments.length - 2];
            this.headSpring = this.createJumpSegment(head, middle);
        }

        if (this.segments.length > 2) {
            const middle = this.segments[parseInt(this.segments.length * 0.33)];
            const tail = this.segments[this.segments.length - 1];
            this.tailSpring = this.createJumpSegment(middle, tail);
        }
    }
    
    createAnchors() {
        // Attach anchors 2 segments inward for better leverage
        const headAttachIndex = 1
        const tailAttachIndex = this.segments.length - 2;
        
        const headAttachSegment = this.segments[headAttachIndex];
        const tailAttachSegment = this.segments[tailAttachIndex];
        
        // Create head anchor
        this.headAnchor = this.matter.add.circle(
            headAttachSegment.position.x,
            headAttachSegment.position.y,
            5,
            {
                isSensor: true,
                density: 0.0001,
                render: {
                    fillStyle: '#74b9ff',
                    strokeStyle: '#3498db',
                    lineWidth: 2,
                    visible: this.config.showDebug
                }
            }
        );
        
        // Create tail anchor
        this.tailAnchor = this.matter.add.circle(
            tailAttachSegment.position.x,
            tailAttachSegment.position.y,
            5,
            {
                isSensor: true,
                density: 0.0001,
                render: {
                    fillStyle: '#ff6b6b',
                    strokeStyle: '#e74c3c',
                    lineWidth: 2,
                    visible: this.config.showDebug
                }
            }
        );
        
        // Connect anchors to inward segments with soft springs
        this.headConstraint = this.Matter.Constraint.create({
            bodyA: this.headAnchor,
            bodyB: headAttachSegment,
            stiffness: this.anchorStiffness,
            damping: this.anchorDamping,
            length: 0,
            render: {
                visible: this.config.showDebug,
                strokeStyle: '#74b9ff',
                lineWidth: 2
            }
        });
        
        this.tailConstraint = this.Matter.Constraint.create({
            bodyA: this.tailAnchor,
            bodyB: tailAttachSegment,
            stiffness: this.anchorStiffness,
            damping: this.anchorDamping,
            length: 0,
            render: {
                visible: this.config.showDebug,
                strokeStyle: '#ff6b6b',
                lineWidth: 2
            }
        });
        
        this.Matter.World.add(this.matter.world.localWorld, [this.headConstraint, this.tailConstraint]);
        
        // Store attachment indices and rest positions
        this.headAttachIndex = headAttachIndex;
        this.tailAttachIndex = tailAttachIndex;
        this.headAnchorRest = { x: headAttachSegment.position.x, y: headAttachSegment.position.y };
        this.tailAnchorRest = { x: tailAttachSegment.position.x, y: tailAttachSegment.position.y };
        
        // Create visual indicators for anchor range (debug)
        this.headRangeGraphics = this.scene.add.graphics();
        this.headRangeGraphics.lineStyle(1, 0x74b9ff, 0.3);
        this.headRangeGraphics.strokeCircle(this.headAnchorRest.x, this.headAnchorRest.y, this.anchorRadius);
        
        this.tailRangeGraphics = this.scene.add.graphics();
        this.tailRangeGraphics.lineStyle(1, 0xff6b6b, 0.3);
        this.tailRangeGraphics.strokeCircle(this.tailAnchorRest.x, this.tailAnchorRest.y, this.anchorRadius);
        
        // Create stick position indicators
        this.headStickIndicator = this.scene.add.graphics();
        this.headStickIndicator.fillStyle(0xff6b6b, 0.8);
        this.headStickIndicator.fillCircle(0, 0, 8);
        
        this.tailStickIndicator = this.scene.add.graphics();
        this.tailStickIndicator.fillStyle(0x74b9ff, 0.8);
        this.tailStickIndicator.fillCircle(0, 0, 8);
    }
    
    createSwingComponents() {
        
    }

    createJumpSegment(from, to) {
        const dx = to.position.x - from.position.x;
        const dy = to.position.y - from.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const spring = this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: distance * 1.75,
            stiffness: this.config.jumpIdle,
            render: {
                visible: true,
                strokeStyle: '#74b9ff',
                lineWidth: 3,
            }
        });
        
        this.Matter.World.add(this.matter.world.localWorld, spring);
        return spring;
    }
    
    
    update(delta) {
        // Call parent update for graphics
        super.update(delta);
    }
    
    // Override destroy to clean up swing components
    destroy() {
        // Clean up anchors
        if (this.headAnchor) {
            this.matter.world.remove(this.headAnchor);
        }
        if (this.tailAnchor) {
            this.matter.world.remove(this.tailAnchor);
        }
        if (this.headConstraint) {
            this.matter.world.remove(this.headConstraint);
        }
        if (this.tailConstraint) {
            this.matter.world.remove(this.tailConstraint);
        }
        
        // Clean up visual elements
        if (this.headRangeGraphics) {
            this.headRangeGraphics.destroy();
        }
        if (this.tailRangeGraphics) {
            this.tailRangeGraphics.destroy();
        }
        if (this.headStickIndicator) {
            this.headStickIndicator.destroy();
        }
        if (this.tailStickIndicator) {
            this.tailStickIndicator.destroy();
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
        } else {
            // Fall back to keyboard simulation
            leftStick = this.simulateStickFromKeyboard('left', delta);
            rightStick = this.simulateStickFromKeyboard('right', delta);
        }
        
        // Update stick states
        this.updateStickState(this.leftStickState, leftStick, deltaSeconds);
        this.updateStickState(this.rightStickState, rightStick, deltaSeconds);
        
        // Update anchor positions based on stick input
        this.updateAnchorPosition(this.headAnchor, this.headAnchorRest, this.leftStickState, deltaSeconds);
        this.updateAnchorPosition(this.tailAnchor, this.tailAnchorRest, this.rightStickState, deltaSeconds);
        
        // Handle triggers to stiffen springs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Left trigger stiffens head spring
        if (this.headSpring) {
            const baseStiffness = this.config.jumpIdle || 0.000001;
            const maxStiffness = this.config.jumpStiffness;
            this.headSpring.stiffness = baseStiffness + (leftTrigger * (maxStiffness - baseStiffness));
        }
        
        // Right trigger stiffens tail spring
        if (this.tailSpring) {
            const baseStiffness = this.config.jumpIdle || 0.000001;
            const maxStiffness = this.config.jumpStiffness;
            this.tailSpring.stiffness = baseStiffness + (rightTrigger * (maxStiffness - baseStiffness));
        }
        
    }
    updateStickDisplay() {
        this.headRangeGraphics.clear();
        this.headRangeGraphics.lineStyle(1, 0xff6b6b, 0.4);
        this.headRangeGraphics.strokeCircle(this.headAnchorRest.x, this.headAnchorRest.y, this.anchorRadius);
        
        this.tailRangeGraphics.clear();
        this.tailRangeGraphics.lineStyle(1, 0x74b9ff, 0.4);
        this.tailRangeGraphics.strokeCircle(this.tailAnchorRest.x, this.tailAnchorRest.y, this.anchorRadius);
        
        // Update stick position indicators
        this.headStickIndicator.x = this.headAnchorRest.x + (this.leftStickState.x * this.anchorRadius);
        this.headStickIndicator.y = this.headAnchorRest.y + (this.leftStickState.y * this.anchorRadius);
        
        this.tailStickIndicator.x = this.tailAnchorRest.x + (this.rightStickState.x * this.anchorRadius);
        this.tailStickIndicator.y = this.tailAnchorRest.y + (this.rightStickState.y * this.anchorRadius);
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
        
        // Velocity is change per second
        if (deltaSeconds > 0) {
            stickState.velocity.x = deltaX / deltaSeconds;
            stickState.velocity.y = deltaY / deltaSeconds;
        }
        
        // Apply damping to velocity (exponential decay over time)
        const dampingFactor = Math.pow(this.velocityDamping, deltaSeconds);
        stickState.velocity.x *= dampingFactor;
        stickState.velocity.y *= dampingFactor;
        
        // Detect release (stick returning to center)
        const wasActive = Math.abs(stickState.prevX) > 0.1 || Math.abs(stickState.prevY) > 0.1;
        const isActive = Math.abs(stickState.x) > 0.1 || Math.abs(stickState.y) > 0.1;
        
        if (wasActive && !isActive && !isKeyboardRelease) {
            // Stick was released - apply impulse only for gamepad, not keyboard
            stickState.released = true;
        } else {
            stickState.released = false;
        }
    }
    
    updateAnchorPosition(anchor, restPos, stickState) {
        if (!anchor) return;
        
        // Get the segment that this anchor is attached to
        const attachIndex = anchor === this.headAnchor ? this.headAttachIndex : this.tailAttachIndex;
        const segment = this.segments[attachIndex];
        
        // Update rest position to follow the attached segment
        restPos.x = segment.position.x;
        restPos.y = segment.position.y;
        
        // Apply position-based force when stick is active
        if (Math.abs(stickState.x) > 0.1 || Math.abs(stickState.y) > 0.1) {
            // Calculate target position based on stick input
            const targetX = restPos.x + (stickState.x * this.anchorRadius);
            const targetY = restPos.y + (stickState.y * this.anchorRadius);
            
            // Calculate force toward target position
            const dx = targetX - segment.position.x;
            const dy = targetY - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0.1) {
                // Apply force proportional to distance
                const forceMagnitude = distance * 0.0002;
                const forceX = (dx / distance) * forceMagnitude;
                const forceY = (dy / distance) * forceMagnitude;
                
                this.matter.body.applyForce(segment, segment.position, { x: forceX, y: forceY });
            }
        }
        
        // Also apply velocity-based impulse continuously
        const mass = segment.mass;
        const impulseX = stickState.velocity.x * this.impulseMultiplier * mass;
        const impulseY = stickState.velocity.y * this.impulseMultiplier * mass;
        
        if (Math.abs(impulseX) > 0.00001 || Math.abs(impulseY) > 0.00001) {
            this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
        }
    }
    
    simulateStickFromKeyboard(stick, delta) {
        const keyboard = this.scene.input.keyboard;
        const state = this.keyboardState[stick];
        
        // Define key mappings
        const keyMap = stick === 'left' ? {
            up: 'W',
            left: 'A', 
            down: 'S',
            right: 'D'
        } : {
            up: 'UP',
            left: 'LEFT',
            down: 'DOWN', 
            right: 'RIGHT'
        };
        
        // Update key press durations
        const keys = keyboard.keys;
        
        // Check each direction
        const isUpPressed = keys[Phaser.Input.Keyboard.KeyCodes[keyMap.up]]?.isDown;
        const isLeftPressed = keys[Phaser.Input.Keyboard.KeyCodes[keyMap.left]]?.isDown;
        const isDownPressed = keys[Phaser.Input.Keyboard.KeyCodes[keyMap.down]]?.isDown;
        const isRightPressed = keys[Phaser.Input.Keyboard.KeyCodes[keyMap.right]]?.isDown;
        
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
}
