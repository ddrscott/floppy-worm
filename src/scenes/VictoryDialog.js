import Phaser from 'phaser';
import { getCachedBuildMode } from '../utils/buildMode';
import MapLoader from '../services/MapLoader';
import { getMenuAudio } from '../audio/MenuAudio';

/**
 * Victory dialog scene for both static and server modes
 */
export default class VictoryDialog extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryDialog' });
        this.selectedButton = 0;
        this.buttons = [];
        this.buttonCallbacks = [];
    }
    
    init(data) {
        // Store reference to the game scene that called us
        this.gameScene = data.gameScene;
        this.mapKey = data.mapKey;
        this.sceneTitle = data.sceneTitle;
        this.stopwatch = data.stopwatch;
        this.getBestTime = data.getBestTime;
    }
    
    async create() {
        // Reset state
        this.selectedButton = 0;
        this.buttons = [];
        this.buttonCallbacks = [];
        
        // Initialize menu audio from registry
        this.menuAudio = getMenuAudio(this);
        
        // Ensure this scene renders on top
        this.scene.bringToTop();
        
        // Get build mode
        this.buildMode = await getCachedBuildMode();
        
        // Create overlay
        const overlay = this.add.rectangle(
            this.scale.width / 2, 
            this.scale.height / 2, 
            this.scale.width, 
            this.scale.height, 
            0x000000, 0.8
        );
        overlay.setDepth(100);
        
        // Dialog background
        const dialogWidth = 600;
        const dialogHeight = 360;
        const dialogBg = this.add.rectangle(
            this.scale.width / 2, 
            this.scale.height / 2, 
            dialogWidth, 
            dialogHeight, 
            0x2c3e50, 0.95
        );
        dialogBg.setDepth(101);
        dialogBg.setStrokeStyle(4, 0x4ecdc4, 1);
        
        // Victory text
        this.add.text(
            this.scale.width / 2, 
            this.scale.height / 2 - 150, 
            'LEVEL COMPLETE!', {
            fontSize: '48px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(102);
        
        // Time display
        let timeText = '';
        if (this.stopwatch) {
            const time = this.stopwatch.elapsedTime;
            timeText = `Time: ${this.formatTime(time)}`;
            
            // Check if it's a new best time
            const bestTime = this.getBestTime();
            if (!bestTime || time < bestTime) {
                timeText += ' NEW BEST!';
            }
        }
        
        this.add.text(
            this.scale.width / 2, 
            this.scale.height / 2 - 90, 
            timeText, {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(102);
        
        if (this.buildMode === 'static') {
            await this.createStaticModeButtons();
        } else {
            await this.createServerModeButtons();
        }
        
        // Set up input
        this.setupInput();
        
        // Celebration effect
        this.createCelebration();
        
        // Update initial selection
        this.updateSelection();
    }
    
    async createStaticModeButtons() {
        const centerY = this.scale.height / 2 + 20;
        const buttonSize = 100; // Square buttons
        const spacing = 15;
        
        // Get next level info
        const { getMapKeys } = await import('./maps/MapDataRegistry');
        const mapKeys = getMapKeys();
        const currentIndex = mapKeys.indexOf(this.mapKey);
        const hasNext = currentIndex !== -1 && currentIndex < mapKeys.length - 1;
        const nextMapKey = hasNext ? mapKeys[currentIndex + 1] : null;
        
        // Calculate button positions (3 buttons in a row, or 2 if no next level)
        const numButtons = hasNext ? 3 : 2;
        const totalWidth = numButtons * buttonSize + (numButtons - 1) * spacing;
        const startX = this.scale.width / 2 - totalWidth / 2 + buttonSize / 2;
        
        let buttonX = startX;
        
        // Retry button
        this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Retry', 0x3498db, () => {
            this.close();
            // Restart the scene completely for a clean replay
            this.gameScene.scene.restart();
        });
        
        buttonX += buttonSize + spacing;
        
        // Next Level button - only if there's a next level
        if (hasNext) {
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Next\nLevel', 0x27ae60, async () => {
                this.close();
                this.gameScene.scene.stop();
                
                // Use MapLoader to properly load and start the next map
                try {
                    await MapLoader.loadAndStart(this, nextMapKey, {
                        returnScene: 'MapSelectScene'
                    });
                } catch (error) {
                    console.error('Failed to load next map:', error);
                    // Fallback to map select screen on error
                    this.scene.start('MapSelectScene');
                }
            });
            buttonX += buttonSize + spacing;
        }
        
        // Main Menu button
        this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Main\nMenu', 0xe74c3c, () => {
            this.close();
            this.gameScene.scene.stop();
            this.gameScene.scene.start('MapSelectScene');
        });
        
        // Instructions
        this.add.text(
            this.scale.width / 2,
            centerY + buttonSize / 2 + 30,
            'Use ARROW KEYS or GAMEPAD to select • SPACE/ENTER/A to confirm',
            {
                fontSize: '14px',
                color: '#95a5a6'
            }
        ).setOrigin(0.5).setDepth(102);
    }
    
    async createServerModeButtons() {
        const centerY = this.scale.height / 2 + 40;
        const buttonSize = 100; // Square buttons
        const spacing = 20;
        
        // Check if map editor is actually available
        const hasMapEditor = this.scene.manager.getScene('MapEditor') !== null;
        
        if (hasMapEditor) {
            // Three buttons horizontally when editor is available
            const numButtons = 3;
            const totalWidth = numButtons * buttonSize + (numButtons - 1) * spacing;
            const startX = this.scale.width / 2 - totalWidth / 2 + buttonSize / 2;
            
            let buttonX = startX;
            
            // Retry button
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Retry', 0x3498db, () => {
                this.close();
                // Restart the scene completely for a clean replay
                this.gameScene.scene.restart();
            });
            
            buttonX += buttonSize + spacing;
            
            // Return to Editor button
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Editor', 0x27ae60, () => {
                // Switch to map editor
                this.close();
                this.gameScene.scene.stop();
                this.gameScene.scene.start('MapEditor');
            });
            
            buttonX += buttonSize + spacing;
            
            // Map Selection button
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Maps', 0xe74c3c, () => {
                this.close();
                this.gameScene.scene.stop();
                this.gameScene.scene.start('MapSelectScene');
            });
            
            // Instructions
            this.add.text(
                this.scale.width / 2,
                centerY + buttonSize / 2 + 30,
                'Server Mode • TAB to toggle editor',
                {
                    fontSize: '14px',
                    color: '#95a5a6'
                }
            ).setOrigin(0.5).setDepth(10002);
        } else {
            // Two buttons when no editor
            const numButtons = 2;
            const totalWidth = numButtons * buttonSize + (numButtons - 1) * spacing;
            const startX = this.scale.width / 2 - totalWidth / 2 + buttonSize / 2;
            
            let buttonX = startX;
            
            // Retry button
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Retry', 0x3498db, () => {
                this.close();
                // Restart the scene completely for a clean replay
                this.gameScene.scene.restart();
            });
            
            buttonX += buttonSize + spacing;
            
            // Map Selection button
            this.createButton(buttonX, centerY, buttonSize, buttonSize, 'Maps', 0xe74c3c, () => {
                this.close();
                this.gameScene.scene.stop();
                this.gameScene.scene.start('MapSelectScene');
            });
            
            // Instructions
            this.add.text(
                this.scale.width / 2,
                centerY + buttonSize / 2 + 30,
                'Use ARROW KEYS or GAMEPAD to select • SPACE/ENTER/A to confirm',
                {
                    fontSize: '14px',
                    color: '#95a5a6'
                }
            ).setOrigin(0.5).setDepth(102);
        }
    }
    
    createButton(x, y, width, height, text, color, onClick) {
        const button = this.add.rectangle(x, y, width, height, color);
        button.setDepth(102);
        button.setStrokeStyle(2, 0x4ecdc4, 1);
        button.setInteractive();
        
        // Adjust font size based on button size and text lines
        const lineCount = text.split('\n').length;
        const fontSize = lineCount > 1 ? '16px' : '18px';
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: fontSize,
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(103);
        
        // Store button data
        const buttonIndex = this.buttons.length;
        this.buttons.push({ button, text: buttonText });
        this.buttonCallbacks.push(onClick);
        
        // Mouse interaction
        button.on('pointerup', onClick);
        button.on('pointerover', () => {
            this.selectedButton = buttonIndex;
            this.updateSelection();
        });
        
        return button;
    }
    
    setupInput() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Gamepad tracking
        this.gamepadInputTimer = 0;
        this.gamepadInputDelay = 200;
        
        // Setup gamepad event listeners
        const pad = this.input.gamepad.getPad(0);
        if (pad) {
            this.gamepad = pad;
            this.gamepadDownHandler = (index, value, button) => {
                if (index === 0) { // A button
                    this.selectButton();
                }
            };
            pad.on('down', this.gamepadDownHandler);
        }
        
        // Clean up on scene shutdown
        this.events.once('shutdown', () => {
            if (this.gamepad && this.gamepadDownHandler) {
                this.gamepad.off('down', this.gamepadDownHandler);
            }
        });
    }
    
    update() {
        // Guard against update being called before create() finishes
        if (!this.cursors || !this.wasd || !this.enterKey || !this.spaceKey) {
            return;
        }
        
        // Handle keyboard navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) {
            this.navigate(-1, 0);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) {
            this.navigate(1, 0);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) {
            this.navigate(0, -1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) {
            this.navigate(0, 1);
        }
        
        // Handle selection
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectButton();
        }
        
        // Handle gamepad
        this.handleGamepadInput();
    }
    
    handleGamepadInput() {
        const currentTime = this.time.now;
        
        if (currentTime - this.gamepadInputTimer < this.gamepadInputDelay) {
            return;
        }
        
        const gamepads = this.input.gamepad.gamepads;
        if (!gamepads || gamepads.length === 0) return;
        
        const gamepad = gamepads[0];
        if (!gamepad) return;
        
        let navigationOccurred = false;
        
        // D-pad or stick navigation
        if (gamepad.left || gamepad.leftStick.x < -0.5) {
            this.navigate(-1, 0);
            navigationOccurred = true;
        } else if (gamepad.right || gamepad.leftStick.x > 0.5) {
            this.navigate(1, 0);
            navigationOccurred = true;
        } else if (gamepad.up || gamepad.leftStick.y < -0.5) {
            this.navigate(0, -1);
            navigationOccurred = true;
        } else if (gamepad.down || gamepad.leftStick.y > 0.5) {
            this.navigate(0, 1);
            navigationOccurred = true;
        }
        
        // Button presses are now handled by gamepad events in setupInput()
        
        if (navigationOccurred) {
            this.gamepadInputTimer = currentTime;
        }
    }
    
    navigate(deltaX, deltaY) {
        if (this.buttons.length === 0) return;
        
        const oldSelection = this.selectedButton;
        
        // All buttons are now in a horizontal row
        // Left/right arrows navigate between buttons
        if (deltaX !== 0) {
            this.selectedButton = (this.selectedButton + deltaX + this.buttons.length) % this.buttons.length;
        }
        // Up/down arrows also navigate horizontally for convenience
        else if (deltaY !== 0) {
            // Down goes right, up goes left
            const direction = deltaY > 0 ? 1 : -1;
            this.selectedButton = (this.selectedButton + direction + this.buttons.length) % this.buttons.length;
        }
        
        // Play sound if selection changed
        if (oldSelection !== this.selectedButton && this.menuAudio) {
            this.menuAudio.play('navigate');
        }
        
        this.updateSelection();
    }
    
    updateSelection() {
        this.buttons.forEach((buttonData, index) => {
            if (index === this.selectedButton) {
                buttonData.button.setScale(1.05);
                buttonData.button.setStrokeStyle(4, 0xffffff, 1);
            } else {
                buttonData.button.setScale(1);
                buttonData.button.setStrokeStyle(2, 0x4ecdc4, 1);
            }
        });
    }
    
    selectButton() {
        if (this.selectedButton >= 0 && this.selectedButton < this.buttonCallbacks.length) {
            const callback = this.buttonCallbacks[this.selectedButton];
            if (callback) {
                if (this.menuAudio) {
                    this.menuAudio.play('select');
                }
                callback();
            }
        }
    }
    
    createCelebration() {
        // Celebration stars
        for (let i = 0; i < 15; i++) {
            this.time.delayedCall(i * 100, () => {
                const star = this.add.star(
                    Phaser.Math.Between(200, this.scale.width - 200),
                    Phaser.Math.Between(100, this.scale.height - 100),
                    5, 8, 15,
                    Phaser.Display.Color.RandomRGB().color
                ).setDepth(99);
                
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
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    close() {
        // Stop this scene and wake the game scene (since it was put to sleep)
        this.scene.stop();
        this.scene.wake(this.gameScene.scene.key);
    }
}