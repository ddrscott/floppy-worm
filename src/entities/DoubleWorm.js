import WormBase from './WormBase';

export default class DoubleWorm extends WormBase {
    constructor(scene, x, y, config = {}) {
        // Merge swing-specific config with base config
        const swingConfig = {
            flattenIdle: 0.000001,
            flattenStiffness: 0.5,
            jumpIdle: 0.000001,
            jumpStiffness: 0.06,
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
        
        // Create anchor system
        this.createAnchors();

        if (this.segments.length > 2) {
            const head = this.segments[0];
            const middle = this.segments[parseInt(this.segments.length * 0.66)];
            
            this.headSpring = this.createJumpSegment(head, middle);
        }

        if (this.segments.length > 2) {
            const middle = this.segments[parseInt(this.segments.length * 0.33)];
            const tail = this.segments[this.segments.length - 2];
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
        this.headStickIndicator.fillStyle(0x74b9ff, 0.8);
        this.headStickIndicator.fillCircle(0, 0, 8);
        
        this.tailStickIndicator = this.scene.add.graphics();
        this.tailStickIndicator.fillStyle(0xff6b6b, 0.8);
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
        if (!pad) return;
        
        const leftStick = pad.leftStick;
        const rightStick = pad.rightStick;
        const deltaSeconds = delta / 1000; // Convert to seconds
        
        // Update stick states
        this.updateStickState(this.leftStickState, leftStick, deltaSeconds);
        this.updateStickState(this.rightStickState, rightStick, deltaSeconds);
        
        // Update anchor positions based on stick input
        this.updateAnchorPosition(this.headAnchor, this.headAnchorRest, this.leftStickState, deltaSeconds);
        this.updateAnchorPosition(this.tailAnchor, this.tailAnchorRest, this.rightStickState, deltaSeconds);
        
        // Handle triggers to stiffen springs
        console.log('pad: ', pad);
        const leftTrigger = pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad.buttons[7] ? pad.buttons[7].value : 0;
        
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
        
        if (wasActive && !isActive) {
            // Stick was released - this is where we could apply impulse
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
}
