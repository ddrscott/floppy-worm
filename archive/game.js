(() => {
    // Game configuration constants
    const config = {
        // Stage dimensions
        stageWidth: 1280,
        stageHeight: 800,
        viewportHeight: 800,

        // Ball properties
        ballRadius: 10,
        ballStartX: 640,
        ballStartY: 100, // Start near bottom with some space
        ballFriction: 0.95,      // Match original - very high friction
        ballStaticFriction: 0.95, // Match original
        ballBounce: 0.0,         // Match original - no bounce
        ballDensity: 0.005,      // Match original density
        worm: {
            segments: 13, // total segments
            segmentSpacing: 2.1, // multiplier of radius for spacing
            constraintStiffness: 0.8,  // Match original
            constraintDamping: 0.7,    // Match original
            head: {
                segments: 3,  // front of the array
                densityMultiplier: 0.1  // Very light head like original (0.0005/0.005)
            },
            body: {
            },
            tail: {
                segments: 3,  // back of the array
                frictionMultiplier: 1.0, // Same friction as original
                densityMultiplier: 1.1 // Very slight weight increase like original
            }
        },

        // Movement parameters
        movement: {
            torqueAmount: 0.1,      // Very strong torque for lifting
            angularDamping: 0.85,   // Slightly less damping
            maxLiftRatio: 0.002,    // Force as percentage of body weight (0.2%)
            forceDecayRate: 0.5,    // Exponential decay rate for force distribution
            horizontalForceMultiplier: 0.3  // Further reduce horizontal force to prevent sliding
        },

        // Straightening parameters
        straightening: {
            torqueMultiplier: 1.5, // Multiplier for torque when straightening
            damping: 0.5, // Higher damping when straightening
            contractionForce: 0.2 // Contraction force for spacebar
        },
        // Ground properties
        groundHeight: 50,
        groundColor: 0x2d3436,

        // Grid properties
        gridVerticalSpacing: 50,
        gridHorizontalSpacing: 100,
        gridColor: 0x333333,
        gridAlpha: 0.9,
        gridMarkerInterval: 1000,
        gridMarkerColor: '#666666',

        // Camera properties
        cameraLerp: 0.2,
        cameraDeadzonePercent: 0.12,

        // Physics
        gravityY: 1,  // Normal gravity
        airFriction: 0.01, // Normal air resistance

        // Platform properties
        platformWidth: 50, // Width of each platform block
        platformHeight: 20, // Height of each platform (doubled for better collision)
        platformVerticalSpacing: 75, // Vertical space between platform rows
        platformColors: [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe] // Different colors
    };

    class WormVariantsScene extends Phaser.Scene {
        constructor() {
            super({ key: 'WormVariantsScene' });
            this.wormVariants = [];
            this.wormLabels = [];
        }

        createBaseWorm(x, y, options = {}) {
            // Default options
            const defaults = {
                segmentCount: 11,
                headRadius: 8,
                neckRadius: 10,
                tailRadius: 4,
                segmentSpacing: 18,
                friction: 0.95,
                frictionStatic: 0.95,
                frictionAir: 0.01,
                density: 0.005,
                restitution: 0,
                slop: 0.01,
                inertia: Infinity,
                color: 0xFF6B6B,
                constraintStiffness: 0.8,
                constraintDamping: 0.1,
                constraintLengthMultiplier: 1.0,
                densityOverride: null, // Function to override density per segment
                constraintStiffnessOverride: null, // Function to override stiffness per constraint
                additionalSegmentOptions: {} // Additional options per segment
            };
            
            const opts = { ...defaults, ...options };
            const segments = [];
            const constraints = [];
            
            // Create segments
            let currentY = y;
            let currentX = x;
            for (let i = 0; i < opts.segmentCount; i++) {
                let radius;
                if (i === 0) {
                    radius = opts.headRadius;
                } else if (i === 1 || i === 2) {
                    radius = opts.neckRadius;
                } else {
                    const bodyProgress = (i - 2) / (opts.segmentCount - 3);
                    radius = opts.neckRadius - (bodyProgress * (opts.neckRadius - opts.tailRadius));
                }
                
                // Position segments with slight angle to prevent vertical start
                if (i > 0) {
                    const prevRadius = segments[i - 1].radius;
                    const gap = prevRadius + radius + 5;
                    // Add slight horizontal offset to create initial angle
                    currentX += gap * 0.15; // 15% horizontal offset
                    currentY += gap * 0.98; // 98% vertical offset
                }
                
                const segY = currentY;
                const segX = currentX;
                
                // Allow density override
                let density = opts.density;
                if (opts.densityOverride) {
                    density = opts.densityOverride(i, opts.segmentCount);
                }
                
                const segmentOptions = {
                    friction: opts.friction,
                    frictionStatic: opts.frictionStatic,
                    frictionAir: opts.frictionAir,
                    density: density,
                    restitution: opts.restitution,
                    slop: opts.slop,
                    inertia: opts.inertia,
                    ...opts.additionalSegmentOptions
                };
                
                const segment = this.matter.add.circle(segX, segY, radius, segmentOptions);
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(opts.color);
                graphics.lineStyle(1, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(segX, segY);
                
                segment.graphics = graphics;
                segment.radius = radius;
                segments.push(segment);
            }
            
            // Connect with constraints at tangent points
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                
                let stiffness = opts.constraintStiffness;
                if (opts.constraintStiffnessOverride) {
                    stiffness = opts.constraintStiffnessOverride(i, segments.length - 1);
                }
                
                // Calculate tangent points
                // Since segments are created vertically (along Y axis), we connect:
                // Point A is at the bottom of segA (positive Y in local coords)
                // Point B is at the top of segB (negative Y in local coords)
                const pointA = { x: 0, y: segA.radius };  // Bottom edge of segA
                const pointB = { x: 0, y: -segB.radius }; // Top edge of segB
                
                // We positioned segments with a 5 pixel gap between edges
                const tangentDistance = 5;
                
                // Create constraint using Matter.Constraint directly
                const Matter = Phaser.Physics.Matter.Matter;
                const constraint = Matter.Constraint.create({
                    bodyA: segA,
                    bodyB: segB,
                    pointA: pointA,
                    pointB: pointB,
                    length: tangentDistance * opts.constraintLengthMultiplier,
                    stiffness: stiffness,
                    damping: opts.constraintDamping
                });
                
                // Add to world
                Matter.World.add(this.matter.world.localWorld, constraint);
                constraints.push(constraint);
            }
            
            return { segments, constraints };
        }

        create() {
            // Set world bounds - increase height for more ceiling space
            this.matter.world.setBounds(0, 0, config.stageWidth, config.viewportHeight + 400);

            // Create grid background
            this.createGridBackground();

            // Create test platforms
            this.createTestPlatforms();

            // Create different worm variants
            this.createWormVariants();

            // Add info text
            this.add.text(20, 20, 'Worm Variants Test - Same Controls', {
                fontSize: '12px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            }).setScrollFactor(0);

            this.add.text(20, 50, 'Arrow Keys: Move All | WASD: Camera | Mouse Wheel: Scroll', {
                fontSize: '10px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            }).setScrollFactor(0);

            // Keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            
            // Scene switching
            this.input.keyboard.on('keydown-T', () => {
                this.scene.start('TestWormScene');
            });
            

            // Set camera without zoom and start at bottom where platforms are
            this.cameras.main.setZoom(1.0);
            this.cameras.main.setBounds(0, 0, config.stageWidth, config.viewportHeight + 400);
            this.cameras.main.scrollY = config.viewportHeight + 400 - config.viewportHeight; // Start at bottom
            
            // Camera scrolling with WASD keys 
            this.wasd = this.input.keyboard.addKeys('W,S,A,D');
            
            // Mouse wheel scrolling
            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
                this.cameras.main.scrollY += deltaY * 0.5;
            });
        }

        createTestPlatforms() {
            const platformY = 650;
            const centerX = config.stageWidth / 2;

            // Create one centered platform
            const platform = this.matter.add.rectangle(
                centerX,
                platformY,
                400,
                20,
                {
                    isStatic: true,
                    friction: 0.8,
                    frictionStatic: 1.0,
                    restitution: 0.0
                }
            );

            const visual = this.add.rectangle(centerX, platformY, 400, 20, 0x4ecdc4);
        }

        createWormVariants() {
            const startY = 150;
            const centerX = config.stageWidth / 2; // Center of screen
            
            // Just one worm: Original Torque-Spring Hybrid
            this.wormVariants.push({
                name: "Torque-Spring Hybrid",
                worm: this.createTorqueSpringHybridWorm(centerX, startY),
                color: 0xFF6B6B
            });

            // Add label for the worm
            this.wormVariants.forEach((variant, index) => {
                const label = this.add.text(0, 0, variant.name, {
                    fontSize: '16px',
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 6, y: 4 }
                });
                label.setOrigin(0.5, 1); // Center horizontally, bottom vertically
                this.wormLabels.push(label);
            });
        }

        createTorqueSpringHybridWorm(x, y) {
            const worm = this.createBaseWorm(x, y, {
                frictionAir: 0.008,
                slop: 0.005,
                color: 0xFF6B6B,
                constraintDamping: 0.15,  // Higher damping for more natural movement
                constraintStiffnessOverride: (i, total) => {
                    // Looser at head for torque control, tighter at body for spring response
                    return i < 2 ? 0.3 : 0.5;  // Lower stiffness overall
                }
            });
            
            return { ...worm, forceDistribution: 'torque-spring-hybrid' };
        }



        update() {
            // // Camera scrolling with WASD
            // const scrollSpeed = 5;
            // if (this.wasd.W.isDown) {
            //     this.cameras.main.scrollY -= scrollSpeed;
            // }
            // if (this.wasd.S.isDown) {
            //     this.cameras.main.scrollY += scrollSpeed;
            // }
            // if (this.wasd.A.isDown) {
            //     this.cameras.main.scrollX -= scrollSpeed;
            // }
            // if (this.wasd.D.isDown) {
            //     this.cameras.main.scrollX += scrollSpeed;
            // }
            // 
            // // Update all worm graphics and labels
            // this.wormVariants.forEach((variant, index) => {
            //     variant.worm.segments.forEach((segment, segIndex) => {
            //         if (segment.graphics) {
            //             segment.graphics.setPosition(segment.position.x, segment.position.y);
            //             segment.graphics.setRotation(segment.angle);
            //             
            //             // Visual feedback for ground contact
            //             if (variant.worm.groundContacts && variant.worm.groundContacts[segIndex]) {
            //                 segment.graphics.setAlpha(1.0);
            //             } else {
            //                 segment.graphics.setAlpha(0.7);
            //             }
            //         }
            //     });
            //     
            //     // Update label position to follow the head (first segment)
            //     const head = variant.worm.segments[0];
            //     if (head && this.wormLabels[index]) {
            //         this.wormLabels[index].setPosition(head.position.x, head.position.y - 40);
            //     }
            // });

            // // Apply controls to all worms
            // const left = this.cursors.left.isDown;
            // const right = this.cursors.right.isDown;
            // const up = this.cursors.up.isDown;

            // this.wormVariants.forEach(variant => {
            //     this.applyMovement(variant.worm, left, right, up);
            // });
        }

        applyMovement(worm, left, right, up) {
            const { segments, constraints, forceDistribution } = worm;
            
            // Initialize ground contact tracking if not present
            if (!worm.groundContacts) {
                worm.groundContacts = new Array(segments.length).fill(false);
            }
            
            // Check which segments are touching the ground
            const pairs = this.matter.world.engine.pairs.list;
            worm.groundContacts.fill(false);
            
            for (let pair of pairs) {
                segments.forEach((segment, index) => {
                    if ((pair.bodyA === segment || pair.bodyB === segment)) {
                        const otherBody = pair.bodyA === segment ? pair.bodyB : pair.bodyA;
                        if (otherBody.isStatic && pair.isActive) {
                            // Check if contact is from below
                            if (pair.collision && pair.collision.normal.y < -0.5) {
                                worm.groundContacts[index] = true;
                            }
                        }
                    }
                });
            }
            
            // Find the pivot point (lowest grounded segment)
            let pivotIndex = -1;
            for (let i = 0; i < worm.groundContacts.length; i++) {
                if (worm.groundContacts[i]) {
                    pivotIndex = i;
                    break;
                }
            }
            
            // Helper function for muscle-like contractions between segments
            const applyMuscleContraction = (indexA, indexB, contractionForce) => {
                if (indexA < 0 || indexB < 0 || indexA >= segments.length || indexB >= segments.length) return;
                
                const segA = segments[indexA];
                const segB = segments[indexB];
                
                // Calculate vector from A to B
                const dx = segB.position.x - segA.position.x;
                const dy = segB.position.y - segA.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // Normalize direction
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    // Apply forces
                    const forceX = dirX * contractionForce;
                    const forceY = dirY * contractionForce;
                    
                    this.matter.body.applyForce(segA, segA.position, { x: forceX, y: forceY });
                    this.matter.body.applyForce(segB, segB.position, { x: -forceX, y: -forceY });
                }
            };

            if (forceDistribution === 'torque-spring-hybrid') {
                // Original TSH: Torque-based movement without external forces
                if (left || right) {
                    // Apply torque to head segments for turning
                    const headCount = 4;
                    for (let i = segments.length - headCount; i < segments.length; i++) {
                        if (i >= 0) {
                            const segment = segments[i];
                            const targetAngle = left ? Math.PI / 2 : -Math.PI / 2; // 90° left or right
                            const currentAngle = segment.angle;
                            
                            let angleDiff = targetAngle - currentAngle;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                            
                            // Proportional torque
                            const torque = angleDiff * 0.15 * (1 - (i - segments.length + headCount) / headCount * 0.5);
                            this.matter.body.setAngularVelocity(segment, 
                                segment.angularVelocity * 0.9 + torque);
                        }
                    }
                    
                    // Wave motion through constraints
                    if (!worm.waveTime) worm.waveTime = 0;
                    worm.waveTime += 0.1;
                    
                    // Store original lengths if not already stored
                    if (!worm.originalLengths) {
                        worm.originalLengths = constraints.map(c => c.length);
                    }
                    
                    constraints.forEach((constraint, i) => {
                        const wave = Math.sin(worm.waveTime - i * 0.7) * 0.15;
                        const baseLength = worm.originalLengths[i];
                        const target = baseLength * (1 + wave);
                        constraint.length = constraint.length * 0.9 + target * 0.1;
                    });
                }
                if (up) {
                    // Torque-based upward movement
                    segments.forEach((segment, i) => {
                        const progress = i / (segments.length - 1);
                        // Create J-shape: horizontal at tail, vertical at head
                        let targetAngle;
                        if (progress < 0.3) {
                            targetAngle = 0; // Horizontal
                        } else {
                            const curveProgress = (progress - 0.3) / 0.7;
                            targetAngle = -Math.PI / 2 * curveProgress; // Curve to vertical
                        }
                        
                        const currentAngle = segment.angle;
                        let angleDiff = targetAngle - currentAngle;
                        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                        
                        const torque = angleDiff * 0.12;
                        this.matter.body.setAngularVelocity(segment, 
                            segment.angularVelocity * 0.85 + torque);
                    });
                    
                    // Contract constraints for rigidity
                    if (!worm.originalLengths) {
                        worm.originalLengths = constraints.map(c => c.length);
                    }
                    
                    constraints.forEach((constraint, i) => {
                        const progress = i / constraints.length;
                        const baseLength = worm.originalLengths[i];
                        const contractionFactor = progress < 0.5 ? 0.6 : 0.8; // Tighter in middle
                        const targetLength = baseLength * contractionFactor;
                        constraint.length = constraint.length * 0.9 + targetLength * 0.1;
                    });
                }
            }

            // Gentle restoration to natural length
            if (!worm.originalLengths) {
                worm.originalLengths = constraints.map(c => c.length);
            }
            
            constraints.forEach((c, i) => {
                const naturalLength = worm.originalLengths[i];
                c.length = c.length * 0.99 + naturalLength * 0.01;
            });
        }

        createGridBackground() {
            const graphics = this.add.graphics();
            graphics.lineStyle(1, config.gridColor, config.gridAlpha);

            for (let x = 0; x < config.stageWidth; x += config.gridVerticalSpacing) {
                graphics.lineBetween(x, 0, x, config.viewportHeight + 400);
            }

            for (let y = 0; y < config.viewportHeight + 400; y += config.gridHorizontalSpacing) {
                graphics.lineBetween(0, y, config.stageWidth, y);
            }
        }
    }

    // Game configuration
    const phaserConfig = {
        type: Phaser.AUTO,
        width: config.stageWidth,
        height: config.viewportHeight,
        parent: 'game-container',
        backgroundColor: '#1a1a1a',
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: config.gravityY },
                debug: true,
                enableSleeping: false,
                showDebug: true,
                showVelocity: true,
                showAngleIndicator: true,
                showSleeping: false,
                showIds: true,
                showBroadphase: false,
                showBounds: false,
                showAxes: true,
                showPositions: true,
                showAngleIndicator: true,
                showCollisions: true,
                showSeparations: true,
                showBody: true,
                showStaticBody: true,
                showInternalEdges: true,
                debugWireframes: true,
                debugShowBody: true,
                debugShowStaticBody: true,
                debugBodyColor: 0xff0000,
                debugBodyFillColor: 0xff0000,
                debugStaticBodyColor: 0x0000ff,
                debugShowJoint: true,
                debugJointColor: 0x00ff00,
                debugShowInternalEdges: true,
                //constraintIterations: 8,  // Higher for better constraint solving
                positionIterations: 12,   // Higher for better collision detection
                //velocityIterations: 0,    // Higher for better velocity resolution
            }
        },
        scene: [WormVariantsScene]
    };

    // Create game
    const game = new Phaser.Game(phaserConfig);
})();
