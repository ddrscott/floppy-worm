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
        
        // Anti-flying parameters
        this.groundingForce = config.groundingForce || 0.0003; // Downward force on middle segments
        this.groundingSegments = config.groundingSegments || 0.33; // Percentage of middle segments to apply force to
        
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

        // Initialize spring references (but don't attach them yet)
        this.headSpring = null;
        this.tailSpring = null;
        this.headSpringAttached = false;
        this.tailSpringAttached = false;
        
        // Calculate initial worm lengths for jump springs
        this.calculateInitialLengths();
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
    
    calculateInitialLengths() {
        // Calculate the initial straight length from head to attachment point
        if (this.segments.length > 2) {
            const head = this.segments[0];
            const headAttach = this.segments[this.segments.length - 2];
            
            let headLength = 0;
            for (let i = 0; i < this.segments.length - 2; i++) {
                const segA = this.segments[i];
                const segB = this.segments[i + 1];
                const dx = segB.position.x - segA.position.x;
                const dy = segB.position.y - segA.position.y;
                headLength += Math.sqrt(dx * dx + dy * dy);
            }
            this.headSpringLength = headLength * 1.25; // 80% of full length for some contraction
        }
        
        // Calculate the initial straight length from middle to tail
        if (this.segments.length > 2) {
            const tailAttachIndex = parseInt(this.segments.length * 0.33);
            
            let tailLength = 0;
            for (let i = tailAttachIndex; i < this.segments.length - 1; i++) {
                const segA = this.segments[i];
                const segB = this.segments[i + 1];
                const dx = segB.position.x - segA.position.x;
                const dy = segB.position.y - segA.position.y;
                tailLength += Math.sqrt(dx * dx + dy * dy);
            }
            this.tailSpringLength = tailLength * 1.25; // 80% of full length for some contraction
        }
    }

    createSwingComponents() {
        
    }

    createJumpSegment(from, to, length, stiffness) {
        const spring = this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: length,
            stiffness: stiffness || this.config.jumpIdle,
            render: {
                visible: true,
                strokeStyle: '#74b9ff',
                lineWidth: 3,
            }
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
        
        // Clean up jump springs if attached
        if (this.headSpring && this.headSpringAttached) {
            this.Matter.World.remove(this.matter.world.localWorld, this.headSpring);
        }
        if (this.tailSpring && this.tailSpringAttached) {
            this.Matter.World.remove(this.matter.world.localWorld, this.tailSpring);
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
        
        // Update anchor positions based on stick input and collect applied forces
        const headForces = this.updateAnchorPosition(this.headAnchor, this.headAnchorRest, this.leftStickState, deltaSeconds);
        const tailForces = this.updateAnchorPosition(this.tailAnchor, this.tailAnchorRest, this.rightStickState, deltaSeconds);
        
        // Handle triggers to attach/detach and stiffen springs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Left trigger controls head spring
        this.handleJumpSpring('head', leftTrigger);
        
        // Right trigger controls tail spring
        this.handleJumpSpring('tail', rightTrigger);
        
        // Apply grounding force to middle segments to prevent flying
        // Pass in the forces being applied to head and tail
        this.applyGroundingForce(headForces, tailForces);
    }
    
    applyGroundingForce(headForces, tailForces) {
        // Calculate total upward force being applied
        const totalUpwardForce = Math.abs(Math.min(0, (headForces?.y || 0) + (tailForces?.y || 0)));
        
        // If no upward forces, apply minimal grounding
        const baseGrounding = this.groundingForce;
        const reactiveGrounding = totalUpwardForce * 0.5; // Counter 50% of upward force
        
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
                y: totalGrounding * (0.5 + centerWeight * 0.5) // 50% to 100% force based on distance from center
            };
            
            this.matter.body.applyForce(segment, segment.position, force);
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
        if (!anchor) return { x: 0, y: 0 };
        
        // Track total forces applied
        let totalForce = { x: 0, y: 0 };
        
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
                totalForce.x += forceX;
                totalForce.y += forceY;
            }
        }
        
        // Also apply velocity-based impulse continuously
        const mass = segment.mass;
        const impulseX = stickState.velocity.x * this.impulseMultiplier * mass;
        const impulseY = stickState.velocity.y * this.impulseMultiplier * mass;
        
        if (Math.abs(impulseX) > 0.00001 || Math.abs(impulseY) > 0.00001) {
            this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
            totalForce.x += impulseX;
            totalForce.y += impulseY;
        }
        
        return totalForce;
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
    
    handleJumpSpring(type, triggerValue) {
        const threshold = 0.1; // Minimum trigger value to activate
        const isActive = triggerValue > threshold;
        
        if (type === 'head') {
            if (isActive && !this.headSpringAttached) {
                // Create and attach head spring
                const head = this.segments[0];
                const middle = this.segments[this.segments.length - 2];
                const stiffness = this.config.jumpIdle + (triggerValue * (this.config.jumpStiffness - this.config.jumpIdle));
                
                this.headSpring = this.createJumpSegment(head, middle, this.headSpringLength, stiffness);
                this.Matter.World.add(this.matter.world.localWorld, this.headSpring);
                this.headSpringAttached = true;
            } else if (!isActive && this.headSpringAttached) {
                // Remove head spring
                if (this.headSpring) {
                    this.Matter.World.remove(this.matter.world.localWorld, this.headSpring);
                    this.headSpring = null;
                    this.headSpringAttached = false;
                }
            } else if (isActive && this.headSpring) {
                // Update stiffness based on trigger pressure
                const stiffness = this.config.jumpIdle + (triggerValue * (this.config.jumpStiffness - this.config.jumpIdle));
                this.headSpring.stiffness = stiffness;
            }
        } else if (type === 'tail') {
            if (isActive && !this.tailSpringAttached) {
                // Create and attach tail spring
                const middle = this.segments[parseInt(this.segments.length * 0.33)];
                const tail = this.segments[this.segments.length - 1];
                const stiffness = this.config.jumpIdle + (triggerValue * (this.config.jumpStiffness - this.config.jumpIdle));
                
                this.tailSpring = this.createJumpSegment(middle, tail, this.tailSpringLength, stiffness);
                this.Matter.World.add(this.matter.world.localWorld, this.tailSpring);
                this.tailSpringAttached = true;
            } else if (!isActive && this.tailSpringAttached) {
                // Remove tail spring
                if (this.tailSpring) {
                    this.Matter.World.remove(this.matter.world.localWorld, this.tailSpring);
                    this.tailSpring = null;
                    this.tailSpringAttached = false;
                }
            } else if (isActive && this.tailSpring) {
                // Update stiffness based on trigger pressure
                const stiffness = this.config.jumpIdle + (triggerValue * (this.config.jumpStiffness - this.config.jumpIdle));
                this.tailSpring.stiffness = stiffness;
            }
        }
    }
}
