(() => {
    class TestWormV2Scene extends Phaser.Scene {
        constructor() {
            super({ key: 'TestWormV2Scene' });
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
                restitution: 0,
                render: { fillColor: 0x2d3436 }
            });
            
            // Left wall
            this.matter.add.rectangle(25, 300, wallThickness, 600, { 
                isStatic: true,
                friction: 10,
                restitution: 0.2,
                render: { fillColor: 0x2d3436 }
            });
            
            // Right wall
            this.matter.add.rectangle(775, 300, wallThickness, 600, { 
                isStatic: true,
                friction: 10,
                restitution: 0.2,
                render: { fillColor: 0x2d3436 }
            });

            // Target platform on left side
            this.platform = this.matter.add.rectangle(150, 300, 120, 20, {
                isStatic: true,
                friction: 15,
                restitution: 0.1,
                render: { fillColor: 0xe17055 }
            });

            // Create worm with simple config
            this.worm = this.createWorm(400, 100, {
                baseRadius: 10,
                segmentSizes: [0.85, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
            });

            // Simple graphics for rendering
            this.graphics = this.add.graphics();
            
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
                constraintDamping: 0.5,
                constraintLength: 1,
                
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
                motorEnabled: true,
                motorSpeed: 1, // rotations per second
                motorArmStiffness: 1,
                motorArmDamping: 0.1,
                motorArmLength: 40,
                
                // Debug
                showDebug: true
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



            // Create segment body
            const motor = this.matter.add.circle(x, motorY, baseRadius * 5, {
                name: 'motor',
                isSensor: true,
                density: 0.02,
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
                render: {
                }
            });
            Matter.World.add(this.matter.world.localWorld, motorAxel);
            constraints.push(motorAxel);


            // attach motor to 2nd segment
            const motorArm = Matter.Constraint.create({
                bodyA: motor,
                bodyB: segments[1],
                pointA: { x: 0, y: baseRadius * 4 },
                pointB: { x: 0, y: 0 }, // axel
                length: baseRadius * 8,
                stiffness: 0.4, // Softer spring
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

            const shoulderSegment = segments[1];
            const torsoIndex = Math.floor(segments.length * 0.35);
            const torsoSegment = segments[torsoIndex];
            const lateralLength = baseRadius * 3; // Default length for lateral constraints

            const lateralConstraint1 = Matter.Constraint.create({
                bodyA: shoulderSegment,
                bodyB: torsoSegment,
                pointA: { x: -segmentRadii[1], y: 0 }, // Left side of shoulder
                pointB: { x: -segmentRadii[torsoIndex], y: 0 }, // Left side of torso
                length: lateralLength,
                stiffness: 0.003, // Softer spring
                damping: 0.1,
                render: {
                    visible: true,
                    strokeStyle: '#ff6b6b',
                    lineWidth: 2
                }
            });

            const lateralConstraint2 = Matter.Constraint.create({
                bodyA: shoulderSegment,
                bodyB: torsoSegment,
                pointA: { x: segmentRadii[1], y: 0 }, // Right side of shoulder
                pointB: { x: segmentRadii[torsoIndex], y: 0 }, // Right side of torso
                length: lateralLength,
                stiffness: 0.003, // Softer spring
                damping: 0.1,
                render: {
                    visible: true,
                    strokeStyle: '#ff6b6b',
                    lineWidth: 2
                }
            });

            // Matter.World.add(this.matter.world.localWorld, lateralConstraint1);
            // Matter.World.add(this.matter.world.localWorld, lateralConstraint2);
            constraints.push(lateralConstraint1);
            constraints.push(lateralConstraint2);
            
            return {
                segments: segments,
                constraints: constraints,
                motor: motor,
                motorConstraint: motorAxel,
                motorArm: motorArm
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
            // Clear graphics
            this.graphics.clear();
            
            // Rotate motor based on GUI settings
            if (this.worm.motor && this.physicsParams.motorEnabled) {
                const rotationSpeed = Math.PI * 2 * this.physicsParams.motorSpeed; // radians per second
                const rotationDelta = (rotationSpeed * delta) / 1000; // radians per frame
                const currentAngle = this.worm.motor.angle;
                this.matter.body.setAngle(this.worm.motor, currentAngle + rotationDelta);
            }
            
            // // Simple visual update - draw segment connections
            // this.graphics.lineStyle(1, 0x556b8d, 0.8);
            
            // for (let i = 0; i < this.worm.segments.length - 1; i++) {
            //     const current = this.worm.segments[i];
            //     const next = this.worm.segments[i + 1];
            //
            //     this.graphics.lineBetween(
            //         current.position.x, current.position.y,
            //         next.position.x, next.position.y
            //     );
            // }
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
                debug: true,
                showAngleIndicator: true,
                positionIterations: 12,   // Higher for better collision detection
            }
        },
        scene: TestWormV2Scene
    };

    // Create and start the game
    const game = new Phaser.Game(config);
})();
