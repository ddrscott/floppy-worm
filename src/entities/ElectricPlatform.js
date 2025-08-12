import PlatformBase from './PlatformBase.js';
import Random from '../utils/Random.js';

export default class ElectricPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const electricConfig = {
            color: 0xffff00,         // Bright yellow electric color
            strokeColor: 0xcccc00,   // Darker yellow border
            strokeWidth: 3,
            friction: 0.6,
            restitution: 0.2,
            ...config
        };
        
        super(scene, x, y, width, height, electricConfig);
        
        // Electric-specific properties
        this.shockForce = config.shockForce || 0.005;
        this.shockRadius = config.shockRadius || 10;
        this.shockDuration = config.shockDuration || 200;
        this.rechargeDuration = config.rechargeDuration || 200;
        this.isCharged = true;
        this.lastShockTime = 0;
        
        // Visual effects
        this.electricArcs = [];
        this.createElectricEffects();
        
        // Setup periodic electrical activity
        this.setupElectricalActivity();
    }
    
    createElectricEffects() {
        // Create electric field visualization
        this.electricField = this.scene.add.graphics();
        this.electricField.setDepth(-1); // Behind the platform
        
        // Add electric field to container (positioned at 0,0 relative to container)
        this.container.add(this.electricField);
        
        // Create spark particle emitter
        try {
            this.sparkEmitter = this.scene.add.particles(0, 0, '__DEFAULT', {
                scale: { start: 0.1, end: 0 },
                speed: { min: 50, max: 150 },
                lifespan: { min: 100, max: 300 },
                tint: [0xe91e63, 0x9c27b0, 0x3f51b5, 0x00bcd4],
                quantity: 1,
                frequency: 200,
                emitZone: {
                    type: 'edge',
                    source: new Phaser.Geom.Rectangle(-this.width/2, -this.height/2, this.width, this.height),
                    quantity: 1
                }
            });
            
            // Add particle emitter to container
            this.container.add(this.sparkEmitter);
        } catch (e) {
            // Fallback: no particles
            this.sparkEmitter = null;
        }
        
        this.updateElectricVisuals();
    }
    
    setupElectricalActivity() {
        // Periodic electrical pulse
        this.electricTimer = this.scene.time.addEvent({
            delay: 150 + Random.random() * 200,
            callback: this.createElectricPulse,
            callbackScope: this,
            loop: true
        });
    }
    
    createElectricPulse() {
        if (!this.isCharged) return;
        
        // Create brief electric arc effect as child of container
        const arcGraphics = this.scene.add.graphics();
        arcGraphics.lineStyle(3, 0xddddff, 1);
        
        // Draw jagged lightning bolt across platform (relative to container center at 0,0)
        const steps = parseInt(this.width / 32);
        const stepWidth = this.width / steps;
        let currentX = -this.width/2;
        let currentY = (Random.random() - 0.5) * this.height;
        
        arcGraphics.moveTo(currentX, currentY);
        
        for (let i = 1; i <= steps; i++) {
            const nextX = -this.width/2 + i * stepWidth;
            const jagY = (Random.random() - 0.5) * this.height;
            
            arcGraphics.lineTo(nextX, jagY);
            currentY = jagY;
        }
        
        arcGraphics.strokePath();
        
        // Add the arc graphics to the container so it moves with the platform
        this.container.add(arcGraphics);
        
        // Fade out the arc
        this.scene.tweens.add({
            targets: arcGraphics,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.container.remove(arcGraphics);
                arcGraphics.destroy();
            }
        });
    }
    
    updateElectricVisuals() {
        if (!this.electricField) return;
        
        this.electricField.clear();
        
        if (this.isCharged) {
            // Draw electric field lines
            this.electricField.lineStyle(1, 0xffff00, 0.3);
            
            const numLines = 6;
            for (let i = 0; i < numLines; i++) {
                const angle = (i / numLines) * Math.PI * 2;
                const startRadius = Math.max(this.width, this.height) / 2;
                const endRadius = this.shockRadius;
                
                const startX = Math.cos(angle) * startRadius;
                const startY = Math.sin(angle) * startRadius;
                const endX = Math.cos(angle) * endRadius;
                const endY = Math.sin(angle) * endRadius;
                
                this.electricField.moveTo(startX, startY);
                this.electricField.lineTo(endX, endY);
            }
            
            this.electricField.strokePath();
            
            // Pulsing glow effect
            const time = this.scene.time.now * 0.005;
            const alpha = (Math.sin(time) * 0.2 + 0.5);
            this.electricField.setAlpha(alpha);
        } else {
            // Dimmed when recharging
            this.electricField.setAlpha(0.1);
        }
    }
    
    onCollision(segment, collision) {
        if (!this.isCharged) return;
        
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShockTime < this.rechargeDuration) return;
        
        // Mark as triggered immediately to prevent multiple restarts
        this.isCharged = false;
        this.lastShockTime = currentTime;
        
        // Visual feedback
        this.triggerShockEffect();
        
        // Simply call handleRestart which will capture screenshot and restart
        if (this.scene.handleRestart && typeof this.scene.handleRestart === 'function') {
            console.log('⚡ Calling handleRestart with reason: electric_shock');
            this.scene.handleRestart('electric_shock');
        } else {
            // Fallback to direct restart if handleRestart isn't available
            console.log('⚡ Falling back to direct restart');
            this.scene.scene.restart();
        }
    }
    
    applyElectricShock(segment) {
        // Apply random shock force
        const shockAngle = Random.random() * Math.PI * 2;
        const shockForceVector = {
            x: Math.cos(shockAngle) * this.shockForce,
            y: Math.sin(shockAngle) * this.shockForce
        };
        
        this.scene.matter.body.applyForce(segment, segment.position, shockForceVector);
        
        // Add some random impulse for erratic movement
        const randomImpulse = {
            x: (Random.random() - 0.5) * this.shockForce * 2,
            y: (Random.random() - 0.5) * this.shockForce * 2
        };
        
        this.scene.matter.body.applyForce(segment, segment.position, randomImpulse);
    }
    
    triggerShockEffect() {
        // Platform flash - handle different graphic types
        let originalColor;
        
        if (this.graphics.setFillStyle) {
            // Graphics object (chamfered rectangles)
            originalColor = this.config.color;
            this.graphics.setFillStyle(0xffeb3b); // Bright yellow flash
        } else if (this.graphics.setFillColor) {
            // Rectangle or Circle object
            originalColor = this.graphics.fillColor;
            this.graphics.setFillColor(0xffeb3b); // Bright yellow flash
        }
        
        this.scene.time.delayedCall(100, () => {
            if (this.graphics && this.graphics.active) {
                if (this.graphics.clear && typeof this.graphics.clear === 'function') {
                    // Graphics object
                    this.graphics.clear();
                    this.graphics.fillStyle(originalColor);
                    
                    // Redraw the rounded rectangle
                    if (this.config.chamfer && this.config.chamfer.radius) {
                        let cornerRadius;
                        if (Array.isArray(this.config.chamfer.radius)) {
                            cornerRadius = Math.min(this.config.chamfer.radius[0], this.width / 2, this.height / 2);
                        } else {
                            cornerRadius = Math.min(this.config.chamfer.radius, this.width / 2, this.height / 2);
                        }
                        this.graphics.fillRoundedRect(-this.width/2, -this.height/2, this.width, this.height, cornerRadius);
                        
                        if (this.config.strokeColor !== null) {
                            this.graphics.lineStyle(this.config.strokeWidth, this.config.strokeColor);
                            this.graphics.strokeRoundedRect(-this.width/2, -this.height/2, this.width, this.height, cornerRadius);
                        }
                    }
                } else if (this.graphics.setFillColor && typeof this.graphics.setFillColor === 'function') {
                    // Rectangle or Circle object
                    this.graphics.setFillColor(originalColor);
                }
            }
        });
        
        // Burst of sparks
        if (this.sparkEmitter) {
            this.sparkEmitter.explode(20);
        }
        
        // Screen shake for dramatic effect
        if (this.scene.cameras && this.scene.cameras.main) {
            this.scene.cameras.main.shake(this.shockDuration, 0.01);
        }
    }
    
    update(delta) {
        super.update(delta);
        this.updateElectricVisuals();
    }
    
    destroy() {
        if (this.electricTimer) {
            this.electricTimer.destroy();
            this.electricTimer = null;
        }
        if (this.electricField) {
            this.electricField.destroy();
            this.electricField = null;
        }
        if (this.sparkEmitter) {
            this.sparkEmitter.destroy();
            this.sparkEmitter = null;
        }
        super.destroy();
    }
}
