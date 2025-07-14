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
        }

        create() {
            // Set world bounds with walls
            this.matter.world.setBounds(0, 0, 800, 600, 32, true, true, true, true);
            
            // Create dat.GUI
            this.gui = new dat.GUI();

            // Target platform on left side
            this.platform = this.matter.add.rectangle(150, 300, 120, 20, {
                isStatic: true,
                friction: 15,
                restitution: 0.1,
                render: { fillColor: 0xe17055 }
            });

            // Create worm with simple config
            this.worm = this.createWorm(30, 300, {
                baseRadius: 10,
                segmentSizes: [0.85, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
            });

            
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
            
            // Add coordinate display tool
            this.coordDisplay = new CoordinateDisplay(this, 10, 10, {
                backgroundColor: 0x2d3436,
                backgroundAlpha: 0.9,
                textColor: '#4ecdc4',
                fontSize: '16px'
            });
            
            // Set depth to ensure it's on top
            this.coordDisplay.setDepth(1000);
            
            // Set up tail pinning if enabled
            if (this.physicsParams.pinTail) {
                this.tailPinPosition = { x: 135, y: 555 };
            }
            
            // Set up camera
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
            
            // Set up drag handling for static bodies
            this.setupStaticBodyDragging();
        }
        
        setupStaticBodyDragging() {
            let draggedBody = null;
            let dragOffset = { x: 0, y: 0 };
            
            // Listen for pointer down
            this.input.on('pointerdown', (pointer) => {
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                const bodies = this.matter.world.getAllBodies();
                
                // Check if we clicked on the tail anchor
                if (this.worm && this.worm.tailAnchor) {
                    const anchor = this.worm.tailAnchor;
                    const distance = Phaser.Math.Distance.Between(
                        worldPoint.x, worldPoint.y,
                        anchor.position.x, anchor.position.y
                    );
                    
                    if (distance <= anchor.circleRadius) {
                        draggedBody = anchor;
                        dragOffset.x = anchor.position.x - worldPoint.x;
                        dragOffset.y = anchor.position.y - worldPoint.y;
                    }
                }
            });
            
            // Listen for pointer move
            this.input.on('pointermove', (pointer) => {
                if (draggedBody && draggedBody.isStatic) {
                    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                    this.matter.body.setPosition(draggedBody, {
                        x: worldPoint.x + dragOffset.x,
                        y: worldPoint.y + dragOffset.y
                    });
                }
            });
            
            // Listen for pointer up
            this.input.on('pointerup', () => {
                draggedBody = null;
            });
        }
        
        setupGUI() {
            // Physics parameters
            this.physicsParams = {
                // World physics
                gravityEnabled: true,
                gravityY: 1,
                
                // Segment physics
                segmentFriction: 1,
                segmentFrictionStatic: 5,
                segmentDensity: 0.03,
                segmentRestitution: 0.01,
                
                // Main constraint parameters
                constraintStiffness: 1,
                constraintDamping: 0.0,
                constraintLength: 0,
                
                // Left lateral constraint parameters
                leftLateralStiffness: 0.03,
                leftLateralDamping: 0.1,
                leftLateralLength: 70,
                showLeftLateral: true,
                
                // Right lateral constraint parameters
                rightLateralStiffness: 0.03,
                rightLateralDamping: 0.1,
                rightLateralLength: 70,
                showRightLateral: true,
                
                // Motor parameters
                motorEnabled: false,
                motorSpeed: 3, // rotations per second
                motorArmStiffness: 1,
                motorArmDamping: 0.1,
                motorArmLength: 40,
                
                // Debug
                showDebug: true,
                pinTail: true,
                
                // Camera
                cameraFollowTail: true,
                cameraZoom: 2
            };
            
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
            
            // Left lateral constraint folder
            const leftLateralFolder = this.gui.addFolder('Left Lateral Spring');
            leftLateralFolder.add(this.physicsParams, 'leftLateralStiffness', 0.001, 0.1).name('Stiffness').onChange(value => {
                // Update the left lateral constraint (first lateral constraint)
                const leftLateralIndex = this.worm.segments.length - 1;
                if (this.worm.constraints[leftLateralIndex]) {
                    this.worm.constraints[leftLateralIndex].stiffness = value;
                }
            });
            leftLateralFolder.add(this.physicsParams, 'leftLateralDamping', 0, 1).name('Damping').onChange(value => {
                const leftLateralIndex = this.worm.segments.length - 1;
                if (this.worm.constraints[leftLateralIndex]) {
                    this.worm.constraints[leftLateralIndex].damping = value;
                }
            });
            leftLateralFolder.add(this.physicsParams, 'leftLateralLength', 50, 300).name('Length').onChange(value => {
                const leftLateralIndex = this.worm.segments.length - 1;
                if (this.worm.constraints[leftLateralIndex]) {
                    this.worm.constraints[leftLateralIndex].length = value;
                }
            });
            leftLateralFolder.add(this.physicsParams, 'showLeftLateral').name('Show').onChange(value => {
                const leftLateralIndex = this.worm.segments.length - 1;
                if (this.worm.constraints[leftLateralIndex]) {
                    this.worm.constraints[leftLateralIndex].render.visible = value;
                }
            });
            leftLateralFolder.open();
            
            // Right lateral constraint folder
            const rightLateralFolder = this.gui.addFolder('Right Lateral Spring');
            rightLateralFolder.add(this.physicsParams, 'rightLateralStiffness', 0.001, 0.1).name('Stiffness').onChange(value => {
                // Update the right lateral constraint (second lateral constraint)
                const rightLateralIndex = this.worm.segments.length;
                if (this.worm.constraints[rightLateralIndex]) {
                    this.worm.constraints[rightLateralIndex].stiffness = value;
                }
            });
            rightLateralFolder.add(this.physicsParams, 'rightLateralDamping', 0, 1).name('Damping').onChange(value => {
                const rightLateralIndex = this.worm.segments.length;
                if (this.worm.constraints[rightLateralIndex]) {
                    this.worm.constraints[rightLateralIndex].damping = value;
                }
            });
            rightLateralFolder.add(this.physicsParams, 'rightLateralLength', 50, 300).name('Length').onChange(value => {
                const rightLateralIndex = this.worm.segments.length;
                if (this.worm.constraints[rightLateralIndex]) {
                    this.worm.constraints[rightLateralIndex].length = value;
                }
            });
            rightLateralFolder.add(this.physicsParams, 'showRightLateral').name('Show').onChange(value => {
                const rightLateralIndex = this.worm.segments.length;
                if (this.worm.constraints[rightLateralIndex]) {
                    this.worm.constraints[rightLateralIndex].render.visible = value;
                }
            });
            rightLateralFolder.open();
            
            // Motor folder
            const motorFolder = this.gui.addFolder('Motor');
            motorFolder.add(this.physicsParams, 'motorEnabled').name('Enable Motor');
            motorFolder.add(this.physicsParams, 'motorSpeed', -5, 5).name('Speed (rot/sec)').step(0.1);
            motorFolder.add(this.physicsParams, 'motorArmStiffness', 0.01, 1.0).name('Arm Stiffness').step(0.01).onChange(value => {
                if (this.worm.motorArm) {
                    this.worm.motorArm.stiffness = value;
                }
            });
            motorFolder.add(this.physicsParams, 'motorArmDamping', 0, 1).name('Arm Damping').step(0.01).onChange(value => {
                if (this.worm.motorArm) {
                    this.worm.motorArm.damping = value;
                }
            });
            motorFolder.add(this.physicsParams, 'motorArmLength', 0, 100).name('Arm Length').step(1).onChange(value => {
                if (this.worm.motorArm) {
                    this.worm.motorArm.length = value;
                }
            });
            motorFolder.open();
            
            // Debug folder
            const debugFolder = this.gui.addFolder('Debug');
            debugFolder.add(this.physicsParams, 'showDebug').onChange(value => {
                this.matter.world.drawDebug = value;
                this.matter.world.debugGraphic.visible = value;
            });
            debugFolder.add(this.physicsParams, 'pinTail').name('Show Tail Anchor').onChange(value => {
                if (this.worm && this.worm.tailAnchor) {
                    this.worm.tailAnchor.render.visible = value;
                }
                if (this.worm && this.worm.tailConstraint) {
                    this.worm.tailConstraint.render.visible = value;
                }
            });
            
            // Camera folder
            const cameraFolder = this.gui.addFolder('Camera');
            cameraFolder.add(this.physicsParams, 'cameraFollowTail').name('Follow Tail');
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
            const group2 = this.matter.world.nextGroup(true);

            // Create segments with variable sizes
            let currentY = y;
            let motorY;
            let motorIndex = 3;
            for (let i = 0; i < segmentSizes.length; i++) {
                // Calculate radius based on percentage
                const radius = baseRadius * segmentSizes[i];
                segmentRadii.push(radius);
                
                // Create segment body
                const segment = this.matter.add.circle(x, currentY, radius, {
                    friction: 100,
                    frictionStatic: 0.25,
                    density: 0.03,
                    restitution: 0.00,
                    collisionFilter: {
                    },
                    render: {
                        fillColor: this.getSegmentColor(i, segmentSizes.length)
                    },
                });
                
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

            // Create draggable tail anchor
            const tail = segments[segments.length - 1];
            const tailAnchor = this.matter.add.circle(30, 560, 15, {
                isStatic: true,  // Keep it static
                isSensor: true,
                render: {
                }
            });
            
            // Create constraint between tail and anchor
            const tailPin = Matter.Constraint.create({
                bodyA: tailAnchor,
                bodyB: tail,
                length: 0,
                stiffness: 1,
                damping: 0.1,
            });
            Matter.World.add(this.matter.world.localWorld, tailPin);
            
            // Create segment body
            const motor = this.matter.add.circle(x, motorY, baseRadius * 6, {
                name: 'motor',
                isSensor: true,
                density: 0.002,
                render: {
                    fillColor: 0xff6b6b, // Red color for motor
                    visible: true,
                    lineWidth: 2,
                    strokeStyle: '#ff6b6b'
                }
            });

            const motorAxel = Matter.Constraint.create({
                bodyA: segments[motorIndex],
                bodyB: motor,
                length: 0,
                stiffness: 1,
                damping: 0.1,
            });
            Matter.World.add(this.matter.world.localWorld, motorAxel);
            constraints.push(motorAxel);


            // attach motor to 2nd segment
            const motorArm = Matter.Constraint.create({
                bodyA: motor,
                bodyB: segments[1],
                pointA: { x: 0, y: baseRadius * 1 },
                pointB: { x: 0, y: 0 }, // axel
                length: baseRadius * 8,
                stiffness: 0.1, // Softer spring
                damping: 0.1,
                render: {
                    visible: true,
                    strokeStyle: '#ff6b6b',
                    lineWidth: 2
                }
            });
            Matter.World.add(this.matter.world.localWorld, motorArm);
            constraints.push(motorArm);


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
                    length: 0, // Small gap between segments
                    stiffness: 1,
                    damping: 0.5
                });
                
                Matter.World.add(this.matter.world.localWorld, constraint);
                constraints.push(constraint);
            }

            // const shoulderSegment = segments[1];
            // const torsoIndex = Math.floor(segments.length * 0.35);
            // const torsoSegment = segments[torsoIndex];
            // const lateralLength = baseRadius * 3; // Default length for lateral constraints

            // const lateralConstraint1 = Matter.Constraint.create({
            //     bodyA: shoulderSegment,
            //     bodyB: torsoSegment,
            //     pointA: { x: -segmentRadii[1], y: 0 }, // Left side of shoulder
            //     pointB: { x: -segmentRadii[torsoIndex], y: 0 }, // Left side of torso
            //     length: lateralLength,
            //     stiffness: 0.003, // Softer spring
            //     damping: 0.1,
            // });
            //
            // const lateralConstraint2 = Matter.Constraint.create({
            //     bodyA: shoulderSegment,
            //     bodyB: torsoSegment,
            //     pointA: { x: segmentRadii[1], y: 0 }, // Right side of shoulder
            //     pointB: { x: segmentRadii[torsoIndex], y: 0 }, // Right side of torso
            //     length: lateralLength,
            //     stiffness: 0.003, // Softer spring
            //     damping: 0.1,
            // });

            // Disable for now, I don't think it helps.
            // Matter.World.add(this.matter.world.localWorld, lateralConstraint1);
            // Matter.World.add(this.matter.world.localWorld, lateralConstraint2);
            // constraints.push(lateralConstraint1);
            // constraints.push(lateralConstraint2);
            
            return {
                segments: segments,
                constraints: constraints,
                motor: motor,
                motorConstraint: motorAxel,
                motorArm: motorArm,
                tailAnchor: tailAnchor,
                tailConstraint: tailPin
            };
        }
        
        getSegmentColor(index, total) {
            if (index === 0) {
                return 0xff6b6b; // Head (red)
            } else if (index < 3) {
                return 0x4ecdc4; // Neck (teal)
            } else {
                return 0x95e1d3; // Body (light green)
            }
        }
        
        update(time, delta) {
            
            // Rotate motor based on GUI settings
            if (this.worm.motor && this.physicsParams.motorEnabled) {
                const rotationSpeed = Math.PI * 2 * this.physicsParams.motorSpeed; // radians per second
                const rotationDelta = (rotationSpeed * delta) / 1000; // radians per frame
                const currentAngle = this.worm.motor.angle;
                this.matter.body.setAngle(this.worm.motor, currentAngle + rotationDelta);
            }
            
            // Camera follow tail or anchor
            if (this.physicsParams.cameraFollowTail) {
                if (this.worm.tailAnchor && this.physicsParams.pinTail) {
                    // Follow the anchor when it's visible
                    this.cameras.main.centerOn(this.worm.tailAnchor.position.x, this.worm.tailAnchor.position.y);
                } else if (this.worm.segments.length > 0) {
                    // Otherwise follow the tail
                    const tail = this.worm.segments[this.worm.segments.length - 1];
                    this.cameras.main.centerOn(tail.position.x, tail.position.y);
                }
            }
        }
    }

    // Game configuration
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        backgroundColor: '#232333',
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: 1 },  // Start with gravity off
                debug: {
                    showBody: true,
                    showConstraint: true,
                    showStaticBody: true,
                    showAngleIndicator: true,
                    showVelocity: true,
                    wireframes: true,
                    showAxes: false,
                },
                positionIterations: 12,   // Higher for better collision detection
            }
        },
        scene: TestWormV2Scene
    };

    // Create and start the game
    const game = new Phaser.Game(config);
})();
