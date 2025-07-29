import Phaser from 'phaser';

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
    }
    
    init(data) {
        // Store reference to the game scene that called us
        this.gameScene = data.gameScene;
        this.mapKey = data.mapKey;
        
        // Reset state
        this.selectedButton = 0;
        this.buttons = [];
        this.buttonCallbacks = [];
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
        
        // Dialog background - increased height to accommodate gamepad layout
        const dialogWidth = 600;
        const dialogHeight = 500;
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
            this.scale.height / 2 - 100, 
            'PAUSED', {
            fontSize: '48px',
            color: '#ecf0f1',
            stroke: '#34495e',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(102);
        
        // Create menu buttons
        const centerY = this.scale.height / 2;
        const buttonWidth = 200;
        const buttonHeight = 50;
        const spacing = 15;
        const startY = centerY - 30;
        
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
        
        // Main Menu button
        this.createButton(
            this.scale.width / 2, 
            startY + (buttonHeight + spacing) * 2, 
            buttonWidth, 
            buttonHeight, 
            'Main Menu', 
            0xe74c3c, 
            () => this.returnToMainMenu()
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
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
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
        
        // Handle selection
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectButton();
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
            options: pad.buttons[9] && pad.buttons[9].pressed // Options/Start button
        };
        
        // Check for button press (transition from not pressed to pressed)
        if (currentStates.up && !this.gamepadButtonStates.up) {
            this.navigate(-1);
        } else if (currentStates.down && !this.gamepadButtonStates.down) {
            this.navigate(1);
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
        this.selectedButton = (this.selectedButton + direction + this.buttons.length) % this.buttons.length;
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
                callback();
            }
        }
    }
    
    resumeGame() {
        // Stop this scene and resume the game scene
        this.scene.stop();
        this.scene.resume(this.gameScene.scene.key);
    }
    
    restartLevel() {
        // Stop this scene and restart the game scene
        this.scene.stop();
        this.scene.resume(this.gameScene.scene.key);
        this.gameScene.scene.restart();
    }
    
    returnToMainMenu() {
        // Stop both scenes and go to map select
        this.scene.stop();
        this.gameScene.scene.stop();
        this.scene.start('MapSelectScene');
    }
}
