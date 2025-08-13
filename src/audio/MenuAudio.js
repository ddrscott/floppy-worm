import WhooshSynthesizer from './WhooshSynthesizer';

class MenuAudio {
    constructor(scene) {
        this.currentScene = scene;
        this.whoosh = null;
        this.audioTween = null;
        this.initialized = false;
        this.stopTimeout = null;
        this.fadeInterval = null;
    }
    
    // Update the current scene reference
    updateScene(scene) {
        this.currentScene = scene;
    }
    
    // Initialize the audio system (called on first use)
    initIfNeeded() {
        if (!this.initialized) {
            // Create and configure the WhooshSynthesizer
            this.whoosh = new WhooshSynthesizer({
                pitch: 0.4,
                filterBase: 900,
                resonance: 16.0,
                lowBoost: 1,
                reverb: 0.03,
                swishFactor: 0.8
            });
            
            this.initialized = true;
        }
    }

    // Play a menu sound with optional type
    play(type = 'navigate', customDuration = null) {
        // Ensure audio is initialized
        this.initIfNeeded();
        
        if (!this.whoosh) return;
        
        // Start the whoosh if not playing
        if (!this.whoosh.isPlaying) {
            this.whoosh.start();
        }
        
        // Kill any existing fade interval
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        // Also kill any existing timeout
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }
        
        // Create an object to tween for smooth audio fade
        const audioParams = { volume: 0, frequency: 0 };
        let duration = customDuration || 200;
        
        switch(type) {
            case 'navigate':
            case 'map':
                // Navigation sound - mid pitch
                audioParams.volume = 0.7;
                audioParams.frequency = 0.5;
                duration = customDuration || 200;
                break;
                
            case 'category':
                // Category change - lower pitch
                audioParams.volume = 0.7;
                audioParams.frequency = 0.3;
                duration = customDuration || 200;
                break;
                
            case 'select':
            case 'confirm':
                // Selection/confirm - higher pitch
                audioParams.volume = 0.7;
                audioParams.frequency = 1.0;
                duration = customDuration || 200;
                break;
                
            case 'hover':
                // Hover - very subtle
                audioParams.volume = 0.3;
                audioParams.frequency = 0.6;
                duration = customDuration || 100;
                break;
                
            case 'back':
            case 'cancel':
                // Back/cancel - descending pitch
                audioParams.volume = 0.6;
                audioParams.frequency = 0.2;
                duration = customDuration || 150;
                break;
                
            case 'error':
                // Error - harsh sound
                audioParams.volume = 0.8;
                audioParams.frequency = 0.1;
                duration = customDuration || 100;
                break;
                
            default:
                // Default navigation sound
                audioParams.volume = 0.5;
                audioParams.frequency = 0.5;
                duration = customDuration || 150;
        }
        
        // Start the sound
        this.whoosh.update(audioParams.volume, audioParams.frequency);
        
        // Use JavaScript-based fade that persists across scene changes
        const startTime = Date.now();
        const startVolume = audioParams.volume;
        const startFrequency = audioParams.frequency;
        
        // Create fade interval
        this.fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Apply sine easing out
            const easedProgress = Math.sin((progress * Math.PI) / 2);
            
            // Interpolate values
            const currentVolume = startVolume * (1 - easedProgress);
            const currentFrequency = startFrequency * (1 - easedProgress);
            
            // Update the whoosh
            if (this.whoosh) {
                this.whoosh.update(currentVolume, currentFrequency);
            }
            
            // Check if fade is complete
            if (progress >= 1) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                
                // Stop the whoosh after fade completes
                if (this.whoosh && this.whoosh.isPlaying) {
                    this.whoosh.stop();
                }
            }
        }, 16); // ~60fps
        
        // Fallback timeout in case tween doesn't complete properly
        this.stopTimeout = setTimeout(() => {
            if (this.whoosh && this.whoosh.isPlaying) {
                this.whoosh.stop();
            }
            this.stopTimeout = null;
        }, duration + 100);
    }

    // Clean up and stop audio
    destroy() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }
        
        if (this.whoosh) {
            this.whoosh.stop();
            this.whoosh = null;
        }
        
        this.currentScene = null;
        this.initialized = false;
    }
}

// Helper function to get or create MenuAudio from registry
export function getMenuAudio(scene) {
    if (!scene || !scene.registry) {
        console.warn('Scene or registry not available');
        return null;
    }
    
    // Check if MenuAudio already exists in registry
    let menuAudio = scene.registry.get('menuAudio');
    
    if (!menuAudio) {
        // Create new MenuAudio instance with scene reference
        menuAudio = new MenuAudio(scene);
        // Store in registry for persistence across scenes
        scene.registry.set('menuAudio', menuAudio);
    } else {
        // Update scene reference for existing instance
        menuAudio.updateScene(scene);
    }
    
    return menuAudio;
}

// Export the class for custom instances if needed
export default MenuAudio;