import Phaser from 'phaser';

export default class MapSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapSelectScene' });
        
        // Map configuration
        this.maps = [
            { key: 'Map001', title: 'Tutorial - First Steps', difficulty: 1 },
            { key: 'Map002', title: 'The Gap', difficulty: 2 },
            { key: 'Map003', title: 'Step Up', difficulty: 2 },
            { key: 'Map004', title: 'Zigzag Challenge', difficulty: 3 },
            { key: 'Map005', title: 'The Wall', difficulty: 3 },
        ];
        
        this.selectedMapIndex = 0;
        this.mapButtons = [];
    }

    create() {
        // Background
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x232333);
        
        // Title
        this.add.text(this.scale.width / 2, 60, 'Floppy Worm', {
            fontSize: '48px',
            color: '#4ecdc4',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(this.scale.width / 2, 110, 'Select a Map', {
            fontSize: '24px',
            color: '#95a5a6'
        }).setOrigin(0.5);
        
        // Get user progress from localStorage
        this.userProgress = this.getUserProgress();
        
        // Create map selection grid
        this.createMapGrid();
        
        // Create UI elements
        this.createUI();
        
        // Set up input (after grid is created)
        this.setupInput();
        
        // Instructions
        this.add.text(this.scale.width / 2, this.scale.height - 60, 'Use ARROW KEYS or WASD to navigate • ENTER or SPACE to select', {
            fontSize: '16px',
            color: '#7f8c8d'
        }).setOrigin(0.5);
        
        this.add.text(this.scale.width / 2, this.scale.height - 30, 'ESC: Return to Main Menu • Shift+R: Reset Progress', {
            fontSize: '14px',
            color: '#7f8c8d'
        }).setOrigin(0.5);
    }
    
    getUserProgress() {
        const savedProgress = localStorage.getItem('floppyWormProgress');
        if (savedProgress) {
            return JSON.parse(savedProgress);
        }
        
        // Default progress - only first map unlocked
        const defaultProgress = {};
        this.maps.forEach((map, index) => {
            defaultProgress[map.key] = {
                unlocked: index === 0,
                completed: false,
                bestTime: null
            };
        });
        
        this.saveUserProgress(defaultProgress);
        return defaultProgress;
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
            button.background.setStrokeStyle(2, button.isUnlocked ? 
                (this.userProgress[button.mapKey].completed ? 0x2ecc71 : 0x4ecdc4) : 0x34495e, 
                button.mapIndex === this.selectedMapIndex ? 1 : 0.8
            );
        });
        
        // Highlight selected button
        const selectedButton = this.mapButtons[this.selectedMapIndex];
        if (selectedButton) {
            selectedButton.background.setStrokeStyle(4, 0xf39c12, 1);
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
        
        // Handle selection
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectMap();
        }
        
        // Handle ESC
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start('LevelsScene');
        }
        
        // Handle reset (require Shift+R to avoid browser refresh conflict)
        if (Phaser.Input.Keyboard.JustDown(this.rKey) && 
            this.input.keyboard.keys[Phaser.Input.Keyboard.KeyCodes.SHIFT].isDown) {
            this.resetProgress();
        }
    }
    
    navigateMap(deltaX, deltaY) {
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
        const selectedButton = this.mapButtons[this.selectedMapIndex];
        if (selectedButton && selectedButton.isUnlocked) {
            const mapKey = selectedButton.mapKey;
            this.scene.start(mapKey);
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
            
            // Find and unlock next map
            const maps = [
                'Map001', 'Map002', 'Map003', 'Map004', 'Map005',
                'Map006', 'Map007', 'Map008', 'Map009', 'Map010'
            ];
            const currentIndex = maps.indexOf(mapKey);
            if (currentIndex !== -1 && currentIndex < maps.length - 1) {
                const nextMapKey = maps[currentIndex + 1];
                if (progress[nextMapKey]) {
                    progress[nextMapKey].unlocked = true;
                }
            }
            
            localStorage.setItem('floppyWormProgress', JSON.stringify(progress));
        }
    }
}
