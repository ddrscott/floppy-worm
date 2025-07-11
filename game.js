(() => {
    // Game configuration constants
    const config = {
        // Stage dimensions
        stageWidth: 800,
        stageHeight: 80000,
        viewportHeight: 600,
        
        // Ball properties
        ballRadius: 10,
        ballStartX: 400,
        ballStartY: 79000, // One screen height (600) above ground (79975 - 600)
        ballFriction: 0.8,
        ballBounce: 0.3,
        ballDensity: 0.002,
        ballColor: 0xff6b6b,
        worm: {
            segments: 13, // total segments
            segmentSpacing: 2, // multiplier of radius for spacing
            constraintStiffness: 1,
            constraintDamping: 0, // No damping for rigid sticks
            head: {
                segments: 3,  // front of the array
                color: 0xff6b6b,
                densityMultiplier: 1
            },
            body: {
                color: 0x95e1d3
            },
            tail: {
                segments: 3,  // back of the array
                color: 0x4ecdc4,
                frictionMultiplier: 2 // relative to ballFriction
            }
        },
        
        // Movement parameters
        movement: {
            torqueAmount: 0.5,
            angularDamping: 0.8,
            bendSegments: 6
        },
        
        // Straightening parameters
        straightening: {
            torqueMultiplier: 3.0, // Multiplier for torque when straightening
            damping: 0.98 // Higher damping when straightening
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
        cameraLerp: 0.8,
        cameraDeadzonePercent: 0.2,
        
        // Physics
        gravityY: 1,
        airFriction: 0.001 // Low air friction for more realistic falling
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
        }

        create() {
            // Set world bounds for the tall stage
            this.matter.world.setBounds(0, 0, config.stageWidth, config.stageHeight);
            
            // Create grid background
            this.createGridBackground();
            
            // Create ground at the bottom
            const groundY = config.stageHeight - config.groundHeight / 2;
            const groundBody = this.matter.add.rectangle(config.stageWidth / 2, groundY, config.stageWidth, config.groundHeight, { 
                isStatic: true
            });
            
            // Add visual representation for ground
            const groundGraphics = this.add.rectangle(config.stageWidth / 2, groundY, config.stageWidth, config.groundHeight, config.groundColor);
            
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
                categories.push(0x0001 << i); // Each segment gets a unique category bit
            }
            
            // Create segments from head to tail
            for (let i = 0; i < config.worm.segments; i++) {
                // Position each segment so they're touching end-to-end
                const y = startY + (i * segmentHeight);
                
                // Determine segment properties
                let fillColor, density, friction;
                if (i < config.worm.head.segments) {
                    // Head segments
                    fillColor = '#ff6b6b';
                    density = config.ballDensity * config.worm.head.densityMultiplier;
                    friction = config.ballFriction;
                } else if (i >= config.worm.segments - config.worm.tail.segments) {
                    // Tail segments
                    fillColor = '#4ecdc4';
                    density = config.ballDensity;
                    friction = config.ballFriction * config.worm.tail.frictionMultiplier;
                } else {
                    // Body segments
                    fillColor = '#95e1d3';
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
                        radius: radius * 0.9  // Almost fully rounded ends
                    },
                    collisionFilter: {
                        category: categories[i],
                        mask: this.createCollisionMask(categories, i)
                    },
                    render: {
                        fillStyle: fillColor,
                        visible: true
                    }
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
                
                // Create sprite and attach the body
                // const segment = this.matter.add.sprite(startX, y, null);
                // segment.setExistingBody(segmentBody);
                //
                // // Set initial rotation to point upward
                // segment.setRotation(-Math.PI / 2);
                
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
            // Start with default category (for ground, walls, etc)
            let mask = 0xFFFFFFFF;
            
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
            
            // Check if spacebar is held
            this.isStiffening = this.spaceKey.isDown;
            
            // Apply angular damping to all segments
            const dampingFactor = this.isStiffening ? config.straightening.damping : config.movement.angularDamping;
            this.wormSegments.forEach(segment => {
                // Apply damping by reducing angular velocity
                const angularVel = segment.angularVelocity * dampingFactor;
                this.matter.body.setAngularVelocity(segment, angularVel);
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
                    this.bendWormToAngle(-Math.PI / 4); // -45 degrees (up-left diagonal)
                } else if (up && right) {
                    this.bendWormToAngle(Math.PI / 4); // 45 degrees (up-right diagonal)
                } else if (left) {
                    this.bendWormToAngle(-Math.PI / 2); // -90 degrees (left)
                } else if (right) {
                    this.bendWormToAngle(Math.PI / 2); // 90 degrees (right)
                } else if (up) {
                    this.bendWormToAngle(0); // 0 degrees (straight up)
                }
            }
        }
        
        bendWormToAngle(targetAngle) {
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
        }
        
        straightenWorm() {
            const torqueAmount = config.movement.torqueAmount * config.straightening.torqueMultiplier;
            
            // Get the head's current angle as the target direction
            const headAngle = this.wormSegments[0].angle;
            
            // Apply torque to all segments to align them with the head's direction
            for (let i = 0; i < this.wormSegments.length; i++) {
                const segment = this.wormSegments[i];
                
                // Target angle is the head's angle
                const targetAngle = headAngle;
                
                // Calculate angle difference
                let angleDiff = targetAngle - segment.angle;
                
                // Normalize angle difference to [-PI, PI]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                // Apply proportional torque with damping factor
                // Use a smaller proportional gain to prevent overshoot
                const kp = 0.25; // Proportional gain (0-1, lower = less overshoot)
                
                // Increase torque towards the tail for spring effect
                // Head (i=0) gets 1x multiplier, tail gets up to 2x multiplier
                const springMultiplier = 1 + (i / (this.wormSegments.length - 1));
                
                const torque = angleDiff * torqueAmount * kp * springMultiplier;
                
                // Apply torque directly to the body
                segment.torque = torque;
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
            }
        },
        scene: GameScene
    };

    // Create game
    const game = new Phaser.Game(phaserConfig);
})();
