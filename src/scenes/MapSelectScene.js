import Phaser from 'phaser';
import { loadMapMetadata, createMapScene, getMapKeys } from './maps/MapDataRegistry';

export default class MapSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapSelectScene' });
        
        this.selectedMapIndex = -1; // Start with nothing selected
        this.mapButtons = [];
        this.maps = []; // Will be loaded in create()
        this.isFocused = false; // Track if user has started navigating
    }
    
    loadMapsFromDataRegistry() {
        const maps = loadMapMetadata();
        
        // Register parameterized map scenes with Phaser (now safe to access scene manager)
        maps.forEach(map => {
            if (!this.scene.manager.getScene(map.key)) {
                const MapSceneClass = createMapScene(map.key);
                if (MapSceneClass) {
                    this.scene.manager.add(map.key, MapSceneClass, false);
                }
            }
        });
        
        return maps;
    }

    create() {
        // Reset focus state to ensure clean start
        this.selectedMapIndex = -1;
        this.isFocused = false;
        
        // Clear any existing button references
        this.mapButtons = [];
        
        // Load maps now that scene manager is available
        this.maps = this.loadMapsFromDataRegistry();
        
        // Responsive design detection
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;
        const isMobile = gameWidth < 600;
        const centerX = gameWidth / 2;
        
        // Create background with grid
        this.createBackground();
        
        // Title with responsive sizing
        const titleSize = isMobile ? '36px' : '48px';
        this.add.text(centerX, 60, 'Floppy Worm', {
            fontSize: titleSize,
            color: '#4ecdc4',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const subtitleSize = isMobile ? '20px' : '24px';
        this.add.text(centerX, 110, 'Select a Map', {
            fontSize: subtitleSize,
            color: '#95a5a6',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        
        // Get user progress from localStorage
        this.userProgress = this.getUserProgress();
        
        // Create map selection grid
        this.createMapGrid();
        
        // Create UI elements
        this.createUI();
        
        // Set up input (after grid is created)
        this.setupInput();
        
        // Instructions with responsive sizing
        const instructionSize = isMobile ? '14px' : '16px';
        const secondarySize = isMobile ? '12px' : '14px';
        const instructionText = isMobile ? 
            'Tap to select • ESC to refresh' :
            'Use ARROW KEYS, WASD, or GAMEPAD to navigate • ENTER, SPACE, or A button to select';
        
        this.add.text(centerX, gameHeight - 60, instructionText, {
            fontSize: instructionSize,
            color: '#7f8c8d',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5);
        
        if (!isMobile) {
            this.add.text(centerX, gameHeight - 30, 'ESC or B button: Refresh • Shift+R: Reset Progress', {
                fontSize: secondarySize,
                color: '#7f8c8d'
            }).setOrigin(0.5);
        }
    }
    
    getUserProgress() {
        const savedProgress = localStorage.getItem('floppyWormProgress');
        let progress = {};
        
        if (savedProgress) {
            progress = JSON.parse(savedProgress);
        }
        
        // Ensure all current maps have entries in progress (for new maps added after save)
        let needsSave = false;
        this.maps.forEach((map, index) => {
            if (!progress[map.key]) {
                progress[map.key] = {
                    unlocked: true, // Unlock all maps by default
                    completed: false,
                    bestTime: null
                };
                needsSave = true;
            }
        });
        
        if (needsSave) {
            this.saveUserProgress(progress);
        }
        
        return progress;
    }
    
    saveUserProgress(progress = this.userProgress) {
        localStorage.setItem('floppyWormProgress', JSON.stringify(progress));
    }
    
    unlockNextMap(completedMapKey) {
        const completedIndex = this.maps.findIndex(map => map.key === completedMapKey);
        if (completedIndex !== -1) {
            // Mark current map as completed
            this.userProgress[completedMapKey].completed = true;
            
            // Unlock next map if it exists
            const nextIndex = completedIndex + 1;
            if (nextIndex < this.maps.length) {
                const nextMapKey = this.maps[nextIndex].key;
                this.userProgress[nextMapKey].unlocked = true;
            }
            
            this.saveUserProgress();
        }
    }
    
    createMapGrid() {
        const startX = 200;
        const startY = 180;
        const buttonWidth = 280;
        const buttonHeight = 60;
        const spacing = 70;
        const mapsPerRow = 2;
        
        this.maps.forEach((map, index) => {
            const row = Math.floor(index / mapsPerRow);
            const col = index % mapsPerRow;
            
            const x = startX + col * (buttonWidth + 100);
            const y = startY + row * spacing;
            
            const isUnlocked = this.userProgress[map.key].unlocked;
            const isCompleted = this.userProgress[map.key].completed;
            
            // Button background
            const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight);
            
            // Make button interactive immediately
            buttonBg.setInteractive();
            buttonBg.on('pointerdown', () => {
                this.selectedMapIndex = index;
                this.updateSelection();
                this.selectMap();
            });
            
            buttonBg.on('pointerover', () => {
                this.selectedMapIndex = index;
                this.isFocused = true;
                this.updateSelection();
            });
            
            // Set button style based on state
            if (!isUnlocked) {
                buttonBg.setFillStyle(0x2c3e50, 0.5);
                buttonBg.setStrokeStyle(2, 0x34495e, 0.8);
            } else if (isCompleted) {
                buttonBg.setFillStyle(0x27ae60, 0.8);
                buttonBg.setStrokeStyle(2, 0x2ecc71, 1);
            } else {
                buttonBg.setFillStyle(0x3498db, 0.8);
                buttonBg.setStrokeStyle(2, 0x4ecdc4, 1);
            }
            
            // Map number
            const mapNumber = this.add.text(x - buttonWidth/2 + 20, y - 15, `${(index + 1).toString().padStart(2, '0')}`, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            });
            
            // Map title
            const titleColor = isUnlocked ? '#ffffff' : '#7f8c8d';
            const title = this.add.text(x - buttonWidth/2 + 60, y - 10, map.title, {
                fontSize: '18px',
                color: titleColor,
                fontStyle: isCompleted ? 'bold' : 'normal'
            });
            
            // Difficulty stars
            const starY = y + 15;
            for (let i = 0; i < map.difficulty; i++) {
                const star = this.add.text(x - buttonWidth/2 + 60 + i * 20, starY, '★', {
                    fontSize: '16px',
                    color: isUnlocked ? '#f1c40f' : '#7f8c8d'
                });
            }
            
            // Status indicator
            if (isCompleted) {
                this.add.text(x + buttonWidth/2 - 20, y, '✓', {
                    fontSize: '24px',
                    color: '#2ecc71'
                }).setOrigin(0.5);
            } else if (!isUnlocked) {
                this.add.text(x + buttonWidth/2 - 20, y, '🔒', {
                    fontSize: '20px',
                    color: '#7f8c8d'
                }).setOrigin(0.5);
            }
            
            // Store button data
            this.mapButtons.push({
                background: buttonBg,
                mapKey: map.key,
                mapIndex: index,
                isUnlocked: isUnlocked,
                x: x,
                y: y,
                width: buttonWidth,
                height: buttonHeight
            });
        });
        
        // Update selection highlight
        this.updateSelection();
    }
    
    updateSelection() {
        // Clear previous highlights
        this.mapButtons.forEach(button => {
            // Use current progress state, not cached isUnlocked
            const currentProgress = this.userProgress[button.mapKey];
            const isUnlocked = currentProgress.unlocked;
            const isCompleted = currentProgress.completed;
            
            button.background.setStrokeStyle(2, isUnlocked ? 
                (isCompleted ? 0x2ecc71 : 0x4ecdc4) : 0x34495e, 
                button.mapIndex === this.selectedMapIndex ? 1 : 0.8
            );
        });
        
        // Highlight selected button only if focused
        if (this.isFocused && this.selectedMapIndex >= 0) {
            const selectedButton = this.mapButtons[this.selectedMapIndex];
            if (selectedButton) {
                selectedButton.background.setStrokeStyle(6, 0xffffff, 1); // Thicker white stroke for visibility
            }
        }
    }
    
    createUI() {
        // Progress summary
        const completedCount = Object.values(this.userProgress).filter(p => p.completed).length;
        const totalCount = this.maps.length;
        
        this.add.text(this.scale.width / 2, 140, `Progress: ${completedCount}/${totalCount} maps completed`, {
            fontSize: '18px',
            color: '#4ecdc4'
        }).setOrigin(0.5);
        
        // Reset progress button (top right)
        const resetButton = this.add.text(this.scale.width - 20, 20, 'Reset Progress', {
            fontSize: '16px',
            color: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setInteractive();
        
        resetButton.on('pointerdown', () => {
            this.resetProgress();
        });
    }
    
    setupInput() {
        // Keyboard navigation
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Selection keys
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        
        // Gamepad setup
        this.gamepadInputTimer = 0; // Track last gamepad input time
        this.gamepadInputDelay = 200; // Milliseconds between gamepad inputs
        
        // Mouse/touch input is handled directly in createMapGrid
    }
    
    update() {
        // Handle keyboard navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) {
            this.navigateMap(-1, 0);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) {
            this.navigateMap(1, 0);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) {
            this.navigateMap(0, -1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) {
            this.navigateMap(0, 1);
        }

        // Handle gamepad navigation
        this.handleGamepadInput();
        
        // Handle selection
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectMap();
        }
        
        // Handle ESC (restart scene to refresh)
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.restart();
        }
        
        // Handle reset (require Shift+R to avoid browser refresh conflict)
        if (Phaser.Input.Keyboard.JustDown(this.rKey) && 
            this.input.keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SHIFT].isDown) {
            this.resetProgress();
        }
    }

    handleGamepadInput() {
        const currentTime = this.time.now;
        
        // Check if enough time has passed since last gamepad input
        if (currentTime - this.gamepadInputTimer < this.gamepadInputDelay) {
            return;
        }

        // Get the first connected gamepad
        const gamepads = this.input.gamepad.gamepads;
        if (!gamepads || gamepads.length === 0) return;
        
        const gamepad = gamepads[0];
        if (!gamepad) return;

        let navigationOccurred = false;

        // D-pad navigation
        if (gamepad.left || gamepad.leftStick.x < -0.5) {
            this.navigateMap(-1, 0);
            navigationOccurred = true;
        } else if (gamepad.right || gamepad.leftStick.x > 0.5) {
            this.navigateMap(1, 0);
            navigationOccurred = true;
        } else if (gamepad.up || gamepad.leftStick.y < -0.5) {
            this.navigateMap(0, -1);
            navigationOccurred = true;
        } else if (gamepad.down || gamepad.leftStick.y > 0.5) {
            this.navigateMap(0, 1);
            navigationOccurred = true;
        }

        // Selection buttons (A button for confirm)
        if (gamepad.A) {
            this.selectMap();
            navigationOccurred = true;
        }

        // Back button (B button to refresh scene)
        if (gamepad.B) {
            this.scene.restart();
            navigationOccurred = true;
        }

        // Update timer if any navigation occurred
        if (navigationOccurred) {
            this.gamepadInputTimer = currentTime;
        }
    }

    createBackground() {
        // Create solid background first
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x232333);
        
        // Create a subtle grid background (from LevelsScene)
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
    
    navigateMap(deltaX, deltaY) {
        // If not focused yet, start at first map
        if (!this.isFocused) {
            this.isFocused = true;
            this.selectedMapIndex = 0;
            this.updateSelection();
            return;
        }
        
        const mapsPerRow = 2;
        const currentRow = Math.floor(this.selectedMapIndex / mapsPerRow);
        const currentCol = this.selectedMapIndex % mapsPerRow;
        
        let newRow = currentRow + deltaY;
        let newCol = currentCol + deltaX;
        
        // Clamp to valid ranges
        const maxRow = Math.floor((this.maps.length - 1) / mapsPerRow);
        newRow = Phaser.Math.Clamp(newRow, 0, maxRow);
        
        const mapsInRow = newRow === maxRow ? (this.maps.length % mapsPerRow || mapsPerRow) : mapsPerRow;
        newCol = Phaser.Math.Clamp(newCol, 0, mapsInRow - 1);
        
        const newIndex = newRow * mapsPerRow + newCol;
        if (newIndex < this.maps.length) {
            this.selectedMapIndex = newIndex;
            this.updateSelection();
        }
    }
    
    selectMap() {
        // Only allow selection if focused and valid index
        if (!this.isFocused || this.selectedMapIndex < 0) {
            return;
        }
        
        const selectedButton = this.mapButtons[this.selectedMapIndex];
        
        if (selectedButton) {
            const mapKey = selectedButton.mapKey;
            const isUnlocked = this.userProgress[mapKey].unlocked;
            
            if (isUnlocked) {
                // Clear focus state before transitioning
                this.isFocused = false;
                this.selectedMapIndex = -1;
                this.updateSelection();
                
                // Add a simple fade transition
                this.cameras.main.fadeOut(250, 0, 0, 0);
                
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    // Stop current scene first, then start the new one
                    this.scene.stop();
                    this.scene.start(mapKey);
                });
            }
        }
    }
    
    resetProgress() {
        // Confirm reset
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            localStorage.removeItem('floppyWormProgress');
            this.scene.restart();
        }
    }
}

// Export function to be called when a map is completed
export function completeMap(mapKey) {
    const mapSelectScene = game.scene.getScene('MapSelectScene');
    if (mapSelectScene) {
        mapSelectScene.unlockNextMap(mapKey);
    } else {
        // If scene doesn't exist, update localStorage directly
        const progress = JSON.parse(localStorage.getItem('floppyWormProgress') || '{}');
        if (progress[mapKey]) {
            progress[mapKey].completed = true;
            
            // Find and unlock next map using the data registry
            const mapKeys = getMapKeys();
            
            const currentIndex = mapKeys.indexOf(mapKey);
            if (currentIndex !== -1 && currentIndex < mapKeys.length - 1) {
                const nextMapKey = mapKeys[currentIndex + 1];
                if (progress[nextMapKey]) {
                    progress[nextMapKey].unlocked = true;
                }
            }
            
            localStorage.setItem('floppyWormProgress', JSON.stringify(progress));
        }
    }
}
