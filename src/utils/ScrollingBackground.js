import Phaser from 'phaser';

/**
 * Creates and manages a scrolling grid background with floating particles
 * Can be used across multiple scenes for consistent visual style
 */
export default class ScrollingBackground {
    constructor(scene, config = {}) {
        this.scene = scene;
        
        // Configuration with defaults
        this.config = {
            backgroundColor: 0x1a1a2e,
            gridColor: 0x333333,
            gridAlpha: 0.2,
            gridSize: 96,
            scrollSpeed: 3000, // Duration for one complete scroll
            particleCount: 20,
            particleColor: 0x4ecdc4,
            particleMinSize: 2,
            particleMaxSize: 5,
            particleMinAlpha: 0.1,
            particleMaxAlpha: 0.3,
            ...config
        };
        
        // Container references
        this.background = null;
        this.gridContainer = null;
        this.particles = [];
        this.scrollTween = null;
    }
    
    create() {
        const { width, height } = this.scene.scale;
        
        // Create solid background
        this.background = this.scene.add.rectangle(
            width / 2, 
            height / 2, 
            width, 
            height, 
            this.config.backgroundColor
        ).setDepth(-100);
        
        // Create scrolling grid
        this.createScrollingGrid();
        
        // Create floating particles
        this.createFloatingParticles();
        
        // Listen for resize events
        this.scene.scale.on('resize', this.handleResize, this);
    }
    
    createScrollingGrid() {
        const { width, height } = this.scene.scale;
        
        // Clean up existing grid if any
        if (this.gridContainer) {
            this.gridContainer.destroy();
        }
        if (this.scrollTween) {
            this.scrollTween.stop();
        }
        
        // Calculate grid dimensions
        const gridSize = this.config.gridSize;
        const extendedHeight = height + gridSize * 2;
        
        // Create scrolling grid container
        this.gridContainer = this.scene.add.container(-gridSize/2, 0);
        this.gridContainer.setDepth(-90);
        
        // Create two grid graphics for seamless scrolling
        for (let gridIndex = 0; gridIndex < 2; gridIndex++) {
            const graphics = this.scene.add.graphics();
            graphics.lineStyle(1, this.config.gridColor, this.config.gridAlpha);
            
            // Draw vertical lines
            for (let x = 0; x <= width + gridSize; x += gridSize) {
                graphics.moveTo(x, 0);
                graphics.lineTo(x, extendedHeight);
            }
            
            // Draw horizontal lines
            for (let y = 0; y <= extendedHeight; y += gridSize) {
                graphics.moveTo(0, y);
                graphics.lineTo(width+gridSize, y);
            }
            
            graphics.strokePath();
            graphics.y = gridIndex * extendedHeight - gridSize;
            this.gridContainer.add(graphics);
        }
        
        // Animate grid scrolling upward (simulating falling)
        this.scrollTween = this.scene.tweens.add({
            targets: this.gridContainer,
            y: gridSize,
            duration: this.config.scrollSpeed,
            ease: 'Linear',
            repeat: -1,
        });
    }
    
    createFloatingParticles() {
        const { width, height } = this.scene.scale;
        
        // Clean up existing particles
        this.particles.forEach(particle => particle.destroy());
        this.particles = [];
        
        // Create new particles
        for (let i = 0; i < this.config.particleCount; i++) {
            const particle = this.scene.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(this.config.particleMinSize, this.config.particleMaxSize),
                this.config.particleColor,
                Phaser.Math.FloatBetween(this.config.particleMinAlpha, this.config.particleMaxAlpha)
            ).setDepth(-80);
            
            // Store initial position for respawning
            particle.startY = height + 10;
            
            // Animate particles floating upward
            this.scene.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(100, 200),
                x: particle.x + Phaser.Math.Between(-50, 50),
                alpha: 0,
                duration: Phaser.Math.Between(5000, 10000),
                repeat: -1,
                onRepeat: () => {
                    particle.x = Phaser.Math.Between(0, width);
                    particle.y = particle.startY;
                    particle.alpha = Phaser.Math.FloatBetween(
                        this.config.particleMinAlpha, 
                        this.config.particleMaxAlpha
                    );
                }
            });
            
            this.particles.push(particle);
        }
    }
    
    handleResize() {
        const { width, height } = this.scene.scale;
        
        // Update background size
        if (this.background) {
            this.background.setPosition(width / 2, height / 2);
            this.background.setSize(width, height);
        }
        
        // Recreate grid with new dimensions
        this.createScrollingGrid();
        
        // Update particle bounds
        this.particles.forEach(particle => {
            particle.startY = height + 10;
        });
    }
    
    destroy() {
        // Clean up resize listener
        this.scene.scale.off('resize', this.handleResize, this);
        
        // Stop and destroy tween
        if (this.scrollTween) {
            this.scrollTween.stop();
            this.scrollTween = null;
        }
        
        // Destroy containers and graphics
        if (this.gridContainer) {
            this.gridContainer.destroy();
            this.gridContainer = null;
        }
        
        // Destroy particles
        this.particles.forEach(particle => particle.destroy());
        this.particles = [];
        
        // Destroy background
        if (this.background) {
            this.background.destroy();
            this.background = null;
        }
    }
    
    /**
     * Update grid speed (useful for dynamic effects)
     * @param {number} duration - New duration in milliseconds
     */
    setScrollSpeed(duration) {
        this.config.scrollSpeed = duration;
        
        // Restart the tween with new speed
        if (this.scrollTween) {
            this.scrollTween.stop();
            const { height } = this.scene.scale;
            const gridSize = this.config.gridSize;
            
            this.scrollTween = this.scene.tweens.add({
                targets: this.gridContainer,
                y: height + gridSize,
                duration: this.config.scrollSpeed,
                ease: 'Linear',
                repeat: -1,
                onRepeat: () => {
                    this.gridContainer.y = 0;
                }
            });
        }
    }
    
    /**
     * Pause the scrolling animation
     */
    pause() {
        if (this.scrollTween) {
            this.scrollTween.pause();
        }
    }
    
    /**
     * Resume the scrolling animation
     */
    resume() {
        if (this.scrollTween) {
            this.scrollTween.resume();
        }
    }
}
