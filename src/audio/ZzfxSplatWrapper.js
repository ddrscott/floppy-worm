import { zzfx, ZZFX } from 'zzfx';

class ZzfxSplatWrapper {
    constructor() {
        this.lastSplatTime = 0;
        this.cooldownMs = 50;
        
        // Resume audio context on first user interaction
        this.audioContextResumed = false;
        
        // Your exact ZzFX parameters for "Blip 23"
        // https://killedbyapixel.github.io/ZzFX/
        this.splatParams = [1,,19,.02,.03,.03,4,3.3,31,,,,.01,,38,,.09,.82,.03,.02,923]
        
        // Movement sounds
        this.squishParams = [.8,,101,.01,.02,.01,3,1.93,8.6,-54,,,,,,,.01,.97,.02,.13,143]; // Squishy compression
        this.stretchParams = [.7,,89,,.04,.02,2,1.2,-7.8,59,,,,,,,.02,.88,.04]; // Stretchy extension
        
        // Platform interaction sounds
        this.electricZapParams = [1.2,,221,.01,.02,.16,4,1.2,-8,82,,,,.1,,.2,.02,.52,.01]; // Electric shock
        this.waterSplashParams = [1.1,,143,.05,.17,.19,2,.3,6.7,7.9,,,,.04,,,,.68,.09]; // Water splash
        
        // Goal collection sound (pickup/coin sound)
        this.goalCollectParams = [.8,,1250,.02,.08,.12,1,1.3,7.8,3.9,,,,,,,.03,.62,.05]; // Coin/pickup sound

        // Victory/completion sound
        this.victoryParams = this.goalCollectParams;
        
        // UI sounds
        this.uiClickParams = [.5,,265,,.04,.02,1,1.5,,,350,.02,,,,,,.4,.01]; // Menu click
        this.uiHoverParams = [.3,,539,.01,,.01,1,2.23,,,400,,.01,,,,.02,.24]; // Menu hover
        this.uiErrorParams = [.8,,213,,.01,.14,4,,,,-100,.02,,,,,,.1,.01]; // Error beep
        
        // Track last play time for each sound type
        this.lastPlayTimes = {};
    }

    playSplat(volumeMultiplier = 1.0) {
        // Check cooldown
        const now = Date.now();
        if (now - this.lastSplatTime < this.cooldownMs) {
            return;
        }
        this.lastSplatTime = now;
        
        // Get global volume from localStorage
        const savedVolume = localStorage.getItem('gameVolume');
        const globalVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;
        
        // Create a copy of params and adjust volume
        const params = [...this.splatParams];
        params[0] = (params[0] || 1) * volumeMultiplier * globalVolume;
        
        // Resume audio context if needed (on first interaction)
        if (!this.audioContextResumed && ZZFX && ZZFX.x) {
            ZZFX.x.resume().then(() => {
                this.audioContextResumed = true;
                console.log('ZzFX audio context resumed');
            });
        }
        
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
    
    // Generic play method for any sound type
    playSound(soundType, volumeMultiplier = 1.0, cooldownMs = null) {
        const now = Date.now();
        const effectiveCooldown = cooldownMs || this.cooldownMs;
        
        // Check cooldown for this specific sound type
        if (this.lastPlayTimes[soundType] && 
            now - this.lastPlayTimes[soundType] < effectiveCooldown) {
            return;
        }
        
        // Get parameters for this sound type
        let params;
        switch(soundType) {
            case 'splat': params = this.splatParams; break;
            case 'squish': params = this.squishParams; break;
            case 'stretch': params = this.stretchParams; break;
            case 'electric': params = this.electricZapParams; break;
            case 'water': params = this.waterSplashParams; break;
            case 'victory': params = this.victoryParams; break;
            case 'goalCollect': params = this.goalCollectParams; break;
            case 'uiClick': params = this.uiClickParams; break;
            case 'uiHover': params = this.uiHoverParams; break;
            case 'uiError': params = this.uiErrorParams; break;
            default:
                console.warn(`Unknown sound type: ${soundType}`);
                return;
        }
        
        this.lastPlayTimes[soundType] = now;
        
        // Get global volume from localStorage
        const savedVolume = localStorage.getItem('gameVolume');
        const globalVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;
        
        // Create a copy of params and adjust volume with both global and local multipliers
        const adjustedParams = [...params];
        adjustedParams[0] = (adjustedParams[0] || 1) * volumeMultiplier * globalVolume;
        
        // Resume audio context if needed (on first interaction)
        if (!this.audioContextResumed && ZZFX && ZZFX.x) {
            ZZFX.x.resume().then(() => {
                this.audioContextResumed = true;
                console.log('ZzFX audio context resumed');
            });
        }
        
        // Play the sound using zzfx directly
        try {
            zzfx(...adjustedParams);
        } catch (error) {
            console.warn(`Failed to play ${soundType} sound:`, error);
        }
    }
    
    // Convenience methods for specific sounds
    playSquish(volumeMultiplier = 1.0) {
        this.playSound('squish', volumeMultiplier, 100); // Slightly longer cooldown for movement
    }
    
    playStretch(volumeMultiplier = 1.0) {
        this.playSound('stretch', volumeMultiplier, 100);
    }
    
    playElectricZap(volumeMultiplier = 1.0) {
        this.playSound('electric', volumeMultiplier, 200); // Longer cooldown for platform sounds
    }
    
    playWaterSplash(volumeMultiplier = 1.0) {
        this.playSound('water', volumeMultiplier, 150);
    }
    
    playVictory(volumeMultiplier = 1.0) {
        this.playSound('victory', volumeMultiplier, 1000); // Long cooldown for victory
    }
    
    playGoalCollect(volumeMultiplier = 1.0) {
        this.playSound('goalCollect', volumeMultiplier, 100); // Short cooldown for pickups
    }
    
    playUIClick(volumeMultiplier = 1.0) {
        this.playSound('uiClick', volumeMultiplier, 50);
    }
    
    playUIHover(volumeMultiplier = 1.0) {
        this.playSound('uiHover', volumeMultiplier, 100);
    }
    
    playUIError(volumeMultiplier = 1.0) {
        this.playSound('uiError', volumeMultiplier, 200);
    }
    
    // Compatibility methods
    stopAll() {
        // ZzFX doesn't need cleanup as sounds are fire-and-forget
    }
}

export default ZzfxSplatWrapper;
