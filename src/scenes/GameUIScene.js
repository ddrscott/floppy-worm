import Phaser from 'phaser';

/**
 * GameUIScene - A dedicated overlay scene for the game HUD
 * 
 * Design philosophy:
 * - Dieter Rams: Less but better, unobtrusive, honest
 * - Teenage Engineering: Functional minimalism, grid-based, monospace
 * - Top-left overlay with vertical stat stacking
 * - No background, pure text overlay
 * - Mobile-first responsive design
 */
export default class GameUIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameUIScene' });
        
        // UI state
        this.levelName = '';
        this.currentTime = 0;
        this.bestTime = null;
        this.totalGoals = 0;
        this.collectedGoals = 0;
        this.isGhostRacing = false;
        this.ghostTime = null;
        
        // UI elements
        this.container = null;
        this.levelText = null;
        this.ghostIndicator = null;
        this.starText = null;
        this.timeText = null;
        this.bestTimeText = null;
        
        // Layout config
        this.baseFontSize = 18;
        this.padding = 20;
        this.lineHeight = 24;
        
        // Colors (limited palette)
        this.colors = {
            primary: '#ffffff',
            gold: '#ffd700',
            purple: '#9b59b6',
            gray: '#95a5a6',
            accent: '#4ecdc4',
            shadow: '#000000'
        };
    }
    
    create(data) {
        // Store reference to game scene
        this.gameScene = data.gameScene;
        
        // Ensure this scene renders on top of everything
        this.scene.bringToTop();
        
        // Calculate responsive sizes
        this.calculateSizes();
        
        // Create the top-left overlay
        this.createTopLeftOverlay();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Handle resize events
        this.scale.on('resize', this.handleResize, this);
        
        // Initialize with data if provided
        if (data) {
            if (data.levelName) this.setLevelName(data.levelName);
            if (data.bestTime !== undefined) this.setBestTime(data.bestTime);
            if (data.totalGoals) this.setGoalTotal(data.totalGoals);
        }
    }
    
    calculateSizes() {
        const { width, height } = this.scale;
        const screenMin = Math.min(width, height);
        
        // Responsive font size (14-20px)
        this.baseFontSize = Math.max(14, Math.min(20, screenMin / 35));
        
        // Line height for vertical spacing
        this.lineHeight = this.baseFontSize * 1.8;
        
        // Adaptive padding
        this.padding = Math.max(15, Math.min(25, width * 0.02));
    }
    
    createTopLeftOverlay() {
        // Main container for the top-left overlay
        this.container = this.add.container(this.padding, this.padding);
        
        let yOffset = 0;
        
        // Level name (top line) - matches title screen color
        this.levelText = this.add.text(0, yOffset, '', {
            fontSize: `${this.baseFontSize}px`,
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#4ecdc4',  // Match title screen cyan
            align: 'left',
            stroke: this.colors.shadow,
            strokeThickness: 2
        }).setOrigin(0, 0);
        this.container.add(this.levelText);
        
        yOffset += this.lineHeight;
        
        // Create pause button and time display on same line (VCR style)
        this.createVCRControls(yOffset);
        
        yOffset += this.lineHeight;
        
        // Best time (appears below timer when it exists)
        this.bestTimeText = this.add.text(0, yOffset, '', {
            fontSize: `${this.baseFontSize * 0.8}px`,
            fontFamily: 'monospace',
            color: this.colors.accent,
            align: 'left',
            stroke: this.colors.shadow,
            strokeThickness: 2
        }).setOrigin(0, 0).setVisible(false);
        this.container.add(this.bestTimeText);
        
        // Star progress (shifts up when no best time)
        this.starText = this.add.text(0, yOffset, '', {
            fontSize: `${this.baseFontSize * 1.1}px`,
            fontFamily: 'monospace',
            color: this.colors.gold,
            align: 'left',
            stroke: this.colors.shadow,
            strokeThickness: 2
        }).setOrigin(0, 0).setVisible(false);
        this.container.add(this.starText);
        
        // Ghost indicator (shifts up when no best time)
        this.ghostIndicator = this.add.text(0, yOffset, '', {
            fontSize: `${this.baseFontSize * 0.8}px`,
            fontFamily: 'monospace',
            color: this.colors.purple,
            align: 'left',
            stroke: this.colors.shadow,
            strokeThickness: 2
        }).setOrigin(0, 0).setVisible(false);
        this.container.add(this.ghostIndicator);
    }
    
    createVCRControls(yOffset) {
        // VCR-style controls container for perfect alignment
        this.vcrContainer = this.add.container(0, yOffset);
        this.container.add(this.vcrContainer);
        
        const buttonSize = this.baseFontSize * 1.5; // Match timer height
        
        // Pause button background (square, VCR style)
        this.pauseButton = this.add.rectangle(
            buttonSize/2, buttonSize/2, 
            buttonSize, buttonSize, 
            0x000000, 0.5  // Transparent background
        ).setOrigin(0.5, 0.5);
        this.pauseButton.setStrokeStyle(2, 0xaaaaaa, 1); // White outline
        this.pauseButton.setInteractive({ useHandCursor: true });
        this.vcrContainer.add(this.pauseButton);
        
        // Pause icon (two vertical bars, VCR style)
        const barWidth = buttonSize * 0.12;
        const barHeight = buttonSize * 0.5;
        const barSpacing = buttonSize * 0.2;
        
        // Left bar - white with black stroke
        const leftBar = this.add.rectangle(
            buttonSize/2 - barSpacing/2, buttonSize/2,
            barWidth, barHeight,
            0xffffff  // White fill
        );
        leftBar.setStrokeStyle(1, this.colors.shadow, 1);
        this.vcrContainer.add(leftBar);
        
        // Right bar - white with black stroke
        const rightBar = this.add.rectangle(
            buttonSize/2 + barSpacing/2, buttonSize/2,
            barWidth, barHeight,
            0xffffff  // White fill
        );
        rightBar.setStrokeStyle(1, this.colors.shadow, 1);
        this.vcrContainer.add(rightBar);
        
        // Store bars for hover effects
        this.pauseBars = [leftBar, rightBar];
        
        // Current time display - vertically centered with button
        this.timeText = this.add.text(buttonSize + 10, buttonSize/2, '0:00.00', {
            fontSize: `${this.baseFontSize * 1.2}px`,
            fontFamily: 'monospace',
            color: this.colors.primary,
            align: 'left',
            stroke: this.colors.shadow,
            strokeThickness: 2
        }).setOrigin(0, 0.5); // Center vertically
        this.vcrContainer.add(this.timeText);
        
        // Hover effects
        this.pauseButton.on('pointerover', () => {
            this.pauseButton.setStrokeStyle(3, this.colors.primary, 1); // Thicker white outline
            this.pauseButton.setFillStyle(0xffffff, 0.1); // Slight white fill
            this.pauseBars.forEach(bar => bar.setScale(1.1));
        });
        
        this.pauseButton.on('pointerout', () => {
            this.pauseButton.setStrokeStyle(2, this.colors.primary, 1); // Normal white outline
            this.pauseButton.setFillStyle(0x000000, 0); // Transparent
            this.pauseBars.forEach(bar => bar.setScale(1));
        });
        
        // Click to pause
        this.pauseButton.on('pointerup', () => {
            if (this.gameScene && !this.gameScene.isPaused) {
                // Trigger pause menu in the game scene
                this.gameScene.showPauseMenu();
            }
        });
    }
    
    setupEventListeners() {
        if (!this.gameScene) return;
        
        // Listen for updates from game scene
        this.gameScene.events.on('ui-update-level', this.setLevelName, this);
        this.gameScene.events.on('ui-update-time', this.updateTime, this);
        this.gameScene.events.on('ui-update-stars', this.updateStars, this);
        this.gameScene.events.on('ui-update-ghost', this.updateGhostStatus, this);
        this.gameScene.events.on('ui-update-best', this.setBestTime, this);
        this.gameScene.events.on('ui-set-goal-total', this.setGoalTotal, this);
        
        // Clean up on scene shutdown
        this.events.once('shutdown', this.cleanup, this);
    }
    
    setLevelName(name) {
        this.levelName = name;
        this.levelText.setText(name);
    }
    
    updateTime(elapsedTime) {
        this.currentTime = elapsedTime;
        this.timeText.setText(this.formatTime(elapsedTime));
    }
    
    setBestTime(time) {
        this.bestTime = time;
        const baseY = this.lineHeight * 2; // Position after level name and VCR controls
        
        if (time !== null && time !== undefined) {
            // Show best time below timer
            this.bestTimeText.setText(`Best ${this.formatTime(time)}`).setVisible(true);
            this.bestTimeText.setY(baseY);
            
            // Shift other elements down
            const offsetY = baseY + this.lineHeight;
            this.starText.setY(offsetY);
            this.ghostIndicator.setY(offsetY + this.lineHeight);
        } else {
            // Hide best time
            this.bestTimeText.setVisible(false);
            
            // Shift elements up
            this.starText.setY(baseY);
            this.ghostIndicator.setY(baseY + this.lineHeight);
        }
    }
    
    setGoalTotal(total) {
        this.totalGoals = total;
        this.updateStars(this.collectedGoals);
    }
    
    updateStars(collected) {
        this.collectedGoals = collected;
        if (this.totalGoals > 0) {
            this.starText.setText(`⭐ ${collected}/${this.totalGoals}`).setVisible(true);
            
            // Show remaining goals message if not all collected
            if (collected < this.totalGoals) {
                const remaining = this.totalGoals - collected;
                this.starText.setText(`⭐ ${collected}/${this.totalGoals}`);
            }
            
            // Update position based on whether best time is visible
            this.updateElementPositions();
        } else {
            this.starText.setVisible(false);
        }
    }
    
    updateGhostStatus(status) {
        if (status && status.isRacing) {
            this.isGhostRacing = true;
            this.ghostTime = status.time;
            const ghostTimeStr = status.time ? this.formatTime(status.time) : '--:--';
            this.ghostIndicator.setText(`👻 ${ghostTimeStr}`).setVisible(true);
            
            // Update position based on whether best time is visible
            this.updateElementPositions();
        } else {
            this.isGhostRacing = false;
            this.ghostIndicator.setVisible(false);
        }
    }
    
    updateElementPositions() {
        const baseY = this.lineHeight * 2; // Position after level name and VCR controls
        
        if (this.bestTimeText.visible) {
            // Best time is showing, shift other elements down
            const offsetY = baseY + this.lineHeight;
            this.starText.setY(offsetY);
            this.ghostIndicator.setY(offsetY + this.lineHeight);
        } else {
            // No best time, elements move up
            this.starText.setY(baseY);
            this.ghostIndicator.setY(baseY + this.lineHeight);
        }
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    handleResize() {
        // Recalculate sizes
        this.calculateSizes();
        
        // Update container padding
        if (this.container) {
            this.container.setPosition(this.padding, this.padding);
        }
        
        // VCR controls will be recreated with new sizes
        // Since they're part of the container, they'll resize automatically
    }
    
    cleanup() {
        if (this.gameScene) {
            this.gameScene.events.off('ui-update-level', this.setLevelName, this);
            this.gameScene.events.off('ui-update-time', this.updateTime, this);
            this.gameScene.events.off('ui-update-stars', this.updateStars, this);
            this.gameScene.events.off('ui-update-ghost', this.updateGhostStatus, this);
            this.gameScene.events.off('ui-update-best', this.setBestTime, this);
            this.gameScene.events.off('ui-set-goal-total', this.setGoalTotal, this);
        }
        
        // Clean up resize listener
        this.scale.off('resize', this.handleResize, this);
    }
}
