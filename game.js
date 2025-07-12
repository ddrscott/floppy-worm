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
        ballFriction: 2,
        ballBounce: 0.003,
        ballDensity: 0.003,
        ballColor: 0xff6b6b,
        worm: {
            segments: 13, // total segments
            segmentSpacing: 2, // multiplier of radius for spacing
            constraintStiffness: 0.5,
            constraintDamping: 0.2, // No damping for rigid sticks
            head: {
                segments: 3,  // front of the array
                densityMultiplier: 1.9
            },
            body: {
            },
            tail: {
                segments: 3,  // back of the array
                frictionMultiplier: 10, // relative to ballFriction
                densityMultiplier: 1.5 // Make tail heavier for better propulsion
            }
        },

        // Movement parameters
        movement: {
            torqueAmount: 1.2,
            angularDamping: 0.9,
            bendSegments: 8
        },

        // Straightening parameters
        straightening: {
            torqueMultiplier: 2, // Multiplier for torque when straightening
            damping: 0.005 // Higher damping when straightening
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
        gravityY: 1,
        airFriction: 0.001, // Low air friction for more realistic falling

        // Platform properties
        platformWidth: 50, // Width of each platform block
        platformHeight: 20, // Height of each platform (doubled for better collision)
        platformStartY: calculatedHeight - 100, // Starting Y position for platforms (much lower)
        platformVerticalSpacing: 75, // Vertical space between platform rows
        platformColors: [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe] // Different colors
    };

    class GameScene extends Phaser.Scene {
        constructor() {
            super({ key: 'GameScene' });
            this.ball = null;
            this.worm = null;
            this.wormSegments = [];
            this.wormConstraints = [];
            this.keys = {};
            this.isStiffening = false;
            this.wasStiffening = false;
            this.stiffeningDuration = 0;
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
                                    friction: 4,
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
                            friction: 4,
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
            const Bodies = Phaser.Physics.Matter.Matter.Bodies;
            const Constraint = Phaser.Physics.Matter.Matter.Constraint;
            const Common = Phaser.Physics.Matter.Matter.Common;

            const segmentLength = radius * config.worm.segmentSpacing;
            const segmentWidth = radius * 2;

            const segmentHeight = segmentLength * 2; // Height of each pill

            // Create collision categories for each segment
            const categories = [];
            for (let i = 0; i < config.worm.segments; i++) {
                categories.push(0x0001 << (i + 4)); // Each segment gets a unique category bit, starting from bit 4
            }

            // Create segments from head to tail
            for (let i = 0; i < config.worm.segments; i++) {
                // Position each segment so they're touching end-to-end
                const y = startY + (i * segmentHeight);

                // Determine segment properties
                let fillColor, density, friction;
                if (i === 0) {
                    // Only the very first segment (head)
                    fillColor = '#AA3939';  // Light pink
                    density = config.ballDensity * config.worm.head.densityMultiplier;
                    friction = config.ballFriction;
                } else if (i >= config.worm.segments - config.worm.tail.segments) {
                    // Tail segments
                    fillColor = '#FFD169';  // Dark red/pink
                    density = config.ballDensity * config.worm.tail.densityMultiplier;
                    friction = config.ballFriction * config.worm.tail.frictionMultiplier;
                } else {
                    // All other segments including rest of head
                    fillColor = '#FFD169';  // Dark red/pink
                    density = config.ballDensity;
                    friction = config.ballFriction;
                }

                // Create segment options
                const segmentOptions = {
                    friction: friction,
                    frictionAir: config.airFriction,
                    restitution: config.ballBounce,
                    density: density,
                    chamfer: {
                        radius: radius
                    },
                    collisionFilter: {
                        category: categories[i],
                        mask: this.createCollisionMask(categories, i)
                    },
                    render: {
                        fillStyle: fillColor,
                        visible: false  // Hide Matter.js rendering, use our custom graphics
                    },
                    // Enable continuous collision detection
                    isSensor: false,
                    slop: 0.1  // Reduce position correction tolerance
                };

                // Create pill-shaped segment (chamfered rectangle)
                // Width is the diameter, height is the full segment length
                const segmentBody = this.matter.add.rectangle(
                    startX,
                    y,
                    segmentWidth,  // Width = diameter
                    segmentLength * 2,  // Height = longer for pill shape
                    segmentOptions
                );

                // Create visual representation
                const graphics = this.add.graphics();
                graphics.fillStyle(parseInt(fillColor.replace('#', '0x')));
                // Add dark stroke for better definition
                graphics.lineStyle(3, 0x333333);  // Dark gray stroke
                graphics.fillRoundedRect(
                    -segmentWidth/2,
                    -segmentLength,
                    segmentWidth,
                    segmentLength * 2,
                    radius * 0.9
                );
                graphics.strokeRoundedRect(
                    -segmentWidth/2,
                    -segmentLength,
                    segmentWidth,
                    segmentLength * 2,
                    radius * 0.9
                );
                graphics.setPosition(startX, y);

                // Store graphics reference on body for updating position/rotation
                segmentBody.graphics = graphics;

                // Ensure graphics are rendered on top
                graphics.setDepth(10);

                this.wormSegments.push(segmentBody);
            }

            // Create constraints between segments (like ragdoll joints)
            for (let i = 0; i < this.wormSegments.length - 1; i++) {
                const segmentA = this.wormSegments[i];
                const segmentB = this.wormSegments[i + 1];

                // Connect bottom of segmentA to top of segmentB
                // Since segments are rectangles of height segmentHeight, half is segmentHeight/2
                const halfHeight = segmentHeight / 2;
                // Use Phaser's Matter.js constraint directly
                const Constraint = Phaser.Physics.Matter.Matter.Constraint;
                const constraint = Constraint.create({
                    bodyA: segmentA,
                    bodyB: segmentB,
                    pointA: { x: 0, y: halfHeight - radius }, // Bottom of segment A
                    pointB: { x: 0, y: -halfHeight + radius }, // Top of segment B
                    length: 0,
                    stiffness: config.worm.constraintStiffness,
                    damping: config.worm.constraintDamping,
                    render: {
                        visible: true
                    }
                });
                this.matter.world.add(constraint);
                this.wormConstraints.push(constraint);
            }

            // Store reference to head for backward compatibility
            this.ball = this.wormSegments[0];
        }

        createCollisionMask(categories, currentIndex) {
            // Start with platform category and default category
            let mask = 0x0002 | 0x0001; // Platforms and default

            // Include all segment categories
            for (let i = 0; i < categories.length; i++) {
                mask |= categories[i];
            }

            // Exclude adjacent segments (neighbors)
            if (currentIndex > 0) {
                mask &= ~categories[currentIndex - 1]; // Don't collide with previous segment
            }
            if (currentIndex < categories.length - 1) {
                mask &= ~categories[currentIndex + 1]; // Don't collide with next segment
            }

            return mask;
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

            // Apply angular damping to all segments and update visuals
            const dampingFactor = this.isStiffening ? config.straightening.damping : config.movement.angularDamping;
            this.wormSegments.forEach(segment => {
                // Apply damping by reducing angular velocity
                const angularVel = segment.angularVelocity * dampingFactor;
                this.matter.body.setAngularVelocity(segment, angularVel);

                // Update visual position and rotation
                if (segment.graphics) {
                    segment.graphics.setPosition(segment.position.x, segment.position.y);
                    segment.graphics.setRotation(segment.angle);
                }
            });

            if (this.isStiffening) {
                // Straighten the worm
                this.straightenWorm();
            } else {
                // Handle normal movement
                const left = this.cursors.left.isDown;
                const right = this.cursors.right.isDown;
                const up = this.cursors.up.isDown;

                if (up && left) {
                    this.bendWormToAngle(-Math.PI / 4, { x: -1, y: -1 }); // -45 degrees (up-left diagonal)
                } else if (up && right) {
                    this.bendWormToAngle(Math.PI / 4, { x: 1, y: -1 }); // 45 degrees (up-right diagonal)
                } else if (left) {
                    this.bendWormToAngle(-Math.PI / 2, { x: -1, y: 0 }); // -90 degrees (left)
                } else if (right) {
                    this.bendWormToAngle(Math.PI / 2, { x: 1, y: 0 }); // 90 degrees (right)
                } else if (up) {
                    this.bendWormToAngle(0, { x: 0, y: -1 }); // 0 degrees (straight up)
                }
            }
        }

        bendWormToAngle(targetAngle, forceDirection = null) {
            const torqueAmount = config.movement.torqueAmount;
            const bendSegments = Math.min(config.movement.bendSegments, this.wormSegments.length);

            for (let i = 0; i < bendSegments; i++) {
                const segment = this.wormSegments[i];

                // Calculate angle difference
                let angleDiff = targetAngle - segment.angle;

                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                // Apply proportional torque with fade effect
                const fadeMultiplier = 1 - (i / bendSegments); // Stronger at head, weaker towards body
                const torque = angleDiff * torqueAmount * fadeMultiplier;

                // Apply torque directly to the body
                segment.torque = torque;
            }

            // Apply a small force to the head for better movement
            if (forceDirection && this.wormSegments.length > 0) {
                const head = this.wormSegments[0];
                const forceMagnitude = 0.002; // Small force
                this.matter.body.applyForce(head, head.position, {
                    x: forceDirection.x * forceMagnitude,
                    y: forceDirection.y * forceMagnitude
                });
            }
        }

        straightenWorm() {
            // Apply forces to stretch the worm and reduce bending
            const stretchForce = 0.03 * config.straightening.torqueMultiplier;  // Reduced from 0.1
            const torqueStrength = config.movement.torqueAmount * config.straightening.torqueMultiplier;

            // Each segment tries to be straight (180°) relative to the one in front
            for (let i = 1; i < this.wormSegments.length; i++) {
                const segment = this.wormSegments[i];
                const prevSegment = this.wormSegments[i - 1];

                // We want the angle between segments to be 0 (straight line)
                // Calculate current bend angle between segments
                const dx = segment.position.x - prevSegment.position.x;
                const dy = segment.position.y - prevSegment.position.y;
                const connectionAngle = Math.atan2(dy, dx);

                // The ideal angle for this segment would be the same as the connection angle
                const targetAngle = connectionAngle - Math.PI / 2; // Adjust for segment orientation

                // Calculate how far off we are from being straight
                let angleDiff = targetAngle - segment.angle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                // Apply torque to straighten
                const fadeMultiplier = 1 - (i / this.wormSegments.length);
                segment.torque = angleDiff * torqueStrength * 0.5 * fadeMultiplier;
            }

            // Then apply stretching forces
            for (let i = 0; i < this.wormSegments.length - 1; i++) {
                const segmentA = this.wormSegments[i];
                const segmentB = this.wormSegments[i + 1];

                // Calculate vector from A to B
                const dx = segmentB.position.x - segmentA.position.x;
                const dy = segmentB.position.y - segmentA.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    // Normalize the vector
                    const nx = dx / distance;
                    const ny = dy / distance;

                    // Apply stretching forces along the connection axis
                    const force = stretchForce * (5 - i / this.wormSegments.length); // Stronger at head

                    // Apply forces in opposite directions
                    this.matter.body.applyForce(segmentA, segmentA.position, { x: -nx * force, y: -ny * force });
                    this.matter.body.applyForce(segmentB, segmentB.position, { x: nx * force, y: ny * force });
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
                debug: false,
                enableSleeping: false,
                debug: true,
                showDebug: true,
                showVelocity: true,
                showAngleIndicator: true,
                showSleeping: false,
                constraintIterations: 4,  // Increase for better constraint solving
                positionIterations: 8,    // Increase for better collision detection
                velocityIterations: 6,    // Increase for better velocity resolution
            }
        },
        scene: GameScene
    };

    // Create game
    const game = new Phaser.Game(phaserConfig);
})();
