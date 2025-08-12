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
        this.scrollContainer = null; // Container for all scrollable content
        this.currentScrollY = 0; // Track current scroll position
        this.targetScrollY = 0; // Target scroll position for smooth scrolling
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
    
    loadMapsFromDataRegistry() {
        // loadMapMetadata is now synchronous
        const maps = loadMapMetadata();
        
        // Preload map assets (textures, sounds, etc) if needed
        // Note: Map data itself is already loaded via import.meta.glob
        maps.forEach(map => {
            // Any asset preloading can go here if needed
            // For now, maps are loaded from the static registry
        });
        
        return maps;
    }

    async create() {
        // Reset transitioning flag
        this.isTransitioning = false;
        
        // Get build mode
        this.buildMode = await getCachedBuildMode();
        this.buildConfig = BuildConfig[this.buildMode];
        
        // Initialize keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Load maps instantly from static registry
        this.maps = this.loadMapsFromDataRegistry();
        
        // Ensure all maps have progress entries
        const mapKeys = this.maps.map(map => map.key);
        this.stateManager.ensureAllMapsHaveProgress(mapKeys);
        
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
        
        if (!isMobile) {
            this.add.text(centerX, gameHeight - 30, 
                'ARROWS/WASD: Navigate • PAGE UP/DOWN: Jump rows • HOME/END: First/Last • ENTER/SPACE: Select • Mouse wheel: Scroll', {
                fontSize: '13px',
                color: '#7f8c8d',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setDepth(100);
        } else {
            this.add.text(centerX, gameHeight - 60, 'Tap to select • Swipe to scroll • ESC to refresh', {
                fontSize: '12px',
                color: '#7f8c8d',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setDepth(100);
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
        // Create a container for all scrollable content
        this.scrollContainer = this.add.container(0, 0);
        
        const startX = this.scale.width / 2 - 400; // Centered with padding
        const startY = 220;
        const buttonWidth = 240;
        const buttonHeight = 80;
        const spacingX = 20;
        const spacingY = 90;
        const mapsPerRow = 3;
        
        // Calculate total height needed for all maps
        const totalRows = Math.ceil(this.maps.length / mapsPerRow);
        this.totalContentHeight = startY + (totalRows * spacingY) + 100; // Add padding at bottom
        
        this.maps.forEach((map, index) => {
            const row = Math.floor(index / mapsPerRow);
            const col = index % mapsPerRow;
            
            const x = startX + col * (buttonWidth + spacingX) + buttonWidth/2;
            const y = startY + row * spacingY;
            
            const mapProgress = this.stateManager.getMapProgress(map.key);
            const isUnlocked = mapProgress.unlocked;
            const isCompleted = mapProgress.completed;
            
            // Button background (add to scroll container)
            const buttonBg = this.add.rectangle(x, y, buttonWidth, buttonHeight);
            this.scrollContainer.add(buttonBg);
            
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
            
            // Map number (add to scroll container)
            const mapNumber = this.add.text(x - buttonWidth/2 + 20, y - 15, `${(index + 1).toString().padStart(2, '0')}`, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            });
            this.scrollContainer.add(mapNumber);
            
            // Map title (all maps are unlocked, so always white)
            const titleColor = '#ffffff';
            const title = this.add.text(x - buttonWidth/2 + 60, y - 18, map.title, {
                fontSize: '16px',
                color: titleColor,
                fontStyle: isCompleted ? 'bold' : 'normal'
            });
            this.scrollContainer.add(title);
            
            // Best time (show for any map with a recorded time)
            const bestTime = mapProgress.bestTime;
            if (bestTime) {
                const bestTimeText = this.formatTime(bestTime);
                const timeColor = isCompleted ? '#4ecdc4' : '#95a5a6';
                const timeText = this.add.text(x - buttonWidth/2 + 60, y, `Best: ${bestTimeText}`, {
                    fontSize: '16px',
                    color: timeColor,
                    fontStyle: 'bold'
                });
                this.scrollContainer.add(timeText);
            }
            
            
            // Status indicator (only show checkmark for completed maps)
            if (isCompleted) {
                const checkmark = this.add.text(x + buttonWidth/2 - 20, y, '✓', {
                    fontSize: '24px',
                    color: '#2ecc71'
                }).setOrigin(0.5);
                this.scrollContainer.add(checkmark);
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
        
        // Add scroll indicators if content is scrollable
        if (this.totalContentHeight > this.scale.height) {
            this.createScrollIndicators();
        }
        
        // Set up mouse wheel scrolling
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.scrollContent(deltaY * 0.5);
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
                
                // Auto-scroll to keep selected button in view
                this.scrollToButton(selectedButton);
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
        
        // View Recordings button (top left)
        const recordingsButton = this.add.text(20, 20, 'View Recordings', {
            fontSize: '16px',
            color: '#9b59b6',
            backgroundColor: 'rgba(155, 89, 182, 0.2)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0, 0).setInteractive();
        
        recordingsButton.on('pointerup', () => {
            // Navigate to recordings page
            // With proper SPA hosting (Vercel, Netlify, etc), this works in new tabs too
            // For local testing without SPA support, use same window
            if (window.location.hostname === 'localhost' && window.location.port === '8080') {
                // Local python server without SPA support
                window.location.href = '/recordings';
            } else {
                // Production or proper SPA hosting
                window.open('/recordings', '_blank');
            }
        });
        
        recordingsButton.on('pointerover', () => {
            recordingsButton.setBackgroundColor('rgba(155, 89, 182, 0.4)');
        });
        
        recordingsButton.on('pointerout', () => {
            recordingsButton.setBackgroundColor('rgba(155, 89, 182, 0.2)');
        });
        
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
        
        // Page navigation keys for faster scrolling
        this.pageUpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP);
        this.pageDownKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN);
        this.homeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.HOME);
        this.endKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.END);
        
        // Fullscreen toggle
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        this.f11Key.on('down', function () {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        }, this);
        
        // Gamepad setup
        this.gamepadInputTimer = 0; // Track last gamepad input time
        this.gamepadInputDelay = 200; // Milliseconds between gamepad inputs
        
        // Setup gamepad event listeners
        this.setupGamepadEvents();
        
        // Listen for scene events to reset transitioning state
        this.events.on('wake', () => {
            this.isTransitioning = false;
            this.setupGamepadEvents(); // Re-setup gamepad events when scene wakes
        });
        this.events.on('resume', () => {
            this.isTransitioning = false;
            this.setupGamepadEvents(); // Re-setup gamepad events when scene resumes
        });
        this.events.on('shutdown', () => {
            this.removeGamepadEvents(); // Clean up gamepad events when scene shuts down
        });
        
        // Mouse/touch input is handled directly in createMapGrid
    }
    
    setupGamepadEvents() {
        // Remove any existing listeners first
        this.removeGamepadEvents();
        
        // Get the first gamepad
        const pad = this.input.gamepad.getPad(0);
        if (!pad) {
            // If no gamepad connected, listen for connection
            if (!this.gamepadConnectedHandler) {
                this.gamepadConnectedHandler = (pad) => {
                    this.setupGamepadEvents();
                };
                this.input.gamepad.once('connected', this.gamepadConnectedHandler);
            }
            return;
        }
        
        // Store reference for cleanup
        this.gamepad = pad;
        
        // Listen for button down events
        this.gamepadDownHandler = (index, value, button) => {
            // Don't process if transitioning
            if (this.isTransitioning) return;
            
            const currentTime = this.time.now;
            if (currentTime - this.gamepadInputTimer < this.gamepadInputDelay) {
                return;
            }
            
            switch(index) {
                case 0: // A button
                    this.selectMap();
                    this.gamepadInputTimer = currentTime;
                    break;
                case 1: // B button
                    this.scene.restart();
                    this.gamepadInputTimer = currentTime;
                    break;
            }
        };
        
        pad.on('down', this.gamepadDownHandler);
    }
    
    removeGamepadEvents() {
        if (this.gamepad && this.gamepadDownHandler) {
            this.gamepad.off('down', this.gamepadDownHandler);
        }
        if (this.gamepadConnectedHandler) {
            this.input.gamepad.off('connected', this.gamepadConnectedHandler);
            this.gamepadConnectedHandler = null;
        }
    }
    
    update(time, delta) {
        // Guard against incomplete initialization (async create)
        if (!this.cursors || !this.wasd || !this.maps || this.maps.length === 0) {
            return;
        }
        
        // Don't process input if we're transitioning
        if (this.isTransitioning) {
            return;
        }
        
        // Smooth scrolling animation
        if (this.scrollContainer && Math.abs(this.targetScrollY - this.currentScrollY) > 1) {
            const scrollSpeed = 0.15;
            this.currentScrollY += (this.targetScrollY - this.currentScrollY) * scrollSpeed;
            this.scrollContainer.y = -this.currentScrollY;
            this.updateScrollIndicators();
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
        
        // Handle page navigation for faster scrolling
        if (Phaser.Input.Keyboard.JustDown(this.pageUpKey)) {
            this.navigateMap(0, -3); // Jump 3 rows up
        } else if (Phaser.Input.Keyboard.JustDown(this.pageDownKey)) {
            this.navigateMap(0, 3); // Jump 3 rows down
        } else if (Phaser.Input.Keyboard.JustDown(this.homeKey)) {
            // Jump to first map
            this.selectedMapIndex = 0;
            this.isFocused = true;
            this.updateSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.endKey)) {
            // Jump to last map
            this.selectedMapIndex = this.maps.length - 1;
            this.isFocused = true;
            this.updateSelection();
        }
        
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

        // Button presses are now handled by gamepad events, not polling

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
        
        // Prevent selection if we're already transitioning
        if (this.isTransitioning) {
            return;
        }
        
        const selectedButton = this.mapButtons[this.selectedMapIndex];
        
        if (selectedButton) {
            const mapKey = selectedButton.mapKey;
            
            // Set transitioning flag to prevent multiple selections
            this.isTransitioning = true;
            
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
    
    // New scroll helper methods
    scrollContent(deltaY) {
        if (!this.scrollContainer) return;
        
        // Calculate max scroll bounds
        const maxScroll = Math.max(0, this.totalContentHeight - this.scale.height + 100);
        
        // Update target scroll position
        this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY + deltaY, 0, maxScroll);
    }
    
    scrollToButton(button) {
        if (!this.scrollContainer) return;
        
        const viewportHeight = this.scale.height;
        const buttonTop = button.y - button.height/2 - this.currentScrollY;
        const buttonBottom = button.y + button.height/2 - this.currentScrollY;
        
        // Define visible area (leave some margin at top and bottom)
        const marginTop = 200;
        const marginBottom = 100;
        
        if (buttonTop < marginTop) {
            // Button is above visible area, scroll up
            this.targetScrollY = button.y - button.height/2 - marginTop;
        } else if (buttonBottom > viewportHeight - marginBottom) {
            // Button is below visible area, scroll down
            this.targetScrollY = button.y + button.height/2 - viewportHeight + marginBottom;
        }
        
        // Clamp to valid range
        const maxScroll = Math.max(0, this.totalContentHeight - viewportHeight + 100);
        this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, maxScroll);
    }
    
    createScrollIndicators() {
        // Create up arrow indicator
        this.scrollUpIndicator = this.add.triangle(
            this.scale.width / 2, 180,
            0, 15, 15, 15, 7.5, 0,
            0x4ecdc4, 0.8
        );
        this.scrollUpIndicator.setDepth(100);
        
        // Create down arrow indicator
        this.scrollDownIndicator = this.add.triangle(
            this.scale.width / 2, this.scale.height - 80,
            0, 0, 15, 0, 7.5, 15,
            0x4ecdc4, 0.8
        );
        this.scrollDownIndicator.setDepth(100);
        
        // Create scroll bar on the right
        const scrollBarBg = this.add.rectangle(
            this.scale.width - 20, this.scale.height / 2,
            4, this.scale.height - 300,
            0x333333, 0.5
        );
        scrollBarBg.setDepth(100);
        
        // Create scroll thumb
        this.scrollThumb = this.add.rectangle(
            this.scale.width - 20, 300,
            8, 50,
            0x4ecdc4, 0.8
        );
        this.scrollThumb.setDepth(101);
        
        this.updateScrollIndicators();
    }
    
    updateScrollIndicators() {
        if (!this.scrollUpIndicator || !this.scrollDownIndicator) return;
        
        const maxScroll = Math.max(0, this.totalContentHeight - this.scale.height + 100);
        
        // Show/hide scroll indicators
        this.scrollUpIndicator.setAlpha(this.currentScrollY > 10 ? 0.8 : 0.2);
        this.scrollDownIndicator.setAlpha(this.currentScrollY < maxScroll - 10 ? 0.8 : 0.2);
        
        // Update scroll thumb position
        if (this.scrollThumb && maxScroll > 0) {
            const scrollPercentage = this.currentScrollY / maxScroll;
            const thumbRange = this.scale.height - 350;
            this.scrollThumb.y = 300 + (scrollPercentage * thumbRange);
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
