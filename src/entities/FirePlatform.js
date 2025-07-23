import PlatformBase from './PlatformBase.js';

export default class FirePlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const fireConfig = {
            color: 0xf44336,         // Red fire color
            strokeColor: 0xd32f2f,   // Darker red border
            strokeWidth: 3,
            friction: 0.9,
            restitution: 0.1,
            ...config
        };
        
        super(scene, x, y, width, height, fireConfig);
        
        // Fire-specific properties
        this.burnForce = config.burnForce || 0.002;
        this.burnDamage = config.burnDamage || 0.1;
        this.heatRadius = config.heatRadius || 80;
        this.burnDuration = config.burnDuration || 2000;
        this.coolingRate = config.coolingRate || 0.001;
        
        // Track burning segments
        this.burningSegments = new Set();
        this.burnTimers = new Map();
        
        // Fire intensity (0-1)
        this.fireIntensity = 1.0;
        this.baseIntensity = 1.0;
        
        // Visual effects
        this.createFireEffects();
        this.setupFireAnimation();
    }
    
    createFireEffects() {
        // Create flame particle emitter
        try {
            this.flameEmitter = this.scene.add.particles(this.x, this.y - this.height/2, '__DEFAULT', {
                scale: { start: 0.3, end: 0 },
                speed: { min: 20, max: 60 },
                lifespan: { min: 300, max: 800 },
                tint: [0xff5722, 0xff9800, 0xffc107, 0xf44336],
                alpha: { start: 0.8, end: 0 },
                gravityY: -100,
                quantity: 2,
                frequency: 100,
                emitZone: {
                    type: 'edge',
                    source: new Phaser.Geom.Rectangle(-this.width/2, -5, this.width, 10),
                    quantity: 1
                }
            });
        } catch (e) {
            // Fallback: no particles
            this.flameEmitter = null;
        }
        
        // Create heat distortion effect
        this.heatField = this.scene.add.graphics();
        this.heatField.setPosition(this.x, this.y);
        this.heatField.setAngle(this.config.angle);
        this.heatField.setDepth(-1);
        
        // Create smoke emitter
        try {
            this.smokeEmitter = this.scene.add.particles(this.x, this.y - this.height/2 - 20, '__DEFAULT', {
                scale: { start: 0.2, end: 0.6 },
                speed: { min: 10, max: 30 },
                lifespan: { min: 1000, max: 2000 },
                tint: [0x424242, 0x616161, 0x757575],
                alpha: { start: 0.6, end: 0 },
                gravityY: -50,
                quantity: 1,
                frequency: 300,
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Rectangle(-this.width/4, -10, this.width/2, 20)
                }
            });
        } catch (e) {
            // Fallback: no particles
            this.smokeEmitter = null;
        }
        
        this.updateFireVisuals();
    }
    
    setupFireAnimation() {
        // Flickering fire intensity
        this.fireTimer = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                this.fireIntensity = this.baseIntensity + (Math.random() - 0.5) * 0.3;
                this.fireIntensity = Math.max(0.1, Math.min(1.0, this.fireIntensity));
                this.updateFireVisuals();
            },
            callbackScope: this,
            loop: true
        });
    }
    
    updateFireVisuals() {
        if (!this.heatField) return;
        
        this.heatField.clear();
        
        // Draw heat waves
        this.heatField.lineStyle(1, 0xff9800, 0.2 * this.fireIntensity);
        
        const numWaves = 5;
        const time = this.scene.time.now * 0.01;
        
        for (let i = 0; i < numWaves; i++) {
            const waveY = (i - numWaves/2) * (this.height / numWaves);
            const amplitude = 10 * this.fireIntensity;
            
            this.heatField.moveTo(-this.heatRadius, waveY);
            
            for (let x = -this.heatRadius; x <= this.heatRadius; x += 5) {
                const wave = Math.sin((x + time) * 0.1) * amplitude;
                this.heatField.lineTo(x, waveY + wave);
            }
        }
        
        this.heatField.strokePath();
        
        // Update particle intensity
        if (this.flameEmitter) {
            this.flameEmitter.setFrequency(100 / this.fireIntensity);
            this.flameEmitter.setScale(0.3 * this.fireIntensity, 0);
        }
        
        // Update platform color based on intensity
        const intensity = Math.floor(this.fireIntensity * 255);
        const color = (intensity << 16) | (Math.floor(intensity * 0.3) << 8) | Math.floor(intensity * 0.2);
        this.graphics.setFillStyle(color);
    }
    
    onCollision(segment, collision) {
        if (this.burningSegments.has(segment)) return;
        
        // Start burning the segment
        this.startBurning(segment);
    }
    
    onCollisionEnd(segment) {
        // Don't immediately stop burning - fire persists
    }
    
    startBurning(segment) {
        this.burningSegments.add(segment);
        
        // Apply initial burn force (upward thrust)
        this.scene.matter.body.applyForce(segment, segment.position, {
            x: (Math.random() - 0.5) * this.burnForce,
            y: -this.burnForce * 2
        });
        
        // Visual effect on segment
        this.createBurnEffect(segment);
        
        // Set burn timer
        const burnTimer = this.scene.time.addEvent({
            delay: 50,
            callback: () => this.applyBurnDamage(segment),
            callbackScope: this,
            repeat: Math.floor(this.burnDuration / 50)
        });
        
        this.burnTimers.set(segment, burnTimer);
        
        // Stop burning after duration
        this.scene.time.delayedCall(this.burnDuration, () => {
            this.stopBurning(segment);
        });
    }
    
    createBurnEffect(segment) {
        // Create fire particles on the segment
        let segmentFire = null;
        try {
            segmentFire = this.scene.add.particles(segment.position.x, segment.position.y, '__DEFAULT', {
                scale: { start: 0.1, end: 0 },
                speed: { min: 10, max: 30 },
                lifespan: { min: 200, max: 500 },
                tint: [0xff5722, 0xff9800, 0xffc107],
                alpha: { start: 0.8, end: 0 },
                gravityY: -50,
                quantity: 1,
                frequency: 150
            });
        } catch (e) {
            // Fallback: no particles
            segmentFire = null;
        }
        
        // Attach to segment for movement
        segment.burnEffect = segmentFire;
        
        // Update position each frame
        const updateEffect = () => {
            if (segmentFire && segment.position) {
                segmentFire.setPosition(segment.position.x, segment.position.y);
            }
        };
        
        segment.burnUpdate = updateEffect;
    }
    
    applyBurnDamage(segment) {
        if (!this.burningSegments.has(segment)) return;
        
        // Apply continuous burn force
        const burnDirection = {
            x: (Math.random() - 0.5) * this.burnForce * 0.5,
            y: -this.burnForce * 0.5
        };
        
        this.scene.matter.body.applyForce(segment, segment.position, burnDirection);
        
        // Update burn effect position
        if (segment.burnUpdate) {
            segment.burnUpdate();
        }
    }
    
    stopBurning(segment) {
        this.burningSegments.delete(segment);
        
        // Clear timer
        const timer = this.burnTimers.get(segment);
        if (timer) {
            timer.destroy();
            this.burnTimers.delete(segment);
        }
        
        // Remove visual effects
        if (segment.burnEffect) {
            segment.burnEffect.destroy();
            delete segment.burnEffect;
        }
        
        if (segment.burnUpdate) {
            delete segment.burnUpdate;
        }
    }
    
    extinguish() {
        // Gradually reduce fire intensity
        this.baseIntensity = Math.max(0, this.baseIntensity - this.coolingRate);
        
        if (this.baseIntensity <= 0) {
            // Fire is out
            if (this.flameEmitter) {
                this.flameEmitter.stop();
            }
            
            // Stop burning all segments
            for (const segment of this.burningSegments) {
                this.stopBurning(segment);
            }
        }
    }
    
    reignite() {
        this.baseIntensity = 1.0;
        if (this.flameEmitter) {
            this.flameEmitter.start();
        }
    }
    
    update(delta) {
        super.update(delta);
        
        // Natural cooling over time
        if (this.baseIntensity > 0.3) {
            this.baseIntensity -= this.coolingRate * delta * 0.001;
        }
    }
    
    destroy() {
        // Stop all burning effects
        for (const segment of this.burningSegments) {
            this.stopBurning(segment);
        }
        
        if (this.fireTimer) {
            this.fireTimer.destroy();
            this.fireTimer = null;
        }
        if (this.flameEmitter) {
            this.flameEmitter.destroy();
            this.flameEmitter = null;
        }
        if (this.smokeEmitter) {
            this.smokeEmitter.destroy();
            this.smokeEmitter = null;
        }
        if (this.heatField) {
            this.heatField.destroy();
            this.heatField = null;
        }
        
        super.destroy();
    }
}