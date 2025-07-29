import Phaser from 'phaser';
import { loadMapMetadata, createMapScene, getMapKeys } from './maps/MapDataRegistry';
import MapLoader from '../services/MapLoader';
import { getCachedBuildMode, BuildConfig } from '../utils/buildMode';
import GameStateManager from '../services/GameStateManager';

export default class MapSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapSelectScene' });
        
        this.selectedMapIndex = -1; // Start with nothing selected
        this.mapButtons = [];
        this.maps = []; // Will be loaded in create()
        this.isFocused = false; // Track if user has started navigating
        this.stateManager = null; // Will be initialized in init()
    }
    
    init() {
        // Reset state on scene init (called before preload)
        this.selectedMapIndex = -1;
        this.isFocused = false;
        this.mapButtons = [];
        
        // Initialize state manager
        this.stateManager = GameStateManager.getFromScene(this);
        
        // Listen for progress updates from other scenes
        this.registry.events.on(this.stateManager.events.PROGRESS_UPDATED, this.onProgressUpdated, this);
    }
    
    async loadMapsFromDataRegistry() {
        const maps = await loadMapMetadata();
        
        // Preload all maps using the unified loader
        for (const map of maps) {
            await MapLoader.preloadMap(this, map.key);
        }
        
        return maps;
    }

    async create() {
        // Get build mode
        this.buildMode = await getCachedBuildMode();
        this.buildConfig = BuildConfig[this.buildMode];
        
        // Initialize keyboard controls immediately (before async loading)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Show loading text
        const loadingText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
            'Loading maps...', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Load maps now that scene manager is available
        this.maps = await this.loadMapsFromDataRegistry();
        
        // Ensure all maps have progress entries
        const mapKeys = this.maps.map(map => map.key);
        this.stateManager.ensureAllMapsHaveProgress(mapKeys);
        
        // Remove loading text
        loadingText.destroy();
        
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
        
        // Create map selection grid
        this.createMapGrid();
        
        // Create UI elements
        this.createUI();
        
        // Set up input (after grid is created)
        this.setupInput();
        
        // Clean up events on shutdown
        this.events.once('shutdown', this.cleanup, this);
        
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
    
    cleanup() {
        // Remove event listeners
        this.registry.events.off(this.stateManager.events.PROGRESS_UPDATED, this.onProgressUpdated, this);
    }
    
    onProgressUpdated(progress) {
        // Refresh the UI when progress is updated from another scene
        // For now, just restart the scene for simplicity
        // In a more sophisticated implementation, we'd update the UI directly
        this.scene.restart();
    }
    
    createMapGrid() {
        const startX = this.scale.width / 2 - 400; // Centered with padding
        const startY = 220;
        const buttonWidth = 240;
        const buttonHeight = 80;
        const spacingX = 20;
        const spacingY = 90;
        const mapsPerRow = 3;
        
        this.maps.forEach((map, index) => {
            const row = Math.floor(index / mapsPerRow);
            const col = index % mapsPerRow;
            
            const x = startX + col * (buttonWidth + spacingX) + buttonWidth/2;
            const y = startY + row * spacingY;
            
            const mapProgress = this.stateManager.getMapProgress(map.key);
            const isUnlocked = mapProgress.unlocked;
            const isCompleted = mapProgress.completed;
            
            // Button background
            const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight);
            
            // Make button interactive immediately
            buttonBg.setInteractive();
            buttonBg.on('pointerup', () => {
                this.selectedMapIndex = index;
                this.updateSelection();
                this.selectMap();
            });
            
            buttonBg.on('pointerover', () => {
                this.selectedMapIndex = index;
                this.isFocused = true;
                this.updateSelection();
            });
            
            // Set button style based on state (all maps are unlocked)
            if (isCompleted) {
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
            
            // Map title (all maps are unlocked, so always white)
            const titleColor = '#ffffff';
            const title = this.add.text(x - buttonWidth/2 + 60, y - 18, map.title, {
                fontSize: '16px',
                color: titleColor,
                fontStyle: isCompleted ? 'bold' : 'normal'
            });
            
            // Best time (show for any map with a recorded time)
            const bestTime = mapProgress.bestTime;
            if (bestTime) {
                const bestTimeText = this.formatTime(bestTime);
                const timeColor = isCompleted ? '#4ecdc4' : '#95a5a6';
                this.add.text(x - buttonWidth/2 + 60, y, `Best: ${bestTimeText}`, {
                    fontSize: '16px',
                    color: timeColor,
                    fontStyle: 'bold'
                });
            }
            
            
            // Status indicator (only show checkmark for completed maps)
            if (isCompleted) {
                this.add.text(x + buttonWidth/2 - 20, y, '✓', {
                    fontSize: '24px',
                    color: '#2ecc71'
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
            // Use current progress state
            const mapProgress = this.stateManager.getMapProgress(button.mapKey);
            const isCompleted = mapProgress.completed;
            
            // All maps are unlocked, so use appropriate colors
            button.background.setStrokeStyle(2, 
                isCompleted ? 0x2ecc71 : 0x4ecdc4, 
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
        const stats = this.stateManager.getCompletionStats();
        const completedCount = stats.completed;
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
        
        resetButton.on('pointerup', () => {
            this.resetProgress();
        });
    }
    
    setupInput() {
        // Keyboard navigation already initialized in create()
        
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
        // Guard against incomplete initialization (async create)
        if (!this.cursors || !this.wasd || !this.maps || this.maps.length === 0) {
            return;
        }
        
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
        
        const mapsPerRow = 3;
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
            
            // All maps are unlocked, so just start the map
            // Clear focus state before transitioning
            this.isFocused = false;
            this.selectedMapIndex = -1;
            this.updateSelection();
            
            // Add a simple fade transition
            this.cameras.main.fadeOut(250, 0, 0, 0);
            
            this.cameras.main.once('camerafadeoutcomplete', async () => {
                // Use the unified loader to start the map
                try {
                    await MapLoader.loadAndStart(this, mapKey, {
                        returnScene: 'MapSelectScene'
                    });
                } catch (error) {
                    console.error('Failed to load map:', error);
                    // Restart map select scene on error
                    this.scene.restart();
                }
            });
        }
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    resetProgress() {
        // Confirm reset
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            this.stateManager.resetProgress();
            this.scene.restart();
        }
    }
}

// Export function to be called when a map is completed
// This function is designed to work even if the MapSelectScene isn't currently active
export function completeMap(mapKey, scene) {
    // Get the state manager from any scene's registry
    const stateManager = GameStateManager.getFromScene(scene);
    
    // Mark the map as completed
    stateManager.completeMap(mapKey);
}
