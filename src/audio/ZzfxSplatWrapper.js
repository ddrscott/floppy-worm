import { zzfx } from 'zzfx';

class ZzfxSplatWrapper {
    constructor() {
        this.lastSplatTime = 0;
        this.cooldownMs = 50;
        
        // Your exact ZzFX parameters for "Blip 23"
        // https://killedbyapixel.github.io/ZzFX/
        this.splatParams = [1,,19,.02,.03,.03,4,3.3,31,,,,.01,,38,,.09,.82,.03,.02,923]
    }

    playSplat(volumeMultiplier = 1.0) {
        // Check cooldown
        const now = Date.now();
        if (now - this.lastSplatTime < this.cooldownMs) {
            return;
        }
        this.lastSplatTime = now;
        
        // Create a copy of params and adjust volume
        const params = [...this.splatParams];
        params[0] = (params[0] || 1) * volumeMultiplier;
        
        // Play the sound using zzfx directly
        try {
            zzfx(...params);
        } catch (error) {
            console.warn('Failed to play splat sound:', error);
        }
    }
    
    // Allow updating the sound parameters
    setSplatParams(params) {
        this.splatParams = params;
    }
    
    // Compatibility methods
    stopAll() {
        // ZzFX doesn't need cleanup as sounds are fire-and-forget
    }
}

export default ZzfxSplatWrapper;
