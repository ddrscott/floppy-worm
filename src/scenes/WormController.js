import Phaser from 'phaser';
import DoubleWorm from '../entities/DoubleWorm';
import { defaultPhysicsParams } from '../config/physicsParams';

export default class WormController extends Phaser.Scene {
    constructor() {
        super({ key: 'WormController' });
        
        // Initialize physics parameters
        this.physicsParams = { ...defaultPhysicsParams };
        this.gamepad = null;
        this.miniControllerVisible = true;
    }

    create() {
        // Set world bounds
        this.matter.world.setBounds(0, 0, 1024, 768, 320, false, false, false, false);
        
        // Create boundary walls
        this.createBoundaryWalls();
        
        // Create grid background
        this.createGrid();
        
        // Create test platform
        this.matter.add.gameObject(
            this.add.rectangle(400, 600, 200, 20, 0xff6b6b), {
            isStatic: true,
        });
        
        // Create another platform
        this.matter.add.gameObject(
            this.add.rectangle(700, 450, 150, 20, 0x4ecdc4), {
            isStatic: true,
        });
        
        // Create worm
        this.worm = new DoubleWorm(this, 512, 300, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.90, 0.85, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.6],
        });
        
        // Create camera target
        this.cameraTarget = this.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
        
        // Set up camera
        this.cameras.main.setDeadzone(200, 200);
        this.cameras.main.startFollow(this.cameraTarget, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.5);
        this.cameras.main.setBounds(0, 0, 1024, 768);
        
        // Show instructions
        this.createInstructions();
        
        // Listen for gamepad connection
        this.input.gamepad.once('connected', (pad) => {
            this.gamepad = pad;
            this.showConnectionMessage();
        });
        
        // Set up keyboard controls as fallback
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        
        // Toggle mini controller visibility with Tab
        this.input.keyboard.on('keydown-TAB', () => {
            this.miniControllerVisible = !this.miniControllerVisible;
            this.miniControllerGroup.setVisible(this.miniControllerVisible);
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
    }
    
    createBoundaryWalls() {
        const wallThickness = 150;
        const wallColor = 0x2c3e50;
        const width = 1024;
        const height = 768;
        
        // Create visual boundary
        const graphics = this.add.graphics();
        graphics.fillStyle(wallColor, 0.8);
        graphics.lineStyle(3, 0x34495e, 1);
        
        // Draw walls
        graphics.fillRect(0, -wallThickness, width, wallThickness);
        graphics.fillRect(0, height, width, wallThickness);
        graphics.fillRect(-wallThickness, 0, wallThickness, height);
        graphics.fillRect(width, 0, wallThickness, height);
        
        // Add boundary line
        graphics.lineStyle(4, 0xe74c3c, 0.8);
        graphics.strokeRect(0, 0, width, height);
        
        // Create physics walls
        this.matter.add.rectangle(width/2, -wallThickness/2, width, wallThickness, { isStatic: true });
        this.matter.add.rectangle(width/2, height + wallThickness/2, width, wallThickness, { isStatic: true });
        this.matter.add.rectangle(-wallThickness/2, height/2, wallThickness, height, { isStatic: true });
        this.matter.add.rectangle(width + wallThickness/2, height/2, wallThickness, height, { isStatic: true });
    }
    
    createGrid() {
        const gridSize = 50;
        const graphics = this.add.graphics();
        
        graphics.lineStyle(1, 0x3a3a4a, 0.5);
        
        // Vertical lines
        for (let x = 0; x <= 1024; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, 768);
        }
        
        // Horizontal lines
        for (let y = 0; y <= 768; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(1024, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
    }
    
    
    createInstructions() {
        const instructionBg = this.add.rectangle(512, 40, 600, 60, 0x000000, 0.7);
        instructionBg.setScrollFactor(0);
        
        this.instructionText = this.add.text(512, 40, 'Connect a PS4 controller to begin\nKeyboard: Arrows + Space/Shift + Tab', {
            fontSize: '16px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        this.instructionText.setScrollFactor(0);
    }
    
    showConnectionMessage() {
        const connectedText = this.add.text(512, 100, `Controller Connected: ${this.gamepad.id}`, {
            fontSize: '18px',
            color: '#4ecdc4',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        connectedText.setScrollFactor(0);
        
        // Fade out after 3 seconds
        this.tweens.add({
            targets: connectedText,
            alpha: 0,
            duration: 1000,
            delay: 3000,
            onComplete: () => connectedText.destroy()
        });
        
        // Update instructions
        this.instructionText.setText('L-Stick/D-Pad: Move | X: Jump | □: Flatten | △: Lift | L2/R2: Zoom');
    }
    
    update(time, delta) {
        // Update worm
        this.worm.update(delta);
        
        // Fallback to head position
        const head = this.worm.getHead();
        this.cameraTarget.x = head.position.x;
        this.cameraTarget.y = head.position.y;
    }
}
