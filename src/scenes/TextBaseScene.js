import Phaser from 'phaser';
import BaseLevelScene from './BaseLevelScene';
import DoubleWorm from '../entities/DoubleWorm';
import VirtualControls from '../components/VirtualControls';
import ControlsDisplay from '../components/ControlsDisplay';

export default class TextBaseScene extends BaseLevelScene {
    constructor(config = {}) {
        super(config);
        
        // Level dimension constants - can be overridden in subclasses
        this.CHAR_WIDTH = config.charWidth || 96;
        this.CHAR_HEIGHT = config.charHeight || 48;
        this.ROW_SPACING = config.rowSpacing || 96;
        this.LEVEL_WIDTH = this.CHAR_WIDTH * (config.levelWidthInChars || 16);
        
        // Default level data - should be overridden in subclasses
        this.levelData = config.levelData || `
            ................
            ..*.......W.....
            .---............
            ................
        `;
        
        // Scene configuration
        this.sceneTitle = config.title || 'Text Level';
        this.returnScene = config.returnScene || 'MapSelectScene';
        
        // Victory state tracking
        this.victoryAchieved = false;
        
        this.platforms = [];
        this.platformColors = config.platformColors || [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe];
        
        // Mini-map configuration - will be updated dynamically in create()
        this.miniMapConfig = {
            width: 200,
            height: 200,
            padding: 20,
            visible: true
        };
        this.minimap = null;
        
        // Store elements to hide from mini-map
        this.minimapIgnoreList = [];
        
        // Track gamepad button state for mini-map toggle
        this.buttonMWasPressed = false;
    }
    
    cleanup() {
        // Call parent cleanup (handles worm, victory state, timers)
        super.cleanup();
        
        // Clear platforms array
        this.platforms = [];
        
        // Clear mini-map ignore list
        this.minimapIgnoreList = [];
        
        // Remove mouse constraint if it exists
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
    }

    create() {
        // Call parent create (handles cleanup and shutdown event)
        super.create();
        
        // Turn off debug rendering for cleaner visuals
        this.matter.world.drawDebug = false;
        
        // Parse level to calculate dimensions
        const levelRows = this.levelData.trim().split('\n').reverse().filter(row => row.trim().length > 0);
        const levelHeight = levelRows.length * this.ROW_SPACING;
        
        // Calculate actual level width from the widest row
        const maxRowLength = Math.max(...levelRows.map(row => row.trim().length));
        this.LEVEL_WIDTH = maxRowLength * this.CHAR_WIDTH;
        
        // Store level dimensions (before creating anything)
        this.levelHeight = levelHeight;
        this.levelWidth = this.LEVEL_WIDTH;

        // Update mini-map size based on level proportions
        this.updateMiniMapSize();
        
        // Set world bounds
        this.matter.world.setBounds(0, 0, this.LEVEL_WIDTH, levelHeight, 1000);
        
        // Create level elements
        this.createGrid(levelHeight);
        this.createBoundaryWalls(levelHeight);
        this.parseLevel(levelRows);

        // Create UI
        this.createUI();
        
        // Set up controls
        this.setupControls();

        // Create mini-map camera (after level is parsed)
        this.createMiniMap(levelHeight);
    }
    
    updateMiniMapSize() {
        const levelAspectRatio = this.levelWidth / this.levelHeight;
        const maxMiniMapWidth = 150;
        const maxMiniMapHeight = 250;
        const minMiniMapSize = 80;
        
        // Calculate ideal mini-map size while maintaining aspect ratio
        let miniMapWidth, miniMapHeight;
        
        if (levelAspectRatio > 1) {
            // Level is wider than tall
            miniMapWidth = Math.min(maxMiniMapWidth, minMiniMapSize * Math.sqrt(levelAspectRatio * 2));
            miniMapHeight = miniMapWidth / levelAspectRatio;
        } else {
            // Level is taller than wide
            miniMapHeight = Math.min(maxMiniMapHeight, minMiniMapSize * Math.sqrt(2 / levelAspectRatio));
            miniMapWidth = miniMapHeight * levelAspectRatio;
        }
        
        // Ensure minimum sizes
        this.miniMapConfig.width = Math.max(minMiniMapSize, miniMapWidth);
        this.miniMapConfig.height = Math.max(minMiniMapSize, miniMapHeight);
    }
    
