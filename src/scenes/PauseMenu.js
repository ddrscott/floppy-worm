import Phaser from 'phaser';
import { getMenuAudio } from '../audio/MenuAudio';
import SettingsScene from './SettingsScene';

/**
 * Pause menu overlay scene
 * Displays Resume, Restart, and Main Menu options
 * Supports both keyboard and gamepad navigation
 */
export default class PauseMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseMenu' });
        this.selectedButton = 0;
        this.buttons = [];
        this.buttonCallbacks = [];
        
        // Load saved volume from localStorage
        const savedVolume = localStorage.getItem('gameVolume');
        this.globalVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;
    }
    
    init(data) {
        // Store reference to the game scene that called us
        this.gameScene = data.gameScene;
        this.mapKey = data.mapKey;
        
        // Reset state
        this.selectedButton = 0;
        this.buttons = [];
        this.buttonCallbacks = [];
        
        // Initialize menu audio from registry
        this.menuAudio = getMenuAudio(this);
    }
    
    create() {
        // Ensure this scene renders on top
        this.scene.bringToTop();
        
        // Add a small delay before accepting input to prevent immediate close
        this.inputDelay = 300; // milliseconds
        this.inputStartTime = this.time.now;
        
        // Create dark overlay
        const overlay = this.add.rectangle(
            this.scale.width / 2, 
            this.scale.height / 2, 
            this.scale.width, 
            this.scale.height, 
            0x000000, 0.7
        );
        overlay.setDepth(100);
        
        // Dialog background - sized for mobile compatibility
        const dialogWidth = 320;
        const dialogHeight = 450;
        const dialogBg = this.add.rectangle(
            this.scale.width / 2, 
            this.scale.height / 2, 
            dialogWidth, 
            dialogHeight, 
            0x2c3e50, 0.95
        );
        dialogBg.setDepth(101);
        dialogBg.setStrokeStyle(4, 0x34495e, 1);
        
        // Title
        this.add.text(
            this.scale.width / 2, 
            this.scale.height / 2 - 160, 
            'PAUSED', {
            fontSize: '32px',
            color: '#ecf0f1',
            stroke: '#34495e',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(102);
        
        // Create menu buttons
        const centerY = this.scale.height / 2;
        const buttonWidth = 180;
        const buttonHeight = 40;
        const spacing = 12;
        const startY = centerY - 80;
        
        // Resume button
        this.createButton(
            this.scale.width / 2, 
            startY, 
            buttonWidth, 
            buttonHeight, 
            'Resume', 
            0x27ae60, 
            () => this.resumeGame()
        );
        
        // Restart button
        this.createButton(
            this.scale.width / 2, 
            startY + buttonHeight + spacing, 
            buttonWidth, 
            buttonHeight, 
            'Restart', 
            0x3498db, 
            () => this.restartLevel()
        );
        
        // Settings button
        this.createButton(
            this.scale.width / 2, 
            startY + (buttonHeight + spacing) * 2, 
            buttonWidth, 
            buttonHeight, 
            'Settings', 
            0x9b59b6, 
            () => this.openSettings()
        );
        
        // Main Menu button
        this.createButton(
            this.scale.width / 2, 
            startY + (buttonHeight + spacing) * 3, 
            buttonWidth, 
            buttonHeight, 
            'Main Menu', 
            0xe74c3c, 
            () => this.returnToMainMenu()
        );
        
        // Volume Control Section
        this.createVolumeControl(
            this.scale.width / 2, 
            startY + (buttonHeight + spacing) * 4 + 20
        );
        
        // Set up input
        this.setupInput();
        
        // Update initial selection
        this.updateSelection();
        
        // Initialize gamepad button states to current state to prevent immediate trigger
        const pad = this.input.gamepad.getPad(0);
        if (pad) {
            this.gamepadButtonStates = {
                A: pad.A,
                B: pad.B,
                up: pad.up || pad.leftStick.y < -0.5,
                down: pad.down || pad.leftStick.y > 0.5,
                options: pad.buttons[9] && pad.buttons[9].pressed
            };
        }
    }
    
    createButton(x, y, width, height, text, color, onClick) {
        const button = this.add.rectangle(x, y, width, height, color);
        button.setDepth(102);
        button.setStrokeStyle(2, 0x4ecdc4, 1);
        button.setInteractive();
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(103);
        
        // Store button data
        const buttonIndex = this.buttons.length;
        this.buttons.push({ button, text: buttonText, isVolumeControl: false });
        this.buttonCallbacks.push(onClick);
        
        // Mouse interaction
        button.on('pointerup', onClick);
        button.on('pointerover', () => {
            this.selectedButton = buttonIndex;
            this.updateSelection();
        });
        
        return button;
    }
    
    createVolumeControl(x, y) {
        // Volume label
        this.add.text(x, y, 'Volume', {
            fontSize: '18px',
            color: '#ecf0f1'
        }).setOrigin(0.5).setDepth(102);
        
        // Volume control container
        const controlY = y + 28;
        const sliderWidth = 200;
        const sliderHeight = 32;
        
        // Create volume control as a button for navigation
        const volumeButton = this.add.rectangle(x, controlY, sliderWidth + 60, sliderHeight, 0x34495e);
        volumeButton.setDepth(102);
        volumeButton.setStrokeStyle(2, 0x4ecdc4, 1);
        volumeButton.setInteractive();
        
        // Slider background
        const sliderBg = this.add.rectangle(x, controlY, sliderWidth, 8, 0x2c3e50);
        sliderBg.setDepth(103);
        
        // Slider fill
        this.volumeFill = this.add.rectangle(
            x - sliderWidth/2, 
            controlY, 
            sliderWidth * this.globalVolume, 
            8, 
            0x4ecdc4
        );
        this.volumeFill.setOrigin(0, 0.5);
        this.volumeFill.setDepth(104);
        
        // Volume percentage text
        this.volumeText = this.add.text(x, controlY + 20, `${Math.round(this.globalVolume * 100)}%`, {
            fontSize: '12px',
            color: '#95a5a6'
        }).setOrigin(0.5).setDepth(102);
        
        // Minus button
        const minusBtn = this.add.text(x - sliderWidth/2 - 20, controlY, '-', {
            fontSize: '20px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(104);
        
        // Plus button
        const plusBtn = this.add.text(x + sliderWidth/2 + 20, controlY, '+', {
            fontSize: '20px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(104);
        
        // Store volume control as a button for keyboard navigation
        const buttonIndex = this.buttons.length;
        this.buttons.push({ 
            button: volumeButton, 
            text: this.volumeText, 
            isVolumeControl: true,
            sliderWidth: sliderWidth
        });
        this.buttonCallbacks.push(null); // No click callback for volume
        
        // Mouse interaction for slider
        volumeButton.on('pointerdown', (pointer) => {
            this.isDraggingVolume = true;
            this.updateVolumeFromPointer(pointer, x, sliderWidth);
        });
        
        volumeButton.on('pointermove', (pointer) => {
            if (this.isDraggingVolume) {
                this.updateVolumeFromPointer(pointer, x, sliderWidth);
            }
        });
        
        volumeButton.on('pointerup', () => {
            this.isDraggingVolume = false;
        });
        
        volumeButton.on('pointerover', () => {
            this.selectedButton = buttonIndex;
            this.updateSelection();
        });
        
        // Click handlers for +/- buttons
        minusBtn.setInteractive();
        minusBtn.on('pointerup', () => {
            this.adjustVolume(-0.1);
        });
        
        plusBtn.setInteractive();
        plusBtn.on('pointerup', () => {
            this.adjustVolume(0.1);
        });
        
        // Apply current volume to game
        this.applyVolume();
    }
    
    updateVolumeFromPointer(pointer, centerX, sliderWidth) {
        const localX = pointer.x - centerX + sliderWidth/2;
        const newVolume = Phaser.Math.Clamp(localX / sliderWidth, 0, 1);
        this.setVolume(newVolume);
    }
    
    adjustVolume(delta) {
        const newVolume = Phaser.Math.Clamp(this.globalVolume + delta, 0, 1);
        this.setVolume(newVolume);
    }
    
    setVolume(volume) {
        this.globalVolume = volume;
        
        // Update visual
        if (this.volumeFill) {
            const volumeControl = this.buttons.find(b => b.isVolumeControl);
            if (volumeControl) {
                this.volumeFill.width = volumeControl.sliderWidth * this.globalVolume;
            }
        }
        
        if (this.volumeText) {
            this.volumeText.setText(`${Math.round(this.globalVolume * 100)}%`);
        }
        
        // Save to localStorage
        localStorage.setItem('gameVolume', this.globalVolume.toString());
        
        // Apply to game
        this.applyVolume();
        
        // Play a sound to test the volume
        if (this.menuAudio) {
            this.menuAudio.play('navigate');
        }
    }
    
    applyVolume() {
        // Set global volume for all sounds
        this.sound.volume = this.globalVolume;
        
        // Also update the game scene's background music if it exists
        if (this.gameScene && this.gameScene.backgroundMusic) {
            // Store the original configured volume if not already stored
            if (!this.gameScene.bgMusicOriginalVolume) {
                this.gameScene.bgMusicOriginalVolume = this.gameScene.bgMusicConfig.volume;
            }
            // Apply global volume multiplier to the music's configured volume
            this.gameScene.backgroundMusic.setVolume(this.gameScene.bgMusicOriginalVolume * this.globalVolume);
        }
    }
    
    setupInput() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // Gamepad tracking
        this.gamepadInputTimer = 0;
        this.gamepadInputDelay = 200;
        
        // Track gamepad button states to prevent repeat
        this.gamepadButtonStates = {
            A: false,
            B: false,
            up: false,
            down: false,
            left: false,
            right: false,
            options: false
        };
    }
    
    update() {
        // Skip input until delay has passed
        if (this.time.now - this.inputStartTime < this.inputDelay) {
            return;
        }
        
        // Handle keyboard navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) {
            this.navigate(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) {
            this.navigate(1);
        }
        
        // Handle selection or volume adjustment
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectButton();
        }
        
        // Left/Right for volume control when selected
        const selectedItem = this.buttons[this.selectedButton];
        if (selectedItem && selectedItem.isVolumeControl) {
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) {
                this.adjustVolume(-0.05);
            } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) {
                this.adjustVolume(0.05);
            }
        }
        
        // ESC to resume
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.resumeGame();
        }
        
        // Handle gamepad
        this.handleGamepadInput();
    }
    
    handleGamepadInput() {
        const pad = this.input.gamepad.getPad(0);
        if (!pad) return;
        
        // Track button states to detect just pressed
        const currentStates = {
            A: pad.A,
            B: pad.B,
            up: pad.up || pad.leftStick.y < -0.5,
            down: pad.down || pad.leftStick.y > 0.5,
            left: pad.left || pad.leftStick.x < -0.5,
            right: pad.right || pad.leftStick.x > 0.5,
            options: pad.buttons[9] && pad.buttons[9].pressed // Options/Start button
        };
        
        // Check for button press (transition from not pressed to pressed)
        if (currentStates.up && !this.gamepadButtonStates.up) {
            this.navigate(-1);
        } else if (currentStates.down && !this.gamepadButtonStates.down) {
            this.navigate(1);
        }
        
        // Left/Right for volume control when selected
        const selectedItem = this.buttons[this.selectedButton];
        if (selectedItem && selectedItem.isVolumeControl) {
            if (currentStates.left && !this.gamepadButtonStates.left) {
                this.adjustVolume(-0.05);
            } else if (currentStates.right && !this.gamepadButtonStates.right) {
                this.adjustVolume(0.05);
            }
        }
        
        // A button to select
        if (currentStates.A && !this.gamepadButtonStates.A) {
            this.selectButton();
        }
        
        // B button or Options button to resume
        if ((currentStates.B && !this.gamepadButtonStates.B) || 
            (currentStates.options && !this.gamepadButtonStates.options)) {
            this.resumeGame();
        }
        
        // Update button states
        this.gamepadButtonStates = currentStates;
    }
    
    navigate(direction) {
        const oldSelection = this.selectedButton;
        this.selectedButton = (this.selectedButton + direction + this.buttons.length) % this.buttons.length;
        
        // Play sound only if selection actually changed
        if (oldSelection !== this.selectedButton && this.menuAudio) {
            // Use 'navigate' type which has proper fade-out
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
                // No delay needed - audio tweens run at game level now
                callback();
            }
        }
    }
    
    resumeGame() {
        // Stop this scene and resume the game scene
        this.scene.stop();
        this.scene.resume(this.gameScene.scene.key);
    }
    
    async restartLevel() {
        // Save recording as incomplete before restarting
        if (this.gameScene && this.gameScene.saveRecordingToIndexedDB) {
            const elapsedTime = this.gameScene.stopwatch ? this.gameScene.stopwatch.elapsedTime : 0;
            await this.gameScene.saveRecordingToIndexedDB(false, elapsedTime, 'restart_from_pause');
        }
        
        // Stop this scene and restart the game scene
        this.scene.stop();
        this.scene.resume(this.gameScene.scene.key);
        this.gameScene.scene.restart();
    }
    
    openSettings() {
        // Add SettingsScene if not already added
        if (!this.scene.manager.getScene('SettingsScene')) {
            this.scene.manager.add('SettingsScene', SettingsScene, false);
        }
        
        // Pause this menu and launch settings
        this.scene.pause();
        this.scene.launch('SettingsScene', {
            callerScene: 'PauseMenu',
            isPauseMenu: true
        });
    }
    
    async returnToMainMenu() {
        // Save recording as incomplete before leaving
        if (this.gameScene && this.gameScene.saveRecordingToIndexedDB) {
            const elapsedTime = this.gameScene.stopwatch ? this.gameScene.stopwatch.elapsedTime : 0;
            await this.gameScene.saveRecordingToIndexedDB(false, elapsedTime, 'returned_to_menu');
        }
        
        // Stop both scenes and go to map select
        this.scene.stop();
        this.gameScene.scene.stop();
        this.scene.start('MapSelectScene');
    }
}
