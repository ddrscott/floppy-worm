import PlatformBase from './PlatformBase.js';

export default class BouncyPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const bouncyConfig = {
            color: 0xff69b4,         // Pink bouncy color (hot pink)
            strokeColor: 0xe91e63,   // Darker pink border
            strokeWidth: 4,
            friction: 0.8,           // Good grip for bouncing
            restitution: 2,        // High bounce factor
            ...config
        };
        
        super(scene, x, y, width, height, bouncyConfig);
        
        // Replace the default rectangle graphics with chamfered corners
        this.createChamferedGraphics();
        
        // Bouncy-specific properties
        this.bounceForce = config.bounceForce || 0.1; // Increased from 0.003
        this.minimumImpactSpeed = config.minimumImpactSpeed || 0.5; // Reduced from 2
        this.bounceSound = config.bounceSound || null;
        
        // Animation properties
        this.baseScaleX = 1;
        this.baseScaleY = 1;
        this.squishAmount = 0.1;
        this.squishDuration = 150;
        
        // Visual effects
        this.createBouncyEffects();
    }
    
    createChamferedGraphics() {
        // Remove the default rectangle graphics
        if (this.graphics) {
            this.container.remove(this.graphics);
            this.graphics.destroy();
        }
        
        // Create custom graphics with chamfered corners
        const chamferSize = Math.min(this.width, this.height) * 0.15; // 15% of the smallest dimension
        const graphics = this.scene.add.graphics();
        
        // Set fill and stroke styles
        graphics.fillStyle(this.config.color);
        if (this.config.strokeColor !== null) {
            graphics.lineStyle(this.config.strokeWidth, this.config.strokeColor);
        }
        
        // Calculate chamfered rectangle points
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        
        // Start from top-left, going clockwise
        graphics.beginPath();
        graphics.moveTo(-halfWidth + chamferSize, -halfHeight); // Top edge start
        graphics.lineTo(halfWidth - chamferSize, -halfHeight);  // Top edge end
        graphics.lineTo(halfWidth, -halfHeight + chamferSize);  // Top-right chamfer
        graphics.lineTo(halfWidth, halfHeight - chamferSize);   // Right edge
        graphics.lineTo(halfWidth - chamferSize, halfHeight);   // Bottom-right chamfer
        graphics.lineTo(-halfWidth + chamferSize, halfHeight);  // Bottom edge
        graphics.lineTo(-halfWidth, halfHeight - chamferSize);  // Bottom-left chamfer
        graphics.lineTo(-halfWidth, -halfHeight + chamferSize); // Left edge
        graphics.closePath(); // Back to start (top-left chamfer)
        
        graphics.fillPath();
        if (this.config.strokeColor !== null) {
            graphics.strokePath();
        }
        
        // Replace the graphics reference
        this.graphics = graphics;
        this.container.add(this.graphics);
    }
    
    createBouncyEffects() {
        // Add spring pattern overlay using simple lines
        const springGraphics = this.scene.add.graphics();
        springGraphics.lineStyle(2, 0xfff3e0, 0.8);
        
        // Draw spring coil pattern using simple zigzag lines
        const numCoils = Math.floor(this.width / 20);
        const coilHeight = this.height * 0.6;
        const coilWidth = this.width / numCoils;
        
        for (let i = 0; i < numCoils; i++) {
            const startX = (i - numCoils/2 + 0.5) * coilWidth;
            const centerY = 0;
            
            // Draw coil as zigzag pattern
            springGraphics.moveTo(startX - coilWidth/4, centerY - coilHeight/2);
            
            // Create zigzag spring pattern
            for (let j = 0; j < 6; j++) {
                const progress = j / 5;
                const y = centerY - coilHeight/2 + progress * coilHeight;
                const x = startX + (j % 2 === 0 ? -coilWidth/4 : coilWidth/4);
                springGraphics.lineTo(x, y);
            }
        }
        
        springGraphics.strokePath();
        
        // Add spring graphics to container (positioned at 0,0 relative to container)
        this.springOverlay = springGraphics;
        this.container.add(this.springOverlay);
    }
    
    onCollision(segment, collision) {
        // Calculate impact velocity
        const velocity = segment.velocity;
        const normal = collision.normal;
        
        // Project velocity onto surface normal to get impact speed
        const impactSpeed = Math.abs(velocity.x * normal.x + velocity.y * normal.y);
        
        console.log(`BouncyPlatform collision: impactSpeed=${impactSpeed.toFixed(3)}, normal=(${normal.x.toFixed(2)}, ${normal.y.toFixed(2)})`);
        
        if (impactSpeed >= this.minimumImpactSpeed) {
            // Apply bounce force with enhanced multiplier
            const bounceMultiplier = Math.max(1, impactSpeed * 0.5); // Scale with impact
            const bounceForceVector = {
                x: -normal.x * this.bounceForce * bounceMultiplier,
                y: -normal.y * this.bounceForce * bounceMultiplier
            };
            
            console.log(`Applying bounce force: (${bounceForceVector.x.toFixed(4)}, ${bounceForceVector.y.toFixed(4)})`);
            
            this.scene.matter.body.applyForce(segment, segment.position, bounceForceVector);
            
            // Trigger visual bounce effect
            this.triggerBounceAnimation();
            
            // Play bounce sound if available
            if (this.bounceSound && this.scene.sound) {
                this.scene.sound.play(this.bounceSound, { volume: Math.min(impactSpeed / 10, 1) });
            }
        } else {
            console.log(`Impact too slow for bounce (${impactSpeed.toFixed(3)} < ${this.minimumImpactSpeed})`);
        }
    }
    
    triggerBounceAnimation() {
        // Stop any existing tween
        if (this.bounceTween) {
            this.bounceTween.stop();
        }
        
        // Squish animation
        this.bounceTween = this.scene.tweens.add({
            targets: [this.graphics, this.springOverlay],
            scaleX: this.baseScaleX + this.squishAmount,
            scaleY: this.baseScaleY - this.squishAmount,
            duration: this.squishDuration / 2,
            ease: 'Power2',
            yoyo: true,
            onComplete: () => {
                this.bounceTween = null;
            }
        });
        
        // Color flash effect
        const originalTint = this.graphics.fillColor;
        this.graphics.setFillStyle(0xffeb3b); // Bright yellow flash
        
        this.scene.time.delayedCall(100, () => {
            if (this.graphics) {
                this.graphics.setFillStyle(originalTint);
            }
        });
    }
    
    update(delta) {
        super.update(delta);
        
        // Subtle breathing animation when not being bounced
        if (!this.bounceTween) {
            const time = this.scene.time.now * 0.002;
            const breathe = Math.sin(time) * 0.02 + 1;
            this.graphics.setScale(breathe, 1 / breathe);
            if (this.springOverlay) {
                this.springOverlay.setScale(breathe, 1 / breathe);
            }
        }
    }
    
    destroy() {
        if (this.bounceTween) {
            this.bounceTween.stop();
            this.bounceTween = null;
        }
        if (this.springOverlay) {
            this.springOverlay.destroy();
            this.springOverlay = null;
        }
        super.destroy();
    }
}
