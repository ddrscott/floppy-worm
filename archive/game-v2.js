(() => {
    // Platform level design - each character represents a 50x20 block
    // - = platform
    // . = empty space
    // Each row is 100 pixels apart vertically
    const levelData = `
        ---.....--....---
        .................
        ...--............
        .................
        .........----....
        .................
        .--..............
        .................
        ......----.......
        .................
        ..............--.
        .................
        .................
        .................
        .........--......
        .................
        .---.............
        .................
        ......--.........
        .................
        ..--......--.....
        .................
        ---...........---
    `;

    // Calculate stage height based on level data
    const levelRows = levelData.trim().split('\n').filter(row => row.trim().length > 0);
    const calculatedHeight = levelRows.length * 150 + 1000; // 150px per row + 2000px buffer

    // Game configuration constants
    const config = {
        // Stage dimensions
        stageWidth: 800,
        stageHeight: calculatedHeight,
        viewportHeight: 600,

        // Ball properties
        ballRadius: 10,
        ballStartX: 400,
        ballStartY: calculatedHeight - 1000, // Start near bottom with some space
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
        platformStartY: calculatedHeight - 100, // Starting Y position for platforms (much lower)
        platformVerticalSpacing: 75, // Vertical space between platform rows
        platformColors: [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe] // Different colors
    };

    class WormVariantsScene extends Phaser.Scene {
        constructor() {
            super({ key: 'WormVariantsScene' });
            this.wormVariants = [];
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

            this.add.text(20, 50, 'Arrow Keys: Move All | Space: Compress | WASD: Camera | Mouse Wheel: Scroll', {
                fontSize: '10px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            }).setScrollFactor(0);

            // Keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            // Scene switching
            this.input.keyboard.on('keydown-T', () => {
                this.scene.start('TestWormScene');
            });
            
            this.input.keyboard.on('keydown-F', () => {
                this.scene.start('FrictionTestScene');
            });
            
            this.input.keyboard.on('keydown-G', () => {
                this.scene.start('GameScene');
            });
            
            this.input.keyboard.on('keydown-V', () => {
                this.scene.start('WormVariantsScene');
            });

            // Zoom out camera to see all variants and center on platforms
            this.cameras.main.setZoom(0.6);
            this.cameras.main.setBounds(0, 0, config.stageWidth, config.viewportHeight + 400);
            this.cameras.main.centerOn(config.stageWidth / 2, 300); // Center between start and platforms
            
            // Camera scrolling with WASD keys 
            this.wasd = this.input.keyboard.addKeys('W,S,A,D');
            
            // Mouse wheel scrolling
            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
                this.cameras.main.scrollY += deltaY * 0.5;
            });
        }

        createTestPlatforms() {
            const platformY = 450;
            const platformAngle = Math.PI / 12; // 15 degrees
            const platformPositions = [150, 350, 550, 750]; // X positions

            // Create 4 platforms horizontally
            platformPositions.forEach(x => {
                const platform = this.matter.add.rectangle(
                    x,
                    platformY,
                    200,
                    20,
                    {
                        isStatic: true,
                        friction: 0.8,
                        frictionStatic: 1.0,
                        restitution: 0.0,
                        angle: platformAngle
                    }
                );

                const visual = this.add.rectangle(x, platformY, 200, 20, 0x4ecdc4);
                visual.setRotation(platformAngle);
            });
        }

        createWormVariants() {
            const startY = 150;  // Start 200px higher (was 350, now 150)
            const xPositions = [150, 350, 550, 750];
            
            // Variant 1: Distributed Force Model
            this.wormVariants.push({
                name: "Distributed Force",
                worm: this.createDistributedForceWorm(xPositions[0], startY),
                color: 0xFF6B6B
            });

            // Variant 2: Heavy Core Model
            this.wormVariants.push({
                name: "Heavy Core",
                worm: this.createHeavyCoreWorm(xPositions[1], startY),
                color: 0x4ECDC4
            });

            // Variant 3: Torque-Based Model
            this.wormVariants.push({
                name: "Torque Based",
                worm: this.createTorqueBasedWorm(xPositions[2], startY),
                color: 0xFECA57
            });

            // Variant 4: Spring Muscle Model
            this.wormVariants.push({
                name: "Spring Muscle",
                worm: this.createSpringMuscleWorm(xPositions[3], startY),
                color: 0xA29BFE
            });

            // Add labels
            this.wormVariants.forEach((variant, index) => {
                this.add.text(xPositions[index] - 60, 100, variant.name, {
                    fontSize: '10px',
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: { x: 2, y: 2 }
                });
            });
        }

        createDistributedForceWorm(x, y) {
            const segments = [];
            const constraints = [];
            const segmentCount = 10;
            const baseRadius = 12;
            
            for (let i = 0; i < segmentCount; i++) {
                let radius;
                if (i === 0) {
                    // Head (first segment) - medium size
                    radius = 6;
                } else if (i === 1 || i === 2) {
                    // Neck/upper body - largest
                    radius = 10;
                } else {
                    // Body tapering down to tail
                    const bodyProgress = (i - 2) / (segmentCount - 3);
                    radius = 10 - (bodyProgress * 6); // Taper from 10 down to 4
                }
                const segY = y + (i * 18); // Position from head down
                
                const progress = i / (segmentCount - 1);
                const segment = this.matter.add.circle(x, segY, radius, {
                    friction: 0.8 - progress * 0.3,
                    frictionStatic: 0.9 - progress * 0.3,
                    frictionAir: 0.01,
                    density: 0.005,
                    restitution: 0,
                    slop: 0.01,
                    inertia: 50 * (1 + progress * 2) // More rotation at tail
                });
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(0xFF6B6B);
                graphics.lineStyle(1, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(x, segY);
                
                segment.graphics = graphics;
                segment.radius = radius;
                segments.push(segment);
            }
            
            // Connect with constraints
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                const constraint = this.matter.add.constraint(segA, segB, {
                    length: segA.radius + segB.radius,
                    stiffness: 0.8,
                    damping: 0.1
                });
                constraints.push(constraint);
            }
            
            return { segments, constraints, forceDistribution: 'exponential' };
        }

        createHeavyCoreWorm(x, y) {
            const segments = [];
            const constraints = [];
            const segmentCount = 10;
            const baseRadius = 12;
            
            for (let i = 0; i < segmentCount; i++) {
                let radius;
                if (i === 0) {
                    // Head (first segment) - medium size
                    radius = 6;
                } else if (i === 1 || i === 2) {
                    // Neck/upper body - largest
                    radius = 10;
                } else {
                    // Body tapering down to tail
                    const bodyProgress = (i - 2) / (segmentCount - 3);
                    radius = 10 - (bodyProgress * 6); // Taper from 10 down to 4
                }
                const segY = y + (i * 18); // Position from head down
                
                const progress = i / (segmentCount - 1);
                // Heavy middle, light extremes
                let density;
                if (i < 3) density = 0.003;
                else if (i < 7) density = 0.01; // Heavy core
                else density = 0.002;
                
                const segment = this.matter.add.circle(x, segY, radius, {
                    friction: 0.7,
                    frictionStatic: 0.8,
                    frictionAir: 0.015,
                    density: density,
                    restitution: 0,
                    slop: 0.01
                });
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(0x4ECDC4);
                graphics.lineStyle(1, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(x, segY);
                
                segment.graphics = graphics;
                segment.radius = radius;
                segments.push(segment);
            }
            
            // Variable stiffness constraints
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                const stiffness = i < 3 ? 0.9 : 0.6;
                const constraint = this.matter.add.constraint(segA, segB, {
                    length: segA.radius + segB.radius,
                    stiffness: stiffness,
                    damping: 0.2
                });
                constraints.push(constraint);
            }
            
            return { segments, constraints, forceDistribution: 'center-weighted' };
        }

        createTorqueBasedWorm(x, y) {
            const segments = [];
            const constraints = [];
            const segmentCount = 10;
            const baseRadius = 12;
            
            for (let i = 0; i < segmentCount; i++) {
                let radius;
                if (i === 0) {
                    // Head (first segment) - medium size
                    radius = 6;
                } else if (i === 1 || i === 2) {
                    // Neck/upper body - largest
                    radius = 10;
                } else {
                    // Body tapering down to tail
                    const bodyProgress = (i - 2) / (segmentCount - 3);
                    radius = 10 - (bodyProgress * 6); // Taper from 10 down to 4
                }
                const segY = y + (i * 18); // Position from head down
                
                const progress = i / (segmentCount - 1);
                const segment = this.matter.add.circle(x, segY, radius, {
                    friction: 0.6,
                    frictionStatic: 0.7,
                    frictionAir: 0.005,
                    density: 0.004,
                    restitution: 0,
                    slop: 0.01,
                    inertia: 30 // Lower inertia for easier rotation
                });
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(0xFECA57);
                graphics.lineStyle(1, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(x, segY);
                
                segment.graphics = graphics;
                segment.radius = radius;
                segments.push(segment);
            }
            
            // Looser constraints for more flexibility
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                const constraint = this.matter.add.constraint(segA, segB, {
                    length: segA.radius + segB.radius * 1.1, // Slightly looser
                    stiffness: 0.5,
                    damping: 0.1
                });
                constraints.push(constraint);
            }
            
            return { segments, constraints, forceDistribution: 'torque-primary' };
        }

        createSpringMuscleWorm(x, y) {
            const segments = [];
            const constraints = [];
            const segmentCount = 10;
            const baseRadius = 12;
            
            for (let i = 0; i < segmentCount; i++) {
                let radius;
                if (i === 0) {
                    // Head (first segment) - medium size
                    radius = 6;
                } else if (i === 1 || i === 2) {
                    // Neck/upper body - largest
                    radius = 10;
                } else {
                    // Body tapering down to tail
                    const bodyProgress = (i - 2) / (segmentCount - 3);
                    radius = 10 - (bodyProgress * 6); // Taper from 10 down to 4
                }
                const segY = y + (i * 18); // Position from head down
                
                const progress = i / (segmentCount - 1);
                const segment = this.matter.add.circle(x, segY, radius, {
                    friction: 0.75,
                    frictionStatic: 0.85,
                    frictionAir: 0.02,
                    density: 0.006,
                    restitution: 0.1, // Slight bounce
                    slop: 0.005,
                    inertia: i < 3 ? 100 : 40 // Stable base
                });
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(0xA29BFE);
                graphics.lineStyle(1, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(x, segY);
                
                segment.graphics = graphics;
                segment.radius = radius;
                segments.push(segment);
            }
            
            // Spring-like constraints
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                const constraint = this.matter.add.constraint(segA, segB, {
                    length: (segA.radius + segB.radius) * 0.9, // Compressed for springiness
                    stiffness: 0.3, // Very springy
                    damping: 0.05 // Low damping
                });
                constraints.push(constraint);
            }
            
            return { segments, constraints, forceDistribution: 'spring-wave' };
        }

        update() {
            // Camera scrolling with WASD
            const scrollSpeed = 5;
            if (this.wasd.W.isDown) {
                this.cameras.main.scrollY -= scrollSpeed;
            }
            if (this.wasd.S.isDown) {
                this.cameras.main.scrollY += scrollSpeed;
            }
            if (this.wasd.A.isDown) {
                this.cameras.main.scrollX -= scrollSpeed;
            }
            if (this.wasd.D.isDown) {
                this.cameras.main.scrollX += scrollSpeed;
            }
            
            // Update all worm graphics
            this.wormVariants.forEach(variant => {
                variant.worm.segments.forEach(segment => {
                    if (segment.graphics) {
                        segment.graphics.setPosition(segment.position.x, segment.position.y);
                        segment.graphics.setRotation(segment.angle);
                    }
                });
            });

            // Apply controls to all worms
            const left = this.cursors.left.isDown;
            const right = this.cursors.right.isDown;
            const up = this.cursors.up.isDown;
            const space = this.spaceKey.isDown;

            this.wormVariants.forEach(variant => {
                this.applyMovement(variant.worm, left, right, up, space);
            });
        }

        applyMovement(worm, left, right, up, space) {
            const { segments, constraints, forceDistribution } = worm;
            
            if (forceDistribution === 'exponential') {
                // Head torque with constraint compression
                if (left || right) {
                    const torque = left ? -0.1 : 0.1;
                    this.matter.body.setAngularVelocity(segments[0], 
                        segments[0].angularVelocity + torque);
                }
                if (up) {
                    // Contract first few constraints more aggressively
                    for (let i = 0; i < 3 && i < constraints.length; i++) {
                        const segA = segments[i];
                        const segB = segments[i + 1];
                        const target = (segA.radius + segB.radius) * 0.7;
                        constraints[i].length = constraints[i].length * 0.9 + target * 0.1;
                    }
                }
            } else if (forceDistribution === 'center-weighted') {
                // Middle constraint compression with head torque
                if (left || right) {
                    const torque = left ? -0.1 : 0.1;
                    this.matter.body.setAngularVelocity(segments[0], 
                        segments[0].angularVelocity + torque);
                }
                if (up) {
                    // Contract middle constraints more strongly
                    const start = Math.floor(constraints.length / 3);
                    const end = Math.floor(constraints.length * 2 / 3);
                    for (let i = start; i < end; i++) {
                        const segA = segments[i];
                        const segB = segments[i + 1];
                        const target = (segA.radius + segB.radius) * 0.6;
                        constraints[i].length = constraints[i].length * 0.9 + target * 0.1;
                    }
                }
            } else if (forceDistribution === 'torque-primary') {
                // Strong torque-based movement
                if (left || right) {
                    const torque = left ? -0.15 : 0.15;
                    for (let i = 0; i < 4; i++) {
                        this.matter.body.setAngularVelocity(segments[i], 
                            segments[i].angularVelocity + torque * (1 - i * 0.2));
                    }
                }
                if (up) {
                    // Strong head lift through torque
                    this.matter.body.setAngularVelocity(segments[0], 
                        segments[0].angularVelocity - 0.1);
                    this.matter.body.setAngularVelocity(segments[1], 
                        segments[1].angularVelocity - 0.05);
                }
            } else if (forceDistribution === 'spring-wave') {
                // More visible wave through constraints
                if (left || right || up) {
                    if (!worm.waveTime) worm.waveTime = 0;
                    worm.waveTime += 0.2; // Faster wave
                    
                    const dir = left ? -1 : right ? 1 : 0;
                    
                    // More pronounced wave
                    constraints.forEach((constraint, i) => {
                        const wave = Math.sin(worm.waveTime - i * 0.5) * 0.3; // Larger amplitude
                        const segA = segments[i];
                        const segB = segments[i + 1];
                        const baseLength = segA.radius + segB.radius;
                        const target = baseLength * (0.8 + wave);
                        constraint.length = constraint.length * 0.8 + target * 0.2;
                    });
                    
                    // Stronger head steering
                    if (dir !== 0) {
                        this.matter.body.setAngularVelocity(segments[0], 
                            segments[0].angularVelocity + dir * 0.05);
                    }
                }
            }

            // Manual compression (spacebar)
            if (space) {
                constraints.forEach(c => c.length = c.length * 0.98);
            } else {
                // Gentle restoration to natural length
                constraints.forEach((c, i) => {
                    const segA = segments[i];
                    const segB = segments[i + 1];
                    const naturalLength = segA.radius + segB.radius;
                    c.length = c.length * 0.99 + naturalLength * 0.01;
                });
            }
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

    class TestWormScene extends Phaser.Scene {
        constructor() {
            super({ key: 'TestWormScene' });
            this.wormSegments = [];
            this.wormConstraints = [];
            this.keys = {};
        }

        create() {
            // Set world bounds
            this.matter.world.setBounds(0, 0, config.stageWidth, config.viewportHeight);

            // Create grid background
            this.createGridBackground();

            // Create test platform with 15 degree angle
            const platformY = config.viewportHeight - 150;
            const platformAngle = Math.PI / 12; // 15 degrees (PI/12 radians)
            const platform = this.matter.add.rectangle(
                config.stageWidth / 2,
                platformY,
                400,
                20,
                {
                    isStatic: true,
                    friction: 0.8,
                    frictionStatic: 1.0,
                    restitution: 0.0,
                    angle: platformAngle
                }
            );

            // Add visual
            const platformGraphics = this.add.rectangle(config.stageWidth / 2, platformY, 400, 20, 0x4ecdc4);
            platformGraphics.setRotation(platformAngle);

            // Create improved worm
            this.createWormV2();

            // Add info text
            this.add.text(20, 20, 'Test Worm V2 - Anti-Slide Design', {
                fontSize: '16px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });

            this.add.text(20, 60, 'Arrow Keys: Move | Space: Compress | V: Variants | F: Friction | G: Game', {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });

            // Keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            this.input.keyboard.on('keydown-F', () => {
                this.scene.start('FrictionTestScene');
            });
            
            this.input.keyboard.on('keydown-G', () => {
                this.scene.start('GameScene');
            });
            
            this.input.keyboard.on('keydown-V', () => {
                this.scene.start('WormVariantsScene');
            });
        }

        createWormV2() {
            const startX = config.stageWidth / 2;
            const startY = config.viewportHeight - 200;
            
            // Design principles for anti-slide worm:
            // 1. Variable segment sizes (larger at base for stability)
            // 2. High friction gradient (maximum at bottom)
            // 3. Strategic mass distribution
            // 4. Limited rotation for bottom segments
            
            const segmentCount = 9;
            const baseRadius = 12;
            
            for (let i = 0; i < segmentCount; i++) {
                const progress = i / (segmentCount - 1);
                
                // Taper radius from bottom to top
                const radius = baseRadius * (1 - progress * 0.3);
                
                // Position with tighter spacing
                const y = startY - (i * radius * 1.8);
                
                // Progressive properties
                let friction, frictionStatic, density, inertia, fillColor;
                
                if (i < 3) {
                    // Base segments - maximum grip
                    friction = 1.0;
                    frictionStatic = 1.0;
                    density = 0.008;
                    inertia = Infinity; // No rotation for base
                    fillColor = 0x10AC84; // Dark green
                } else if (i < 6) {
                    // Middle segments - balanced
                    friction = 0.7;
                    frictionStatic = 0.8;
                    density = 0.005;
                    inertia = 100; // Limited rotation
                    fillColor = 0x48DBFB; // Blue
                } else {
                    // Head segments - mobile
                    friction = 0.4;
                    frictionStatic = 0.5;
                    density = 0.002;
                    inertia = 10; // Easy rotation
                    fillColor = 0xFF6B6B; // Red
                }
                
                const segment = this.matter.add.circle(startX, y, radius, {
                    friction: friction,
                    frictionStatic: frictionStatic,
                    frictionAir: 0.02, // Higher air resistance for stability
                    restitution: 0,
                    density: density,
                    slop: 0.01, // Tighter collision
                    inertia: inertia,
                    render: {
                        visible: false
                    }
                });
                
                // Visual
                const graphics = this.add.graphics();
                graphics.fillStyle(fillColor);
                graphics.lineStyle(2, 0x000000);
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(startX, y);
                graphics.setDepth(10);
                
                segment.graphics = graphics;
                segment.radius = radius;
                this.wormSegments.push(segment);
            }
            
            // Create constraints with variable stiffness
            for (let i = 0; i < this.wormSegments.length - 1; i++) {
                const segmentA = this.wormSegments[i];
                const segmentB = this.wormSegments[i + 1];
                
                // Stiffer constraints at base
                const stiffness = i < 3 ? 0.9 : 0.7;
                const damping = i < 3 ? 0.3 : 0.1;
                
                const constraint = this.matter.add.constraint(segmentA, segmentB, {
                    length: segmentA.radius + segmentB.radius,
                    stiffness: stiffness,
                    damping: damping,
                    render: {
                        visible: true,
                        strokeStyle: '#666666',
                        lineWidth: 2
                    }
                });
                
                this.wormConstraints.push(constraint);
            }
            
            // Log configuration
            console.log('Worm V2 created with anti-slide design');
        }

        update() {
            // Update graphics positions
            this.wormSegments.forEach(segment => {
                if (segment.graphics) {
                    segment.graphics.setPosition(segment.position.x, segment.position.y);
                    segment.graphics.setRotation(segment.angle);
                }
            });
            
            // Simple movement for testing
            const force = 0.001;
            
            if (this.cursors.left.isDown) {
                // Apply force to upper segments only
                for (let i = 4; i < this.wormSegments.length; i++) {
                    const segment = this.wormSegments[i];
                    this.matter.body.applyForce(segment, segment.position, { x: -force, y: 0 });
                }
            }
            
            if (this.cursors.right.isDown) {
                // Apply force to upper segments only
                for (let i = 4; i < this.wormSegments.length; i++) {
                    const segment = this.wormSegments[i];
                    this.matter.body.applyForce(segment, segment.position, { x: force, y: 0 });
                }
            }
            
            if (this.cursors.up.isDown) {
                // Lift force on head
                const head = this.wormSegments[this.wormSegments.length - 1];
                this.matter.body.applyForce(head, head.position, { x: 0, y: -force * 2 });
            }
            
            if (this.spaceKey.isDown) {
                // Compress constraints
                this.wormConstraints.forEach(constraint => {
                    constraint.length = constraint.length * 0.95;
                });
            } else {
                // Restore constraints
                this.wormConstraints.forEach((constraint, i) => {
                    const segA = this.wormSegments[i];
                    const segB = this.wormSegments[i + 1];
                    const targetLength = segA.radius + segB.radius;
                    constraint.length = constraint.length * 0.98 + targetLength * 0.02;
                });
            }
        }

        createGridBackground() {
            const graphics = this.add.graphics();
            graphics.lineStyle(1, config.gridColor, config.gridAlpha);

            for (let x = 0; x < config.stageWidth; x += config.gridVerticalSpacing) {
                graphics.lineBetween(x, 0, x, config.viewportHeight);
            }

            for (let y = 0; y < config.viewportHeight; y += config.gridHorizontalSpacing) {
                graphics.lineBetween(0, y, config.stageWidth, y);
            }
        }
    }

    class FrictionTestScene extends Phaser.Scene {
        constructor() {
            super({ key: 'FrictionTestScene' });
            this.testBalls = [];
        }

        create() {
            // Set world bounds
            this.matter.world.setBounds(0, 0, config.stageWidth, config.stageHeight);

            // Create grid background
            this.createGridBackground();
            
            // Create test ball texture with rotation indicator
            this.createTestBallTexture();

            // Create slanted platform
            const platformCenterX = config.stageWidth / 2;
            const platformCenterY = config.viewportHeight / 2;
            const platformWidth = 1200;  // Much longer platform
            const platformHeight = 20;
            const platformAngle = Math.PI / 6; // 30 degrees

            const platform = this.matter.add.rectangle(
                platformCenterX,
                platformCenterY,
                platformWidth,
                platformHeight,
                {
                    isStatic: true,
                    angle: platformAngle,
                    friction: 0.8,
                    frictionStatic: 1.0,
                    restitution: 0.0,
                    render: {
                        fillStyle: '#4ecdc4'
                    }
                }
            );

            // Add visual
            const platformGraphics = this.add.rectangle(
                platformCenterX,
                platformCenterY,
                platformWidth,
                platformHeight,
                0x4ecdc4
            );
            platformGraphics.setRotation(platformAngle);

            // Test configurations with rotation resistance
            const testConfigs = [
                { friction: 0.1, density: 0.001, color: 0xFF6B6B, inertia: 1 },
                { friction: 0.1, density: 0.01, color: 0xFECA57, inertia: 10 },
                { friction: 0.1, density: 0.1, color: 0xFF9FF3, inertia: 100 },
                { friction: 0.5, density: 0.001, color: 0x54A0FF, inertia: 1 },
                { friction: 0.5, density: 0.01, color: 0x48DBFB, inertia: 10 },
                { friction: 0.5, density: 0.1, color: 0x0ABDE3, inertia: 100 },
                { friction: 0.95, density: 0.001, color: 0x00D2D3, inertia: 1 },
                { friction: 0.95, density: 0.01, color: 0x1DD1A1, inertia: 10 },
                { friction: 0.95, density: 0.1, color: 0x10AC84, inertia: 100 },
            ];

            // Create test balls
            const startX = platformCenterX - platformWidth * 0.45;  // Start further left on longer platform
            const spacing = 60;
            const startY = platformCenterY - 150; // Start higher above platform

            testConfigs.forEach((config, index) => {
                const x = startX + (index % 3) * spacing;
                const y = startY - Math.floor(index / 3) * 80;
                
                const ball = this.matter.add.circle(x, y, 15, {
                    friction: config.friction,
                    frictionStatic: config.friction,
                    frictionAir: 0.01,  // Normal air resistance
                    restitution: 0,
                    density: config.density,
                    slop: 0,
                    angle: Math.random() * Math.PI * 2, // Start with random rotation
                    inertia: config.inertia, // Rotation resistance
                    render: {
                        fillStyle: `#${config.color.toString(16).padStart(6, '0')}`,
                        visible: false  // Hide Matter.js rendering, use our custom graphics
                    }
                });

                // Create sprite with the test texture tinted to the config color
                const sprite = this.add.sprite(x, y, 'testBall');
                sprite.setTint(config.color);
                sprite.setScale(1);
                sprite.setDepth(10);

                // Label with numeric values including inertia
                const labelText = `F:${config.friction} D:${config.density} I:${config.inertia}`;
                const label = this.add.text(x, y - 25, labelText, {
                    fontSize: '10px',
                    color: '#FFFFFF',
                    backgroundColor: '#000000',
                    padding: { x: 2, y: 2 }
                });
                label.setOrigin(0.5, 1);

                // Store references
                ball.sprite = sprite;
                ball.label = label;
                ball.config = config;
                this.testBalls.push(ball);
            });

            // Add info text
            this.add.text(20, 20, 'Friction Test: F = Friction, D = Density', {
                fontSize: '16px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });

            // Add gravity info
            this.add.text(20, 60, `Gravity: ${config.gravityY}`, {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });

            // Add scene switch info
            this.add.text(20, 100, 'Press G for Game | T for Test Worm', {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });

            // Add keyboard control
            this.input.keyboard.on('keydown-G', () => {
                this.scene.start('GameScene');
            });
            
            this.input.keyboard.on('keydown-V', () => {
                this.scene.start('WormVariantsScene');
            });
            
            this.input.keyboard.on('keydown-T', () => {
                this.scene.start('TestWormScene');
            });
        }

        update() {
            // Update ball positions and labels
            this.testBalls.forEach(ball => {
                if (ball.sprite) {
                    ball.sprite.setPosition(ball.position.x, ball.position.y);
                    ball.sprite.setRotation(ball.angle);
                }
                if (ball.label) {
                    ball.label.setPosition(ball.position.x, ball.position.y - 25);
                }
            });
        }

        createTestBallTexture() {
            // Create a texture with clear rotation indicator
            const graphics = this.add.graphics();
            const radius = 15;
            
            // Main circle
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(radius, radius, radius);
            
            // Add directional indicator
            graphics.fillStyle(0x000000, 1);
            // Arrow pointing right
            graphics.fillTriangle(
                radius + 5, radius,      // tip
                radius - 5, radius - 5,  // top back
                radius - 5, radius + 5   // bottom back
            );
            
            // Add a line from center to edge
            graphics.lineStyle(2, 0x000000, 1);
            graphics.lineBetween(radius, radius, radius * 2 - 2, radius);
            
            // Add some dots for more rotation visibility
            graphics.fillStyle(0x000000, 1);
            graphics.fillCircle(radius, radius - radius/2, 2);
            graphics.fillCircle(radius - radius/2, radius, 2);
            graphics.fillCircle(radius + radius/2, radius, 2);
            graphics.fillCircle(radius, radius + radius/2, 2);
            
            // Generate texture
            graphics.generateTexture('testBall', radius * 2, radius * 2);
            graphics.destroy();
        }
        
        createGridBackground() {
            const graphics = this.add.graphics();
            graphics.lineStyle(1, config.gridColor, config.gridAlpha);

            for (let x = 0; x < config.stageWidth; x += config.gridVerticalSpacing) {
                graphics.lineBetween(x, 0, x, config.viewportHeight);
            }

            for (let y = 0; y < config.viewportHeight; y += config.gridHorizontalSpacing) {
                graphics.lineBetween(0, y, config.stageWidth, y);
            }
        }
    }

    class GameScene extends Phaser.Scene {
        constructor() {
            super({ key: 'GameScene' });
            this.ball = null;
            this.worm = null;
            this.wormSegments = [];
            this.wormConstraints = [];
            this.originalConstraintLengths = []; // Store original spring lengths
            this.keys = {};
            this.isStiffening = false;
            this.wasStiffening = false;
            this.stiffeningDuration = 0;
            this.compressionFactor = 1.0; // Current compression state
            this.waveTime = 0; // For wave-based movement
            this.totalWormMass = 0; // Will calculate after creation
        }

        create() {
            // Set world bounds for the tall stage
            this.matter.world.setBounds(0, 0, config.stageWidth, config.stageHeight);

            // Create grid background
            this.createGridBackground();

            // Create ground at the bottom
            const groundY = config.stageHeight - config.groundHeight / 2;
            const groundBody = this.matter.add.rectangle(config.stageWidth / 2, groundY, config.stageWidth, config.groundHeight, {
                isStatic: true,
                collisionFilter: {
                    category: 0x0002, // Same as platforms
                    mask: 0xFFFFFFFF // Collide with everything
                }
            });

            // Add visual representation for ground
            const groundGraphics = this.add.rectangle(config.stageWidth / 2, groundY, config.stageWidth, config.groundHeight, config.groundColor);

            // Create platforms from level data
            this.createPlatforms();

            // Create worm instead of single ball
            this.createWorm();

            // Create a camera target that follows the head segment
            this.cameraTarget = this.add.rectangle(0, 0, 1, 1, 0x000000, 0);

            // Setup camera to follow the camera target
            this.cameras.main.setBounds(0, 0, config.stageWidth, config.stageHeight);
            // Use high lerp values for responsive following
            this.cameras.main.startFollow(this.cameraTarget, true, config.cameraLerp, config.cameraLerp);
            // Set deadzone to 20% of viewport
            const deadzoneWidth = config.stageWidth * config.cameraDeadzonePercent;
            const deadzoneHeight = config.viewportHeight * config.cameraDeadzonePercent;
            this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);
            this.cameras.main.setZoom(1);

            // Debug: Log initial position
            console.log('Worm created with', this.wormSegments.length, 'segments');

            // Set up keyboard input
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

            // Add scene switch control
            this.input.keyboard.on('keydown-F', () => {
                this.scene.start('FrictionTestScene');
            });
            
            this.input.keyboard.on('keydown-T', () => {
                this.scene.start('TestWormScene');
            });

            // Add info text for scene switching
            this.add.text(20, 20, 'Press F for Friction Test | T for Test Worm', {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 10 }
            });
        }

        createGridBackground() {
            // Create a graphics object for the grid
            const graphics = this.add.graphics();
            graphics.lineStyle(1, config.gridColor, config.gridAlpha);

            // Draw vertical lines
            for (let x = 0; x < config.stageWidth; x += config.gridVerticalSpacing) {
                graphics.lineBetween(x, 0, x, config.stageHeight);
            }

            // Draw horizontal lines
            for (let y = 0; y < config.stageHeight; y += config.gridHorizontalSpacing) {
                graphics.lineBetween(0, y, config.stageWidth, y);

                // Add height markers
                if (y % config.gridMarkerInterval === 0 && y > 0) {
                    this.add.text(20, y - 10, `${y}m`, {
                        fontSize: '14px',
                        color: config.gridMarkerColor
                    });
                }
            }
        }

        createPlatforms() {
            // Parse the level data
            const rows = levelData.trim().split('\n').filter(row => row.trim().length > 0);

            // Reverse the rows so bottom of string is bottom of level
            rows.reverse();

            rows.forEach((row, rowIndex) => {
                const trimmedRow = row.trim();
                let currentPlatformStart = -1;

                // Calculate Y position for this row
                const y = config.platformStartY - (rowIndex * config.platformVerticalSpacing);

                // Process each character in the row
                for (let colIndex = 0; colIndex < trimmedRow.length; colIndex++) {
                    const char = trimmedRow[colIndex];

                    if (char === '-') {
                        // Start of platform
                        if (currentPlatformStart === -1) {
                            currentPlatformStart = colIndex;
                        }
                    } else {
                        // End of platform or empty space
                        if (currentPlatformStart !== -1) {
                            // Create platform from currentPlatformStart to colIndex-1
                            const platformLength = colIndex - currentPlatformStart;
                            const centerX = (currentPlatformStart + platformLength / 2) * config.platformWidth;
                            const width = platformLength * config.platformWidth;

                            // Create the platform
                            const platform = this.matter.add.rectangle(
                                centerX,
                                y,
                                width,
                                config.platformHeight,
                                {
                                    isStatic: true,
                                    friction: 0.8,         // High friction to prevent sliding
                                    frictionStatic: 1.0,   // Max static friction
                                    restitution: 0.0,      // No bounce
                                    collisionFilter: {
                                        category: 0x0002, // Platform category
                                        mask: 0xFFFFFFFF // Collide with everything
                                    }
                                }
                            );

                            // Add visual
                            const color = config.platformColors[rowIndex % config.platformColors.length];
                            this.add.rectangle(centerX, y, width, config.platformHeight, color);

                            currentPlatformStart = -1;
                        }
                    }
                }

                // Handle platform that extends to end of row
                if (currentPlatformStart !== -1) {
                    const platformLength = trimmedRow.length - currentPlatformStart;
                    const centerX = (currentPlatformStart + platformLength / 2) * config.platformWidth;
                    const width = platformLength * config.platformWidth;

                    // Create the platform
                    this.matter.add.rectangle(
                        centerX,
                        y,
                        width,
                        config.platformHeight,
                        {
                            isStatic: true,
                            friction: 0.8,         // High friction to prevent sliding
                            frictionStatic: 1.0,   // Max static friction
                            restitution: 0.0,      // No bounce
                            collisionFilter: {
                                category: 0x0002, // Platform category
                                mask: 0xFFFFFFFF // Collide with everything
                            }
                        }
                    );

                    // Add visual
                    const color = config.platformColors[rowIndex % config.platformColors.length];
                    this.add.rectangle(centerX, y, width, config.platformHeight, color);
                }
            });
        }

        createWorm() {
            const startX = config.ballStartX;
            const startY = config.ballStartY;
            const radius = config.ballRadius;

            const segmentSpacing = radius * config.worm.segmentSpacing;

            // Create segments from head to tail
            for (let i = 0; i < config.worm.segments; i++) {
                // Position each ball with proper spacing
                const y = startY + (i * segmentSpacing);

                // Determine segment properties
                let fillColor, density, friction;
                if (i < config.worm.head.segments) {
                    // Head segments (first few)
                    fillColor = '#AA3939';  // Light pink
                    density = config.ballDensity * config.worm.head.densityMultiplier;
                    friction = config.ballFriction; // Normal friction for head
                } else if (i >= config.worm.segments - config.worm.tail.segments) {
                    // Tail segments (last few)
                    fillColor = '#4ecdc4';  // Teal
                    density = config.ballDensity * config.worm.tail.densityMultiplier;
                    friction = config.ballFriction * config.worm.tail.frictionMultiplier;
                } else {
                    // Body segments
                    fillColor = '#FFD169';  // Yellow
                    density = config.ballDensity;
                    friction = config.ballFriction;
                }

                // Create segment options
                const segmentOptions = {
                    friction: friction,
                    frictionStatic: config.ballStaticFriction, // Add static friction
                    frictionAir: config.airFriction, // No air friction like original
                    restitution: config.ballBounce,
                    density: density,
                    render: {
                        fillStyle: fillColor,
                        visible: false  // Hide Matter.js rendering, use our custom graphics
                    },
                    slop: 0.0  // Match original - zero slop for perfect collision
                };

                // Create circular segment
                const segmentBody = this.matter.add.circle(
                    startX,
                    y,
                    radius,
                    segmentOptions
                );

                // Create visual representation
                const graphics = this.add.graphics();
                graphics.fillStyle(parseInt(fillColor.replace('#', '0x')));
                // Add dark stroke for better definition
                graphics.lineStyle(2, 0x333333);  // Dark gray stroke
                graphics.fillCircle(0, 0, radius);
                graphics.strokeCircle(0, 0, radius);
                graphics.setPosition(startX, y);

                // Store graphics reference on body for updating position/rotation
                segmentBody.graphics = graphics;

                // Ensure graphics are rendered on top
                graphics.setDepth(10);

                this.wormSegments.push(segmentBody);
            }

            // Create spring constraints between segments
            for (let i = 0; i < this.wormSegments.length - 1; i++) {
                const segmentA = this.wormSegments[i];
                const segmentB = this.wormSegments[i + 1];

                // Use Phaser's Matter.js constraint directly
                const Constraint = Phaser.Physics.Matter.Matter.Constraint;
                const constraintLength = segmentSpacing * 0.9; // Slightly less for natural compression
                const constraint = Constraint.create({
                    bodyA: segmentA,
                    bodyB: segmentB,
                    // Connect centers - no offset points needed for circles
                    length: constraintLength,
                    stiffness: config.worm.constraintStiffness,
                    damping: config.worm.constraintDamping,
                    render: {
                        visible: true,
                        strokeStyle: '#666666',
                        lineWidth: 2
                    }
                });
                this.matter.world.add(constraint);
                this.wormConstraints.push(constraint);
                this.originalConstraintLengths.push(constraintLength);
            }

            // Store reference to head for backward compatibility
            this.ball = this.wormSegments[0];
            
            // Calculate total worm mass for force calculations
            this.totalWormMass = 0;
            this.wormSegments.forEach(segment => {
                this.totalWormMass += segment.mass;
            });
            console.log('Total worm mass:', this.totalWormMass);
            console.log('Head segment mass:', this.wormSegments[0].mass);
            console.log('Gravity:', config.gravityY);
        }


        createSegmentTexture(name, color, radius) {
            const graphics = this.add.graphics();
            graphics.fillStyle(color);
            graphics.fillCircle(0, 0, radius);
            graphics.generateTexture(name, radius * 2, radius * 2);
            graphics.destroy();
            return name;
        }

        update() {
            if (!this.wormSegments.length) return;

            // Update camera target to follow head segment
            if (this.cameraTarget && this.wormSegments[0]) {
                this.cameraTarget.setPosition(this.wormSegments[0].position.x, this.wormSegments[0].position.y);
            }
            

            // Track spacebar state changes
            this.wasStiffening = this.isStiffening;
            this.isStiffening = this.spaceKey.isDown;

            // Track how long we've been stiffening
            if (this.isStiffening) {
                this.stiffeningDuration++;
            } else if (this.wasStiffening && !this.isStiffening) {
                this.stiffeningDuration = 0;
            }

            // Update visuals and apply damping only when needed
            this.wormSegments.forEach(segment => {
                // Apply damping only if moving or stiffening
                if (this.isStiffening || this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown) {
                    const dampingFactor = this.isStiffening ? config.straightening.damping : config.movement.angularDamping;
                    const angularVel = segment.angularVelocity * dampingFactor;
                    this.matter.body.setAngularVelocity(segment, angularVel);
                }

                // Update visual position and rotation
                if (segment.graphics) {
                    segment.graphics.setPosition(segment.position.x, segment.position.y);
                    segment.graphics.setRotation(segment.angle);
                }
            });

            if (this.isStiffening) {
                // Compress the worm springs
                this.compressWorm();
            } else {
                // Release compression gradually
                this.releaseWorm();
                // Handle normal movement
                const left = this.cursors.left.isDown;
                const right = this.cursors.right.isDown;
                const up = this.cursors.up.isDown;

                if (up && left) {
                    this.moveWormWithWave({ angle: -Math.PI / 4, force: { x: -1, y: -1 } });
                } else if (up && right) {
                    this.moveWormWithWave({ angle: Math.PI / 4, force: { x: 1, y: -1 } });
                } else if (left) {
                    this.moveWormWithWave({ angle: -Math.PI / 2, force: { x: -1, y: 0 } });
                } else if (right) {
                    this.moveWormWithWave({ angle: Math.PI / 2, force: { x: 1, y: 0 } });
                } else if (up) {
                    this.moveWormWithWave({ angle: 0, force: { x: 0, y: -1 } });
                } else {
                    // Don't reset wave time - let it continue for smoother physics
                    // Just don't call moveWormWithWave
                }
            }
        }

        moveWormWithWave(direction) {
            // Increment wave time
            this.waveTime += 0.2;
            
            const waveAmplitude = 0.5;  // Strong wave for better movement
            const waveFrequency = 0.6;
            const torqueAmount = config.movement.torqueAmount;
            
            // Apply wave motion through the body
            for (let i = 0; i < this.wormSegments.length; i++) {
                const segment = this.wormSegments[i];
                
                // Calculate phase offset for this segment
                const phaseOffset = i * 0.4;
                
                // Calculate wave position
                const waveAngle = Math.sin(this.waveTime * waveFrequency - phaseOffset) * waveAmplitude;
                
                // Combine with direction
                let targetAngle = direction.angle + waveAngle;
                
                // Calculate angle difference
                let angleDiff = targetAngle - segment.angle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                // Apply torque with exponential decay - same as force distribution
                const fadeMultiplier = Math.exp(-i * config.movement.forceDecayRate);
                const torque = angleDiff * torqueAmount * fadeMultiplier;
                this.matter.body.setAngularVelocity(segment, segment.angularVelocity + torque);
            }
            
            // Apply calculated force based on worm physics
            // Force should be proportional to what the worm could realistically generate
            if (direction.force) {
                // Calculate maximum force based on worm's total weight
                const gravity = config.gravityY;
                const totalWeight = this.totalWormMass * gravity;
                
                // Debug logging
                if (Math.random() < 0.02) { // Log occasionally to avoid spam
                    console.log('Force calculation:', {
                        totalMass: this.totalWormMass,
                        gravity: gravity,
                        totalWeight: totalWeight,
                        direction: direction.force
                    });
                }
                
                // A worm can only generate a tiny fraction of its weight as upward force
                const maxLiftRatio = config.movement.maxLiftRatio;
                
                // Apply force to more segments with smooth gradient
                const forceSegments = Math.min(8, this.wormSegments.length); // Apply to up to 8 segments
                
                for (let i = 0; i < forceSegments; i++) {
                    const segment = this.wormSegments[i];
                    
                    // Smooth exponential decay for more natural distribution
                    // Force is strongest at head, decreases smoothly
                    const segmentForceRatio = Math.exp(-i * config.movement.forceDecayRate);
                    
                    // Force per unit mass (F = ma, so this is acceleration)
                    const forcePerMass = gravity * maxLiftRatio * segmentForceRatio;
                    
                    // Actual force = acceleration * segment mass
                    const forceMagnitude = forcePerMass * segment.mass;
                    
                    if (i === 0 && Math.random() < 0.02) { // Debug first segment
                        console.log('Head force:', {
                            segmentMass: segment.mass,
                            segmentForceRatio: segmentForceRatio,
                            forcePerMass: forcePerMass,
                            forceMagnitude: forceMagnitude,
                            finalY: direction.force.y * forceMagnitude
                        });
                    }
                    
                    this.matter.body.applyForce(segment, segment.position, {
                        x: direction.force.x * forceMagnitude * config.movement.horizontalForceMultiplier,
                        y: direction.force.y * forceMagnitude
                    });
                }
            }
        }

        compressWorm() {
            // Gradually compress the springs when spacebar is held
            const compressionRate = 0.04;  // Faster compression
            const minCompression = 0.4;     // Compress to 40% for more dramatic effect
            
            if (this.compressionFactor > minCompression) {
                this.compressionFactor -= compressionRate;
                this.compressionFactor = Math.max(this.compressionFactor, minCompression);
            }
            
            // Update all constraint lengths based on compression
            for (let i = 0; i < this.wormConstraints.length; i++) {
                const constraint = this.wormConstraints[i];
                const originalLength = this.originalConstraintLengths[i];
                constraint.length = originalLength * this.compressionFactor;
            }
            
            // Also apply some angular damping to help coil
            const coilDamping = 0.85;
            this.wormSegments.forEach(segment => {
                this.matter.body.setAngularVelocity(segment, segment.angularVelocity * coilDamping);
            });
        }
        
        releaseWorm() {
            // Quickly restore spring lengths when spacebar is released for snap effect
            const releaseRate = 0.2;
            
            if (this.compressionFactor < 1.0) {
                this.compressionFactor += releaseRate;
                this.compressionFactor = Math.min(this.compressionFactor, 1.0);
                
                // Update all constraint lengths
                for (let i = 0; i < this.wormConstraints.length; i++) {
                    const constraint = this.wormConstraints[i];
                    const originalLength = this.originalConstraintLengths[i];
                    constraint.length = originalLength * this.compressionFactor;
                }
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
        scene: [WormVariantsScene, TestWormScene, FrictionTestScene, GameScene]
    };

    // Create game
    const game = new Phaser.Game(phaserConfig);
})();