    setupControls() {
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        
        // M to toggle mini-map
        this.input.keyboard.on('keydown-M', () => {
            this.toggleMiniMap();
        });
        
        // Camera controls
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Virtual controls (joystick + buttons)
        this.virtualControls = new VirtualControls(this);
        
        // Hidden magic keybinding for mouse constraint
        this.mouseConstraint = null;
        this.input.keyboard.on('keydown-SHIFT', () => {
            if (this.mKey.isDown) {
                this.toggleMouseConstraint();
            }
        });
        
        // Track gamepad button states
        this.button0WasPressed = false;
        this.button1WasPressed = false;
    }
    
    createGrid(height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x888888, 0.5);
        
        // Vertical lines
        for (let x = 0; x <= this.LEVEL_WIDTH; x += this.CHAR_WIDTH) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Horizontal lines - draw from bottom to top to match marker numbering
        for (let gridLine = 0; gridLine * this.CHAR_WIDTH <= height; gridLine++) {
            const y = height - (gridLine * this.CHAR_WIDTH);
            graphics.moveTo(0, y);
            graphics.lineTo(this.LEVEL_WIDTH, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
        
        // Store grid for mini-map ignore list
        this.minimapIgnoreList.push(graphics);
        
        // Add height markers every 5 grid lines (counting from bottom = 0)
        for (let y = 0; y <= height; y += this.CHAR_WIDTH) {
            const gridLineNumber = Math.round(y / this.CHAR_WIDTH);
            
            // Every 5th grid line gets a marker (but skip zero)
            if (gridLineNumber % 5 === 0 && gridLineNumber > 0) {
                // Create height marker text on the left
                const leftText = this.add.text(10, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                
                // Create height marker text on the right
                const rightText = this.add.text(this.LEVEL_WIDTH - 40, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                
                // Create a more visible horizontal line for this height
                const markerGraphics = this.add.graphics();
                markerGraphics.lineStyle(2, 0x4ecdc4, 0.6);
                markerGraphics.moveTo(0, height - y);
                markerGraphics.lineTo(this.LEVEL_WIDTH, height - y);
                markerGraphics.strokePath();
                markerGraphics.setDepth(-50);
                
                // Store height markers for mini-map ignore list
                this.minimapIgnoreList.push(leftText, rightText, markerGraphics);
            }
        }
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
        
        // Store start position for resets
        this.wormStartPosition = { x: wormStartX, y: wormStartY };
        
        // Create worm at start position
        this.worm = new DoubleWorm(this, wormStartX, wormStartY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: false
        });

        // Initial impulse is now handled automatically in WormBase
        
        // Create camera target
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
        
        // Set up camera
        this.cameras.main.setBounds(0, 0, this.LEVEL_WIDTH, levelRows.length * this.ROW_SPACING);
        this.handleResize();
        this.scale.on('resize', this.handleResize, this);
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
        const title = this.add.text(20, 20, this.sceneTitle, {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        this.minimapIgnoreList.push(title);
        
        // Controls - only show on desktop
        const isTouchDevice = ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0) || 
                            (navigator.msMaxTouchPoints > 0);
        
        if (!isTouchDevice) {
            this.controlsDisplay = new ControlsDisplay(this, 20, 60);
            this.minimapIgnoreList.push(this.controlsDisplay.elements);
        }
    }
    
    createMiniMap(levelHeight) {
        // Calculate mini-map position (upper-right corner)
        const screenWidth = this.scale.width;
        const mapX = screenWidth - this.miniMapConfig.width - this.miniMapConfig.padding;
        const mapY = this.miniMapConfig.padding;
        
        // Create mini-map camera
        this.minimap = this.cameras.add(mapX, mapY, this.miniMapConfig.width, this.miniMapConfig.height);
        this.minimap.setBounds(0, 0, this.LEVEL_WIDTH, levelHeight);
        
        // Calculate zoom to fit entire level in mini-map
        const zoomX = this.miniMapConfig.width / this.LEVEL_WIDTH;
        const zoomY = this.miniMapConfig.height / levelHeight;
        const zoom = Math.min(zoomX, zoomY) * 0.9;
        
        this.minimap.setZoom(zoom);
        this.minimap.setBackgroundColor(0x2c3e50);
        this.minimap.centerOn(this.LEVEL_WIDTH / 2, levelHeight / 2);
        this.minimap.setName('minimap');
        
        // Apply ignore list to hide clutter from mini-map
        this.minimapIgnoreList.forEach(element => {
            this.minimap.ignore(element);
        });
        
        if (this.controlsDisplay && this.controlsDisplay.elements) {
            this.minimap.ignore(this.controlsDisplay.elements);
        }
        
        this.minimapIgnoreList = [];
        
        // Add visual border and viewport indicator
        this.createMiniMapBorder(mapX, mapY);
        this.createViewportIndicator();
    }
    
    createMiniMapBorder(x, y) {
        this.miniMapBorder = this.add.graphics();
        this.miniMapBorder.lineStyle(2, 0x34495e, 1);
        this.miniMapBorder.strokeRect(x, y, this.miniMapConfig.width, this.miniMapConfig.height);
        this.miniMapBorder.setScrollFactor(0);
        this.miniMapBorder.setDepth(1001);
        
        this.miniMapLabel = this.add.text(x + 5, y - 20, 'Map (M)', {
            fontSize: '12px',
            color: '#4ecdc4',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 4, y: 2 }
        }).setScrollFactor(0).setDepth(1001);
        
        if (this.minimap) {
            this.minimap.ignore(this.miniMapBorder);
            this.minimap.ignore(this.miniMapLabel);
        }
    }
    
    createViewportIndicator() {
        this.viewportIndicator = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x4ecdc4);
        this.viewportIndicator.setStrokeStyle(5, 0x4ecdc4, 0.8);
        this.viewportIndicator.setFillStyle(0x4ecdc4, 0.1);
        this.viewportIndicator.setDepth(100);
        
        this.cameras.main.ignore(this.viewportIndicator);
    }
    
    updateMiniMapBorder(x, y) {
        if (this.miniMapBorder) {
            this.miniMapBorder.clear();
            this.miniMapBorder.lineStyle(2, 0x34495e, 1);
            this.miniMapBorder.strokeRect(x, y, this.miniMapConfig.width, this.miniMapConfig.height);
        }
        
        if (this.miniMapLabel) {
            this.miniMapLabel.setPosition(x + 5, y - 20);
        }
    }
    
    updateViewportIndicator() {
        if (!this.viewportIndicator || !this.minimap || !this.miniMapConfig.visible) return;
        
        const mainCam = this.cameras.main;
        const miniZoom = this.minimap.zoom;
        
        const viewWidth = mainCam.width / mainCam.zoom;
        const viewHeight = mainCam.height / mainCam.zoom;
        
        const centerX = mainCam.worldView.centerX;
        const centerY = mainCam.worldView.centerY;
        
        this.viewportIndicator.setPosition(centerX, centerY);
        
        const scaleX = viewWidth * miniZoom / 50;
        const scaleY = viewHeight * miniZoom / 30;
        this.viewportIndicator.setScale(scaleX, scaleY);
    }
    
    handleResize() {
        const width = this.scale.width;
        
        // Safety check for camera existence
        if (this.cameras && this.cameras.main && this.cameraTarget) {
            this.cameras.main.startFollow(this.cameraTarget, true);
            this.cameras.main.setZoom(1);
            this.cameras.main.setDeadzone(100, 100);
        }
        
        if (this.minimap) {
            const mapX = width - this.miniMapConfig.width - this.miniMapConfig.padding;
            const mapY = this.miniMapConfig.padding;
            this.minimap.setPosition(mapX, mapY);
            this.updateMiniMapBorder(mapX, mapY);
            this.updateViewportIndicator();
        }
    }
    
    update(time, delta) {
        // Handle victory screen input
        if (this.victoryAchieved) {
            const pad = this.input.gamepad.getPad(0);
            
            // SPACE key to go to next level (if available)
            if (this.hasNextLevel && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this.scene.start(this.nextMapKey);
                return;
            }
            
            // ESC key to return to map select
            if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
                this.scene.start('MapSelectScene');
                return;
            }
            
            // Gamepad button A (0) for next level, B (1) for map select
            if (pad && pad.buttons[0] && pad.buttons[0].pressed && !this.button0WasPressed) {
                if (this.hasNextLevel) {
                    this.scene.start(this.nextMapKey);
                } else {
                    this.scene.start('MapSelectScene');
                }
                return;
            }
            
            // Gamepad button B (1) for map select
            if (pad && pad.buttons[1] && pad.buttons[1].pressed && !this.button1WasPressed) {
                this.scene.start('MapSelectScene');
                return;
            }
            
            this.button0WasPressed = pad && pad.buttons[0] && pad.buttons[0].pressed;
            this.button1WasPressed = pad && pad.buttons[1] && pad.buttons[1].pressed;
            
            // Don't process normal game logic during victory
            return;
        }
        
        // Normal ESC handling (only if not in victory state)
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start(this.returnScene);
            return;
        }
        
