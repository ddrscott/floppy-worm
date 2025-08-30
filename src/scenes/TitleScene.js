import Phaser from 'phaser';
import { getMenuAudio } from '../audio/MenuAudio';
import ScrollingBackground from '../utils/ScrollingBackground';
import WormBase from '../entities/WormBase';
import ZzfxSplatWrapper from '../audio/ZzfxSplatWrapper';
import SettingsScene from './SettingsScene';

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
        
        this.titleText = null;
        this.subtitleText = null;
        this.versionText = null;
        this.menuContainer = null;
        this.selectedOption = 0;
        this.menuOptions = [];
        this.isTransitioning = false;
        
        // Input state tracking
        this.upWasPressed = false;
        this.downWasPressed = false;
        this.aWasPressed = false;
        
        // Audio
        this.menuAudio = null;
        
        // Background worm segments
        this.wormSegments = null;
        
        // Scrolling background
        this.scrollingBackground = null;
    }
    
    init() {
        this.isTransitioning = false;
        this.selectedOption = 0;
        this.menuOptions = []; // Reset menu options array
        
        // Reset gamepad state
        this.upWasPressed = false;
        this.downWasPressed = false;
        this.aWasPressed = false;
        
        // Initialize menu audio from registry
        this.menuAudio = getMenuAudio(this);
        
        // Clean up any existing resize listeners to prevent duplicates
        this.scale.off('resize', this.handleResize, this);
    }
    
    preload() {
        // Preload any assets needed for the title screen
        // Background music is already preloaded in MapSelectScene
    }
    
    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Initialize global splat synthesizer for UI sounds
        if (!this.registry.get('splatSynthesizer')) {
            try {
                const globalSplatSynth = new ZzfxSplatWrapper();
                this.registry.set('splatSynthesizer', globalSplatSynth);
            } catch (error) {
                // Audio not available
            }
        }
        
        // Disable physics debug rendering
        this.matter.world.drawDebug = false;
        this.matter.world.debugGraphic?.clear();
        
        // Create animated scrolling background
        this.scrollingBackground = new ScrollingBackground(this, {
            gridSize: 96,
            gridColor: 0x888888,
            gridAlpha: 0.5,
            scrollSpeed: 3000
        });
        this.scrollingBackground.create();
        
        // Calculate responsive font size based on screen width
        // Base size is 72px at 1280px width, scales proportionally
        const baseFontSize = 72;
        const baseWidth = 1280;
        const scaleFactor = Math.min(width / baseWidth, 1.5); // Cap at 1.5x to prevent huge text
        const titleFontSize = Math.max(36, Math.floor(baseFontSize * scaleFactor)); // Min 36px
        
        // Create title with responsive size
        this.titleText = this.add.text(centerX, centerY - 150, 'Title Screen', {
            fontSize: `${titleFontSize}px`,
            fontFamily: 'Arial Black, Arial',
            color: '#4ecdc4',
            stroke: '#232333',
            strokeThickness: Math.max(4, Math.floor(8 * scaleFactor)),
            shadow: {
                offsetX: 5,
                offsetY: 5,
                color: '#1a1a2e',
                blur: 10,
                stroke: true,
                fill: true
            }
        }).setOrigin(0.5);
        
        // Create subtitle with responsive size
        const subtitleFontSize = Math.max(14, Math.floor(20 * scaleFactor));
        this.subtitleText = this.add.text(centerX, centerY, "Worms life is hard life", {
            fontSize: `${subtitleFontSize}px`,
            fontFamily: 'Arial',
            color: '#95a5a6',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        
        // Create version text
        this.versionText = this.add.text(width - 20, height - 20, 'v0.1.0-beta', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#7f8c8d'
        }).setOrigin(1, 1).setAlpha(0.5);
        
        // Create menu container
        this.menuContainer = this.add.container(centerX, centerY + 50);
        
        // Menu options
        const menuData = [
            { text: 'START GAME', action: 'start' },
            { text: 'SETTINGS', action: 'settings' },
            { text: 'QUIT', action: 'quit' }
        ];
        
        // Calculate responsive sizes for menu
        const menuFontSize = Math.max(18, Math.floor(24 * scaleFactor));
        const optionWidth = Math.max(200, Math.floor(250 * scaleFactor));
        const optionHeight = Math.max(35, Math.floor(40 * scaleFactor));
        const optionSpacing = Math.max(45, Math.floor(50 * scaleFactor));
        
        // Create menu options
        menuData.forEach((item, index) => {
            const yPos = index * optionSpacing;
            
            // Option background - start with slight fill so it's visible
            const optionBg = this.add.rectangle(0, yPos, optionWidth, optionHeight, 0x2c3e50, 0.2)
                .setStrokeStyle(2, 0x4ecdc4, 0.3);
            
            // Option text
            const optionText = this.add.text(0, yPos, item.text, {
                fontSize: `${menuFontSize}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            // Add to container
            this.menuContainer.add([optionBg, optionText]);
            
            // Store reference
            this.menuOptions.push({
                bg: optionBg,
                text: optionText,
                action: item.action,
                index: index
            });
            
            // Interactive for mouse/touch
            optionBg.setInteractive({ useHandCursor: true });
            
            optionBg.on('pointerover', () => {
                if (!this.isTransitioning) {
                    this.selectOption(index);
                }
            });
            
            optionBg.on('pointerup', () => {
                if (!this.isTransitioning) {
                    this.executeOption();
                }
            });
        });
        
        // Create controls hint
       this.add.text(centerX, height - 40, 
            '↑↓ Navigate • ENTER Select • F11 Fullscreen', {
            fontSize: '14px',
            color: '#7f8c8d',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setAlpha(0.7);
        
        
        // Setup keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Fullscreen toggle
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        this.f11Key.on('down', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });
        
        // Update initial selection after a small delay to ensure scene is active
        this.time.delayedCall(50, () => {
            this.updateSelection();
        });
        
        // Set up resize handler
        this.scale.on('resize', this.handleResize, this);
    }
    
    handleResize() {
        // Check if scene is still active and not being destroyed
        if (!this.scene || !this.scene.isActive() || this.isTransitioning) {
            return;
        }
        
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Calculate new scale factor
        const baseWidth = 1280;
        const scaleFactor = Math.min(width / baseWidth, 1.5);
        const titleFontSize = Math.max(36, Math.floor(72 * scaleFactor));
        const subtitleFontSize = Math.max(14, Math.floor(20 * scaleFactor));
        const menuFontSize = Math.max(18, Math.floor(24 * scaleFactor));
        
        // Update title position and size with safety checks
        if (this.titleText && this.titleText.scene) {
            try {
                this.titleText.setPosition(centerX, centerY - 150);
                this.titleText.setFontSize(titleFontSize);
                this.titleText.setStroke('#232333', Math.max(4, Math.floor(8 * scaleFactor)));
            } catch (e) {
                // Text object may have been destroyed, ignore
            }
        }
        
        // Update subtitle position and size with safety checks
        if (this.subtitleText && this.subtitleText.scene) {
            try {
                this.subtitleText.setPosition(centerX, centerY - 90);
                this.subtitleText.setFontSize(subtitleFontSize);
            } catch (e) {
                // Text object may have been destroyed, ignore
            }
        }
        
        // Update menu container position
        if (this.menuContainer && this.menuContainer.scene) {
            this.menuContainer.setPosition(centerX, centerY + 50);
        }
        
        // Update version text position
        if (this.versionText && this.versionText.scene) {
            this.versionText.setPosition(width - 20, height - 20);
        }
        
        // Update floating worm position if needed
        const xPosition = width * 0.75;
        const yPosition = height * 0.4;
        if (this.wormSegments) {
            
            // Adjust base positions for worm segments
            let currentY = yPosition;
            this.wormSegments.forEach((segment, i) => {
                segment.baseX = xPosition + Phaser.Math.Between(-5, 5);
                segment.baseY = currentY;
                currentY += segment.radius * 2 + 2;
            });
        }

        if (!this.worm) {
            // move it
            this.matter.world.setGravity(-0.001, -0.001);
            this.worm = new WormBase(this, xPosition, yPosition)
        } else {
            //this.worm.setPosition(xPosition, yPosition);
        }
    }
    
    
    selectOption(index) {
        if (index < 0 || index >= this.menuOptions.length) return;
        
        // Play UI hover sound
        if (this.registry.get('splatSynthesizer') && index !== this.selectedOption) {
            const splatSynth = this.registry.get('splatSynthesizer');
            splatSynth.playUIHover(0.3); // Play at 30% volume
        }
        
        this.selectedOption = index;
        this.updateSelection();
        
        // Play menu sound
        if (this.menuAudio) {
            this.menuAudio.play('map');
        }
    }
    
    updateSelection() {
        // Check if scene is still active and not transitioning
        if (!this.scene || !this.scene.isActive('TitleScene') || this.isTransitioning) {
            return;
        }
        
        // Check if menuOptions exists
        if (!this.menuOptions) {
            return;
        }
        
        this.menuOptions.forEach((option, index) => {
            // Check if objects still exist and are not destroyed
            if (!option || !option.bg || !option.text || option.bg.scene === undefined || option.text.scene === undefined) {
                return;
            }
            
            try {
                if (index === this.selectedOption) {
                    // Selected state
                    option.bg.setFillStyle(0x2c3e50, 0.8);
                    option.bg.setStrokeStyle(3, 0x4ecdc4, 1);
                    option.text.setColor('#4ecdc4');
                    option.text.setScale(1.1);
                    
                    // Kill any existing tweens first
                    this.tweens.killTweensOf(option.bg);
                    
                    // Add glow effect
                    this.tweens.add({
                        targets: option.bg,
                        alpha: 0.9,
                        duration: 500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else {
                    // Unselected state - keep slightly visible
                    this.tweens.killTweensOf(option.bg);
                    option.bg.setFillStyle(0x2c3e50, 0.2);
                    option.bg.setStrokeStyle(2, 0x4ecdc4, 0.3);
                    option.text.setColor('#ffffff');
                    option.text.setScale(1);
                    option.bg.setAlpha(1);
                }
            } catch (e) {
                // Silently ignore errors from destroyed objects
                console.warn('Error updating menu selection, object may be destroyed:', e);
            }
        });
    }
    
    executeOption() {
        if (this.isTransitioning) return;
        
        const option = this.menuOptions[this.selectedOption];
        
        // Play UI click sound
        if (this.registry.get('splatSynthesizer')) {
            const splatSynth = this.registry.get('splatSynthesizer');
            splatSynth.playUIClick(0.4); // Play at 40% volume
        }
        
        // Play select sound
        if (this.menuAudio) {
            this.menuAudio.play('select');
        }
        
        switch (option.action) {
            case 'start':
                this.startGame();
                break;
            case 'settings':
                this.openSettings();
                break;
            case 'quit':
                this.quitGame();
                break;
        }
    }
    
    startGame() {
        this.isTransitioning = true;
        
        // Stop all tweens immediately to prevent updates on destroyed objects
        this.tweens.killAll();
        
        // Fade out to map select
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('MapSelectScene');
        });
    }
    
    openSettings() {
        this.isTransitioning = true;
        
        // Play select sound
        if (this.menuAudio) {
            this.menuAudio.play('select');
        }
        
        // Add SettingsScene if not already added
        if (!this.scene.manager.getScene('SettingsScene')) {
            this.scene.manager.add('SettingsScene', SettingsScene, false);
        }
        
        // Fade out to settings
        this.cameras.main.fadeOut(300, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Stop this scene to prevent resize issues
            this.scene.stop();
            this.scene.start('SettingsScene', { callerScene: 'TitleScene' });
        });
    }
    
    quitGame() {
        this.isTransitioning = true;
        
        // Show thank you message briefly
        const thankYou = this.add.text(this.scale.width / 2, this.scale.height / 2, 
            'Thanks for playing!', {
            fontSize: '36px',
            color: '#4ecdc4',
            stroke: '#232333',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(1000);
        
        // Fade everything out
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        
        this.tweens.add({
            targets: thankYou,
            alpha: 1,
            duration: 500,
            onComplete: () => {
                // Try to close the window after showing the message
                // This will work in standalone apps/electron but may be blocked in browsers
                setTimeout(() => {
                    window.close();
                    // If window.close() doesn't work (likely in a browser), 
                    // the thank you message will remain visible
                }, 500);
            }
        });
    }
    
    update(time, delta) {
        if (this.isTransitioning) return;
        
        // Animate floating worm segments
        if (this.wormSegments) {
            this.wormSegments.forEach((segment, i) => {
                // Gentle floating animation
                const waveX = Math.sin(time / 1000 + segment.phaseOffset) * 3;
                const waveY = Math.cos(time / 800 + segment.phaseOffset * 1.5) * 2;
                
                segment.graphics.x = segment.baseX + waveX;
                segment.graphics.y = segment.baseY + waveY;
                
                // Update connection dots
                if (segment.connectionDot && i < this.wormSegments.length - 1) {
                    const nextSegment = this.wormSegments[i + 1];
                    segment.connectionDot.x = segment.graphics.x;
                    segment.connectionDot.y = segment.graphics.y + segment.radius;
                }
            });
        }
        
        // Get gamepad if available
        const pad = this.input.gamepad ? this.input.gamepad.getPad(0) : null;
        
        // Vertical navigation
        const moveUp = Phaser.Input.Keyboard.JustDown(this.cursors.up) || 
                      Phaser.Input.Keyboard.JustDown(this.wasd.W) ||
                      (pad && (pad.up || (pad.leftStick && pad.leftStick.y < -0.5)));
        const moveDown = Phaser.Input.Keyboard.JustDown(this.cursors.down) || 
                        Phaser.Input.Keyboard.JustDown(this.wasd.S) ||
                        (pad && (pad.down || (pad.leftStick && pad.leftStick.y > 0.5)));
        
        if (moveUp && !this.upWasPressed) {
            const newIndex = this.selectedOption - 1;
            if (newIndex >= 0) {
                this.selectOption(newIndex);
            }
        }
        if (moveDown && !this.downWasPressed) {
            const newIndex = this.selectedOption + 1;
            if (newIndex < this.menuOptions.length) {
                this.selectOption(newIndex);
            }
        }
        
        // Select option
        const selectPressed = Phaser.Input.Keyboard.JustDown(this.enterKey) || 
                            Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
                            (pad && pad.A && !this.aWasPressed);
        if (selectPressed) {
            this.executeOption();
        }
        
        // Track gamepad state
        if (pad) {
            this.upWasPressed = pad.up || (pad.leftStick && pad.leftStick.y < -0.5);
            this.downWasPressed = pad.down || (pad.leftStick && pad.leftStick.y > 0.5);
            this.aWasPressed = pad.A;
        } else {
            this.upWasPressed = false;
            this.downWasPressed = false;
            this.aWasPressed = false;
        }
    }
    
    shutdown() {
        // Set transitioning flag to prevent resize handlers from running
        this.isTransitioning = true;
        
        // Kill all tweens to prevent them from running on destroyed objects
        this.tweens.killAll();
        
        // Clean up resize listener immediately
        this.scale.off('resize', this.handleResize, this);
        
        // Clean up scrolling background
        if (this.scrollingBackground) {
            this.scrollingBackground.destroy();
            this.scrollingBackground = null;
        }
        
        // Clean up menu options
        if (this.menuOptions) {
            this.menuOptions.forEach(option => {
                if (option.bg) this.tweens.killTweensOf(option.bg);
                if (option.text) this.tweens.killTweensOf(option.text);
            });
        }
        
        // Clean up worm segments
        if (this.wormSegments) {
            this.wormSegments.forEach(segment => {
                if (segment.graphics) segment.graphics.destroy();
                if (segment.connectionDot) segment.connectionDot.destroy();
            });
            this.wormSegments = null;
        }
        
        // Call parent shutdown
        super.shutdown();
    }
}
