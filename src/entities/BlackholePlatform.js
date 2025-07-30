import PlatformBase from './PlatformBase.js';
import Tick from '../utils/Tick.js';

export default class BlackholePlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        // Black hole specific properties - extract from config first
        const physics = config.physics || config;
        const attractionStrength = physics.attractionStrength || 0.0001;
        const attractionRadius = physics.attractionRadius || 200;
        const rotationSpeed = physics.rotationSpeed || 0.02;
        const radius = width / 2; // For circles, width is diameter
        const deathRadius = radius * 0.5; // Inner death zone
        
        const blackholeConfig = {
            color: 0x1a1a1a,         // Dark color for black hole
            strokeColor: 0x8b00ff,   // Purple event horizon
            strokeWidth: 3,
            shape: 'circle',         // Black holes are circular
            friction: 0,
            restitution: 0,
            ...config,
            // Add attractor configuration to the matter body options
            matter: {
                ...config.matter,
                isSensor: true, // Make it a sensor so worm can pass through
                attractors: [
                    (bodyA, bodyB) => {
                        // bodyA is the black hole, bodyB is the other body
                        const dx = bodyA.position.x - bodyB.position.x;
                        const dy = bodyA.position.y - bodyB.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        // Only attract within radius
                        if (distance > attractionRadius || distance < deathRadius) {
                            return { x: 0, y: 0 };
                        }
                        
                        // Calculate attraction force (stronger as object gets closer)
                        const strength = attractionStrength * (1 - distance / attractionRadius);
                        let force = strength / Math.max(distance, 10); // Prevent division by very small numbers
                        
                        // Clamp force to prevent physics instability
                        const maxForce = 0.001;
                        force = Math.min(force, maxForce);
                        
                        // Log attraction data for debugging
                        // if (bodyB.label === 'worm') {
                        //     Tick.push('blackhole_distance', distance, 0xff00ff);
                        //     Tick.push('blackhole_force', force, 0x00ffff);
                        // }
                        
                        return {
                            x: dx * force,
                            y: dy * force
                        };
                    }
                ]
            }
        };
        
        super(scene, x, y, width, height, blackholeConfig);
        
        // Store properties as instance variables
        this.attractionStrength = attractionStrength;
        this.attractionRadius = attractionRadius;
        this.deathRadius = deathRadius;
        this.rotationSpeed = rotationSpeed;
        
        console.log('BlackholePlatform initialized with:', {
            attractionStrength: this.attractionStrength,
            attractionRadius: this.attractionRadius,
            rotationSpeed: this.rotationSpeed,
            position: { x: this.x, y: this.y }
        });
        
        // Visual effects
        this.createBlackholeEffects();
        
        // Track attracted bodies
        this.attractedBodies = new Set();
        
        // Prevent multiple collision triggers
        this.isTriggered = false;
    }
    
    createBlackholeEffects() {
        // Create event horizon gradient effect
        this.eventHorizon = this.scene.add.graphics();
        this.eventHorizon.setDepth(-2);
        
        // Create attraction field visualization
        this.attractionField = this.scene.add.graphics();
        this.attractionField.setDepth(-3);
        
        // Add to container (positioned at 0,0 relative to container)
        this.container.add(this.attractionField);
        this.container.add(this.eventHorizon);
        
        // Create swirling particle effect
        try {
            // Particle emitter for matter being sucked in
            this.debrisEmitter = this.scene.add.particles(0, 0, '__DEFAULT', {
                scale: { start: 0.3, end: 0 },
                speed: { min: 20, max: 50 },
                lifespan: { min: 1000, max: 2000 },
                tint: [0x8b00ff, 0x4b0082, 0x0000ff],
                quantity: 2,
                frequency: 100,
                emitZone: {
                    type: 'edge',
                    source: new Phaser.Geom.Circle(0, 0, this.attractionRadius),
                    quantity: 1
                },
                angle: {
                    onEmit: (particle) => {
                        // Calculate angle towards center
                        const angle = Phaser.Math.Angle.Between(
                            particle.x, particle.y, 0, 0
                        );
                        return Phaser.Math.RadToDeg(angle + Math.PI/2);
                    }
                },
                moveToX: 0,
                moveToY: 0
            });
            
            // Add particle emitter to container
            this.container.add(this.debrisEmitter);
        } catch (e) {
            // Fallback: no particles
            this.debrisEmitter = null;
        }
        
        this.updateBlackholeVisuals();
    }
    
    
    updateBlackholeVisuals() {
        const time = this.scene.time.now * 0.001;
        
        // Clear previous drawings
        this.eventHorizon.clear();
        this.attractionField.clear();
        
        // Draw attraction field with pulsing effect
        const pulseScale = 1 + Math.sin(time * 2) * 0.1;
        this.attractionField.lineStyle(2, 0x8b00ff, 0.1);
        this.attractionField.strokeCircle(0, 0, this.attractionRadius * pulseScale);
        
        // Draw spiral lines in attraction field
        const spiralCount = 6;
        for (let i = 0; i < spiralCount; i++) {
            const startAngle = (i / spiralCount) * Math.PI * 2 + time;
            this.attractionField.lineStyle(1, 0x8b00ff, 0.7);
            this.attractionField.beginPath();
            
            for (let r = this.radius; r < this.attractionRadius; r += 10) {
                const angle = startAngle + (r / 50) + time;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                
                if (r === this.radius) {
                    this.attractionField.moveTo(x, y);
                } else {
                    this.attractionField.lineTo(x, y);
                }
            }
            
            this.attractionField.strokePath();
        }
        
        // Draw event horizon with distortion effect
        const segments = 32;
        this.eventHorizon.fillStyle(0x000000, 0.8);
        this.eventHorizon.beginPath();
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const distortion = Math.sin(angle * 3 + time * 5) * 2;
            const r = this.radius + distortion;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            
            if (i === 0) {
                this.eventHorizon.moveTo(x, y);
            } else {
                this.eventHorizon.lineTo(x, y);
            }
        }
        
        this.eventHorizon.closePath();
        this.eventHorizon.fillPath();
        
        // Draw swirling inner vortex
        this.eventHorizon.lineStyle(2, 0x8b00ff, 0.8);
        for (let i = 0; i < 3; i++) {
            const offsetAngle = (i / 3) * Math.PI * 2;
            this.eventHorizon.beginPath();
            this.eventHorizon.arc(0, 0, this.deathRadius, 
                time * 3 + offsetAngle, 
                time * 3 + offsetAngle + Math.PI * 0.5);
            this.eventHorizon.strokePath();
        }
        
        // Rotate the entire container for swirling effect
        this.container.setRotation(this.container.rotation + this.rotationSpeed);
    }
    
    onCollision(segment, collision) {
        // Prevent multiple collision triggers
        if (this.isTriggered) return;
        this.isTriggered = true;
        
        const drawDuration = 500; // Time to draw suck-in effect
        // Trigger suck-in visual effect
        this.triggerSuckInEffect(segment, drawDuration);
        
        // Add a slight delay before restarting to let the effect play
        this.scene.time.delayedCall(drawDuration, () => {
            // Restart the entire scene - this will reset everything cleanly
            this.scene.scene.restart();
        });
    }
    
    triggerSuckInEffect(segment, duration) {
        // Visual feedback for being sucked in
        if (this.debrisEmitter) {
            this.debrisEmitter.explode(100);
        }
        
        // Scale down the entire worm as it gets sucked in
        if (this.scene.worm && this.scene.worm.segments) {
            this.scene.worm.segments.forEach(wormSegment => {
                if (wormSegment.gameObject && wormSegment.gameObject.setScale) {
                    // Animate the worm segments shrinking to nothing
                    this.scene.tweens.add({
                        targets: wormSegment.gameObject,
                        scaleX: 0,
                        scaleY: 0,
                        duration: duration,
                        ease: 'Power2.easeIn'
                    });
                }
            });
        }
        
        // Screen effects for dramatic suck-in
        if (this.scene.cameras && this.scene.cameras.main) {
            // Quickly zoom in towards black hole center
            this.scene.cameras.main.pan(
                this.body.position.x, 
                this.body.position.y, 
                duration, 
                'Power3'
            );
            this.scene.cameras.main.zoomTo(3.0, duration);
            
            // Fade to black faster for suck-in effect
            this.scene.cameras.main.fade(duration/2, 0, 0, 0);
        }
        
        // Sound effect placeholder
        // this.scene.sound.play('blackhole_suck');
    }
    
    update(delta) {
        super.update(delta);
        this.updateBlackholeVisuals();
        
        // Clean up tracked bodies that are no longer being attracted
        for (const body of this.attractedBodies) {
            const dx = this.body.position.x - body.position.x;
            const dy = this.body.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.attractionRadius) {
                this.attractedBodies.delete(body);
            }
        }
    }
    
    destroy() {
        // Clear attractors to prevent physics oscillations
        if (this.body && this.body.attractors) {
            this.body.attractors = [];
        }
        
        // Clean up visual effects
        if (this.eventHorizon) {
            this.eventHorizon.destroy();
            this.eventHorizon = null;
        }
        if (this.attractionField) {
            this.attractionField.destroy();
            this.attractionField = null;
        }
        if (this.debrisEmitter) {
            this.debrisEmitter.destroy();
            this.debrisEmitter = null;
        }
        
        // Clear tracked bodies
        if (this.attractedBodies) {
            this.attractedBodies.clear();
        }
        
        // Reset state
        this.isTriggered = false;
        
        super.destroy();
    }
}
