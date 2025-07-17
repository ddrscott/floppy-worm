import Phaser from 'phaser';
import * as dat from 'dat.gui';
import CoordinateDisplay from '../components/CoordinateDisplay';
import { defaultPhysicsParams } from '../config/physicsParams';
import DoubleWorm from '../entities/DoubleWorm';
import VirtualControls from '../components/VirtualControls';

export default class TestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestScene' });
        
        // Initialize physics parameters
        this.physicsParams = { ...defaultPhysicsParams };
    }

    create() {
        
        // Set world bounds without default walls
        this.matter.world.setBounds(0, 0, 800, 600, 320, false, false, false, false);
        
        // Create custom colored boundary walls
        this.createBoundaryWalls();
        
        // Create dat.GUI
        this.gui = new dat.GUI();
        
        // Create grid background
        this.createGrid();

        // Target platform on left side
        this.matter.add.gameObject(
            this.add.rectangle(300, 500, 50, 250, 0xff6b6b), {
            isStatic: true,
        });
        
        // Create worm using the new MotorWorm class
        this.worm = new DoubleWorm(this, 460, 220, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
        });
        
        // Create camera target - a Phaser object that follows the swing weight
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
        // Set up camera basic settings
        this.cameras.main.setZoom(2);
        this.cameras.main.setBounds(0, 0, 800, 600);

        
        // Add coordinate display tool
        this.coordDisplay = new CoordinateDisplay(this, 300, 300, {
            backgroundColor: 0x2d3436,
            backgroundAlpha: 0.9,
            textColor: '#4ecdc4',
            fontSize: '16px'
        });
        
        // Set depth to ensure it's on top
        this.coordDisplay.setDepth(1000);
        
        // Add movement instructions - only on desktop
        const isTouchDevice = ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0) || 
                            (navigator.msMaxTouchPoints > 0);
        
        if (!isTouchDevice) {
            // Controller recommendation
            this.add.text(10, 10, '🎮 Best played with a controller!', {
                fontSize: '16px',
                color: '#ffd700',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 5 }
            });
            
            // Control mapping
            const controlsText = [
                'Controls:',
                '─────────',
                'WASD: Head control (Left stick)',
                '↑←↓→: Tail control (Right stick)', 
                'L2/R2: Stiffen springs',
                'Scroll: Zoom | ESC: Menu'
            ].join('\n');
            
            this.add.text(10, 50, controlsText, {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 10, y: 8 },
                lineSpacing: 4
            });
        }
        
        
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
        
        // Add spacebar key
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // ESC to return to levels menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('LevelsScene');
        });
        
        // Virtual controls (joystick + buttons)
        this.virtualControls = new VirtualControls(this);
        
        // Clean up GUI when scene shuts down
        this.events.on('shutdown', () => {
            if (this.gui && this.gui.domElement && this.gui.domElement.parentElement) {
                try {
                    this.gui.destroy();
                } catch (e) {
                    // If destroy fails, manually remove the DOM element
                    if (this.gui.domElement.parentElement) {
                        this.gui.domElement.parentElement.removeChild(this.gui.domElement);
                    }
                }
                this.gui = null;
            }
        });
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
            this.worm.updateConfig({ segmentFriction: value });
        });
        segmentFolder.add(this.physicsParams, 'segmentFrictionStatic', 0, 1).onChange(value => {
            this.worm.updateConfig({ segmentFrictionStatic: value });
        });
        segmentFolder.add(this.physicsParams, 'segmentDensity', 0.01, 1).onChange(value => {
            this.worm.updateConfig({ segmentDensity: value });
        });
        segmentFolder.add(this.physicsParams, 'segmentRestitution', 0, 1).onChange(value => {
            this.worm.updateConfig({ segmentRestitution: value });
        });
        segmentFolder.open();
        
        // Main constraints folder
        const constraintFolder = this.gui.addFolder('Main Constraints');
        constraintFolder.add(this.physicsParams, 'constraintStiffness', 0, 1).onChange(value => {
            this.worm.updateConfig({ constraintStiffness: value });
        });
        constraintFolder.add(this.physicsParams, 'constraintDamping', 0, 1).onChange(value => {
            this.worm.updateConfig({ constraintDamping: value });
        });
        constraintFolder.add(this.physicsParams, 'constraintLength', 0, 10).onChange(value => {
            this.worm.updateConfig({ constraintLength: value });
        });
        constraintFolder.open();
        
        // Swing folder
        const swingFolder = this.gui.addFolder('Swing');
        swingFolder.add(this.physicsParams, 'swingSpeed', 0, 5).name('Speed (rot/sec)').step(0.1).onChange(value => {
            this.worm.updateConfig({ swingSpeed: value });
        });
        swingFolder.open();
        
        // Actions folder
        const actionsFolder = this.gui.addFolder('Actions');
        actionsFolder.add(this.physicsParams, 'straightenTorque', 0, 5).name('Straighten Force').step(0.1);
        actionsFolder.add(this.physicsParams, 'straightenDamping', 0, 1).name('Straighten Damping').step(0.01);
        actionsFolder.add(this.physicsParams, 'flattenStiffness', 0, 1).name('Flatten Stiffness').step(0.01).onChange(value => {
            this.worm.updateConfig({ flattenStiffness: value });
        });
        actionsFolder.add(this.physicsParams, 'jumpStiffness', 0, 1).name('Jump Stiffness').step(0.01).onChange(value => {
            this.worm.updateConfig({ jumpStiffness: value });
        });
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
    
    
    update(time, delta) {
        // Handle input (keyboard + virtual joystick)
        const input = {
            left: this.cursors.left.isDown || (this.virtualControls && this.virtualControls.getLeftPressed()),
            right: this.cursors.right.isDown || (this.virtualControls && this.virtualControls.getRightPressed()),
            jump: this.spaceKey.isDown || (this.virtualControls && this.virtualControls.getJumpPressed()),
            up: this.cursors.up.isDown || (this.virtualControls && this.virtualControls.getUpPressed()),
            down: this.cursors.down.isDown || (this.virtualControls && this.virtualControls.getDownPressed())
        };
        
        // Pass input to worm
        this.worm.handleInput(input);
        
        // Update worm
        this.worm.update(delta);
        
        // Update camera target to follow swing weight position
        if (this.cameraTarget && this.worm.getSwingWeightPosition()) {
            const swingPos = this.worm.getSwingWeightPosition();
            this.cameraTarget.x = swingPos.x;
            this.cameraTarget.y = swingPos.y;
        }
    }
}
