import PlatformBase from './PlatformBase.js';
import Tick from '../utils/Tick.js';

export default class WaterPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const waterConfig = {
            color: 0x2196f3,         // Blue water color
            strokeColor: 0x1976d2,   // Darker blue border
            strokeWidth: 2,
            friction: 0.1,           // Low friction in water
            restitution: 0.0,
            matter: {
                isSensor: true       // Water acts as a sensor, not solid
            },
            ...config
        };
        
        super(scene, x, y, width, height, waterConfig);
        
        // Water flow properties
        this.flowDirection = config.flowDirection || 'right'; // 'left', 'right'
        this.flowSpeed = config.flowSpeed || 0.00; // Force applied per frame
        this.flowVariation = config.flowVariation || 0.2; // Random variation in flow
        this.waterFriction = config.waterFriction || 0.01; // Air friction in water
        this.dragCoefficient = config.dragCoefficient || 0.01; // Water resistance
        
        // Swimming properties
        this.swimForce = config.swimForce || 0.01; // Force applied when swimming
        this.swimControlResponsiveness = config.swimControlResponsiveness || 0.08; // How responsive controls are in water
        
        // Track segments in water
        this.segmentsInWater = new Set();
        this.entryDepths = new Map(); // Track how deep each segment entered
        this.originalProperties = new Map(); // Store original segment properties
        
        // Visual effects
        this.createWaterEffects();
        this.setupFlowAnimation();
    }
    
    createWaterEffects() {
        // Create wave overlay
        this.waveGraphics = this.scene.add.graphics();
        this.waveGraphics.setDepth(10); // Above most things
        this.container.add(this.waveGraphics);
        
        // Create bubble particles
        try {
            this.bubbleEmitter = this.scene.add.particles(0, 0, '__DEFAULT', {
                scale: { start: 0.1, end: 0.3 },
                speed: { min: 20, max: 40 },
                lifespan: { min: 1000, max: 2000 },
                tint: [0x4fc3f7, 0x81d4fa, 0xb3e5fc],
                alpha: { start: 0.6, end: 0 },
                gravityY: -50,
                quantity: 0, // Will emit manually
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Rectangle(-this.width/2, -this.height/2, this.width, this.height)
                }
            });
            
            this.container.add(this.bubbleEmitter);
        } catch (e) {
            this.bubbleEmitter = null;
        }
        
        // Semi-transparent water overlay
        this.waterOverlay = this.scene.add.rectangle(0, 0, this.width, this.height, 0x2196f3, 0.3);
        this.container.add(this.waterOverlay);
        this.container.sendToBack(this.waterOverlay);
        
        this.updateWaterVisuals();
    }
    
    setupFlowAnimation() {
        // Animate water flow
        this.flowTimer = this.scene.time.addEvent({
            delay: 50,
            callback: () => {
                this.updateWaterVisuals();
                this.applyFlowForces();
            },
            callbackScope: this,
            loop: true
        });
    }
    
    updateWaterVisuals() {
        if (!this.waveGraphics) return;
        
        this.waveGraphics.clear();
        this.waveGraphics.lineStyle(2, 0x64b5f6, 0.8);
        
        // Draw flowing water lines
        const time = this.scene.time.now * 0.001;
        const flowOffset = this.flowDirection === 'right' ? time * 20 : -time * 20;
        
        // Surface waves
        const waveHeight = 5;
        const waveFrequency = 0.1;
        
        this.waveGraphics.beginPath();
        this.waveGraphics.moveTo(-this.width/2, -this.height/2);
        
        for (let x = -this.width/2; x <= this.width/2; x += 5) {
            const waveY = Math.sin((x + flowOffset) * waveFrequency) * waveHeight;
            this.waveGraphics.lineTo(x, -this.height/2 + waveY);
        }
        
        this.waveGraphics.strokePath();
        
        // Flow lines
        this.waveGraphics.lineStyle(1, 0x90caf9, 0.4);
        
        for (let y = -this.height/2 + 20; y < this.height/2; y += 20) {
            this.waveGraphics.beginPath();
            
            for (let x = -this.width/2; x <= this.width/2; x += 10) {
                const lineOffset = (flowOffset + y * 2) % 40 - 20;
                if (x === -this.width/2) {
                    this.waveGraphics.moveTo(x + lineOffset, y);
                } else {
                    this.waveGraphics.lineTo(x + lineOffset, y);
                }
            }
            
            this.waveGraphics.strokePath();
        }
    }
    
    onCollision(segment, collision) {
        if (!this.segmentsInWater.has(segment)) {
            console.log('Segment entering water:', segment.label, segment.isWorm);
            
            this.segmentsInWater.add(segment);
            
            // Record entry depth
            const relativeY = segment.position.y - this.body.position.y;
            this.entryDepths.set(segment, relativeY);
            
            // Store original physics properties
            this.originalProperties.set(segment, {
                frictionAir: segment.frictionAir || 0
            });
            
            // Apply water physics - increase air friction for water resistance
            this.scene.matter.body.set(segment, {
                frictionAir: this.waterFriction
            });
            
            // Mark segment as being in water (for worm to detect)
            segment.isInWater = true;
            
            // Create splash effect
            this.createSplash(segment.position.x, this.body.position.y - this.height/2);
            
            // Start creating bubbles
            if (this.bubbleEmitter) {
                this.bubbleEmitter.setQuantity(1);
                this.bubbleEmitter.setFrequency(200);
            }
        }
    }
    
    onCollisionEnd(segment) {
        if (this.segmentsInWater.has(segment)) {
            this.segmentsInWater.delete(segment);
            this.entryDepths.delete(segment);
            
            // Restore original physics properties
            const original = this.originalProperties.get(segment);
            if (original) {
                this.scene.matter.body.set(segment, {
                    frictionAir: original.frictionAir
                });
                this.originalProperties.delete(segment);
            }
            
            // Remove water marker
            segment.isInWater = false;
            
            // Create exit splash
            this.createSplash(segment.position.x, this.body.position.y - this.height/2);
            
            // Stop bubbles if no segments in water
            if (this.segmentsInWater.size === 0 && this.bubbleEmitter) {
                this.bubbleEmitter.setQuantity(0);
            }
        }
    }
    
    createSplash(x, y) {
        // Create splash particles
        try {
            const splash = this.scene.add.particles(x, y, '__DEFAULT', {
                scale: { start: 0.3, end: 0.1 },
                speed: { min: 50, max: 150 },
                lifespan: { min: 300, max: 600 },
                tint: [0x2196f3, 0x64b5f6, 0x90caf9],
                alpha: { start: 0.8, end: 0 },
                gravityY: 200,
                quantity: 10,
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 20)
                }
            });
            
            // Auto-destroy after emission
            this.scene.time.delayedCall(100, () => {
                splash.stop();
                this.scene.time.delayedCall(600, () => {
                    splash.destroy();
                });
            });
        } catch (e) {
            // Fallback: no splash
        }
    }
    
    applyFlowForces() {
        // Debug: Log when this is called
        if (Math.random() < 0.01 && this.segmentsInWater.size > 0) {
            console.log('Applying water forces to', this.segmentsInWater.size, 'segments');
        }
        
        for (const segment of this.segmentsInWater) {
            // Calculate depth factor (deeper = stronger effect)
            const relativeY = segment.position.y - this.body.position.y;
            const depthFactor = Math.min(1, (relativeY + this.height/2) / this.height);
            
            // Apply flow force
            const baseFlow = this.flowDirection === 'right' ? this.flowSpeed : -this.flowSpeed;
            const flowVariation = (Math.random() - 0.5) * this.flowVariation * this.flowSpeed;
            const flowForce = (baseFlow + flowVariation) * depthFactor;
            
            // Apply drag (resistance to motion) - reduced for better swimming
            const velocity = segment.velocity;
            const dragX = -velocity.x * this.dragCoefficient;
            const dragY = -velocity.y * this.dragCoefficient;
            
            // Apply buoyancy force to counteract gravity
            // Matter.js applies gravity as: force = mass * gravity
            // Get the actual gravity from the world (default is usually { x: 0, y: 1 })
            const worldGravity = this.scene.matter.world.localWorld.gravity;
            const gravityForce = segment.mass * worldGravity.y * worldGravity.scale;
            const gravityCompensation = -gravityForce * 2.85; // Fully counteract gravity
            
            // Check for swimming input
            let swimX = 0;
            let swimY = 0;
            
            // Apply swim forces to all worm segments
            if (segment.isWorm) {
                // Try to get keyboard input
                if (this.scene.cursors) {
                    if (this.scene.cursors.left.isDown) swimX = -this.swimForce;
                    if (this.scene.cursors.right.isDown) swimX = this.swimForce;
                    if (this.scene.cursors.up.isDown) swimY = -this.swimForce;
                    if (this.scene.cursors.down.isDown) swimY = this.swimForce;
                }
                
                // Create bubbles to show we're in water
                if (this.bubbleEmitter && Math.random() < 0.2) {
                    this.bubbleEmitter.emitParticleAt(segment.position.x, segment.position.y);
                }
            }
            
            // Combined forces
            this.scene.matter.body.applyForce(segment, segment.position, {
                x: flowForce + dragX + swimX,
                y: gravityCompensation + dragY + swimY
            });
            
            Tick.push('water_flow_x', flowForce, 0x2196f3);
            Tick.push('water_swim_x', swimX, 0x00ff00);
            Tick.push('water_total_x', (flowForce + dragX + swimX), 0xff0000);
            
            // Create occasional bubbles from moving segments
            if (this.bubbleEmitter && Math.random() < 0.1) {
                this.bubbleEmitter.emitParticleAt(segment.position.x, segment.position.y);
            }
        }
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // Update bubble emitter position to follow any water movement
        if (this.bubbleEmitter && this.body) {
            this.bubbleEmitter.setPosition(this.body.position.x, this.body.position.y);
        }
    }
    
    destroy() {
        if (this.flowTimer) {
            this.flowTimer.destroy();
            this.flowTimer = null;
        }
        
        if (this.bubbleEmitter) {
            this.bubbleEmitter.destroy();
            this.bubbleEmitter = null;
        }
        
        if (this.waveGraphics) {
            this.waveGraphics.destroy();
            this.waveGraphics = null;
        }
        
        if (this.waterOverlay) {
            this.waterOverlay.destroy();
            this.waterOverlay = null;
        }
        
        // Restore any segments still in water
        for (const segment of this.segmentsInWater) {
            const original = this.originalProperties.get(segment);
            if (original) {
                this.scene.matter.body.set(segment, {
                    frictionAir: original.frictionAir
                });
            }
        }
        
        this.segmentsInWater.clear();
        this.entryDepths.clear();
        this.originalProperties.clear();
        
        super.destroy();
    }
}