        this.worm.update(delta);
        
        // Check for gamepad button M to toggle mini-map
        const pad = this.input.gamepad.getPad(0);
        if (pad && pad.buttons[2] && pad.buttons[2].pressed && !this.buttonMWasPressed) {
            this.toggleMiniMap();
        }
        this.buttonMWasPressed = pad && pad.buttons[2] && pad.buttons[2].pressed;
        
        // Update camera target to follow worm
        if (this.cameraTarget && this.worm) {
            const head = this.worm.getHead();
            const tail = this.worm.getTail();
            if (head && tail) {
                this.cameraTarget.x = (head.position.x + tail.position.x) / 2;
                this.cameraTarget.y = (head.position.y + tail.position.y) / 2;
            }
        }
        
        // Update mini-map
        if (this.minimap && this.worm && this.miniMapConfig.visible) {
            const head = this.worm.getHead();
            if (head) {
                this.minimap.centerOn(head.position.x, head.position.y);
            }
            this.updateViewportIndicator();
        }
        
        // Check victory condition - any part of worm touching goal
        if (this.goal && this.worm && this.worm.segments) {
            for (let i = 0; i < this.worm.segments.length; i++) {
                const segment = this.worm.segments[i];
                const distance = Phaser.Math.Distance.Between(
                    segment.position.x, segment.position.y,
                    this.goal.x, this.goal.y
                );
                
                // Check if any segment is close enough to the goal
                // Use segment radius from segmentRadii array + goal star radius (25)
                const segmentRadius = this.worm.segmentRadii[i] || 15;
                const goalRadius = 20; // Goal star outer radius
                const collisionDistance = segmentRadius + goalRadius;
                
                if (distance < collisionDistance) {
                    this.victory();
                    return; // Exit early once victory is triggered
                }
            }
        }
    }
    
    victory() {
        // Call parent victory (handles worm cleanup and victory state)
        super.victory();
        
        // Update progress system
        this.updateProgress();
        
        // Create dark overlay
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.8);
        overlay.setScrollFactor(0);
        overlay.setDepth(1000);
        
        // Victory dialog background
        const dialogBg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 500, 350, 0x2c3e50, 0.95);
        dialogBg.setScrollFactor(0);
        dialogBg.setDepth(1001);
        dialogBg.setStrokeStyle(4, 0x4ecdc4, 1);
        
        const victoryText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 120, 'LEVEL COMPLETE!', {
            fontSize: '48px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        
        const completionText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, `Well done!`, {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        
        // Determine if there's a next level
        const maps = ['Map001', 'Map002', 'Map003', 'Map004', 'Map005'];
        const currentIndex = maps.indexOf(this.scene.key);
        const hasNextLevel = currentIndex !== -1 && currentIndex < maps.length - 1;
        const nextMapKey = hasNextLevel ? maps[currentIndex + 1] : null;
        
        // Button styling
        const buttonWidth = 180;
        const buttonHeight = 50;
        const buttonY = this.scale.height / 2 + 20;
        
        // Next Level button (if available)
        if (hasNextLevel) {
            const nextButton = this.add.rectangle(this.scale.width / 2 - 100, buttonY, buttonWidth, buttonHeight, 0x27ae60);
            nextButton.setScrollFactor(0).setDepth(1002);
            nextButton.setStrokeStyle(2, 0x2ecc71, 1);
            nextButton.setInteractive();
            
            const nextText = this.add.text(this.scale.width / 2 - 100, buttonY, 'Next Level', {
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);
            
            nextButton.on('pointerdown', () => {
                this.scene.start(nextMapKey);
            });
            
            nextButton.on('pointerover', () => {
                nextButton.setFillStyle(0x2ecc71);
            });
            
            nextButton.on('pointerout', () => {
                nextButton.setFillStyle(0x27ae60);
            });
            
            this.nextButton = nextButton;
            this.nextText = nextText;
        }
        
        // Menu button
        const menuButtonX = hasNextLevel ? this.scale.width / 2 + 100 : this.scale.width / 2;
        const menuButton = this.add.rectangle(menuButtonX, buttonY, buttonWidth, buttonHeight, 0x3498db);
        menuButton.setScrollFactor(0).setDepth(1002);
        menuButton.setStrokeStyle(2, 0x4ecdc4, 1);
        menuButton.setInteractive();
        
        const menuText = this.add.text(menuButtonX, buttonY, 'Map Select', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);
        
        menuButton.on('pointerdown', () => {
            this.scene.start('MapSelectScene');
        });
        
        menuButton.on('pointerover', () => {
            menuButton.setFillStyle(0x4ecdc4);
        });
        
        menuButton.on('pointerout', () => {
            menuButton.setFillStyle(0x3498db);
        });
        
        // Instructions
        const instructions = hasNextLevel ? 
            'SPACE: Next Level • ESC: Map Select' : 
            'ESC: Map Select';
            
        const instructionText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 90, instructions, {
            fontSize: '16px',
            color: '#95a5a6'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        
        // Store references for input handling
        this.menuButton = menuButton;
        this.menuText = menuText;
        this.hasNextLevel = hasNextLevel;
        this.nextMapKey = nextMapKey;
        
        // Hide from minimap
        if (this.minimap) {
            this.minimap.ignore(overlay);
            this.minimap.ignore(dialogBg);
            this.minimap.ignore(victoryText);
            this.minimap.ignore(completionText);
            this.minimap.ignore(menuButton);
            this.minimap.ignore(menuText);
            this.minimap.ignore(instructionText);
            if (this.nextButton) {
                this.minimap.ignore(this.nextButton);
                this.minimap.ignore(this.nextText);
            }
        }
        
        // Celebration effect
        for (let i = 0; i < 15; i++) {
            this.time.delayedCall(i * 100, () => {
                const star = this.add.star(
                    Phaser.Math.Between(200, this.scale.width - 200),
                    Phaser.Math.Between(100, this.scale.height - 100),
                    5, 8, 15,
                    Phaser.Display.Color.RandomRGB().color
                ).setScrollFactor(0).setDepth(999);
                
                if (this.minimap) {
                    this.minimap.ignore(star);
                }
                
                this.tweens.add({
                    targets: star,
                    alpha: 0,
                    scale: 1.5,
                    rotation: Math.PI * 2,
                    duration: 2000,
                    onComplete: () => star.destroy()
                });
            });
        }
    }
    
    updateProgress() {
        // Get current progress
        const progress = JSON.parse(localStorage.getItem('floppyWormProgress') || '{}');
        
        // Mark current map as completed
        if (progress[this.scene.key]) {
            progress[this.scene.key].completed = true;
            
            // Unlock next map
            const maps = [
                'Map001', 'Map002', 'Map003', 'Map004', 'Map005'
            ];
            const currentIndex = maps.indexOf(this.scene.key);
            if (currentIndex !== -1 && currentIndex < maps.length - 1) {
                const nextMapKey = maps[currentIndex + 1];
                if (progress[nextMapKey]) {
                    progress[nextMapKey].unlocked = true;
                }
            }
            
            // Save progress
            localStorage.setItem('floppyWormProgress', JSON.stringify(progress));
        }
    }
    
    toggleMiniMap() {
        if (this.minimap) {
            this.miniMapConfig.visible = !this.miniMapConfig.visible;
            this.minimap.setVisible(this.miniMapConfig.visible);
            
            if (this.miniMapBorder) {
                this.miniMapBorder.setVisible(this.miniMapConfig.visible);
            }
            if (this.miniMapLabel) {
                this.miniMapLabel.setVisible(this.miniMapConfig.visible);
            }
            if (this.viewportIndicator) {
                this.viewportIndicator.setVisible(this.miniMapConfig.visible);
            }
            
            const text = this.add.text(this.scale.width / 2, 50, 
                this.miniMapConfig.visible ? 'Mini-map ON' : 'Mini-map OFF', {
                fontSize: '20px',
                color: this.miniMapConfig.visible ? '#4ecdc4' : '#ff6b6b',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            if (this.minimap) {
                this.minimap.ignore(text);
            }
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 1500,
                onComplete: () => text.destroy()
            });
        }
    }
    
    toggleMouseConstraint() {
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
            
            const text = this.add.text(this.scale.width / 2, 100, 'Mouse Constraint OFF', {
                fontSize: '24px',
                color: '#ff6b6b',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            if (this.minimap) {
                this.minimap.ignore(text);
            }
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 1000,
                onComplete: () => text.destroy()
            });
        } else {
            this.mouseConstraint = this.matter.add.mouseSpring({
                length: 0,
                stiffness: 0.4,
                damping: 0,
                angularStiffness: 0,
                collisionFilter: {
                    category: 0x0001,
                    mask: 0xFFFFFFFF,
                    group: 0
                }
            });
            
            const text = this.add.text(this.scale.width / 2, 100, 'Mouse Constraint ON - Click and drag!', {
                fontSize: '24px',
                color: '#4ecdc4',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            if (this.minimap) {
                this.minimap.ignore(text);
            }
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 2000,
                onComplete: () => text.destroy()
            });
        }
    }
}
