import { Worm } from './Worm.js';

(() => {
    class TestWormClassScene extends Phaser.Scene {
        constructor() {
            super({ key: 'TestWormClassScene' });
        }

        create() {
            // Set world bounds
            this.matter.world.setBounds(0, 0, 800, 600, 32, false, false, false, false);
            
            // Create boundary walls
            this.createBoundaryWalls();
            
            // Create platform
            this.platform = this.matter.add.rectangle(250, 450, 220, 20, {
                isStatic: true,
                friction: 1,
                restitution: 0.1,
                render: { fillColor: 0xe17055 }
            });
            
            // Create worm using the new class
            this.worm = new Worm(this, 100, 300, {
                baseRadius: 10,
                segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
                motorSpeed: 5,
                jumpStiffness: 0.05,
                flattenStiffness: 0.5
            });
            
            // Set up camera
            this.cameras.main.setZoom(2);
            this.cameras.main.setBounds(0, 0, 800, 600);
            
            // Create camera target that follows motor
            this.cameraTarget = this.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
            this.cameras.main.startFollow(this.cameraTarget, true);
            
            // Set up controls
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            
            // Add mouse constraint
            this.matter.add.mouseSpring({
                length: 0,
                stiffness: 0.2,
                damping: 0,
                angularStiffness: 0
            });
            
            // Add simple GUI
            this.createSimpleGUI();
        }
        
        createBoundaryWalls() {
            const wallThickness = 50;
            
            // Create physics walls
            this.matter.add.rectangle(400, -wallThickness/2, 800, wallThickness, { isStatic: true });
            this.matter.add.rectangle(400, 600 + wallThickness/2, 800, wallThickness, { isStatic: true });
            this.matter.add.rectangle(-wallThickness/2, 300, wallThickness, 600, { isStatic: true });
            this.matter.add.rectangle(800 + wallThickness/2, 300, wallThickness, 600, { isStatic: true });
        }
        
        createSimpleGUI() {
            // Create control text
            const style = { fontSize: '16px', fill: '#ffffff' };
            this.add.text(10, 10, 'Controls:', style);
            this.add.text(10, 30, '← → : Move', style);
            this.add.text(10, 50, '↓ : Flatten', style);
            this.add.text(10, 70, 'Space : Jump', style);
            this.add.text(10, 90, 'Scroll : Zoom', style);
        }
        
        update(time, delta) {
            if (!this.worm) return;
            
            // Handle input
            if (this.cursors.left.isDown) {
                this.worm.setMotorDirection(-1);
            } else if (this.cursors.right.isDown) {
                this.worm.setMotorDirection(1);
            } else {
                this.worm.setMotorDirection(0);
            }
            
            // Handle flatten
            this.worm.setFlatten(this.cursors.down.isDown);
            
            // Handle jump
            this.worm.setJump(this.spaceKey.isDown);
            
            // Update worm
            this.worm.update(delta);
            
            // Update camera target
            const motorPos = this.worm.getMotorPosition();
            if (motorPos && this.cameraTarget) {
                this.cameraTarget.x = motorPos.x;
                this.cameraTarget.y = motorPos.y;
            }
            
            // Handle zoom
            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                const camera = this.cameras.main;
                const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Phaser.Math.Clamp(camera.zoom + zoomDelta, 0.5, 3);
                camera.setZoom(newZoom);
            });
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
                gravity: { y: 1 },
                debug: {
                    wireframes: false,
                    showBody: true,
                    showConstraint: true,
                    showStaticBody: true,
                    showAngleIndicator: true,
                },
                positionIterations: 10,
                velocityIterations: 16,
                constraintIterations: 2,
            }
        },
        scene: TestWormClassScene
    };

    // Create and start the game
    const game = new Phaser.Game(config);
})();