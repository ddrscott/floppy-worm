import Phaser from 'phaser';
import Worm from '../entities/Worm';

export default class TowerScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TowerScene' });
        
        // Level dimension constants - tweak these to adjust level size
        this.CHAR_WIDTH = 64;   // Width of each ASCII character in pixels
        this.CHAR_HEIGHT = 48;  // Height of each ASCII character in pixels
        this.ROW_SPACING = 96; // Vertical spacing between rows in pixels
        this.LEVEL_WIDTH = this.CHAR_WIDTH * 16; // width * number of characters per row
        
        // ASCII level design - each character represents a CHAR_WIDTH x CHAR_HEIGHT block
        // - = platform
        // . = empty space
        // W = worm start position
        // * = goal/target
        this.levelData = `
            ................
            ..*.............
            .---............
            ................
            .........----...
            ................
            .--.............
            ................
            .....----.......
            ................
            ............--..
            ................
            ................
            ................
            ........--......
            ................
            .---............
            ................
            .....--.........
            ................
            .--......--.....
            ................
            ..............--
            ................
            .---............
            ................
            ........----....
            ................
            ................
            ...........W....
            ....--..........
            ................
            .............--.
            ................
            .---............
            ................
            ......----......
            ................
            ................
            ................
            ........--......
            ................
            .--.............
            ................
            ................
            -------.........
            ................
            ................
            .........-------
            ................
            ................
        `;
        
        this.platforms = [];
        this.platformColors = [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe];
    }

    create() {
        // Parse level to calculate height
        const levelRows = this.levelData.trim().split('\n').reverse().filter(row => row.trim().length > 0);
        const levelHeight = levelRows.length * this.ROW_SPACING;
        
        // Set world bounds
        this.matter.world.setBounds(0, 0, this.LEVEL_WIDTH, levelHeight);
        
        // Create grid background
        this.createGrid(levelHeight);
        
        // Create boundary walls
        this.createBoundaryWalls(levelHeight);
        
        // Parse and create level
        this.parseLevel(levelRows);
        
        // Create UI
        this.createUI();
        
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // ESC to return to levels menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('LevelsScene');
        });
        
        // Camera controls
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    }
    
    createGrid(height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x333333, 0.3);
        
        // Vertical lines
        for (let x = 0; x <= this.LEVEL_WIDTH; x += this.CHAR_WIDTH) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += this.CHAR_WIDTH) {
            graphics.moveTo(0, y);
            graphics.lineTo(this.LEVEL_WIDTH, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
    }
    
    createBoundaryWalls(height) {
        const wallThickness = 150;
        const wallColor = 0x2c3e50;
        
        // Create visual boundary
        const graphics = this.add.graphics();
        graphics.fillStyle(wallColor, 0.8);
        graphics.lineStyle(3, 0x34495e, 1);
        
        // Left wall
        graphics.fillRect(-wallThickness, 0, wallThickness, height);
        graphics.strokeRect(-wallThickness, 0, wallThickness, height);
        
        // Right wall
        graphics.fillRect(this.LEVEL_WIDTH, 0, wallThickness, height);
        graphics.strokeRect(this.LEVEL_WIDTH, 0, wallThickness, height);
        
        // Top wall
        graphics.fillRect(0, -wallThickness, this.LEVEL_WIDTH, wallThickness);
        graphics.strokeRect(0, -wallThickness, this.LEVEL_WIDTH, wallThickness);
        
        // Bottom wall
        graphics.fillRect(0, height, this.LEVEL_WIDTH, wallThickness);
        graphics.strokeRect(0, height, this.LEVEL_WIDTH, wallThickness);
        
        // Red boundary line
        graphics.lineStyle(4, 0xe74c3c, 0.8);
        graphics.strokeRect(0, 0, this.LEVEL_WIDTH, height);
        
        // Create physics walls
        this.matter.add.rectangle(-wallThickness/2, height/2, wallThickness, height, { isStatic: true });
        this.matter.add.rectangle(this.LEVEL_WIDTH + wallThickness/2, height/2, wallThickness, height, { isStatic: true });
        this.matter.add.rectangle(this.LEVEL_WIDTH/2, -wallThickness/2, this.LEVEL_WIDTH, wallThickness, { isStatic: true });
        this.matter.add.rectangle(this.LEVEL_WIDTH/2, height + wallThickness/2, this.LEVEL_WIDTH, wallThickness, { isStatic: true });
    }
    
    parseLevel(levelRows) {
        // Reverse rows so bottom is at the bottom
        levelRows.reverse();
        
        let wormStartX = 500;
        let wormStartY = 100;
        let goalX = 500;
        let goalY = 50;
        
        levelRows.forEach((row, rowIndex) => {
            const trimmedRow = row.trim();
            const y = this.ROW_SPACING + rowIndex * this.ROW_SPACING;
            
            let platformStart = -1;
            
            for (let colIndex = 0; colIndex < trimmedRow.length; colIndex++) {
                const char = trimmedRow[colIndex];
                const x = colIndex * this.CHAR_WIDTH;
                
                switch(char) {
                    case '-':
                        if (platformStart === -1) {
                            platformStart = colIndex;
                        }
                        break;
                        
                    case 'W':
                        wormStartX = x + this.CHAR_WIDTH / 2;
                        wormStartY = y;
                        // Fall through to default to end platform if needed
                        
                    case '*':
                        if (char === '*') {
                            goalX = x + this.CHAR_WIDTH / 2;
                            goalY = y;
                        }
                        // Fall through to default to end platform if needed
                        
                    default:
                        if (platformStart !== -1) {
                            // Create platform from platformStart to current position
                            this.createPlatform(platformStart, colIndex - 1, y, rowIndex);
                            platformStart = -1;
                        }
                        break;
                }
            }
            
            // Handle platform that extends to end of row
            if (platformStart !== -1) {
                this.createPlatform(platformStart, trimmedRow.length - 1, y, rowIndex);
            }
        });
        
        // Create worm at start position
        this.worm = new Worm(this, wormStartX, wormStartY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: false
        });
        
        // Create camera target - invisible rectangle that follows worm
        this.cameraTarget = this.add.rectangle(wormStartX, wormStartY, 10, 10, 0xff0000, 0);
        
        // Create goal
        this.goal = this.add.star(goalX, goalY, 5, 15, 25, 0xffd700);
        this.add.star(goalX, goalY, 5, 10, 20, 0xffed4e).setDepth(1);
        
        // Rotate the goal
        this.tweens.add({
            targets: this.goal,
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
        
        // Set up camera to fill width of level
        this.cameras.main.setBounds(0, 0, this.LEVEL_WIDTH, levelRows.length * this.ROW_SPACING);
        
        // Calculate zoom to fit level width in viewport
        const gameWidth = this.sys.game.config.width;  // Game viewport width
        const zoomToFitWidth = gameWidth / this.LEVEL_WIDTH;
        
        this.cameras.main.startFollow(this.cameraTarget, true);
        this.cameras.main.setZoom(zoomToFitWidth);
        this.cameras.main.setDeadzone(0, 100);  // No horizontal deadzone, small vertical deadzone
    }
    
    createPlatform(startCol, endCol, y, rowIndex) {
        const width = (endCol - startCol + 1) * this.CHAR_WIDTH;
        const leftEdge = startCol * this.CHAR_WIDTH;
        const centerX = leftEdge + width / 2;
        
        const platform = this.matter.add.rectangle(centerX, y, width, this.CHAR_HEIGHT, {
            isStatic: true,
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0
        });
        
        const color = this.platformColors[rowIndex % this.platformColors.length];
        const visual = this.add.rectangle(centerX, y, width, this.CHAR_HEIGHT, color);
        
        this.platforms.push({ body: platform, visual: visual });
    }
    
    createUI() {
        // Title
        this.add.text(20, 20, 'Tower Climb', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        // Controls
        this.add.text(20, 60, 'Arrow Keys: Move | Space: Jump | Down: Flatten | ESC: Menu', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        // Timer
        this.startTime = this.time.now;
        this.timerText = this.add.text(20, 100, 'Time: 0.00s', {
            fontSize: '16px',
            color: '#4ecdc4',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
    }
    
    update(time, delta) {
        // Update timer
        const elapsed = (this.time.now - this.startTime) / 1000;
        this.timerText.setText(`Time: ${elapsed.toFixed(2)}s`);
        
        // Worm controls
        if (this.cursors.left.isDown) {
            this.worm.setMotorDirection(-1);
        } else if (this.cursors.right.isDown) {
            this.worm.setMotorDirection(1);
        } else {
            this.worm.setMotorDirection(0);
        }
        
        this.worm.setFlatten(this.cursors.down.isDown);
        this.worm.setJump(this.spaceKey.isDown);
        
        this.worm.update(delta);
        
        // Update camera target to follow worm head
        if (this.cameraTarget && this.worm) {
            const head = this.worm.getHead();
            if (head) {
                this.cameraTarget.x = head.position.x;
                this.cameraTarget.y = head.position.y;
            }
        }
        
        // Check if worm reached goal
        if (this.goal && this.worm) {
            const head = this.worm.getHead();
            const distance = Phaser.Math.Distance.Between(
                head.position.x, head.position.y,
                this.goal.x, this.goal.y
            );
            
            if (distance < 50) {
                this.victory();
            }
        }
        
        // Camera manual controls
        const cam = this.cameras.main;
        const scrollSpeed = 5;
        if (this.wasd.W.isDown) cam.scrollY -= scrollSpeed;
        if (this.wasd.S.isDown) cam.scrollY += scrollSpeed;
        if (this.wasd.A.isDown) cam.scrollX -= scrollSpeed;
        if (this.wasd.D.isDown) cam.scrollX += scrollSpeed;
    }
    
    victory() {
        // Disable further input
        this.input.keyboard.enabled = false;
        
        // Create victory text
        const victoryText = this.add.text(500, 300, 'VICTORY!', {
            fontSize: '64px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0);
        
        // Add time
        const elapsed = (this.time.now - this.startTime) / 1000;
        this.add.text(500, 380, `Time: ${elapsed.toFixed(2)} seconds`, {
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);
        
        // Return to menu button
        this.add.text(500, 450, 'Press ESC to return to menu', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0);
        
        // Re-enable ESC key only
        this.input.keyboard.enabled = true;
        this.input.keyboard.removeAllListeners('keydown-ESC');
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('LevelsScene');
        });
        
        // Celebration effect
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 50, () => {
                const star = this.add.star(
                    Phaser.Math.Between(100, 900),
                    Phaser.Math.Between(100, 500),
                    5,
                    10,
                    20,
                    Phaser.Display.Color.RandomRGB().color
                ).setScrollFactor(0);
                
                this.tweens.add({
                    targets: star,
                    alpha: 0,
                    scale: 2,
                    duration: 1000,
                    onComplete: () => star.destroy()
                });
            });
        }
    }
}
