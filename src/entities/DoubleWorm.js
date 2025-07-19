import WormBase from './WormBase';

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
            
            // Anchor physics
            anchorRadius: 45,
            anchorStiffness: 0.15,
            anchorDamping: 0.05,
            anchorSensorRadius: 5,
            anchorDensity: 0.0001,
            
            // Movement physics
            velocityDamping: 0.1,
            impulseMultiplier: 0.00175,
            stickDeadzone: 0.05,
            positionForceMagnitude: 0.0002,
            minForceThreshold: 0.00001,
            minDistanceThreshold: 0.1,
            
            // Anti-flying parameters
            groundingForce: 0.01,
            groundingSegments: 0.2, // 50% of segments will receive grounding force
            groundingReactiveMultiplier: 0.5,
            groundingCenterWeight: 0.5,
            
            // Visual parameters
            stickIndicatorRadius: 8,
            rangeIndicatorAlpha: 0.4,
            rangeIndicatorLineWidth: 1,
            connectionDotRadius: 0.4,
            
            // Jump visual parameters
            jumpSpringLengthMultiplier: 1,
            jumpTriggerThreshold: 0.01,
            jumpStiffness: 0.025,

            // laser guidance
            laserLineWidth: 4,
            laserGlowWidth: 8,
            laserGlowAlpha: 0.5,
            laserLength: 200,
            laserArrowSize: 15,
            laserArrowOffset: 10,
            laserFadeDuration: 1000,
            
            // Attach points
            headAttachIndex: 1,
            tailAttachFromEnd: 2,
            tailSpringAttachPercent: 0.4,
            
            
            ...config
        };
        
        super(scene, x, y, swingConfig);
        
        // Copy config values to instance
        this.anchorRadius = swingConfig.anchorRadius;
        this.anchorStiffness = swingConfig.anchorStiffness;
        this.anchorDamping = swingConfig.anchorDamping;
        this.velocityDamping = swingConfig.velocityDamping;
        this.impulseMultiplier = swingConfig.impulseMultiplier;
        this.groundingForce = swingConfig.groundingForce;
        this.groundingSegments = swingConfig.groundingSegments;
        
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
        
        // Initialize anchor system
        this.anchors = {
            head: {
                body: null,
                constraint: null,
                attachIndex: swingConfig.headAttachIndex,
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: this.config.headColor,
                strokeColor: this.config.headStrokeColor,
                stickState: this.leftStickState
            },
            tail: {
                body: null,
                constraint: null,
                attachIndex: this.segments.length - swingConfig.tailAttachFromEnd,
                restPos: { x: 0, y: 0 },
                rangeGraphics: null,
                stickIndicator: null,
                color: this.config.tailColor,
                strokeColor: this.config.tailStrokeColor,
                stickState: this.rightStickState
            }
        };
        
        // Create anchor system
        this.createAnchors();

        // Initialize spring system
        this.springs = {
            head: {
                spring: null,
                attached: false,
                length: 0,
                laser: this.scene.add.graphics(),
                color: this.config.headColor,
                getSegments: () => ({
                    from: this.segments[0],
                    to: this.segments[this.segments.length - 2]
                })
            },
            tail: {
                spring: null,
                attached: false,
                length: 0,
                laser: this.scene.add.graphics(),
                color: this.config.tailColor,
                getSegments: () => ({
                    from: this.segments[this.segments.length - 1],
                    to: this.segments[1]
                })
            }
        };
        
        // Set laser depths
        Object.values(this.springs).forEach(springData => {
            springData.laser.setDepth(100);
        });
        
        // Calculate initial worm lengths for jump springs
        this.calculateInitialLengths();
    }
    
    createAnchors() {
        const constraints = [];
        
        Object.entries(this.anchors).forEach(([type, anchorData]) => {
            const attachSegment = this.segments[anchorData.attachIndex];
            
            // Create anchor body
            anchorData.body = this.matter.add.circle(
                attachSegment.position.x,
                attachSegment.position.y,
                this.config.anchorSensorRadius,
                {
                    isSensor: true,
                    density: this.config.anchorDensity,
                    render: {
                        fillStyle: this.colorToHex(anchorData.color),
                        strokeStyle: this.colorToHex(anchorData.strokeColor),
                        lineWidth: 2,
                        visible: this.config.showDebug
                    }
                }
            );
            
            // Create constraint
            anchorData.constraint = this.Matter.Constraint.create({
                bodyA: anchorData.body,
                bodyB: attachSegment,
                stiffness: this.anchorStiffness,
                damping: this.anchorDamping,
                length: 0,
                render: {
                    visible: this.config.showDebug,
                    strokeStyle: this.colorToHex(anchorData.color),
                    lineWidth: 2
                }
            });
            
            constraints.push(anchorData.constraint);
            
            // Store rest position
            anchorData.restPos.x = attachSegment.position.x;
            anchorData.restPos.y = attachSegment.position.y;
            
            // Create visual indicators
            anchorData.rangeGraphics = this.scene.add.graphics();
            anchorData.rangeGraphics.lineStyle(this.config.rangeIndicatorLineWidth, anchorData.color, this.config.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(anchorData.restPos.x, anchorData.restPos.y, this.anchorRadius);
            
            // Create stick position indicators
            anchorData.stickIndicator = this.scene.add.graphics();
            anchorData.stickIndicator.fillStyle(anchorData.color, 0.8);
            anchorData.stickIndicator.fillCircle(0, 0, this.config.stickIndicatorRadius);
        });
        
        // Add all constraints to the world
        this.Matter.World.add(this.matter.world.localWorld, constraints);
    }
    
    calculateInitialLengths() {
        if (this.segments.length > 2) {
            const segA = this.segments[0];
            const segB = this.segments[this.segments.length - 2];
            this.springs.head.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jumpSpringLengthMultiplier;
        }
        
        if (this.segments.length > 2) {
            const segA = this.segments[1];
            const segB = this.segments[this.segments.length - 1];
            this.springs.tail.length = Phaser.Math.Distance.BetweenPoints(segA.position, segB.position) * this.config.jumpSpringLengthMultiplier;
        }
    }

    createJumpSegment(from, to, length, stiffness) {
        const spring = this.Matter.Constraint.create({
            bodyA: from,
            bodyB: to,
            length: length,
            stiffness: stiffness,
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
        Object.values(this.anchors).forEach(anchorData => {
            if (anchorData.body) {
                this.matter.world.remove(anchorData.body);
            }
            if (anchorData.constraint) {
                this.matter.world.remove(anchorData.constraint);
            }
            if (anchorData.rangeGraphics) {
                anchorData.rangeGraphics.destroy();
            }
            if (anchorData.stickIndicator) {
                anchorData.stickIndicator.destroy();
            }
        });
        
        // Clean up jump springs if attached
        Object.values(this.springs).forEach(springData => {
            if (springData.spring && springData.attached) {
                this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
            }
            if (springData.laser) {
                springData.laser.destroy();
            }
        });
        
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
            
            // But also check keyboard and combine inputs
            const keyboardLeft = this.simulateStickFromKeyboard('left', delta);
            const keyboardRight = this.simulateStickFromKeyboard('right', delta);
            
            // Combine gamepad and keyboard inputs (take the one with larger magnitude)
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
            // Fall back to keyboard simulation only
            leftStick = this.simulateStickFromKeyboard('left', delta);
            rightStick = this.simulateStickFromKeyboard('right', delta);
        }
        
        // Update stick states
        this.updateStickState(this.leftStickState, leftStick, deltaSeconds);
        this.updateStickState(this.rightStickState, rightStick, deltaSeconds);
        
        // Update anchor positions based on stick input and collect applied forces
        const headForces = this.updateAnchorPosition('head', deltaSeconds);
        const tailForces = this.updateAnchorPosition('tail', deltaSeconds);
        
        // Handle triggers to attach/detach and stiffen springs
        const leftTrigger = pad && pad.buttons[6] ? pad.buttons[6].value : 0;
        const rightTrigger = pad && pad.buttons[7] ? pad.buttons[7].value : 0;
        
        // Always check keyboard keys for jump (works even with gamepad connected)
        const keyboard = this.scene.input.keyboard;
        const spacePressed = keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SPACE]?.isDown;
        const slashPressed = keyboard.keys[191]?.isDown ||
            keyboard.keys[Phaser.Input.Keyboard.KeyCodes.QUESTION_MARK]?.isDown || (keyboard.addKey && keyboard.addKey(191).isDown);
        
        // Left trigger or spacebar controls head spring
        const headTriggerValue = Math.max(leftTrigger, spacePressed ? 1.0 : 0);
        this.handleJumpSpring('head', headTriggerValue);
        
        // Right trigger or Q controls tail spring
        const tailTriggerValue = Math.max(rightTrigger, slashPressed ? 1.0 : 0);
        this.handleJumpSpring('tail', tailTriggerValue);
        
        // Apply grounding force to middle segments to prevent flying
        // Pass in the forces being applied to head and tail
        this.applyGroundingForce(headForces, tailForces);
    }
    
    applyGroundingForce(headForces, tailForces) {
        // Calculate total upward force being applied
        const totalUpwardForce = Math.abs(Math.min(0, (headForces?.y || 0) + (tailForces?.y || 0)));
        
        // If no upward forces, apply minimal grounding
        const baseGrounding = this.groundingForce;
        const reactiveGrounding = totalUpwardForce * this.config.groundingReactiveMultiplier;
        
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
                y: totalGrounding * (this.config.groundingCenterWeight + centerWeight * this.config.groundingCenterWeight)
            };
            
            this.matter.body.applyForce(segment, segment.position, force);
        }
    }
    updateStickDisplay() {
        Object.values(this.anchors).forEach(anchorData => {
            // Update range graphics
            anchorData.rangeGraphics.clear();
            anchorData.rangeGraphics.lineStyle(this.config.rangeIndicatorLineWidth, anchorData.color, this.config.rangeIndicatorAlpha);
            anchorData.rangeGraphics.strokeCircle(anchorData.restPos.x, anchorData.restPos.y, this.anchorRadius);
            
            // Update stick position indicators
            anchorData.stickIndicator.x = anchorData.restPos.x + (anchorData.stickState.x * this.anchorRadius);
            anchorData.stickIndicator.y = anchorData.restPos.y + (anchorData.stickState.y * this.anchorRadius);
        });
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
        
        // Velocity is change per second - but not on keyboard releases
        if (deltaSeconds > 0 && !isKeyboardRelease) {
            stickState.velocity.x = deltaX / deltaSeconds;
            stickState.velocity.y = deltaY / deltaSeconds;
        } else if (isKeyboardRelease) {
            // On keyboard release, zero out velocity to prevent snapback
            stickState.velocity.x = 0;
            stickState.velocity.y = 0;
        }
        
        // Apply damping to velocity (exponential decay over time)
        const dampingFactor = Math.pow(this.velocityDamping, deltaSeconds);
        stickState.velocity.x *= dampingFactor;
        stickState.velocity.y *= dampingFactor;
        
        // Detect release (stick returning to center)
        const wasActive = Math.abs(stickState.prevX) > this.config.stickDeadzone || Math.abs(stickState.prevY) > this.config.stickDeadzone;
        const isActive = Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone;
        
        if (wasActive && !isActive && !isKeyboardRelease) {
            // Stick was released - apply impulse only for gamepad, not keyboard
            stickState.released = true;
        } else {
            stickState.released = false;
        }
    }
    
    updateAnchorPosition(type, deltaSeconds) {
        const anchorData = this.anchors[type];
        if (!anchorData.body) return { x: 0, y: 0 };
        
        // Track total forces applied
        let totalForce = { x: 0, y: 0 };
        
        // Get the segment that this anchor is attached to
        const segment = this.segments[anchorData.attachIndex];
        const stickState = anchorData.stickState;
        const restPos = anchorData.restPos;
        
        // Update rest position to follow the attached segment
        restPos.x = segment.position.x;
        restPos.y = segment.position.y;
        
        // When stick is centered, move anchor to segment position to prevent pullback
        if (Math.abs(stickState.x) <= this.config.stickDeadzone && Math.abs(stickState.y) <= this.config.stickDeadzone) {
            this.Matter.Body.setPosition(anchorData.body, { x: segment.position.x, y: segment.position.y });
            this.Matter.Body.setVelocity(anchorData.body, { x: 0, y: 0 });
        }
        
        // Apply position-based force only when stick is actively moved
        if (Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone) {
            // Calculate target position based on stick input
            const targetX = restPos.x + (stickState.x * this.anchorRadius);
            const targetY = restPos.y + (stickState.y * this.anchorRadius);
            
            // Move anchor to target position
            this.Matter.Body.setPosition(anchorData.body, { x: targetX, y: targetY });
            
            // Calculate force toward target position
            const dx = targetX - segment.position.x;
            const dy = targetY - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.config.minDistanceThreshold) {
                // Apply force proportional to distance
                const forceMagnitude = distance * this.config.positionForceMagnitude;
                const forceX = (dx / distance) * forceMagnitude;
                const forceY = (dy / distance) * forceMagnitude;
                
                this.matter.body.applyForce(segment, segment.position, { x: forceX, y: forceY });
                totalForce.x += forceX;
                totalForce.y += forceY;
            }
        }
        // When stick is centered, don't apply any centering force - let the worm relax naturally
        
        // Apply velocity-based impulse only when stick is active and not on release
        if ((Math.abs(stickState.x) > this.config.stickDeadzone || Math.abs(stickState.y) > this.config.stickDeadzone) && !stickState.released) {
            const mass = segment.mass;
            const impulseX = stickState.velocity.x * this.impulseMultiplier * mass;
            const impulseY = stickState.velocity.y * this.impulseMultiplier * mass;
            
            if (Math.abs(impulseX) > this.config.minForceThreshold || Math.abs(impulseY) > this.config.minForceThreshold) {
                this.matter.body.applyForce(segment, segment.position, { x: impulseX, y: impulseY });
                totalForce.x += impulseX;
                totalForce.y += impulseY;
            }
        }
        
        return totalForce;
    }
    
    simulateStickFromKeyboard(stick, delta) {
        const keyboard = this.scene.input.keyboard;
        const state = this.keyboardState[stick];
        const kc = Phaser.Input.Keyboard.KeyCodes;
        
        // Check each direction using proper Phaser key checking
        let isUpPressed, isLeftPressed, isDownPressed, isRightPressed;
        
        if (stick === 'left') {
            // For WASD, try multiple ways to access the keys
            isUpPressed = keyboard.keys[kc.W]?.isDown || 
                         (this.scene.wasd && this.scene.wasd.W?.isDown) ||
                         keyboard.checkDown(keyboard.addKey(kc.W));
            isLeftPressed = keyboard.keys[kc.A]?.isDown || 
                           (this.scene.wasd && this.scene.wasd.A?.isDown) ||
                           keyboard.checkDown(keyboard.addKey(kc.A));
            isDownPressed = keyboard.keys[kc.S]?.isDown || 
                           (this.scene.wasd && this.scene.wasd.S?.isDown) ||
                           keyboard.checkDown(keyboard.addKey(kc.S));
            isRightPressed = keyboard.keys[kc.D]?.isDown || 
                            (this.scene.wasd && this.scene.wasd.D?.isDown) ||
                            keyboard.checkDown(keyboard.addKey(kc.D));
        } else {
            // Arrow keys work with standard method
            isUpPressed = keyboard.keys[kc.UP]?.isDown;
            isLeftPressed = keyboard.keys[kc.LEFT]?.isDown;
            isDownPressed = keyboard.keys[kc.DOWN]?.isDown;
            isRightPressed = keyboard.keys[kc.RIGHT]?.isDown;
        }
        
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
    
    showJumpTrajectory(type, fromSegment, toSegment) {
        const springData = this.springs[type];
        const laser = springData.laser;
        const color = springData.color;
        
        // Clear previous drawing
        laser.clear();
        
        // Calculate direction vector (from connection point to head/tail)
        const dx = toSegment.position.x - fromSegment.position.x;
        const dy = toSegment.position.y - fromSegment.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Normalize direction
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            // Calculate laser length inversely proportional to distance
            // When segments are close (compressed spring), laser is longer
            // When segments are far (extended spring), laser is shorter
            const springLength = this.springs[type].length;
            const compressionRatio = Math.max(0, Math.min(1, (springLength - distance) / springLength));
            // Laser length ranges from 1.1x to 1.5x the spring length
            const laserLength = springLength * (compressionRatio * 1.3);
            
            // Draw laser beam
            laser.lineStyle(this.config.laserLineWidth, color, 1);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add glow effect
            laser.lineStyle(this.config.laserGlowWidth, color, this.config.laserGlowAlpha);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(
                fromSegment.position.x + dirX * laserLength,
                fromSegment.position.y + dirY * laserLength
            );
            laser.strokePath();
            
            // Add arrow head at the end pointing in the direction of force
            const arrowSize = this.config.laserArrowSize;
            const arrowX = fromSegment.position.x + dirX * (laserLength - this.config.laserArrowOffset);
            const arrowY = fromSegment.position.y + dirY * (laserLength - this.config.laserArrowOffset);
            
            laser.fillStyle(color, 1);
            laser.beginPath();
            laser.moveTo(arrowX + dirX * arrowSize, arrowY + dirY * arrowSize);
            laser.lineTo(arrowX - dirY * arrowSize/2, arrowY + dirX * arrowSize/2);
            laser.lineTo(arrowX + dirY * arrowSize/2, arrowY - dirX * arrowSize/2);
            laser.closePath();
            laser.fillPath();
            
            // Fade out the laser
            laser.alpha = 1;
            this.scene.tweens.add({
                targets: laser,
                alpha: 0,
                duration: this.config.laserFadeDuration,
                ease: 'Linear',
                onComplete: () => {
                    laser.clear();
                }
            });
        }
    }
    
    handleJumpSpring(type, triggerValue) {
        const threshold = this.config.jumpTriggerThreshold;
        const isActive = triggerValue > threshold;
        
        const springData = this.springs[type];
        if (!springData) return;
        
        if (isActive && !springData.attached) {
            this.attachSpring(type, triggerValue);
        } else if (!isActive && springData.attached) {
            this.detachSpring(type);
        } else if (isActive && springData.spring) {
            this.updateSpringStiffness(type, triggerValue);
        }
    }
    
    attachSpring(type, triggerValue) {
        const springData = this.springs[type];
        const segments = springData.getSegments();
        const stiffness = this.calculateStiffness(triggerValue);
        
        springData.spring = this.createJumpSegment(segments.from, segments.to, springData.length, stiffness);
        this.Matter.World.add(this.matter.world.localWorld, springData.spring);
        springData.attached = true;
        
        // Show jump trajectory from the connection point
        this.showJumpTrajectory(type, segments.to, segments.from);
    }
    
    detachSpring(type) {
        const springData = this.springs[type];
        
        if (springData.spring) {
            this.Matter.World.remove(this.matter.world.localWorld, springData.spring);
            springData.spring = null;
            springData.attached = false;
        }
    }
    
    updateSpringStiffness(type, triggerValue) {
        const springData = this.springs[type];
        if (springData.spring) {
            springData.spring.stiffness = this.calculateStiffness(triggerValue);
        }
    }
    
    calculateStiffness(triggerValue) {
        return triggerValue * this.config.jumpStiffness;
    }
}
