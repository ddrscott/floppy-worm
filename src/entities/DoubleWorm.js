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
        this.impulseMultiplier = 0.002; // Multiplier for release impulse
        
        // Stick tracking for momentum
        this.leftStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        this.rightStickState = { x: 0, y: 0, prevX: 0, prevY: 0, velocity: { x: 0, y: 0 } };
        
        // Create anchor system
        this.createAnchors();
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
        if (this.config.showDebug) {
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
    }
    
    createSwingComponents() {
        // Create swing weight
        let swingY = this.segments[1].position.y;
        const swingWeight = this.matter.add.circle(
            this.segments[1].position.x, 
            swingY, 
            this.config.baseRadius * 3, 
            {
                name: 'swingWeight',
                density: 0.001,
                isSensor: true,
                render: {
                    visible: this.config.showDebug,
                }
            }
        );
        
        // Add flatten springs
        const flattenSprings = [];
        for (let i = 0; i < this.segments.length - 1; i++) {
            const segA = this.segments[i];
            const segB = this.segments[i + 1];
            
            const dx = segB.position.x - segA.position.x;
            const dy = segB.position.y - segA.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const spring = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                length: distance * 1.25,
                stiffness: this.config.flattenIdle,
                render: {
                    visible: true,
                    strokeStyle: '#ff6b6b',
                    lineWidth: 2,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, spring);
            flattenSprings.push(spring);
        }

        if (this.segments.length > 2) {
            const head = this.segments[0];
            const middle = this.segments[parseInt(this.segments.length / 2)];
            
            this.headSpring = this.createJumpSegment(head, middle);
        }

        if (this.segments.length > 2) {
            const middle = this.segments[parseInt(this.segments.length / 2)]
            const tail = this.segments[this.segments.length - 2];
            this.tailSpring = this.createJumpSegment(middle, tail);
        }
    }

    createJumpSegment(from, to) {
        const dx = to.position.x - from.position.x;
        const dy = to.position.y - from.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const spring = this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: distance,
            stiffness: this.config.jumpIdle,
            render: {
                visible: true,
                strokeStyle: '#74b9ff',
                lineWidth: 3,
            }
        });
        
        // this.Matter.World.add(this.matter.world.localWorld, spring);
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

    /**
     * Movement is based on swinging the weight of the worm around to generate momentum.
     * This is controlled by the left and right sticks of the gamepad.
     * When enough momentum is generated, it will naturally cause the worm to move or lift off.
     * There are lots of parameters to tweak to get the right feel.
     * The amount of movement is naturally constrainted by the degree of freedom of the sticks themselfs
     * and we should use the sticks values as a multiplier to the movement limits.
     * For instance, let's set the field of movement to 20 pixles radius then we read the
     * stick values as often as we can to compute it's velocity and when the stick snaps to 0,
     * we release and the force just does what it does.
     */
    updateMovement(delta) {
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
        
        // Update visual debug indicators
        if (this.config.showDebug && this.headRangeGraphics) {
            this.headRangeGraphics.clear();
            this.headRangeGraphics.lineStyle(1, 0x74b9ff, 0.3);
            this.headRangeGraphics.strokeCircle(this.headAnchorRest.x, this.headAnchorRest.y, this.anchorRadius);
            
            this.tailRangeGraphics.clear();
            this.tailRangeGraphics.lineStyle(1, 0xff6b6b, 0.3);
            this.tailRangeGraphics.strokeCircle(this.tailAnchorRest.x, this.tailAnchorRest.y, this.anchorRadius);
            
            // Update stick position indicators
            this.headStickIndicator.x = this.headAnchorRest.x + (this.leftStickState.x * this.anchorRadius);
            this.headStickIndicator.y = this.headAnchorRest.y + (this.leftStickState.y * this.anchorRadius);
            
            this.tailStickIndicator.x = this.tailAnchorRest.x + (this.rightStickState.x * this.anchorRadius);
            this.tailStickIndicator.y = this.tailAnchorRest.y + (this.rightStickState.y * this.anchorRadius);
        }
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
        
        // Apply impulse based on accumulated velocity directly to the segment
        const mass = segment.mass;
        const impulseX = stickState.velocity.x * this.impulseMultiplier * mass;
        const impulseY = stickState.velocity.y * this.impulseMultiplier * mass;

        this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
        
        // Update rest position to follow the attached segment
        restPos.x = segment.position.x;
        restPos.y = segment.position.y;
        
        // Update anchor position to follow segment (for visual consistency)
        this.matter.body.setPosition(anchor, segment.position);
    }
}
