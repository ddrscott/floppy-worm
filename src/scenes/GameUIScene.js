import Phaser from 'phaser';

/**
 * GameUIScene - A dedicated overlay scene for the game HUD
 * 
 * Design philosophy:
 * - Dieter Rams: Less but better, unobtrusive, honest
 * - Teenage Engineering: Functional minimalism, grid-based, monospace
 * - Bottom bar layout for minimal gameplay obstruction
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
        this.background = null;
        this.levelText = null;
        this.ghostIndicator = null;
        this.starIcon = null;
        this.starText = null;
        this.timeText = null;
        this.bestTimeText = null;
        this.pauseButton = null;
        
        // Layout config
        this.barHeight = 80;
        this.baseFontSize = 18;
        this.padding = 20;
        
        // Colors (limited palette)
        this.colors = {
            background: 0x000000,
            backgroundAlpha: 0.85,
            primary: '#ffffff',
            gold: '#ffd700',
            purple: '#9b59b6',
            gray: '#95a5a6',
            accent: '#4ecdc4'
        };
    }
    
    create(data) {
        // Store reference to game scene
        this.gameScene = data.gameScene;
        
        // Calculate responsive sizes
        this.calculateSizes();
        
        // Create the bottom bar
        this.createBottomBar();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize with data if provided
        if (data) {
            if (data.levelName) this.setLevelName(data.levelName);
            if (data.bestTime !== undefined) this.setBestTime(data.bestTime);
            if (data.totalGoals) this.setGoalTotal(data.totalGoals);
        }
        
        // Notify game scene of UI height for camera adjustment
        if (this.gameScene && this.gameScene.adjustCameraForUI) {
            this.gameScene.adjustCameraForUI(this.barHeight);
        }
    }
    
    calculateSizes() {
        const { width, height } = this.scale;
        const screenMin = Math.min(width, height);
        
        // Responsive font size (14-24px)
        this.baseFontSize = Math.max(14, Math.min(24, screenMin / 30));
        
        // Responsive bar height (60-100px, 8% of screen)
        this.barHeight = Math.max(60, Math.min(100, height * 0.08));
        
        // Adaptive padding
        this.padding = Math.max(10, Math.min(30, width * 0.02));
    }
    
    createBottomBar() {
        const { width, height } = this.scale;
        
        // Main container for the bottom bar
        this.container = this.add.container(0, height - this.barHeight);
        
        // Semi-transparent background
        this.background = this.add.rectangle(
            width / 2, 
            this.barHeight / 2, 
            width, 
            this.barHeight, 
            this.colors.background, 
            this.colors.backgroundAlpha
        );
        this.container.add(this.background);
        
        // Add subtle top border
        const border = this.add.rectangle(
            width / 2,
            1,
            width,
            2,
            parseInt(this.colors.accent.replace('#', '0x')),
            0.3
        );
        this.container.add(border);
        
        // Create sections
        this.createLevelSection();
        this.createProgressSection();
        this.createTimerSection();
        this.createControlsSection();
    }
    
    createLevelSection() {
        const x = this.padding;
        const y = this.barHeight / 2;
        
        // Level name (subdued color, smaller font)
        this.levelText = this.add.text(x, y - 8, '', {
            fontSize: `${this.baseFontSize * 0.8}px`,
            fontFamily: 'Arial, sans-serif',
            color: this.colors.gray,
            align: 'left'
        }).setOrigin(0, 0.5);
        
        // Ghost indicator (appears below level name when racing)
        this.ghostIndicator = this.add.text(x, y + 12, '', {
            fontSize: `${this.baseFontSize * 0.7}px`,
            fontFamily: 'monospace',
            color: this.colors.purple,
            align: 'left'
        }).setOrigin(0, 0.5).setVisible(false);
        
        this.container.add([this.levelText, this.ghostIndicator]);
    }
    
    createProgressSection() {
        const { width } = this.scale;
        const x = width * 0.3; // 30% from left
        const y = this.barHeight / 2;
        
        // Star icon (only shown when goals exist)
        this.starIcon = this.add.star(x - 15, y, 5, 8, 12, parseInt(this.colors.gold.replace('#', '0x')))
            .setVisible(false);
        
        // Star counter text
        this.starText = this.add.text(x + 5, y, '', {
            fontSize: `${this.baseFontSize}px`,
            fontFamily: 'monospace',
            color: this.colors.gold,
            align: 'left'
        }).setOrigin(0, 0.5).setVisible(false);
        
        this.container.add([this.starIcon, this.starText]);
    }
    
    createTimerSection() {
        const { width } = this.scale;
        const x = width * 0.65; // 65% from left (right-center)
        const y = this.barHeight / 2;
        
        // Current time (large, prominent)
        this.timeText = this.add.text(x, y - 10, '0:00.00', {
            fontSize: `${this.baseFontSize * 1.3}px`,
            fontFamily: 'monospace',
            color: this.colors.primary,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        
        // Best time (smaller, below current)
        this.bestTimeText = this.add.text(x, y + 12, '', {
            fontSize: `${this.baseFontSize * 0.75}px`,
            fontFamily: 'monospace',
            color: this.colors.gold,
            align: 'center'
        }).setOrigin(0.5, 0.5).setVisible(false);
        
        this.container.add([this.timeText, this.bestTimeText]);
    }
    
    createControlsSection() {
        const { width } = this.scale;
        const x = width - this.padding;
        const y = this.barHeight / 2;
        
        // Pause button (minimalist design)
        const buttonSize = Math.max(40, this.barHeight * 0.5);
        
        // Create button background
        const buttonBg = this.add.rectangle(x - buttonSize/2, y, buttonSize, buttonSize, 0xffffff, 0)
            .setStrokeStyle(2, parseInt(this.colors.gray.replace('#', '0x')), 0.5)
            .setInteractive({ useHandCursor: true });
        
        // Pause icon (two vertical bars)
        const barWidth = buttonSize * 0.08;
        const barHeight = buttonSize * 0.3;
        const barSpacing = buttonSize * 0.15;
        
        const pauseIcon1 = this.add.rectangle(
            x - buttonSize/2 - barSpacing/2, 
            y, 
            barWidth, 
            barHeight, 
            parseInt(this.colors.gray.replace('#', '0x'))
        );
        
        const pauseIcon2 = this.add.rectangle(
            x - buttonSize/2 + barSpacing/2, 
            y, 
            barWidth, 
            barHeight, 
            parseInt(this.colors.gray.replace('#', '0x'))
        );
        
        // Group pause button elements
        this.pauseButton = this.add.container(0, 0, [buttonBg, pauseIcon1, pauseIcon2]);
        
        // Add hover effect
        buttonBg.on('pointerover', () => {
            buttonBg.setStrokeStyle(2, parseInt(this.colors.accent.replace('#', '0x')), 1);
            pauseIcon1.setFillStyle(parseInt(this.colors.accent.replace('#', '0x')));
            pauseIcon2.setFillStyle(parseInt(this.colors.accent.replace('#', '0x')));
        });
        
        buttonBg.on('pointerout', () => {
            buttonBg.setStrokeStyle(2, parseInt(this.colors.gray.replace('#', '0x')), 0.5);
            pauseIcon1.setFillStyle(parseInt(this.colors.gray.replace('#', '0x')));
            pauseIcon2.setFillStyle(parseInt(this.colors.gray.replace('#', '0x')));
        });
        
        buttonBg.on('pointerdown', () => {
            this.handlePauseClick();
        });
        
        this.container.add(this.pauseButton);
    }
    
    setupEventListeners() {
        // Listen for events from the game scene
        this.gameScene.events.on('ui-update-time', this.updateTime, this);
        this.gameScene.events.on('ui-update-stars', this.updateStars, this);
        this.gameScene.events.on('ui-set-best', this.setBestTime, this);
        this.gameScene.events.on('ui-show-ghost', this.showGhost, this);
        this.gameScene.events.on('ui-hide-ghost', this.hideGhost, this);
        this.gameScene.events.on('ui-pulse-time', this.pulseTime, this);
        
        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);
        
        // Clean up on shutdown
        this.events.once('shutdown', this.cleanup, this);
    }
    
    // Public methods for updating UI
    
    setLevelName(name) {
        this.levelName = name;
        // Truncate if too long for mobile
        const maxLength = this.scale.width < 600 ? 15 : 25;
        const displayName = name.length > maxLength ? 
            name.substring(0, maxLength - 3) + '...' : name;
        this.levelText.setText(displayName);
    }
    
    updateTime(milliseconds) {
        this.currentTime = milliseconds;
        this.timeText.setText(this.formatTime(milliseconds));
    }
    
    setBestTime(milliseconds) {
        this.bestTime = milliseconds;
        if (milliseconds !== null) {
            this.bestTimeText.setText(`best: ${this.formatTime(milliseconds)}`).setVisible(true);
        } else {
            this.bestTimeText.setVisible(false);
        }
    }
    
    setGoalTotal(total) {
        this.totalGoals = total;
        if (total > 0) {
            this.starIcon.setVisible(true);
            this.starText.setVisible(true);
            this.updateStars(0);
        } else {
            this.starIcon.setVisible(false);
            this.starText.setVisible(false);
        }
    }
    
    updateStars(collected) {
        this.collectedGoals = collected;
        if (this.totalGoals > 0) {
            this.starText.setText(`${collected}/${this.totalGoals}`);
            
            // Pulse effect on collection
            if (collected > 0) {
                this.tweens.add({
                    targets: [this.starIcon, this.starText],
                    scale: 1.2,
                    duration: 200,
                    yoyo: true,
                    ease: 'Power2'
                });
            }
        }
    }
    
    showGhost(ghostTime) {
        this.isGhostRacing = true;
        this.ghostTime = ghostTime;
        this.ghostIndicator
            .setText(`👻 racing ${this.formatTime(ghostTime)}`)
            .setVisible(true);
        
        // Fade in animation
        this.ghostIndicator.setAlpha(0);
        this.tweens.add({
            targets: this.ghostIndicator,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }
    
    hideGhost() {
        this.isGhostRacing = false;
        this.tweens.add({
            targets: this.ghostIndicator,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.ghostIndicator.setVisible(false);
            }
        });
    }
    
    pulseTime() {
        // Pulse effect for new best time
        this.tweens.add({
            targets: this.timeText,
            scale: 1.3,
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Power2'
        });
        
        // Flash gold color
        this.timeText.setColor(this.colors.gold);
        this.time.delayedCall(1000, () => {
            this.timeText.setColor(this.colors.primary);
        });
    }
    
    handlePauseClick() {
        // Trigger pause in the game scene
        if (this.gameScene && this.gameScene.showPauseMenu) {
            this.gameScene.showPauseMenu();
        }
    }
    
    handleResize() {
        const { width, height } = this.scale;
        
        // Recalculate sizes
        this.calculateSizes();
        
        // Reposition container
        this.container.y = height - this.barHeight;
        
        // Update background size
        this.background.setSize(width, this.barHeight);
        this.background.x = width / 2;
        
        // Reposition sections
        // (We would need to store positions and update them here)
        // For now, this is simplified
        
        // Notify game scene of new UI height
        if (this.gameScene && this.gameScene.adjustCameraForUI) {
            this.gameScene.adjustCameraForUI(this.barHeight);
        }
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    cleanup() {
        // Remove event listeners
        if (this.gameScene) {
            this.gameScene.events.off('ui-update-time', this.updateTime, this);
            this.gameScene.events.off('ui-update-stars', this.updateStars, this);
            this.gameScene.events.off('ui-set-best', this.setBestTime, this);
            this.gameScene.events.off('ui-show-ghost', this.showGhost, this);
            this.gameScene.events.off('ui-hide-ghost', this.hideGhost, this);
            this.gameScene.events.off('ui-pulse-time', this.pulseTime, this);
        }
        
        this.scale.off('resize', this.handleResize, this);
    }
    
    setVisible(visible) {
        if (this.container) {
            this.container.setVisible(visible);
        }
    }
    
    getBarHeight() {
        return this.barHeight;
    }
}