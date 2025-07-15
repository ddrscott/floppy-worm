(() => {
    class TestWormScene extends Phaser.Scene {
        constructor() {
            super({ key: 'TestWormScene' });
        }

        create() {
            // Set world bounds
            this.matter.world.setBounds(0, 0, 800, 600);
            
            // Create dat.GUI
            this.gui = new dat.GUI();
            

            // Create room (floor and walls)
            const wallThickness = 20;
            
            // Floor
            this.matter.add.rectangle(400, 575, 800, wallThickness, { 
                isStatic: true,
                friction: 10,
                restitution: 0
            });
            
            // Left wall
            this.matter.add.rectangle(25, 300, wallThickness, 600, { 
                isStatic: true,
                friction: 10,
                restitution: 0.2
            });
            
            // Right wall
            this.matter.add.rectangle(775, 300, wallThickness, 600, { 
                isStatic: true,
                friction: 10,
                restitution: 0.2
            });

            // Target platform on left side
            this.platform = this.matter.add.rectangle(150, 300, 120, 20, {
                isStatic: true,
                friction: 15,
                restitution: 0.1
            });

            // Create worm with default config
            this.worm = this.createWorm(400, 100, 
                {
                    radius: 10,
                    segments: [0.85, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
                }
            );

            // Simple graphics update
            this.graphics = this.add.graphics();
            
            // Controls
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            // Setup GUI controls
            this.setupGUI();
            
            // Store original colors for visual feedback
            this.originalColors = this.worm.segments.map((seg, i) => {
                if (i === 0) {
                    return { fill: '#ff6b6b', stroke: '#ff4444' }; // Head (red)
                } else if (i < 3) {
                    return { fill: '#4ecdc4', stroke: '#2ca89a' }; // Neck (teal)
                } else {
                    return { fill: '#95e1d3', stroke: '#6bc5b8' }; // Body (light green)
                }
            });
        }
        
        setupGUI() {
            const movement = this.worm.movement;
            
            // Physics mode toggle
            this.gui.add(movement, 'useSimplePhysics').name('Use Simple Physics');
            
            // Simple physics folder
            const simpleFolder = this.gui.addFolder('Simple Physics');
            simpleFolder.add(movement, 'movementForce', 0.0001, 0.01).name('Movement Force').step(0.0001);
            simpleFolder.add(movement, 'upwardForce', 0.0001, 0.01).name('Upward Force').step(0.0001);
            simpleFolder.add(movement, 'bendTorque', 0, 0.5).name('Bend Torque').step(0.01);
            simpleFolder.add(movement, 'contractionForce', 0.01, 0.5).name('Contraction Force').step(0.01);
            simpleFolder.add(movement, 'straightenDamping', 0.8, 0.999).name('Straighten Damping').step(0.001);
            simpleFolder.open();
            
            // Complex physics folder
            const complexFolder = this.gui.addFolder('Complex Physics');
            complexFolder.add(movement, 'waveSpeed', 0.5, 10).name('Wave Speed');
            complexFolder.add(movement, 'waveAmplitude', 0, 1).name('Wave Amplitude (%)').step(0.05);
            complexFolder.add(movement, 'waveFrequency', 0.5, 4).name('Wave Frequency');
            complexFolder.add(movement, 'torqueMultiplier', 0.01, 2).name('Torque Strength');
            complexFolder.add(movement, 'velocityBoost', 0, 2).name('Velocity Boost');
            complexFolder.add(movement, 'weightLeanStrength', 0, 1).name('Weight Lean').step(0.05);
            
            // Friction folder
            const frictionFolder = this.gui.addFolder('Friction');
            frictionFolder.add(movement, 'frictionHigh', 1, 50).name('High Friction');
            frictionFolder.add(movement, 'frictionLow', 0.01, 5).name('Low Friction');
            
            // Physics folder
            const physicsFolder = this.gui.addFolder('Physics');
            physicsFolder.add(movement, 'contractionStrength', 0, 0.3).name('Contraction');
            physicsFolder.add(movement, 'damping', 0.8, 0.99).name('Damping');
            
            // Jump folder
            const jumpFolder = this.gui.addFolder('Jump');
            jumpFolder.add(movement, 'jumpStrategy', ['spiral', 'catapult', 'coil', 'wave', 'contraction']).name('Jump Strategy');
            jumpFolder.add(movement, 'jumpTorque', 10, 200).name('Jump Torque');
            jumpFolder.add(movement, 'spiralSpeed', 1, 10).name('Spiral Speed');
            jumpFolder.add(movement, 'coilTightness', 0.3, 1.5).name('Coil Tightness');
            
            // Debug
            const debugFolder = this.gui.addFolder('Debug');
            debugFolder.add(this.matter.config, 'debug').name('Show Debug').onChange(value => {
                this.matter.world.drawDebug = value;
            });
        }

        createWorm(x, y, config = {}) {
            // Default config
            const defaultConfig = {
                radius: 10,
                segments: [0.95, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.3, 0.3]
            };
            
            // Merge with provided config
            const { radius: baseRadius, segments: segmentSizes } = { ...defaultConfig, ...config };
            
            const segments = [];
            const constraints = [];
            const segmentRadii = [];
            
            // Create segments
            let currentY = y;
            for (let i = 0; i < segmentSizes.length; i++) {
                // Calculate radius based on percentage
                const radius = baseRadius * segmentSizes[i];
                segmentRadii.push(radius);
                
                // Create body
                const segment = this.matter.add.circle(x, currentY, radius, {
                    friction: 18,
                    frictionStatic: 0.8,
                    density: 0.1,
                    restitution: 0.01
                });
                
                segments.push(segment);
                
                // Position next segment
                if (i < segmentSizes.length - 1) {
                    const nextRadius = baseRadius * segmentSizes[i + 1];
                    currentY += radius + nextRadius + 3; // Small gap
                }
            }
            
            // Connect with constraints at tangent points
            const Matter = Phaser.Physics.Matter.Matter;
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                
                // Tangent points
                const radiusA = segmentRadii[i];
                const radiusB = segmentRadii[i + 1];
                
                const pointA = { x: 0, y: radiusA };  // Bottom of segA
                const pointB = { x: 0, y: -radiusB }; // Top of segB
                
                const constraint = Matter.Constraint.create({
                    bodyA: segA,
                    bodyB: segB,
                    pointA: pointA,
                    pointB: pointB,
                    length: 2, // Small gap between segments
                    stiffness: 0.9,
                    damping: 0.05
                });
                
                Matter.World.add(this.matter.world.localWorld, constraint);
                constraints.push(constraint);
            }
            
            // Movement parameters
            const movement = {
                time: 0,
                waveSpeed: 10,          // How fast the wave travels down the body
                waveAmplitude: 0.5,     // Percentage of base radius (0-1)
                waveFrequency: 4,       // Number of waves along the body
                direction: 0,           // Current movement direction (-1, 0, 1)
                upPressed: false,       // Whether up key is being pressed
                jumpPressed: false,     // Whether spacebar is being pressed
                contractionPhase: 0,    // For length modulation
                baseConstraintLengths: constraints.map(c => c.length),
                baseStiffness: constraints.map(c => c.stiffness),
                constraintAngles: new Array(constraints.length).fill(0),
                baseRadius: baseRadius, // Store base radius for amplitude calculation
                // Jump tracking
                lastJumpPressed: false, // Track spacebar state
                // Adjustable parameters
                torqueMultiplier: 2,
                frictionHigh: 20,
                frictionLow: 2,
                contractionStrength: 0.3,
                damping: 0.85,
                velocityBoost: 2,
                weightLeanStrength: 1,
                jumpStrength: 10,       // Not used anymore - kept for compatibility
                jumpTorque: 50,         // Torque strength for jumping
                jumpStrategy: 'spiral', // Jump strategy to use
                spiralSpeed: 3,         // Speed of spiral rotation
                coilTightness: 0.8,     // How tight to coil for coil jump
                // New simplified movement parameters
                movementForce: 0.015,   // Direct force strength (5x index.html's 0.003)
                upwardForce: 0.01,      // Upward force strength (5x index.html's 0.002)
                bendTorque: 0.6,        // Torque for bending (5x index.html's 0.12)
                contractionForce: 0.2,  // Muscular contraction force
                straightenDamping: 0.9, // Angular damping when straightening
                useSimplePhysics: true  // Toggle between simple and complex physics
            };
            
            return { segments, constraints, radii: segmentRadii, movement };
        }

        update() {
            // Clear graphics
            this.graphics.clear();
            
            // Draw platform
            this.graphics.fillStyle(0x8B4513); // Brown platform
            this.graphics.fillRect(90, 290, 120, 20);
            this.graphics.lineStyle(2, 0x654321);
            this.graphics.strokeRect(90, 290, 120, 20);
            
            
            // Draw worm
            this.worm.segments.forEach((segment, i) => {
                const radius = this.worm.radii[i];
                
                // Body color gradient - flash on jump
                let baseColor1 = { r: 255, g: 100, b: 100 };
                let baseColor2 = { r: 100, g: 255, b: 100 };
                
                // Flash yellow when jumping
                if (this.worm.movement.jumpPressed) {
                    baseColor1 = { r: 255, g: 255, b: 100 };
                    baseColor2 = { r: 255, g: 200, b: 50 };
                }
                
                
                const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    baseColor1,
                    baseColor2,
                    this.worm.segments.length,
                    i
                );
                
                this.graphics.fillStyle(
                    Phaser.Display.Color.GetColor(color.r, color.g, color.b)
                );
                this.graphics.fillCircle(segment.position.x, segment.position.y, radius);
                
                // Black outline
                this.graphics.lineStyle(1, 0x000000);
                this.graphics.strokeCircle(segment.position.x, segment.position.y, radius);
            });
            
            // Update movement direction based on input
            if (this.cursors.left.isDown) {
                this.worm.movement.direction = -1;
            } else if (this.cursors.right.isDown) {
                this.worm.movement.direction = 1;
            } else {
                this.worm.movement.direction *= 0.95; // Gradually stop
            }
            
            // Track if up is pressed for upward movement
            this.worm.movement.upPressed = this.cursors.up.isDown;
            
            // Track spacebar for jumping
            this.worm.movement.jumpPressed = this.spaceKey.isDown;
            
            // Update worm movement
            if (this.worm.movement.useSimplePhysics) {
                this.updateSimpleMovement();
            } else {
                this.updateWormMovement();
            }
            
            // TEST: Continuously straighten to verify algorithm
            // this.straightenWorm(this.worm.movement, Phaser.Physics.Matter.Matter);
        }
        
        updateWormMovement() {
            const movement = this.worm.movement;
            const Matter = Phaser.Physics.Matter.Matter;
            
            // Handle jumping - simple spacebar press detection
            if (movement.jumpPressed && !movement.lastJumpPressed) {
                this.executeJump(movement, Matter);
            }
            movement.lastJumpPressed = movement.jumpPressed;
            
            
            // Update time only when moving (old system)
            if (Math.abs(movement.direction) > 0.01) {
                movement.time += 0.016 * movement.waveSpeed;
            }
            
            // Apply segment physics with head-first wave propagation
            this.worm.segments.forEach((segment, i) => {
                // No velocity manipulation - pure torque only!
                
                // Angular velocity damping
                Matter.Body.setAngularVelocity(segment, segment.angularVelocity * movement.damping);
                
                // Reset friction to default when not moving
                if (Math.abs(movement.direction) < 0.01) {
                    segment.friction = 0.8;
                    segment.frictionStatic = 0.9;
                }
                
                // Calculate phase offset - REVERSED so wave starts at head
                const segmentRatio = i / this.worm.segments.length;
                const phaseOffset = segmentRatio * movement.waveFrequency * Math.PI * 2;
                
                // Only apply active movement when direction is pressed
                if (Math.abs(movement.direction) > 0.1) {
                    // Wave propagates from head to tail
                    const waveTime = movement.time - (segmentRatio * 2); // Delay increases towards tail
                    
                    // Lateral wave pattern
                    
                    // Head segment handling
                    if (i === 0) {
                        // First segment stays grounded and stable - no lateral forces
                        segment.torque = -segment.angle * 0.05; // Just keep it level
                        
                        // High friction for gripping
                        segment.friction = movement.frictionHigh;
                        segment.frictionStatic = movement.frictionHigh * 1.5;
                        
                        // Pure torque - no velocity manipulation!
                    } else if (i < 3) { // Neck segments (1-2)
                        // Base lean angle - throw weight in movement direction
                        const weightLean = movement.direction * movement.weightLeanStrength * (1 - i * 0.1);
                        
                        // Add wave motion on top of the lean
                        const amplitudeRadians = (movement.waveAmplitude * movement.baseRadius) / 15;
                        const waveMotion = Math.sin(waveTime) * amplitudeRadians * 0.5;
                        
                        const targetAngle = weightLean + waveMotion;
                        const torqueStrength = movement.torqueMultiplier * (2 - i * 0.3);
                        segment.torque = (targetAngle - segment.angle) * torqueStrength;
                        
                        // No velocity manipulation - use torque to influence movement
                        
                        // Friction based on weight commitment
                        const leanAmount = Math.abs(segment.angle);
                        const isLeaning = leanAmount > 0.1;
                        const leanDirection = Math.sign(segment.angle);
                        const movingInLeanDirection = (leanDirection * movement.direction) > 0;
                        
                        if (isLeaning && movingInLeanDirection) {
                            segment.friction = movement.frictionHigh * (1 + leanAmount);
                            segment.frictionStatic = movement.frictionHigh * (1.5 + leanAmount);
                            
                            // High friction when committed to movement provides forward motion
                        } else {
                            segment.friction = movement.frictionLow;
                            segment.frictionStatic = movement.frictionLow * 1.2;
                        }
                    } else {
                        // Body follows with weight shifting and delayed wave
                        // Progressive weight lean - decreases toward tail
                        const bodyLean = movement.direction * movement.weightLeanStrength * 0.7 * (1 - segmentRatio * 0.8);
                        
                        // Delayed wave motion
                        const amplitudeRadians = (movement.waveAmplitude * movement.baseRadius) / 15;
                        const delayedWave = Math.sin(waveTime - segmentRatio) * amplitudeRadians * 0.3;
                        
                        const targetAngle = bodyLean + delayedWave;
                        const torqueStrength = movement.torqueMultiplier * (1 - segmentRatio * 0.5);
                        segment.torque = (targetAngle - segment.angle) * torqueStrength;
                        
                        // Pure torque approach - no forces or velocity changes
                        
                        // Friction based on body weight commitment
                        const bodyLeanAmount = Math.abs(segment.angle);
                        const bodyLeanDirection = Math.sign(segment.angle);
                        const bodyMovingInLeanDirection = (bodyLeanDirection * movement.direction) > 0;
                        
                        if (bodyLeanAmount > 0.05 && bodyMovingInLeanDirection) {
                            // High friction when body is leaning into movement
                            segment.friction = movement.frictionHigh * (0.8 + bodyLeanAmount);
                            segment.frictionStatic = movement.frictionHigh * (1 + bodyLeanAmount);
                        } else {
                            // Low friction when transitioning or opposing lean
                            segment.friction = movement.frictionLow;
                            segment.frictionStatic = movement.frictionLow * 1.33;
                        }
                    }
                } else {
                    // Natural flopping - gentle restoring force
                    segment.torque = -segment.angle * 0.01;
                    
                    // Add slight random torque for organic movement
                    if (Math.random() < 0.01) {
                        segment.torque += (Math.random() - 0.5) * 0.005;
                    }
                }
            });
            
            // Constraint modulation and rotation for movement
            this.worm.constraints.forEach((constraint, i) => {
                if (Math.abs(movement.direction) > 0.1) {
                    const phase = (i / this.worm.constraints.length) * Math.PI * 2;
                    
                    // Length modulation for peristaltic motion
                    const lengthPhase = movement.contractionPhase + phase;
                    const contraction = Math.sin(lengthPhase) * movement.contractionStrength + 1;
                    constraint.length = movement.baseConstraintLengths[i] * contraction;
                    
                    // Stiffness wave for energy transfer
                    const stiffnessPhase = Math.sin(movement.time * 2 + phase);
                    constraint.stiffness = movement.baseStiffness[i] * (1 + stiffnessPhase * 0.3);
                    
                    // Apply rotational momentum between segments
                    if (constraint.bodyA && constraint.bodyB && movement.velocityBoost > 0) {
                        const rotationPhase = Math.sin(movement.time + phase * 2);
                        const torqueTransfer = rotationPhase * movement.velocityBoost * 0.1 * movement.direction;
                        constraint.bodyA.torque += torqueTransfer;
                        constraint.bodyB.torque -= torqueTransfer * 0.5;
                    }
                } else {
                    // Return to base when idle
                    constraint.length = movement.baseConstraintLengths[i];
                    constraint.stiffness = movement.baseStiffness[i] * 0.8;
                }
            });
            
            // Update contraction phase only when moving
            if (Math.abs(movement.direction) > 0.1) {
                movement.contractionPhase += 0.03;
            }
            
            // Head control - stronger influence for directional control
            const head = this.worm.segments[0];
            if (Math.abs(movement.direction) > 0.1) {
                // Head points in movement direction
                const targetHeadAngle = movement.direction * 0.3;
                head.torque += (targetHeadAngle - head.angle) * 0.1;
            } else if (Math.abs(head.angle) > 0.5) {
                // Stabilize when idle
                head.torque += -head.angle * 0.05;
            }
        }
        
        executeJump(movement, Matter) {
            // Try different jump strategies
            const strategy = movement.jumpStrategy || 'spiral';
            
            switch(strategy) {
                case 'spiral':
                    this.spiralJump(movement, Matter);
                    break;
                case 'catapult':
                    this.catapultJump(movement, Matter);
                    break;
                case 'coil':
                    this.coilJump(movement, Matter);
                    break;
                case 'wave':
                    this.compressionWaveJump(movement, Matter);
                    break;
                case 'contraction':
                    // Use the simple contraction mechanism
                    if (this.checkGroundContact()) {
                        this.applyContractionForces();
                    }
                    break;
                default:
                    this.spiralJump(movement, Matter);
            }
        }
        
        pushJump(movement, Matter) {
            // Simple physics: rotate all segments to "push" against the ground
            this.worm.segments.forEach((segment, i) => {
                // All segments rotate to push downward-backward
                const pushAngle = movement.direction * -0.3 - 0.5; // Angled down and back
                
                // Immediate strong rotation
                Matter.Body.setAngularVelocity(segment, pushAngle * movement.jumpTorque * 0.2);
                segment.torque = pushAngle * movement.jumpTorque;
                
                // Maximum ground friction for push-off
                segment.friction = 50;
                segment.frictionStatic = 50;
            });
            
            // After a brief moment, reduce friction to allow flight
            setTimeout(() => {
                this.worm.segments.forEach(segment => {
                    segment.friction = 8;
                    segment.frictionStatic = 0.9;
                });
            }, 100);
        }
        
        spiralJump(movement, Matter) {
            // Create a spiral motion that naturally lifts the worm
            this.worm.segments.forEach((segment, i) => {
                const segmentRatio = i / this.worm.segments.length;
                const phase = segmentRatio * Math.PI * 2;
                
                // Spiral rotation that progresses along the body
                const spiralAngle = Math.sin(phase) * movement.direction;
                const rotationSpeed = movement.spiralSpeed * (1 - segmentRatio * 0.5);
                
                // Apply torque in a spiral pattern
                segment.torque = spiralAngle * movement.jumpTorque * 0.5;
                Matter.Body.setAngularVelocity(segment, 
                    Math.cos(phase) * rotationSpeed * movement.jumpTorque * 0.01
                );
                
                // Alternating friction for grip
                if (i % 2 === 0) {
                    segment.friction = movement.frictionHigh * 2;
                    segment.frictionStatic = movement.frictionHigh * 3;
                } else {
                    segment.friction = movement.frictionLow;
                    segment.frictionStatic = movement.frictionLow;
                }
            });
        }
        
        catapultJump(movement, Matter) {
            // Use tail as counterweight, head launches up
            const midPoint = Math.floor(this.worm.segments.length / 2);
            
            this.worm.segments.forEach((segment, i) => {
                if (i < midPoint) {
                    // Front half: rotate upward
                    const frontRatio = i / midPoint;
                    const upwardAngle = -Math.PI/4 + (movement.direction * 0.2);
                    segment.torque = (upwardAngle - segment.angle) * movement.jumpTorque * (1 - frontRatio * 0.3);
                    
                    // Low friction for launch
                    segment.friction = movement.frictionLow;
                    segment.frictionStatic = movement.frictionLow;
                } else {
                    // Back half: slam down as counterweight
                    const backRatio = (i - midPoint) / (this.worm.segments.length - midPoint);
                    const downAngle = Math.PI/4;
                    segment.torque = (downAngle - segment.angle) * movement.jumpTorque * 1.5;
                    Matter.Body.setAngularVelocity(segment, downAngle * 2);
                    
                    // High friction for anchoring
                    segment.friction = movement.frictionHigh * 3;
                    segment.frictionStatic = movement.frictionHigh * 4;
                }
            });
        }
        
        coilJump(movement, Matter) {
            // Coil into a spring, then release
            const coilCenter = Math.floor(this.worm.segments.length * 0.3);
            
            this.worm.segments.forEach((segment, i) => {
                const distFromCenter = Math.abs(i - coilCenter);
                const coilPhase = i * movement.coilTightness;
                
                // Create coiling motion
                const targetAngle = Math.sin(coilPhase) * (1 - distFromCenter / this.worm.segments.length);
                segment.torque = (targetAngle - segment.angle) * movement.jumpTorque;
                
                // Oscillating angular velocity for spring effect
                const springVelocity = Math.cos(coilPhase * 2) * movement.jumpTorque * 0.02;
                Matter.Body.setAngularVelocity(segment, springVelocity);
                
                // Variable friction based on coil position
                if (Math.abs(targetAngle) > 0.5) {
                    segment.friction = movement.frictionHigh * 2;
                    segment.frictionStatic = movement.frictionHigh * 2.5;
                } else {
                    segment.friction = movement.frictionLow;
                    segment.frictionStatic = movement.frictionLow * 1.2;
                }
            });
            
            // Stiffen constraints for spring effect
            this.worm.constraints.forEach(constraint => {
                constraint.stiffness = 0.95;
            });
            
            // Restore after brief moment
            setTimeout(() => {
                this.worm.constraints.forEach((constraint, i) => {
                    constraint.stiffness = movement.baseStiffness[i];
                });
            }, 150);
        }
        
        compressionWaveJump(movement, Matter) {
            // Send a compression wave from tail to head
            const wavePosition = (Date.now() % 500) / 500; // 0 to 1 over 500ms
            
            this.worm.segments.forEach((segment, i) => {
                const segmentRatio = i / this.worm.segments.length;
                const waveDistance = Math.abs(segmentRatio - wavePosition);
                
                if (waveDistance < 0.3) {
                    // Segment is in the wave
                    const waveIntensity = 1 - (waveDistance / 0.3);
                    
                    // Compress by rotating perpendicular to body axis
                    const compressionAngle = (i % 2 === 0 ? 1 : -1) * waveIntensity;
                    segment.torque = compressionAngle * movement.jumpTorque;
                    
                    // High friction at wave point
                    segment.friction = movement.frictionHigh * (1 + waveIntensity * 2);
                    segment.frictionStatic = movement.frictionHigh * (1 + waveIntensity * 3);
                } else {
                    // Normal friction outside wave
                    segment.friction = movement.frictionLow;
                    segment.frictionStatic = movement.frictionLow * 1.5;
                }
            });
            
            // When wave reaches head, apply upward torque
            if (wavePosition > 0.8) {
                const head = this.worm.segments[0];
                head.torque = (-Math.PI/3 - head.angle) * movement.jumpTorque * 2;
            }
        }
        
        
        whipCrackJump(movement, Matter) {
            // Apply sequential angular impulses from tail to head
            // This creates a whip-like motion that propels the worm upward
            
            this.worm.segments.forEach((segment, i) => {
                const segmentRatio = i / this.worm.segments.length;
                
                // Timing: tail moves first, head moves last
                const delay = (1 - segmentRatio) * 0.1;
                const isActive = movement.jumpTimer < delay + 0.1;
                
                if (isActive) {
                    // Rotate segments in alternating directions for maximum effect
                    const rotationDirection = i % 2 === 0 ? 1 : -1;
                    const rotationStrength = movement.jumpTorque * (1 - segmentRatio * 0.5);
                    
                    // Set angular velocity directly for immediate response
                    Matter.Body.setAngularVelocity(segment, rotationDirection * rotationStrength * 0.3);
                    
                    // Also apply torque for continued motion
                    segment.torque = rotationDirection * rotationStrength * 0.5;
                    
                    // Maximum friction to convert rotation into upward motion
                    segment.friction = movement.frictionHigh * 5;
                    segment.frictionStatic = movement.frictionHigh * 5;
                }
            });
            
            // Stiffen constraints during jump for better energy transfer
            if (movement.jumpTimer < 0.2) {
                this.worm.constraints.forEach(constraint => {
                    constraint.stiffness = 0.95;
                });
            } else {
                // Restore normal stiffness
                this.worm.constraints.forEach((constraint, i) => {
                    constraint.stiffness = movement.baseStiffness[i];
                });
            }
            
            // Track jump progress
            movement.jumpTimer += 0.016;
            if (movement.jumpTimer > 0.3) {
                movement.jumpTimer = 0;
            }
        }
        
        updateSimpleMovement() {
            const movement = this.worm.movement;
            const Matter = Phaser.Physics.Matter.Matter;
            
            // Handle spacebar contraction
            if (movement.jumpPressed) {
                // Check if worm is on ground
                const isOnGround = this.checkGroundContact();
                
                if (isOnGround && !movement.lastJumpPressed) {
                    // Apply muscular contraction forces
                    this.applyContractionForces();
                }
                
                // Visual feedback - brighten colors
                this.worm.segments.forEach((segment, i) => {
                    if (i === 0) {
                        segment.render.fillStyle = '#ff9999'; // Bright red
                    } else if (i < 3) {
                        segment.render.fillStyle = '#6eddd6'; // Bright teal
                    } else {
                        segment.render.fillStyle = '#b5f1e3'; // Bright green
                    }
                });
            } else {
                // Reset colors
                this.worm.segments.forEach((segment, i) => {
                    const colors = this.originalColors[i];
                    segment.render.fillStyle = colors.fill;
                });
            }
            
            movement.lastJumpPressed = movement.jumpPressed;
            
            // Bend worm function (similar to index.html)
            const bendWormToDirection = (targetAngle, forceVector, kp = 1) => {
                // Apply to top 4 segments
                for (let i = 0; i < Math.min(4, this.worm.segments.length); i++) {
                    const segment = this.worm.segments[i];
                    
                    // Calculate angle difference
                    const currentAngle = segment.angle;
                    let angleDiff = targetAngle - currentAngle;
                    
                    // Normalize angle
                    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                    
                    // Apply torque (matching index.html exactly)
                    const torque = angleDiff * movement.bendTorque * kp;
                    
                    // Fade the effect from head to body (head=0, so give it priority)
                    const fadeMultiplier = (4 - i) / 4; // Higher for head (i=0)
                    Matter.Body.setAngularVelocity(segment, 
                        segment.angularVelocity * 0.9 + torque * (1 - fadeMultiplier * 0.7));
                    
                    // Apply force to head
                    if (i === 0 && forceVector) {
                        Matter.Body.applyForce(segment, segment.position, forceVector);
                    }
                }
            };
            
            // Handle directional input
            if (movement.direction < -0.1) {
                // Left - bend to face left and move left
                bendWormToDirection(-Math.PI / 2, { x: -movement.movementForce, y: 0 });
            } else if (movement.direction > 0.1) {
                // Right - bend to face right and move right
                bendWormToDirection(Math.PI / 2, { x: movement.movementForce, y: 0 });
            }
            
            if (movement.upPressed) {
                // Up - bend upward
                bendWormToDirection(Math.PI, { x: 0, y: -movement.upwardForce });
            }
            
            // Basic angular damping for all segments
            this.worm.segments.forEach(segment => {
                Matter.Body.setAngularVelocity(segment, 
                    segment.angularVelocity * movement.damping);
            });
        }
        
        checkGroundContact() {
            // Simple ground contact detection - check if any segment is near the ground
            const groundY = 565; // Approximate ground level based on game setup
            const tolerance = 15; // Distance tolerance
            
            for (let segment of this.worm.segments) {
                if (segment.position.y >= (groundY - tolerance)) {
                    return true;
                }
            }
            
            // Also check if near platform
            const platformY = 300;
            const platformX1 = 90;
            const platformX2 = 210;
            
            for (let segment of this.worm.segments) {
                if (segment.position.y >= (platformY - tolerance) && 
                    segment.position.y <= (platformY + tolerance) &&
                    segment.position.x >= platformX1 && 
                    segment.position.x <= platformX2) {
                    return true;
                }
            }
            
            return false;
        }
        
        applyContractionForces() {
            const movement = this.worm.movement;
            const Matter = Phaser.Physics.Matter.Matter;
            
            // Apply contraction forces between adjacent segments
            for (let i = 0; i < this.worm.segments.length - 1; i++) {
                const curr = this.worm.segments[i];
                const next = this.worm.segments[i + 1];
                
                // Vector from current to next
                const toNext = Matter.Vector.sub(next.position, curr.position);
                const direction = Matter.Vector.normalise(toNext);
                
                // Contract by pulling segments together
                const force = movement.contractionForce;
                
                // Equal and opposite forces
                Matter.Body.applyForce(curr, curr.position, 
                    Matter.Vector.mult(direction, force));
                Matter.Body.applyForce(next, next.position, 
                    Matter.Vector.mult(direction, -force));
                
                // Add upward component based on angle
                const angleFromHorizontal = Math.atan2(direction.y, direction.x);
                const upwardComponent = Math.abs(Math.sin(angleFromHorizontal)) * force;
                
                Matter.Body.applyForce(curr, curr.position, { x: 0, y: -upwardComponent * 0.5 });
                Matter.Body.applyForce(next, next.position, { x: 0, y: -upwardComponent * 0.5 });
            }
            
            // Also stiffen constraints temporarily
            this.worm.constraints.forEach(constraint => {
                constraint.stiffness = 0.95;
            });
            
            // Reset stiffness after a moment
            setTimeout(() => {
                this.worm.constraints.forEach((constraint, i) => {
                    constraint.stiffness = movement.baseStiffness[i];
                });
            }, 150);
        }
        
        straightenWorm(movement, Matter, torqueMultiplier = 1) {
            // Apply straightening torque to each segment
            for (let i = 1; i < this.worm.segments.length; i++) {
                const currentSegment = this.worm.segments[i];
                const previousSegment = this.worm.segments[i - 1];
                
                // Simple approach: each segment should match the angle of the previous segment
                const targetAngle = previousSegment.angle;
                
                // Calculate shortest angular distance
                let angleDiff = targetAngle - currentSegment.angle;
                // Normalize to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                // Apply torque proportional to angle difference
                const segmentRatio = i / this.worm.segments.length;
                const torqueStrength = torqueMultiplier * (1 - segmentRatio * 0.5); // Less strong at tail
                currentSegment.torque = angleDiff * torqueStrength;
                
                // Add damping to prevent oscillation
                currentSegment.angularVelocity *= 0.9;
                
                // For jumping, also set angular velocity
                if (torqueMultiplier > 10) {
                    const angularImpulse = angleDiff * 2 * (1 + segmentRatio);
                    Matter.Body.setAngularVelocity(currentSegment, angularImpulse);
                    
                    // High friction for jumping
                    currentSegment.friction = movement.frictionHigh * 3;
                    currentSegment.frictionStatic = movement.frictionHigh * 4;
                }
            }
            
            // Handle head segment
            const head = this.worm.segments[0];
            if (torqueMultiplier > 10) {
                // For jumping: point upward with slight direction
                const jumpAngle = -Math.PI/2 + (movement.direction * 0.3);
                const headAngleDiff = jumpAngle - head.angle;
                // Normalize
                const normalizedHeadDiff = Math.atan2(Math.sin(headAngleDiff), Math.cos(headAngleDiff));
                head.torque = normalizedHeadDiff * torqueMultiplier * 2;
                Matter.Body.setAngularVelocity(head, normalizedHeadDiff * 3);
            } else {
                // For testing: just keep head level
                head.torque = -head.angle * torqueMultiplier * 0.5;
            }
        }
    }

    // Game configuration
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        backgroundColor: '#87CEEB',
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: 1 },
                debug: true
            }
        },
        scene: TestWormScene
    };

    // Create game
    const game = new Phaser.Game(config);
})();
