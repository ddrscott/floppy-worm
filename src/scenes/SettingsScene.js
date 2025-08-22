import Phaser from 'phaser';
import { getMenuAudio } from '../audio/MenuAudio';
import ScrollingBackground from '../utils/ScrollingBackground';

export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
        
        this.selectedOption = 0;
        this.options = [];
        this.optionCallbacks = [];
        this.isDragging = false;
        
        // Load saved settings from localStorage
        this.settings = {
            masterVolume: parseFloat(localStorage.getItem('masterVolume') ?? '0.5'),
            musicVolume: parseFloat(localStorage.getItem('musicVolume') ?? '0.7'),
            sfxVolume: parseFloat(localStorage.getItem('sfxVolume') ?? '0.8'),
            fullscreen: localStorage.getItem('fullscreen') === 'true'
        };
        
        // Input state tracking for gamepad
        this.gamepadButtonStates = {
            up: false,
            down: false,
            left: false,
            right: false,
            A: false,
            B: false
        };
    }
    
    init(data) {
        // Store caller scene reference if provided
        this.callerScene = data?.callerScene;
        this.isPauseMenu = data?.isPauseMenu || false;
        
        // Reset state
        this.selectedOption = 0;
        this.options = [];
        this.optionCallbacks = [];
        
        // Initialize menu audio
        this.menuAudio = getMenuAudio(this);
    }
    
    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Create scrolling background like TitleScene
        this.scrollingBackground = new ScrollingBackground(this, {
            backgroundColor: 0x1a1a2e,
            gridColor: 0x888888,
            gridAlpha: 0.5,
            particleColor: 0x4ecdc4,
            scrollSpeed: 3000
        });
        this.scrollingBackground.create();
        
        // Fade in the scene
        this.cameras.main.fadeIn(300, 0, 0, 0);
        
        // Create semi-transparent overlay with proper depth
        this.overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.3);
        this.overlay.setDepth(-50); // Ensure it's above background but below UI
        
        // Set up resize handler for overlay
        this.scale.on('resize', () => {
            const { width: newWidth, height: newHeight } = this.scale;
            if (this.overlay) {
                this.overlay.setPosition(newWidth / 2, newHeight / 2);
                this.overlay.setSize(newWidth, newHeight);
            }
        }, this);
        
        // Settings container - narrower for better fit
        const containerWidth = Math.min(480, width * 0.85);
        const containerHeight = Math.min(520, height * 0.85);
        const containerBg = this.add.rectangle(
            centerX, centerY,
            containerWidth, containerHeight,
            0x2c3e50, 0.95
        );
        containerBg.setStrokeStyle(4, 0x34495e, 1);
        containerBg.setDepth(0); // Ensure it's above overlay
        
        // Title
        const titleY = centerY - containerHeight/2 + 50;
        const titleText = this.add.text(centerX, titleY, 'SETTINGS', {
            fontSize: '36px',
            color: '#ecf0f1',
            stroke: '#34495e',
            strokeThickness: 4
        });
        titleText.setOrigin(0.5);
        titleText.setDepth(1);
        
        // Create settings options
        const startY = titleY + 70;
        const optionSpacing = 70;
        let currentY = startY;
        
        // Master Volume
        this.createVolumeSlider(
            centerX, currentY,
            'Master Volume',
            'masterVolume',
            this.settings.masterVolume
        );
        currentY += optionSpacing;
        
        // Music Volume
        this.createVolumeSlider(
            centerX, currentY,
            'Music Volume',
            'musicVolume',
            this.settings.musicVolume
        );
        currentY += optionSpacing;
        
        // SFX Volume
        this.createVolumeSlider(
            centerX, currentY,
            'SFX Volume',
            'sfxVolume',
            this.settings.sfxVolume
        );
        currentY += optionSpacing;
        
        // Fullscreen Toggle
        this.createToggle(
            centerX, currentY,
            'Fullscreen',
            'fullscreen',
            this.settings.fullscreen
        );
        currentY += optionSpacing;
        
        // Controls Display
        this.createControlsDisplay(centerX, currentY);
        currentY += optionSpacing + 30;
        
        // Back button - ensure it stays within container
        const backButtonY = Math.min(currentY, centerY + containerHeight/2 - 40);
        this.createButton(
            centerX, backButtonY,
            200, 40,
            'Back',
            0x27ae60,
            () => this.goBack()
        );
        
        // Setup input
        this.setupInput();
        
        // Update initial selection
        this.updateSelection();
        
        // Apply initial volume settings
        this.applyVolumeSettings();
        
        // Apply fullscreen if enabled
        if (this.settings.fullscreen && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }
    }
    
    createVolumeSlider(x, y, label, settingKey, initialValue) {
        // Label - adjusted position for narrower container
        const labelText = this.add.text(x - 120, y, label, {
            fontSize: '16px',
            color: '#ecf0f1'
        }).setOrigin(0, 0.5).setDepth(1);
        
        // Slider container - adjusted for narrower card
        const sliderWidth = 150;
        const sliderHeight = 32;
        const sliderX = x + 40;
        
        const sliderBg = this.add.rectangle(sliderX, y, sliderWidth + 50, sliderHeight, 0x34495e);
        sliderBg.setStrokeStyle(2, 0x4ecdc4, 1);
        sliderBg.setInteractive();
        sliderBg.setDepth(1);
        
        // Slider track
        const track = this.add.rectangle(sliderX, y, sliderWidth, 8, 0x2c3e50);
        track.setDepth(2);
        
        // Slider fill
        const fill = this.add.rectangle(
            sliderX - sliderWidth/2, y,
            sliderWidth * initialValue, 8,
            0x4ecdc4
        );
        fill.setOrigin(0, 0.5);
        fill.setDepth(3);
        
        // Value text - positioned closer
        const valueText = this.add.text(sliderX + sliderWidth/2 + 35, y, 
            `${Math.round(initialValue * 100)}%`, {
            fontSize: '13px',
            color: '#95a5a6'
        }).setOrigin(0.5).setDepth(1);
        
        // Minus button
        const minusBtn = this.add.text(sliderX - sliderWidth/2 - 18, y, '-', {
            fontSize: '18px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive().setDepth(1);
        
        // Plus button
        const plusBtn = this.add.text(sliderX + sliderWidth/2 + 18, y, '+', {
            fontSize: '18px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive().setDepth(1);
        
        // Store option data
        const optionIndex = this.options.length;
        this.options.push({
            container: sliderBg,
            isSlider: true,
            settingKey,
            sliderWidth,
            sliderX,
            fill,
            valueText,
            minusBtn,
            plusBtn
        });
        this.optionCallbacks.push(null);
        
        // Mouse interaction
        sliderBg.on('pointerdown', (pointer) => {
            this.isDragging = true;
            this.draggedSlider = optionIndex;
            this.updateSliderFromPointer(pointer, optionIndex);
        });
        
        sliderBg.on('pointermove', (pointer) => {
            if (this.isDragging && this.draggedSlider === optionIndex) {
                this.updateSliderFromPointer(pointer, optionIndex);
            }
        });
        
        sliderBg.on('pointerup', () => {
            if (this.draggedSlider === optionIndex) {
                this.isDragging = false;
                this.draggedSlider = null;
            }
        });
        
        sliderBg.on('pointerover', () => {
            this.selectedOption = optionIndex;
            this.updateSelection();
        });
        
        // Button handlers
        minusBtn.on('pointerup', () => {
            this.adjustSlider(optionIndex, -0.1);
        });
        
        plusBtn.on('pointerup', () => {
            this.adjustSlider(optionIndex, 0.1);
        });
    }
    
    createToggle(x, y, label, settingKey, initialValue) {
        // Label - adjusted for narrower container
        const labelText = this.add.text(x - 120, y, label, {
            fontSize: '16px',
            color: '#ecf0f1'
        }).setOrigin(0, 0.5).setDepth(1);
        
        // Toggle button
        const toggleWidth = 100;
        const toggleHeight = 32;
        const toggleX = x + 40;
        
        const toggleBg = this.add.rectangle(
            toggleX, y,
            toggleWidth, toggleHeight,
            initialValue ? 0x27ae60 : 0x34495e
        );
        toggleBg.setStrokeStyle(2, 0x4ecdc4, 1);
        toggleBg.setInteractive();
        toggleBg.setDepth(1);
        
        const toggleText = this.add.text(toggleX, y, initialValue ? 'ON' : 'OFF', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2);
        
        // Store option data
        const optionIndex = this.options.length;
        this.options.push({
            container: toggleBg,
            isToggle: true,
            settingKey,
            toggleText,
            value: initialValue
        });
        
        this.optionCallbacks.push(() => {
            const option = this.options[optionIndex];
            option.value = !option.value;
            this.settings[settingKey] = option.value;
            
            // Update visual
            toggleBg.setFillStyle(option.value ? 0x27ae60 : 0x34495e);
            toggleText.setText(option.value ? 'ON' : 'OFF');
            
            // Apply setting
            if (settingKey === 'fullscreen') {
                if (option.value) {
                    this.scale.startFullscreen();
                } else {
                    this.scale.stopFullscreen();
                }
            }
            
            // Save to localStorage
            localStorage.setItem(settingKey, option.value.toString());
            
            // Play sound
            if (this.menuAudio) {
                this.menuAudio.play('select');
            }
        });
        
        toggleBg.on('pointerup', () => {
            this.optionCallbacks[optionIndex]();
        });
        
        toggleBg.on('pointerover', () => {
            this.selectedOption = optionIndex;
            this.updateSelection();
        });
    }
    
    createControlsDisplay(x, y) {
        // Controls header
        this.add.text(x, y, 'Controls', {
            fontSize: '20px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1);
        
        // Controls text (non-interactive)
        const controlsText = [
            'Movement: WASD / Arrow Keys / Gamepad',
            'Jump: Space / Slash / Triggers',
            'Pause: ESC / P / Options Button',
            'Fullscreen: F11'
        ].join('\n');
        
        this.add.text(x, y + 25, controlsText, {
            fontSize: '14px',
            color: '#95a5a6',
            align: 'center',
            lineSpacing: 5
        }).setOrigin(0.5, 0).setDepth(1);
    }
    
    createButton(x, y, width, height, text, color, onClick) {
        const button = this.add.rectangle(x, y, width, height, color);
        button.setStrokeStyle(2, 0x4ecdc4, 1);
        button.setInteractive();
        button.setDepth(1);
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2);
        
        // Store button data
        const optionIndex = this.options.length;
        this.options.push({
            container: button,
            isButton: true,
            text: buttonText
        });
        this.optionCallbacks.push(onClick);
        
        // Mouse interaction
        button.on('pointerup', onClick);
        button.on('pointerover', () => {
            this.selectedOption = optionIndex;
            this.updateSelection();
        });
        
        return button;
    }
    
    updateSliderFromPointer(pointer, index) {
        const option = this.options[index];
        const localX = pointer.x - option.sliderX + option.sliderWidth/2;
        const newValue = Phaser.Math.Clamp(localX / option.sliderWidth, 0, 1);
        
        this.settings[option.settingKey] = newValue;
        option.fill.width = option.sliderWidth * newValue;
        option.valueText.setText(`${Math.round(newValue * 100)}%`);
        
        // Save to localStorage
        localStorage.setItem(option.settingKey, newValue.toString());
        
        // Apply volume immediately
        this.applyVolumeSettings();
    }
    
    adjustSlider(index, delta) {
        const option = this.options[index];
        const currentValue = this.settings[option.settingKey];
        const newValue = Phaser.Math.Clamp(currentValue + delta, 0, 1);
        
        this.settings[option.settingKey] = newValue;
        option.fill.width = option.sliderWidth * newValue;
        option.valueText.setText(`${Math.round(newValue * 100)}%`);
        
        // Save to localStorage
        localStorage.setItem(option.settingKey, newValue.toString());
        
        // Apply volume immediately
        this.applyVolumeSettings();
        
        // Play navigation sound
        if (this.menuAudio) {
            this.menuAudio.play('navigate');
        }
    }
    
    applyVolumeSettings() {
        // Calculate effective volumes
        const effectiveMusicVolume = this.settings.masterVolume * this.settings.musicVolume;
        const effectiveSfxVolume = this.settings.masterVolume * this.settings.sfxVolume;
        
        // Apply master volume to the sound manager
        this.sound.volume = this.settings.masterVolume;
        
        // Store effective volumes for other scenes to use
        this.registry.set('effectiveMusicVolume', effectiveMusicVolume);
        this.registry.set('effectiveSfxVolume', effectiveSfxVolume);
        
        // Update background music if it exists in any active scene
        const scenes = this.scene.manager.scenes;
        scenes.forEach(scene => {
            if (scene.backgroundMusic) {
                if (!scene.bgMusicOriginalVolume) {
                    scene.bgMusicOriginalVolume = scene.bgMusicConfig?.volume || 0.3;
                }
                scene.backgroundMusic.setVolume(scene.bgMusicOriginalVolume * effectiveMusicVolume);
            }
        });
    }
    
    setupInput() {
        // Keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // F11 for fullscreen toggle
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        this.f11Key.on('down', () => {
            const fullscreenOption = this.options.find(opt => opt.settingKey === 'fullscreen');
            if (fullscreenOption) {
                const index = this.options.indexOf(fullscreenOption);
                if (this.optionCallbacks[index]) {
                    this.optionCallbacks[index]();
                }
            }
        });
        
        // Global pointer up to stop dragging
        this.input.on('pointerup', () => {
            this.isDragging = false;
            this.draggedSlider = null;
        });
    }
    
    update() {
        // Handle keyboard navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) {
            this.navigate(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) {
            this.navigate(1);
        }
        
        // Handle slider adjustment for selected option
        const selectedOption = this.options[this.selectedOption];
        if (selectedOption && selectedOption.isSlider) {
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) {
                this.adjustSlider(this.selectedOption, -0.05);
            } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) {
                this.adjustSlider(this.selectedOption, 0.05);
            }
        }
        
        // Handle selection
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectOption();
        }
        
        // ESC to go back
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.goBack();
        }
        
        // Handle gamepad
        this.handleGamepadInput();
    }
    
    handleGamepadInput() {
        const pad = this.input.gamepad?.getPad(0);
        if (!pad) return;
        
        // Track button states
        const currentStates = {
            up: pad.up || pad.leftStick.y < -0.5,
            down: pad.down || pad.leftStick.y > 0.5,
            left: pad.left || pad.leftStick.x < -0.5,
            right: pad.right || pad.leftStick.x > 0.5,
            A: pad.A,
            B: pad.B
        };
        
        // Navigation
        if (currentStates.up && !this.gamepadButtonStates.up) {
            this.navigate(-1);
        } else if (currentStates.down && !this.gamepadButtonStates.down) {
            this.navigate(1);
        }
        
        // Slider adjustment
        const selectedOption = this.options[this.selectedOption];
        if (selectedOption && selectedOption.isSlider) {
            if (currentStates.left && !this.gamepadButtonStates.left) {
                this.adjustSlider(this.selectedOption, -0.05);
            } else if (currentStates.right && !this.gamepadButtonStates.right) {
                this.adjustSlider(this.selectedOption, 0.05);
            }
        }
        
        // Selection
        if (currentStates.A && !this.gamepadButtonStates.A) {
            this.selectOption();
        }
        
        // Back
        if (currentStates.B && !this.gamepadButtonStates.B) {
            this.goBack();
        }
        
        // Update button states
        this.gamepadButtonStates = currentStates;
    }
    
    navigate(direction) {
        const oldSelection = this.selectedOption;
        this.selectedOption = (this.selectedOption + direction + this.options.length) % this.options.length;
        
        if (oldSelection !== this.selectedOption && this.menuAudio) {
            this.menuAudio.play('navigate');
        }
        
        this.updateSelection();
    }
    
    updateSelection() {
        this.options.forEach((option, index) => {
            if (index === this.selectedOption) {
                option.container.setScale(1.05);
                option.container.setStrokeStyle(4, 0xffffff, 1);
                
                // Add glow effect for buttons and toggles
                if (option.isButton || option.isToggle) {
                    this.tweens.killTweensOf(option.container);
                    this.tweens.add({
                        targets: option.container,
                        alpha: 0.9,
                        duration: 500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                option.container.setScale(1);
                option.container.setStrokeStyle(2, 0x4ecdc4, 1);
                this.tweens.killTweensOf(option.container);
                option.container.setAlpha(1);
            }
        });
    }
    
    selectOption() {
        const callback = this.optionCallbacks[this.selectedOption];
        if (callback) {
            if (this.menuAudio) {
                this.menuAudio.play('select');
            }
            callback();
        }
    }
    
    goBack() {
        if (this.menuAudio) {
            this.menuAudio.play('select');
        }
        
        // Fade out before transitioning
        this.cameras.main.fadeOut(300, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Stop this scene
            this.scene.stop();
            
            // Resume or start the caller scene
            if (this.isPauseMenu && this.callerScene) {
                // If called from pause menu, just stop settings (pause menu is still running)
                this.scene.resume('PauseMenu');
            } else if (this.callerScene) {
                // If called from title, restart it properly
                this.scene.start(this.callerScene);
            } else {
                // Default to title scene
                this.scene.start('TitleScene');
            }
        });
    }
    
    shutdown() {
        // Clean up scrolling background
        if (this.scrollingBackground) {
            this.scrollingBackground.destroy();
            this.scrollingBackground = null;
        }
        
        // Clean up resize listener
        this.scale.off('resize');
        
        // Clean up tweens
        this.tweens.killAll();
        
        // Clean up event listeners
        if (this.f11Key) {
            this.f11Key.off('down');
        }
        this.input.off('pointerup');
        
        super.shutdown();
    }
}