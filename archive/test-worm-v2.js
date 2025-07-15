(() => {
    // Coordinate display tool class
    class CoordinateDisplay extends Phaser.GameObjects.Container {
        constructor(scene, x, y, config = {}) {
            super(scene, x, y);
            
            // Default configuration
            const defaultConfig = {
                backgroundColor: 0x000000,
                backgroundAlpha: 0.7,
                textColor: '#ffffff',
                fontSize: '14px',
                padding: 10,
                updateFrequency: 100 // milliseconds
            };
            
            this.config = { ...defaultConfig, ...config };
            
            // Create background
            this.background = scene.add.rectangle(0, 0, 100, 30, this.config.backgroundColor);
            this.background.setAlpha(this.config.backgroundAlpha);
            this.background.setOrigin(0, 0);
            this.add(this.background);
            
            // Create text
            this.coordText = scene.add.text(this.config.padding, this.config.padding, '(0, 0)', {
                fontSize: this.config.fontSize,
                color: this.config.textColor,
                fontFamily: 'monospace'
            });
            this.coordText.setOrigin(0, 0);
            this.add(this.coordText);
            
            // Add to scene
            scene.add.existing(this);
            
            // Make draggable
            this.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 30), Phaser.Geom.Rectangle.Contains);
            scene.input.setDraggable(this);
            
            // Update timer
            this.lastUpdate = 0;
            
            // Enable drag
            this.on('drag', (pointer, dragX, dragY) => {
                this.x = dragX;
                this.y = dragY;
            });
            
            // Initial update
            this.updateCoordinates();
        }
        
        updateCoordinates() {
            const worldX = Math.round(this.x);
            const worldY = Math.round(this.y);
            this.coordText.setText(`(${worldX}, ${worldY})`);
            
            // Adjust background size to fit text
            const textBounds = this.coordText.getBounds();
            this.background.setSize(
                textBounds.width + this.config.padding * 2,
                textBounds.height + this.config.padding * 2
            );
        }
        
        preUpdate(time, delta) {
            // Update coordinates at specified frequency
            if (time - this.lastUpdate > this.config.updateFrequency) {
                this.updateCoordinates();
                this.lastUpdate = time;
            }
        }
    }
    
    class TestWormV2Scene extends Phaser.Scene {
        constructor() {
            super({ key: 'TestWormV2Scene' });
            
            // Physics parameters - moved to top for consistency
            this.physicsParams = {
                // World physics
                gravityEnabled: true,
                gravityY: 1,
                
                // Segment physics
                segmentFriction: 1,
                segmentFrictionStatic: 0.8,
                segmentDensity: 0.03,
                segmentRestitution: 0.0001,
                
                // Main constraint parameters
                constraintStiffness: 1,
                constraintDamping: 0.08,
                constraintLength: 1.8, // Small gap to prevent overlap
                
                // Motor parameters
                motorSpeed: 5, // rotations per second
                motorAxelOffset: 40,
                
                // Action parameters
                straightenTorque: 2.0, // Angular acceleration in rad/s²
                straightenDamping: 0.1, // Damping to prevent oscillation
                

                flattenIdle: 0.000001,
                flattenStiffness: 0.5, // Stiffness for flatten constraints
                
                jumpIdle: 0.000001,
                jumpStiffness: 0.05, // Stiffness for jump constraint


                // Debug
                showDebug: true,
                showGrid: true,
                
                // Camera
                cameraFollowTail: true,
                cameraZoom: 2
            };
        }

        create() {
            // Set world bounds without default walls
            this.matter.world.setBounds(0, 0, 800, 600, 32, false, false, false, false);
            
            // Create custom colored boundary walls
            this.createBoundaryWalls();
            
            // Create dat.GUI
            this.gui = new dat.GUI();
            
            // Create grid background
            this.createGrid();

            // Target platform on left side
            this.platform = this.matter.add.rectangle(400, 600, 20, 100, {
                isStatic: true,
                friction: 1,
                restitution: 0.1,
                render: { fillColor: 0xe17055 }
            });
            
            // // Add visual platform using Phaser graphics
            // const platformGraphics = this.add.graphics();
            // platformGraphics.fillStyle(0xe17055, 1); // Orange/coral color
            // platformGraphics.lineStyle(3, 0xd63031, 1); // Darker red outline
            // platformGraphics.fillRect(-110, -10, 220, 20);
            // platformGraphics.strokeRect(-110, -10, 220, 20);
            // platformGraphics.x = 150;
            // platformGraphics.y = 400;
            //
            // Create worm with simple config
            this.worm = this.createWorm(30, 300, {
                baseRadius: 10,
                segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
            });
            
            // Create camera target - a Phaser object that follows the motor
            this.cameraTarget = this.add.rectangle(0, 0, 10, 10, 0xff0000, 0); // Invisible rectangle

            
            // Add mouse constraint for interaction
            this.matter.add.mouseSpring({
                length: 0,
                stiffness: 0.2,
                damping: 0,
                angularStiffness: 0,
                collisionFilter: {
                    category: 0x0001,
                    mask: 0xFFFFFFFF,
                    group: 0
                }
            });
            
            // Setup GUI controls
            this.setupGUI();
            
            // Set up camera following after GUI is initialized
            this.cameras.main.setDeadzone(150, 150);
            if (this.physicsParams.cameraFollowTail) {
                this.cameras.main.startFollow(this.cameraTarget, true);
            }
            
            // Add coordinate display tool
            this.coordDisplay = new CoordinateDisplay(this, 10, 300, {
                backgroundColor: 0x2d3436,
                backgroundAlpha: 0.9,
                textColor: '#4ecdc4',
                fontSize: '16px'
            });
            
            // Set depth to ensure it's on top
            this.coordDisplay.setDepth(1000);
            
            
            // Set up camera basic settings
            this.cameras.main.setZoom(2);
            this.cameras.main.setBounds(0, 0, 800, 600);

            // Camera zoom controls
            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                const camera = this.cameras.main;
                const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Phaser.Math.Clamp(camera.zoom + zoomDelta, 0.5, 3);
                camera.setZoom(newZoom);
                this.physicsParams.cameraZoom = newZoom;
            });
            
            // Set up keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            this.motorDirection = 0; // -1 for left, 0 for idle, 1 for right
            this.motorNeutralAngle = -Math.PI/2; // Crank pointing up (12 o'clock, closest to head)
            
            // Add spacebar key
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        
        createBoundaryWalls() {
            const wallThickness = 50;
            const wallColor = 0x2c3e50;
            
            // Create visual boundary with Phaser graphics
            const graphics = this.add.graphics();
            
            // Draw colored boundary walls
            graphics.fillStyle(wallColor, 0.8);
            graphics.lineStyle(3, 0x34495e, 1);
            
            // Top wall
            graphics.fillRect(0, -wallThickness, 800, wallThickness);
            graphics.strokeRect(0, -wallThickness, 800, wallThickness);
            
            // Bottom wall
            graphics.fillRect(0, 600, 800, wallThickness);
            graphics.strokeRect(0, 600, 800, wallThickness);
            
            // Left wall
            graphics.fillRect(-wallThickness, 0, wallThickness, 600);
            graphics.strokeRect(-wallThickness, 0, wallThickness, 600);
            
            // Right wall
            graphics.fillRect(800, 0, wallThickness, 600);
            graphics.strokeRect(800, 0, wallThickness, 600);
            
            // Add red boundary line
            graphics.lineStyle(4, 0xe74c3c, 0.8);
            graphics.strokeRect(0, 0, 800, 600);
            
            // Create physics walls
            const walls = [
                // Top wall
                this.matter.add.rectangle(400, -wallThickness/2, 800, wallThickness, {
                    isStatic: true
                }),
                // Bottom wall
                this.matter.add.rectangle(400, 600 + wallThickness/2, 800, wallThickness, {
                    isStatic: true
                }),
                // Left wall
                this.matter.add.rectangle(-wallThickness/2, 300, wallThickness, 600, {
                    isStatic: true
                }),
                // Right wall
                this.matter.add.rectangle(800 + wallThickness/2, 300, wallThickness, 600, {
                    isStatic: true
                })
            ];
        }
        
        createGrid() {
            const gridSize = 50; // Size of each grid cell
            const graphics = this.add.graphics();
            
            // Set grid line style
            graphics.lineStyle(1, 0x3a3a4a, 0.3); // Dark gray with low opacity
            
            // Draw vertical lines
            for (let x = 0; x <= 800; x += gridSize) {
                graphics.moveTo(x, 0);
                graphics.lineTo(x, 600);
            }
            
            // Draw horizontal lines
            for (let y = 0; y <= 600; y += gridSize) {
                graphics.moveTo(0, y);
                graphics.lineTo(800, y);
            }
            
            // Draw the grid
            graphics.strokePath();
            
            // Set depth to be behind everything
            graphics.setDepth(-100);
            
            // Store reference for potential updates
            this.gridGraphics = graphics;
        }
        
        setupGUI() {
            
            // World physics folder
            const worldFolder = this.gui.addFolder('World Physics');
            worldFolder.add(this.physicsParams, 'gravityEnabled').name('Enable Gravity').onChange(value => {
                this.matter.world.localWorld.gravity.y = value ? this.physicsParams.gravityY : 0;
            });
            worldFolder.add(this.physicsParams, 'gravityY', 0, 2).name('Gravity Strength').onChange(value => {
                if (this.physicsParams.gravityEnabled) {
                    this.matter.world.localWorld.gravity.y = value;
                }
            });
            worldFolder.open();
            
            // Segment physics folder
            const segmentFolder = this.gui.addFolder('Segment Physics');
            segmentFolder.add(this.physicsParams, 'segmentFriction', 0, 20).onChange(value => {
                this.worm.segments.forEach(segment => {
                    segment.friction = value;
                });
            });
            segmentFolder.add(this.physicsParams, 'segmentFrictionStatic', 0, 1).onChange(value => {
                this.worm.segments.forEach(segment => {
                    segment.frictionStatic = value;
                });
            });
            segmentFolder.add(this.physicsParams, 'segmentDensity', 0.01, 1).onChange(value => {
                this.worm.segments.forEach(segment => {
                    this.matter.body.setDensity(segment, value);
                });
            });
            segmentFolder.add(this.physicsParams, 'segmentRestitution', 0, 1).onChange(value => {
                this.worm.segments.forEach(segment => {
                    segment.restitution = value;
                });
            });
            segmentFolder.open();
            
            // Main constraints folder
            const constraintFolder = this.gui.addFolder('Main Constraints');
            constraintFolder.add(this.physicsParams, 'constraintStiffness', 0, 1).onChange(value => {
                // Update only the main sequential constraints (not lateral ones)
                for (let i = 0; i < this.worm.segments.length - 1; i++) {
                    this.worm.constraints[i].stiffness = value;
                }
            });
            constraintFolder.add(this.physicsParams, 'constraintDamping', 0, 1).onChange(value => {
                for (let i = 0; i < this.worm.segments.length - 1; i++) {
                    this.worm.constraints[i].damping = value;
                }
            });
            constraintFolder.add(this.physicsParams, 'constraintLength', 0, 10).onChange(value => {
                for (let i = 0; i < this.worm.segments.length - 1; i++) {
                    this.worm.constraints[i].length = value;
                }
            });
            constraintFolder.open();
            
            // Motor folder
            const motorFolder = this.gui.addFolder('Motor');
            motorFolder.add(this.physicsParams, 'motorSpeed', 0, 5).name('Speed (rot/sec)').step(0.1);
            motorFolder.open();
            
            // Actions folder
            const actionsFolder = this.gui.addFolder('Actions');
            actionsFolder.add(this.physicsParams, 'straightenTorque', 0, 5).name('Straighten Force').step(0.1);
            actionsFolder.add(this.physicsParams, 'straightenDamping', 0, 1).name('Straighten Damping').step(0.01);
            actionsFolder.add(this.physicsParams, 'flattenStiffness', 0, 1).name('Flatten Stiffness').step(0.01);
            actionsFolder.add(this.physicsParams, 'jumpStiffness', 0, 1).name('Jump Stiffness').step(0.01);
            actionsFolder.open();
            
            // Debug folder
            const debugFolder = this.gui.addFolder('Debug');
            debugFolder.add(this.physicsParams, 'showDebug').onChange(value => {
                this.matter.world.drawDebug = value;
                this.matter.world.debugGraphic.visible = value;
            });
            debugFolder.add(this.physicsParams, 'showGrid').name('Show Grid').onChange(value => {
                if (this.gridGraphics) {
                    this.gridGraphics.setVisible(value);
                }
            });
            
            // Camera folder
            const cameraFolder = this.gui.addFolder('Camera');
            cameraFolder.add(this.physicsParams, 'cameraFollowTail').name('Follow Tail').onChange(value => {
                if (value && this.cameraTarget) {
                    this.cameras.main.startFollow(this.cameraTarget, true);
                } else {
                    this.cameras.main.stopFollow();
                }
            });
            cameraFolder.add(this.physicsParams, 'cameraZoom', 0.5, 3).name('Zoom').step(0.1).onChange(value => {
                this.cameras.main.setZoom(value);
            });
            cameraFolder.open();
        }
        
        createWorm(x, y, config = {}) {
            const segments = [];
            const constraints = [];
            const segmentRadii = [];
            
            // Default configuration
            const defaultConfig = {
                baseRadius: 10,
                segmentSizes: [0.85, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
            };
            
            // Merge with provided config
            const { baseRadius, segmentSizes } = { ...defaultConfig, ...config };
            
            const Matter = Phaser.Physics.Matter.Matter;

            // Create segments with variable sizes
            let currentY = y;
            let motorY;
            let motorIndex = 2;
            for (let i = 0; i < segmentSizes.length; i++) {
                // Calculate radius based on percentage
                const radius = baseRadius * segmentSizes[i];
                segmentRadii.push(radius);
                
                let density = this.physicsParams.segmentDensity;
                let friction = this.physicsParams.segmentFriction;
                let frictionStatic = this.physicsParams.segmentFrictionStatic;

                // Special properties for head segment
                if (i === 0) {
                    // density = this.physicsParams.segmentDensity * 5; // 5x heavier head
                    // friction = 150;  // Higher friction for better grip
                    // frictionStatic = 0.5; // Higher static friction
                }

                // Create segment body
                const segment = this.matter.add.circle(x, currentY, radius, {
                    friction: friction,
                    frictionStatic: frictionStatic,
                    density: density,
                    restitution: this.physicsParams.segmentRestitution,
                    slop: 0.01, // Very tight collision tolerance
                    render: {
                        fillStyle: '#' + this.getSegmentColor(i, segmentSizes.length).toString(16).padStart(6, '0'),
                        strokeStyle: '#' + this.getDarkerColor(this.getSegmentColor(i, segmentSizes.length)).toString(16).padStart(6, '0'),
                        lineWidth: 2,
                        visible: true,
                    },
                });
                
                // Add visual circle using Phaser graphics
                const segmentGraphics = this.add.graphics();
                segmentGraphics.fillStyle(this.getSegmentColor(i, segmentSizes.length), 1);
                segmentGraphics.strokeStyle = this.getDarkerColor(this.getSegmentColor(i, segmentSizes.length));
                segmentGraphics.lineWidth = 2;
                segmentGraphics.fillCircle(0, 0, radius);
                segmentGraphics.strokeCircle(0, 0, radius);
                
                // Store graphics reference
                segment.graphics = segmentGraphics;
                
                if (i === motorIndex) {
                    motorY = currentY; // Store Y position for motor
                }

                segments.push(segment);
                
                // Position next segment
                if (i < segmentSizes.length - 1) {
                    const nextRadius = baseRadius * segmentSizes[i + 1];
                    currentY += radius + nextRadius + 2; // Small gap between segments
                }
            }

            // Create motor attached to the worm
            const motor = this.matter.add.circle(x, motorY, baseRadius * 3, {
                name: 'motor',
                density: 0.001,  // Start with no density
                isSensor: true,
                render: {
                    visible: this.physicsParams.showDebug,
                }
            });

            // Attach motor to segment with a bearing (allows rotation)
            const motorMount = Matter.Constraint.create({
                bodyA: segments[1],
                bodyB: motor,
                pointB: { x: 0, y: this.physicsParams.motorAxelOffset },
                length: this.physicsParams.motorAxelOffset * 0.3,
                stiffness: 0.3,
                damping: 0.1,
                render: {
                    visible: this.physicsParams.showDebug,
                }
            });
            Matter.World.add(this.matter.world.localWorld, motorMount);
            
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                
                // Tangent points
                const radiusA = segmentRadii[i];
                const radiusB = segmentRadii[i + 1];
                
                const pointA = { x: 0, y: radiusA + 1 };  // Bottom of segA
                const pointB = { x: 0, y: -radiusB - 1 }; // Top of segB
                
                const constraint = Matter.Constraint.create({
                    bodyA: segA,
                    bodyB: segB,
                    pointA: pointA,
                    pointB: pointB,
                    length: this.physicsParams.constraintLength,
                    stiffness: this.physicsParams.constraintStiffness,
                    damping: this.physicsParams.constraintDamping,
                    render: {
                        visible: true,
                    }
                });
                
                Matter.World.add(this.matter.world.localWorld, constraint);
                constraints.push(constraint);
            }
            
            // Add minimum distance constraints between non-adjacent segments to prevent compression
            // This helps prevent the motor weight from forcing segments through each other
            for (let i = 0; i < segments.length - 2; i++) {
                const segA = segments[i];
                const segB = segments[i + 2]; // Skip one segment
                const minDistance = segmentRadii[i] + segmentRadii[i + 2] + 5; // Minimum separation
                
                const spacingConstraint = Matter.Constraint.create({
                    bodyA: segA,
                    bodyB: segB,
                    pointA: { x: 0, y: 0 },
                    pointB: { x: 0, y: 0 },
                    length: minDistance,
                    stiffness: 0.005, // Very soft, only activates when too close
                    damping: 0.1,
                    render: {
                        visible: false,
                        anchors: false,
                        showVelocity: false
                    }
                });
                
                // Only add constraint if it helps maintain structure
                Matter.World.add(this.matter.world.localWorld, spacingConstraint);
                constraints.push(spacingConstraint);
            }
            
            // Add flatten springs between neighboring segments
            const flattenSprings = [];
            for (let i = 0; i < segments.length - 1; i++) {
                const segA = segments[i];
                const segB = segments[i + 1];
                
                // Calculate current distance between segments
                const dx = segB.position.x - segA.position.x;
                const dy = segB.position.y - segA.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const spring = Matter.Constraint.create({
                    bodyA: segA,
                    bodyB: segB,
                    // No pointA/pointB specified - defaults to centers
                    length: distance * 1.25, // Shorter to create contraction
                    stiffness: this.physicsParams.flattenIdle,
                    render: {
                        visible: true,
                        strokeStyle: '#ff6b6b',
                        lineWidth: 2,
                    }
                });
                
                Matter.World.add(this.matter.world.localWorld, spring);
                flattenSprings.push(spring);
            }
            
            // Add jump spring from head to second-to-last segment
            let jumpSpring = null;
            if (segments.length > 2) {
                const head = segments[0];
                const jumpTarget = segments[segments.length - 2]; // Second to last segment
                
                // Calculate current distance between segments
                const dx = jumpTarget.position.x - head.position.x;
                const dy = jumpTarget.position.y - head.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                jumpSpring = Matter.Constraint.create({
                    bodyA: head,
                    bodyB: jumpTarget,
                    // No pointA/pointB specified - defaults to centers
                    length: distance * 2, // Shorter to create launch tension
                    stiffness: this.physicsParams.jumpIdle,
                    render: {
                        visible: true,
                        strokeStyle: '#74b9ff',
                        lineWidth: 3,
                    }
                });
                
                Matter.World.add(this.matter.world.localWorld, jumpSpring);
            }

            return {
                segments: segments,
                constraints: constraints,
                motor: motor,
                motorMount: motorMount,
                flattenSprings: flattenSprings,
                jumpSpring: jumpSpring
            };
        }
        
        getSegmentColor(index, total) {
            // Create a gradient from head to tail
            if (index === 0) {
                return 0xff6b6b; // Head (coral red)
            } else if (index === 1) {
                return 0xffa502; // Shoulder (orange)
            } else if (index === 2) {
                return 0xffd93d; // Upper body (yellow)
            } else if (index < 5) {
                return 0x6bcf7f; // Mid body (green)
            } else if (index < 8) {
                return 0x4ecdc4; // Lower body (teal)
            } else if (index < 11) {
                return 0x74b9ff; // Near tail (light blue)
            } else {
                return 0xa29bfe; // Tail (purple)
            }
        }
        
        getDarkerColor(color) {
            // Make color 20% darker for outline
            const r = (color >> 16) & 0xff;
            const g = (color >> 8) & 0xff;
            const b = color & 0xff;
            
            return ((r * 0.8) << 16) | ((g * 0.8) << 8) | (b * 0.8);
        }
        
        update(time, delta) {
            
            // Update motor direction based on keyboard input
            const wasPressed = this.motorDirection !== 0;
            
            if (this.cursors.left.isDown) {
                this.motorDirection = -1;
            } else if (this.cursors.right.isDown) {
                this.motorDirection = 1;
            } else {
                this.motorDirection = 0;
            }
            
            // Update motor density based on movement
            if (this.worm.motor) {
                if (this.motorDirection !== 0) {
                    // Give motor mass when moving
                    this.matter.body.setDensity(this.worm.motor, 0.01);
                } else {
                    // Remove motor mass when idle
                    this.matter.body.setDensity(this.worm.motor, 0.0001);
                }
            }
            
            // Rotate motor based on direction and speed
            if (this.worm.motor && this.motorDirection !== 0) {
                const rotationSpeed = Math.PI * 2 * this.physicsParams.motorSpeed * this.motorDirection; // radians per second
                const rotationDelta = (rotationSpeed * delta) / 1000; // radians per frame
                const currentAngle = this.worm.motor.angle;
                
                // Force rotation by setting angle directly
                this.matter.body.setAngle(this.worm.motor, currentAngle + rotationDelta);
                
                // Also apply torque to help overcome resistance
                this.matter.body.setAngularVelocity(this.worm.motor, rotationSpeed);
            } else if (this.worm.motor && wasPressed) {
                // Snap to neutral position immediately when keys are released
                // this.matter.body.setAngle(this.worm.motor, this.motorNeutralAngle);
                this.matter.body.setAngularVelocity(this.worm.motor, 0);
            }
            
            
            // Update camera target to follow motor position
            if (this.cameraTarget && this.worm.motor) {
                this.cameraTarget.x = this.worm.motor.position.x;
                this.cameraTarget.y = this.worm.motor.position.y;
            }
            
            // Handle down arrow for flatten spring activation
            if (this.worm && this.worm.flattenSprings) {
                if (this.cursors.down.isDown) {
                    // Apply flatten parameters to all springs when down arrow is pressed
                    this.worm.flattenSprings.forEach(spring => {
                        spring.stiffness = this.physicsParams.flattenStiffness;
                    });
                } else {
                    // Return to idle parameters when released
                    this.worm.flattenSprings.forEach(spring => {
                        spring.stiffness = this.physicsParams.flattenIdle;
                    });
                }
            }
            
            // Handle spacebar for jump spring activation
            if (this.worm && this.worm.jumpSpring) {
                if (this.spaceKey.isDown) {
                    // Apply jump parameters when spacebar is pressed
                    this.worm.jumpSpring.stiffness = this.physicsParams.jumpStiffness;
                } else {
                    // Return to idle parameters when released
                    this.worm.jumpSpring.stiffness = this.physicsParams.jumpIdle;
                }
            }
            
            // Update segment graphics positions
            if (this.worm && this.worm.segments) {
                this.worm.segments.forEach((segment) => {
                    if (segment.graphics) {
                        segment.graphics.x = segment.position.x;
                        segment.graphics.y = segment.position.y;
                        // segment.graphics.rotation = segment.angle;
                    }
                });
            }
        }
    }

    // Game configuration
    const config = {
        type: Phaser.AUTO,
        width: 1024,
        height: 768,
        parent: 'game-container',
        backgroundColor: '#232333',
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: 1 },  // Start with gravity off
                debug: {
                    wireframes: false,
                    showBody: true,
                    showConstraint: true,
                    showStaticBody: true,
                    showAngleIndicator: true,
                    //showVelocity: true,
                    //showCollisions: true,
                    //showAxes: false,
                },
                positionIterations: 10,   // Even higher for better collision resolution
                velocityIterations: 16,
                constraintIterations: 2,
            }
        },
        scene: TestWormV2Scene
    };

    // Create and start the game
    const game = new Phaser.Game(config);
})();
