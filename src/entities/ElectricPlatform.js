import PlatformBase from './PlatformBase.js';

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
        this.shockRadius = config.shockRadius || 100;
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
            delay: 2000 + Math.random() * 3000,
            callback: this.createElectricPulse,
            callbackScope: this,
            loop: true
        });
    }
    
    createElectricPulse() {
        if (!this.isCharged) return;
        
        // Create brief electric arc effect
        const arcGraphics = this.scene.add.graphics();
        arcGraphics.lineStyle(2, 0xe91e63, 0.8);
        
        // Draw jagged lightning bolt across platform
        const steps = 8;
        const stepWidth = this.width / steps;
        let currentX = this.x - this.width/2;
        let currentY = this.y;
        
        arcGraphics.moveTo(currentX, currentY);
        
        for (let i = 1; i <= steps; i++) {
            const nextX = this.x - this.width/2 + i * stepWidth;
            const jagY = currentY + (Math.random() - 0.5) * this.height * 0.3;
            
            arcGraphics.lineTo(nextX, jagY);
            currentY = jagY;
        }
        
        arcGraphics.strokePath();
        
        // Fade out the arc
        this.scene.tweens.add({
            targets: arcGraphics,
            alpha: 0,
            duration: 200,
            onComplete: () => arcGraphics.destroy()
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
        
        // Visual feedback first
        this.triggerShockEffect();
        
        // Reset worm to start position (skip shock force since we're teleporting)
        if (this.scene.resetWorm && typeof this.scene.resetWorm === 'function') {
            this.scene.resetWorm();
        }
        
        // Trigger recharge cycle
        this.isCharged = false;
        this.lastShockTime = currentTime;
        
        // Recharge after duration
        this.scene.time.delayedCall(this.rechargeDuration, () => {
            this.isCharged = true;
        });
    }
    
    applyElectricShock(segment) {
        // Apply random shock force
        const shockAngle = Math.random() * Math.PI * 2;
        const shockForceVector = {
            x: Math.cos(shockAngle) * this.shockForce,
            y: Math.sin(shockAngle) * this.shockForce
        };
        
        this.scene.matter.body.applyForce(segment, segment.position, shockForceVector);
        
        // Add some random impulse for erratic movement
        const randomImpulse = {
            x: (Math.random() - 0.5) * this.shockForce * 2,
            y: (Math.random() - 0.5) * this.shockForce * 2
        };
        
        this.scene.matter.body.applyForce(segment, segment.position, randomImpulse);
    }
    
    triggerShockEffect() {
        // Platform flash
        const originalColor = this.graphics.fillColor;
        this.graphics.setFillStyle(0xffeb3b); // Bright yellow flash
        
        this.scene.time.delayedCall(100, () => {
            if (this.graphics) {
                this.graphics.setFillStyle(originalColor);
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
