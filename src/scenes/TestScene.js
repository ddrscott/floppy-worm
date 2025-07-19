import Phaser from 'phaser';
import * as dat from 'dat.gui';
import CoordinateDisplay from '../components/CoordinateDisplay';
import { defaultPhysicsParams } from '../config/physicsParams';
import DoubleWorm from '../entities/DoubleWorm';
import VirtualControls from '../components/VirtualControls';
import ControlsDisplay from '../components/ControlsDisplay';

export default class TestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TestScene' });
        
        // Initialize physics parameters
        this.physicsParams = { ...defaultPhysicsParams };


        this.width = 1024;
        this.height = 768;
    }

    create() {
        
        // Set world bounds without default walls
        this.matter.world.setBounds(0, 0, 1024, 768, 100);
        
        
        // Create dat.GUI
        this.gui = new dat.GUI();
        
        // Create grid background
        this.createGrid();

        // Target platform on left side
        this.matter.add.gameObject(
            this.add.rectangle(300, 500, 50, 250, 0xff6b6b), {
            isStatic: true,
        });
        
        // Target platform on left side
        this.matter.add.gameObject(
            this.add.rectangle(300, 400, 500, 48, 0xff6b6b), {
            isStatic: true,
        });
        
        // Create worm using the new MotorWorm class
        this.worm = new DoubleWorm(this, 660, 220, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
        });
        
        // Create camera target - a Phaser object that follows the swing weight
        this.cameraTarget = this.add.rectangle(0, 0, 10, 10, 0xff0000, 0); // Invisible rectangle

        
        this.toggleMouseConstraint();
        this.input.keyboard.on('keydown-M', () => {
            // Check if shift is held (capital M)
            if (this.input.keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SHIFT].isDown) {
                this.toggleMouseConstraint();
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
        this.cameras.main.setZoom(1);
        this.cameras.main.setBounds(0, 0, this.width, this.height);

        
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
            // Use the reusable ControlsDisplay component with zoom option
            this.controlsDisplay = new ControlsDisplay(this, 10, 10, { showZoom: true });
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
    
    createGrid() {
        const gridSize = 50; // Size of each grid cell
        const graphics = this.add.graphics();
        
        // Set grid line style
        graphics.lineStyle(1, 0x3a3a4a, 0.3); // Dark gray with low opacity
        
        // Draw vertical lines
        for (let x = 0; x <= this.width; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, this.height);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.height; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(this.width, y);
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
        
        // Anti-flying folder
        const antiFlyFolder = this.gui.addFolder('Anti-Flying');
        this.physicsParams.groundingForce = this.worm.groundingForce || 0.0003;
        this.physicsParams.groundingSegments = this.worm.groundingSegments || 0.4;
        
        antiFlyFolder.add(this.physicsParams, 'groundingForce', 0, 0.001).name('Grounding Force').step(0.00001).onChange(value => {
            this.worm.groundingForce = value;
        });
        antiFlyFolder.add(this.physicsParams, 'groundingSegments', 0.1, 0.8).name('Middle Segments %').step(0.05).onChange(value => {
            this.worm.groundingSegments = value;
        });
        antiFlyFolder.open();
        
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
        // Update worm (DoubleWorm handles its own input)
        this.worm.update(delta);
        
        // Update camera target to follow head position
        if (this.cameraTarget && this.worm) {
            const head = this.worm.getHead();
            if (head) {
                this.cameraTarget.x = head.position.x;
                this.cameraTarget.y = head.position.y;
            }
        }
    }
    
    toggleMouseConstraint() {
        if (this.mouseConstraint) {
            // Remove existing constraint
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
            
            // Show feedback
            const text = this.add.text(this.scale.width / 2, 50, 'Mouse Constraint OFF', {
                fontSize: '24px',
                color: '#ff6b6b',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 1000,
                onComplete: () => text.destroy()
            });
        } else {
            // Add mouse constraint
            this.mouseConstraint = this.matter.add.mouseSpring({
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
            
            // Show feedback
            const text = this.add.text(this.scale.width / 2, 50, 'Mouse Constraint ON - Click and drag!', {
                fontSize: '24px',
                color: '#4ecdc4',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 2000,
                onComplete: () => text.destroy()
            });
        }
    }
}
