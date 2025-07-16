import Phaser from 'phaser';

export default class LevelsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelsScene' });
        this.selectedLevel = 0;
        this.levels = [
            {
                name: 'Tower Climb',
                description: 'Climb the ASCII tower to reach the golden star',
                scene: 'TowerScene',
                color: 0x4ecdc4
            },
            {
                name: 'Test Scene',
                description: 'Physics playground with adjustable parameters',
                scene: 'TestScene',
                color: 0xff6b6b
            },
            {
                name: 'Worm Examples',
                description: 'Multiple example scenes showing different worm behaviors',
                scene: 'BasicWormScene',
                color: 0xfeca57
            },
            {
                name: 'Gamepad Test',
                description: 'Test and visualize PS4 controller inputs',
                scene: 'GamepadTest',
                color: 0x9b59b6
            }
        ];
    }

    create() {
        // Set world bounds
        this.matter.world.setBounds(0, 0, 800, 600);
        
        // Create background
        this.createBackground();
        
        // Create title with responsive sizing
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;
        const isMobile = gameWidth < 600;
        const titleSize = isMobile ? '36px' : '48px';
        const centerX = gameWidth / 2;
        this.add.text(centerX, 80, 'Floppy Worm', {
            fontSize: titleSize,
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        const subtitleSize = isMobile ? '20px' : '24px';
        this.add.text(centerX, 130, 'Select a Level', {
            fontSize: subtitleSize,
            color: '#4ecdc4',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        
        // Create level buttons
        this.createLevelButtons();
        
        // Create instructions
        this.createInstructions();
        
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Create animated worm decoration
        this.createDecorativeWorm();
    }
    
    createBackground() {
        // Create a subtle grid background
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x333333, 0.2);
        
        const width = this.scale.width;
        const height = this.scale.height;
        
        for (let x = 0; x <= width; x += 40) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        for (let y = 0; y <= height; y += 40) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
    }
    
    createLevelButtons() {
        this.levelButtons = [];
        
        const gameWidth = this.scale.width;
        const centerX = gameWidth / 2;
        
        this.levels.forEach((level, index) => {
            const y = 220 + index * 100;
            
            // Create button background
            const buttonBg = this.add.rectangle(centerX, y, Math.min(600, gameWidth - 40), 80, 0x2c3e50, 0.8);
            buttonBg.setStrokeStyle(3, level.color);
            
            // Calculate text positions relative to button center
            const textStartX = centerX - 250;
            
            // Create level title
            const title = this.add.text(textStartX, y - 15, level.name, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            });
            
            // Create level description
            const description = this.add.text(textStartX, y + 15, level.description, {
                fontSize: '14px',
                color: '#bdc3c7'
            });
            
            // Create selection indicator
            const indicator = this.add.text(textStartX - 40, y, '▶', {
                fontSize: '32px',
                color: level.color
            }).setVisible(index === this.selectedLevel);
            
            // Make button interactive with better touch support
            buttonBg.setInteractive({ useHandCursor: true });
            buttonBg.on('pointerdown', () => {
                buttonBg.setScale(0.98);
            });
            
            buttonBg.on('pointerup', () => {
                buttonBg.setScale(1);
                this.selectLevel(index);
                this.startLevel();
            });
            
            buttonBg.on('pointerover', () => {
                this.selectLevel(index);
                buttonBg.setFillStyle(0x34495e, 0.9);
            });
            
            buttonBg.on('pointerout', () => {
                buttonBg.setFillStyle(0x2c3e50, 0.8);
            });
            
            this.levelButtons.push({
                background: buttonBg,
                title: title,
                description: description,
                indicator: indicator,
                level: level
            });
        });
    }
    
    createInstructions() {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;
        const centerX = gameWidth / 2;
        const isMobile = gameWidth < 600;
        const instructionText = isMobile ? 'Tap a level to start' : 'Use ↑↓ to select, ENTER/SPACE to start, or click a level';
        const fontSize = isMobile ? '14px' : '16px';
        
        this.add.text(centerX, gameHeight - 50, instructionText, {
            fontSize: fontSize,
            color: '#95a5a6',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
    }
    
    createDecorativeWorm() {
        // Create a simple animated worm as decoration using graphics
        const wormSegments = [];
        const segmentCount = 8;
        const baseRadius = 8;
        
        for (let i = 0; i < segmentCount; i++) {
            const radius = baseRadius * (1 - i * 0.1);
            const x = 650 + i * 18;
            const y = 400;
            
            const segment = this.add.graphics();
            segment.fillStyle(this.getSegmentColor(i));
            segment.lineStyle(2, 0x000000);
            segment.fillCircle(x, y, radius);
            segment.strokeCircle(x, y, radius);
            
            wormSegments.push(segment);
        }
        
        // Animate the decorative worm
        wormSegments.forEach((segment, index) => {
            this.tweens.add({
                targets: segment,
                y: 400 + Math.sin(index * 0.5) * 15,
                duration: 2000 + index * 100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }
    
    getSegmentColor(index) {
        const colors = [0xff6b6b, 0xffa502, 0xffd93d, 0x6bcf7f, 0x4ecdc4, 0x74b9ff, 0xa29bfe, 0xfd79a8];
        return colors[index % colors.length];
    }
    
    selectLevel(index) {
        if (index === this.selectedLevel) return;
        
        // Hide previous indicator
        this.levelButtons[this.selectedLevel].indicator.setVisible(false);
        
        // Update selection
        this.selectedLevel = index;
        
        // Show new indicator
        this.levelButtons[this.selectedLevel].indicator.setVisible(true);
    }
    
    startLevel() {
        const selectedLevelData = this.levels[this.selectedLevel];
        
        // Add a transition effect
        const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0);
        
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 300,
            onComplete: () => {
                this.scene.start(selectedLevelData.scene);
            }
        });
    }
    
    update() {
        // Handle keyboard navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            const newIndex = Math.max(0, this.selectedLevel - 1);
            this.selectLevel(newIndex);
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
            const newIndex = Math.min(this.levels.length - 1, this.selectedLevel + 1);
            this.selectLevel(newIndex);
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || 
            Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.startLevel();
        }
    }
}
