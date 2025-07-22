import PlatformBase from './PlatformBase.js';

export default class IcePlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const iceConfig = {
            color: 0xb3e5fc,        // Light blue ice color
            strokeColor: 0x81d4fa,   // Slightly darker blue border
            strokeWidth: 3,
            friction: 0.05,          // Very low friction for slippery surface
            restitution: 0.1,        // Slightly bouncy
            ...config
        };
        
        super(scene, x, y, width, height, iceConfig);
        
        // Ice-specific properties
        this.slipForce = config.slipForce || 0.001;
        this.meltTime = config.meltTime || 0; // 0 = no melting, > 0 = melt after time
        this.timeOnIce = 0;
        
        // Visual effects
        this.createIceEffects();
    }
    
    createIceEffects() {
        // Add crystalline pattern overlay
        const crystalGraphics = this.scene.add.graphics();
        crystalGraphics.lineStyle(1, 0xe1f5fe, 0.6);
        
        // Draw ice crystal pattern
        const numCrystals = Math.floor((this.width * this.height) / 1000);
        for (let i = 0; i < numCrystals; i++) {
            const localX = (Math.random() - 0.5) * this.width * 0.8;
            const localY = (Math.random() - 0.5) * this.height * 0.8;
            const size = Math.random() * 8 + 2;
            
            // Draw simple crystal shape (6-pointed star)
            crystalGraphics.moveTo(localX, localY - size);
            crystalGraphics.lineTo(localX, localY + size);
            crystalGraphics.moveTo(localX - size * 0.866, localY - size * 0.5);
            crystalGraphics.lineTo(localX + size * 0.866, localY + size * 0.5);
            crystalGraphics.moveTo(localX - size * 0.866, localY + size * 0.5);
            crystalGraphics.lineTo(localX + size * 0.866, localY - size * 0.5);
        }
        
        crystalGraphics.strokePath();
        crystalGraphics.setPosition(this.x, this.y);
        crystalGraphics.setAngle(this.config.angle);
        
        this.crystalOverlay = crystalGraphics;
    }
    
    onCollision(segment, collision) {
        // Apply additional sliding force perpendicular to surface normal
        const normal = collision.normal;
        const tangent = { x: -normal.y, y: normal.x };
        
        // Apply slip force in the direction of existing velocity
        const velocity = segment.velocity;
        const velocityMagnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        if (velocityMagnitude > 0.1) {
            const normalizedVel = {
                x: velocity.x / velocityMagnitude,
                y: velocity.y / velocityMagnitude
            };
            
            this.scene.matter.body.applyForce(segment, segment.position, {
                x: normalizedVel.x * this.slipForce,
                y: normalizedVel.y * this.slipForce
            });
        }
    }
    
    update(delta) {
        super.update(delta);
        
        // Handle melting if enabled
        if (this.meltTime > 0) {
            this.timeOnIce += delta;
            
            if (this.timeOnIce >= this.meltTime) {
                this.melt();
            } else {
                // Visual feedback for melting process
                const meltProgress = this.timeOnIce / this.meltTime;
                const alpha = 1 - (meltProgress * 0.3);
                this.graphics.setAlpha(alpha);
                if (this.crystalOverlay) {
                    this.crystalOverlay.setAlpha(alpha * 0.6);
                }
            }
        }
    }
    
    melt() {
        // Create melting effect (simple graphics instead of particles if no texture)
        try {
            const particles = this.scene.add.particles(this.x, this.y, '__DEFAULT', {
                scale: { start: 0.3, end: 0 },
                speed: { min: 20, max: 50 },
                lifespan: 500,
                tint: 0x81d4fa,
                quantity: 20
            });
            
            // Remove platform after brief delay
            this.scene.time.delayedCall(200, () => {
                particles.destroy();
                this.destroy();
            });
        } catch (e) {
            // Fallback: simple fade effect
            this.scene.tweens.add({
                targets: [this.graphics, this.crystalOverlay],
                alpha: 0,
                duration: 500,
                onComplete: () => this.destroy()
            });
        }
    }
    
    destroy() {
        if (this.crystalOverlay) {
            this.crystalOverlay.destroy();
        }
        super.destroy();
    }
}