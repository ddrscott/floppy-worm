import PlatformBase from './PlatformBase.js';
import Tick from '../utils/Tick.js';

export default class WaterfallPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const waterfallConfig = {
            color: 0x1e88e5,         // Deeper blue for waterfall
            strokeColor: 0x1565c0,   // Dark blue border
            strokeWidth: 2,
            friction: 0.05,          // Very low friction
            restitution: 0.0,
            matter: {
                isSensor: true       // Waterfall acts as a sensor
            },
            ...config
        };
        
        super(scene, x, y, width, height, waterfallConfig);
        
        // Waterfall properties
        this.fallSpeed = config.fallSpeed || 0.008; // Downward pull force
        this.lateralDrift = config.lateralDrift || 0.001; // Slight sideways drift
        this.splashForce = config.splashForce || 0.01; // Force when entering top
        this.mist = config.mist || true; // Generate mist particles
        
        // Track segments in waterfall
        this.segmentsInWaterfall = new Set();
        this.segmentEntryTimes = new Map();
        this.originalProperties = new Map(); // Store original segment properties
        
        // Pool at bottom (if connected to water)
        this.poolConnection = null;
        
        // Visual effects
        this.createWaterfallEffects();
        this.setupWaterfallAnimation();
    }
    
    createWaterfallEffects() {
        // Create falling water overlay
        this.waterStrips = [];
        const numStrips = Math.floor(this.width / 10);
        
        for (let i = 0; i < numStrips; i++) {
            const stripX = -this.width/2 + (i + 0.5) * (this.width / numStrips);
            const strip = this.scene.add.rectangle(
                stripX, 
                0, 
                this.width / numStrips - 2, 
                this.height,
                0x2196f3,
                0.4
            );
            this.waterStrips.push(strip);
            this.container.add(strip);
        }
        
        // Create waterfall particle effect
        try {
            // Main water particles
            this.waterfallEmitter = this.scene.add.particles(0, -this.height/2, '__DEFAULT', {
                scale: { start: 0.3, end: 0.1 },
                speed: { min: 100, max: 200 },
                lifespan: this.height * 3,
                tint: [0x1e88e5, 0x2196f3, 0x42a5f5],
                alpha: { start: 0.7, end: 0.3 },
                gravityY: 300,
                quantity: 3,
                frequency: 50,
                emitZone: {
                    type: 'edge',
                    source: new Phaser.Geom.Line(-this.width/2, 0, this.width/2, 0),
                    quantity: 1
                }
            });
            
            this.container.add(this.waterfallEmitter);
            
            // Mist particles at bottom
            if (this.mist) {
                this.mistEmitter = this.scene.add.particles(0, this.height/2, '__DEFAULT', {
                    scale: { start: 0.5, end: 1.0 },
                    speed: { min: 20, max: 60 },
                    lifespan: { min: 1000, max: 2000 },
                    tint: [0xbbdefb, 0xe3f2fd],
                    alpha: { start: 0.4, end: 0 },
                    gravityY: -50,
                    quantity: 1,
                    frequency: 100,
                    emitZone: {
                        type: 'random',
                        source: new Phaser.Geom.Rectangle(-this.width/2, -10, this.width, 20)
                    }
                });
                
                this.container.add(this.mistEmitter);
            }
        } catch (e) {
            this.waterfallEmitter = null;
            this.mistEmitter = null;
        }
        
        // Animated water texture overlay
        this.waterOverlay = this.scene.add.graphics();
        this.waterOverlay.setDepth(-1);
        this.container.add(this.waterOverlay);
        
        this.updateWaterfallVisuals();
    }
    
    setupWaterfallAnimation() {
        // Animate waterfall flow
        this.animationTime = 0;
        this.flowTimer = this.scene.time.addEvent({
            delay: 30,
            callback: () => {
                this.animationTime += 30;
                this.updateWaterfallVisuals();
                this.applyWaterfallForces();
            },
            callbackScope: this,
            loop: true
        });
    }
    
    updateWaterfallVisuals() {
        // Animate water strips
        this.waterStrips.forEach((strip, index) => {
            const offset = (this.animationTime * 0.002 + index * 0.5) % 1;
            strip.setAlpha(0.3 + Math.sin(offset * Math.PI * 2) * 0.2);
            
            // Slight horizontal movement
            const xOffset = Math.sin(this.animationTime * 0.001 + index) * 2;
            strip.setX(-this.width/2 + (index + 0.5) * (this.width / this.waterStrips.length) + xOffset);
        });
        
        // Draw flowing lines
        if (this.waterOverlay) {
            this.waterOverlay.clear();
            this.waterOverlay.lineStyle(1, 0x64b5f6, 0.3);
            
            // Vertical flow lines
            const flowOffset = (this.animationTime * 0.1) % 40;
            
            for (let x = -this.width/2; x <= this.width/2; x += 15) {
                for (let y = -this.height/2; y < this.height/2; y += 40) {
                    const lineY = y + flowOffset;
                    if (lineY < this.height/2) {
                        this.waterOverlay.moveTo(x + Math.sin(lineY * 0.05) * 3, lineY);
                        this.waterOverlay.lineTo(x + Math.sin((lineY + 20) * 0.05) * 3, Math.min(lineY + 20, this.height/2));
                    }
                }
            }
            
            this.waterOverlay.strokePath();
        }
    }
    
    onCollision(segment, collision) {
        if (!this.segmentsInWaterfall.has(segment)) {
            this.segmentsInWaterfall.add(segment);
            this.segmentEntryTimes.set(segment, this.scene.time.now);
            
            // Store original physics properties
            this.originalProperties.set(segment, {
                frictionAir: segment.frictionAir || 0
            });
            
            // Apply waterfall physics - reduce air friction for faster falling
            this.scene.matter.body.set(segment, {
                frictionAir: 0.001 // Very low air friction in waterfall
            });
            
            // Check if entering from top
            const relativeY = segment.position.y - this.body.position.y;
            if (relativeY < -this.height/3) {
                // Splash effect at top
                this.createTopSplash(segment.position.x);
                
                // Apply initial downward force
                this.scene.matter.body.applyForce(segment, segment.position, {
                    x: (Math.random() - 0.5) * this.splashForce,
                    y: this.splashForce
                });
            }
        }
    }
    
    onCollisionEnd(segment) {
        if (this.segmentsInWaterfall.has(segment)) {
            this.segmentsInWaterfall.delete(segment);
            this.segmentEntryTimes.delete(segment);
            
            // Restore original physics properties
            const original = this.originalProperties.get(segment);
            if (original) {
                this.scene.matter.body.set(segment, {
                    frictionAir: original.frictionAir
                });
                this.originalProperties.delete(segment);
            }
            
            // Check if exiting at bottom into pool
            const relativeY = segment.position.y - this.body.position.y;
            if (relativeY > this.height/3) {
                this.createBottomSplash(segment.position.x);
            }
        }
    }
    
    createTopSplash(x) {
        try {
            const splash = this.scene.add.particles(x, this.body.position.y - this.height/2, '__DEFAULT', {
                scale: { start: 0.2, end: 0.05 },
                speed: { min: 30, max: 80 },
                lifespan: { min: 200, max: 400 },
                tint: [0x2196f3, 0x64b5f6],
                alpha: { start: 0.8, end: 0 },
                gravityY: 150,
                quantity: 5,
                angle: { min: -120, max: -60 }
            });
            
            this.scene.time.delayedCall(100, () => {
                splash.stop();
                this.scene.time.delayedCall(400, () => {
                    splash.destroy();
                });
            });
        } catch (e) {
            // No splash
        }
    }
    
    createBottomSplash(x) {
        try {
            const splash = this.scene.add.particles(x, this.body.position.y + this.height/2, '__DEFAULT', {
                scale: { start: 0.4, end: 0.1 },
                speed: { min: 50, max: 150 },
                lifespan: { min: 400, max: 800 },
                tint: [0x1e88e5, 0x2196f3, 0x90caf9],
                alpha: { start: 0.7, end: 0 },
                gravityY: 100,
                quantity: 15,
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 30)
                }
            });
            
            this.scene.time.delayedCall(100, () => {
                splash.stop();
                this.scene.time.delayedCall(800, () => {
                    splash.destroy();
                });
            });
        } catch (e) {
            // No splash
        }
    }
    
    applyWaterfallForces() {
        for (const segment of this.segmentsInWaterfall) {
            // Time in waterfall affects force strength
            const timeInWaterfall = this.scene.time.now - this.segmentEntryTimes.get(segment);
            const timeFactor = Math.min(1, timeInWaterfall / 500); // Ramp up over 0.5 seconds
            
            // Main downward force
            const downwardForce = this.fallSpeed * timeFactor;
            
            // Lateral drift (creates slight swaying motion)
            const driftPhase = this.animationTime * 0.001 + segment.position.x * 0.01;
            const lateralForce = Math.sin(driftPhase) * this.lateralDrift;
            
            // Turbulence based on position
            const turbulence = (Math.random() - 0.5) * this.fallSpeed * 0.2;
            
            // Apply combined forces
            this.scene.matter.body.applyForce(segment, segment.position, {
                x: lateralForce + turbulence * 0.5,
                y: downwardForce + turbulence
            });
            
            // Reduce horizontal velocity (water drag)
            const dragFactor = 0.95;
            this.scene.matter.body.setVelocity(segment, {
                x: segment.velocity.x * dragFactor,
                y: segment.velocity.y // Don't reduce vertical velocity
            });
            
            // Log forces for debugging
            if (Math.random() < 0.01) {
                Tick.push('waterfall_force_y', downwardForce * 1000, 0x1e88e5);
                Tick.push('waterfall_drift_x', lateralForce * 1000, 0x42a5f5);
            }
        }
    }
    
    // Connect this waterfall to a pool below
    setPoolConnection(poolPlatform) {
        this.poolConnection = poolPlatform;
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // Update particle emitter positions if waterfall moves
        if (this.waterfallEmitter && this.body) {
            this.waterfallEmitter.setPosition(this.body.position.x, this.body.position.y - this.height/2);
        }
        
        if (this.mistEmitter && this.body) {
            this.mistEmitter.setPosition(this.body.position.x, this.body.position.y + this.height/2);
        }
    }
    
    destroy() {
        if (this.flowTimer) {
            this.flowTimer.destroy();
            this.flowTimer = null;
        }
        
        if (this.waterfallEmitter) {
            this.waterfallEmitter.destroy();
            this.waterfallEmitter = null;
        }
        
        if (this.mistEmitter) {
            this.mistEmitter.destroy();
            this.mistEmitter = null;
        }
        
        if (this.waterOverlay) {
            this.waterOverlay.destroy();
            this.waterOverlay = null;
        }
        
        this.waterStrips.forEach(strip => strip.destroy());
        this.waterStrips = [];
        
        // Restore any segments still in waterfall
        for (const segment of this.segmentsInWaterfall) {
            const original = this.originalProperties.get(segment);
            if (original) {
                this.scene.matter.body.set(segment, {
                    frictionAir: original.frictionAir
                });
            }
        }
        
        this.segmentsInWaterfall.clear();
        this.segmentEntryTimes.clear();
        this.originalProperties.clear();
        
        super.destroy();
    }
}