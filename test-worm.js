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
            
            // Setup GUI controls
            this.setupGUI();
        }
        
        setupGUI() {
            const movement = this.worm.movement;
            
            // Movement folder
            const movementFolder = this.gui.addFolder('Movement');
            movementFolder.add(movement, 'waveSpeed', 0.5, 10).name('Wave Speed');
            movementFolder.add(movement, 'waveAmplitude', 0, 1).name('Wave Amplitude (%)').step(0.05);
            movementFolder.add(movement, 'waveFrequency', 0.5, 4).name('Wave Frequency');
            movementFolder.add(movement, 'torqueMultiplier', 0.01, 2).name('Torque Strength');
            movementFolder.add(movement, 'velocityBoost', 0, 2).name('Velocity Boost');
            movementFolder.add(movement, 'weightLeanStrength', 0, 1).name('Weight Lean').step(0.05);
            movementFolder.open();
            
            // Friction folder
            const frictionFolder = this.gui.addFolder('Friction');
            frictionFolder.add(movement, 'frictionHigh', 1, 50).name('High Friction');
            frictionFolder.add(movement, 'frictionLow', 0.01, 5).name('Low Friction');
            frictionFolder.open();
            
            // Physics folder
            const physicsFolder = this.gui.addFolder('Physics');
            physicsFolder.add(movement, 'contractionStrength', 0, 0.3).name('Contraction');
            physicsFolder.add(movement, 'damping', 0.8, 0.99).name('Damping');
            
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
                    friction: 8,
                    frictionStatic: 0.8,
                    density: 0.15,
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
                contractionPhase: 0,    // For length modulation
                baseConstraintLengths: constraints.map(c => c.length),
                baseStiffness: constraints.map(c => c.stiffness),
                constraintAngles: new Array(constraints.length).fill(0),
                baseRadius: baseRadius, // Store base radius for amplitude calculation
                // Adjustable parameters
                torqueMultiplier: 2,
                frictionHigh: 20,
                frictionLow: 2,
                contractionStrength: 0.3,
                damping: 0.85,
                velocityBoost: 2,
                weightLeanStrength: 1
            };
            
            return { segments, constraints, radii: segmentRadii, movement };
        }

        update() {
            // Clear graphics
            this.graphics.clear();
            
            // Draw worm
            this.worm.segments.forEach((segment, i) => {
                const radius = this.worm.radii[i];
                
                // Body color gradient
                const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    { r: 255, g: 100, b: 100 },
                    { r: 100, g: 255, b: 100 },
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
            
            // Update worm movement
            this.updateWormMovement();
        }
        
        updateWormMovement() {
            const movement = this.worm.movement;
            const Matter = Phaser.Physics.Matter.Matter;
            
            // Update time only when moving
            if (Math.abs(movement.direction) > 0.01) {
                movement.time += 0.016 * movement.waveSpeed;
            }
            
            // Apply segment physics with head-first wave propagation
            this.worm.segments.forEach((segment, i) => {
                // Velocity limiting to prevent explosions
                const velocity = segment.velocity;
                const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
                if (speed > 10) {
                    Matter.Body.setVelocity(segment, {
                        x: (velocity.x / speed) * 10,
                        y: (velocity.y / speed) * 10
                    });
                }
                
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
                        
                        // Small forward push based on direction only
                        if (movement.velocityBoost > 0 && Math.abs(movement.direction) > 0.1) {
                            const currentVel = segment.velocity;
                            const pushForce = movement.velocityBoost * movement.direction * 0.3; // Gentle push
                            let newY = currentVel.y;
                            
                            // Only allow upward movement if up is pressed
                            if (!movement.upPressed) {
                                newY = Math.max(currentVel.y, 0);
                            }
                            
                            Matter.Body.setVelocity(segment, {
                                x: currentVel.x + pushForce * 0.05,
                                y: newY
                            });
                        }
                    } else if (i < 3) { // Neck segments (1-2)
                        // Base lean angle - throw weight in movement direction
                        const weightLean = movement.direction * movement.weightLeanStrength * (1 - i * 0.1);
                        
                        // Add wave motion on top of the lean
                        const amplitudeRadians = (movement.waveAmplitude * movement.baseRadius) / 15;
                        const waveMotion = Math.sin(waveTime) * amplitudeRadians * 0.5;
                        
                        const targetAngle = weightLean + waveMotion;
                        const torqueStrength = movement.torqueMultiplier * (2 - i * 0.3);
                        segment.torque = (targetAngle - segment.angle) * torqueStrength;
                        
                        // Handle vertical movement based on up key
                        if (!movement.upPressed) {
                            // Force neck to stay grounded during lateral movement
                            if (segment.position.y < 530) {
                                Matter.Body.setVelocity(segment, {
                                    x: segment.velocity.x,
                                    y: Math.max(segment.velocity.y + 0.6, 2)
                                });
                            }
                        }
                        
                        // Friction based on weight commitment
                        const leanAmount = Math.abs(segment.angle);
                        const isLeaning = leanAmount > 0.1;
                        const leanDirection = Math.sign(segment.angle);
                        const movingInLeanDirection = (leanDirection * movement.direction) > 0;
                        
                        if (isLeaning && movingInLeanDirection) {
                            segment.friction = movement.frictionHigh * (1 + leanAmount);
                            segment.frictionStatic = movement.frictionHigh * (1.5 + leanAmount);
                            
                            if (movement.velocityBoost > 0) {
                                const currentVel = segment.velocity;
                                const pushIntensity = leanAmount * 1.5;
                                const pushForce = movement.velocityBoost * movement.direction * pushIntensity;
                                let newY = currentVel.y;
                                
                                if (!movement.upPressed) {
                                    newY = Math.max(currentVel.y, 0);
                                }
                                
                                Matter.Body.setVelocity(segment, {
                                    x: currentVel.x + pushForce * 0.08,
                                    y: newY
                                });
                            }
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
                        
                        // Handle vertical movement for body segments
                        if (!movement.upPressed) {
                            // Keep body grounded during lateral movement
                            if (segment.position.y < 540) { // If above ground level
                                // Apply downward velocity
                                Matter.Body.setVelocity(segment, {
                                    x: segment.velocity.x,
                                    y: Math.max(segment.velocity.y + 0.5, 2) // Downward pull
                                });
                                
                                // Add weight when body is leaning
                                if (Math.abs(segment.angle) > 0.05) {
                                    const downwardForce = Math.abs(segment.angle) * 0.01;
                                    Matter.Body.applyForce(segment, segment.position, {
                                        x: 0,
                                        y: downwardForce
                                    });
                                }
                            }
                        }
                        
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
