import Phaser from 'phaser';

/**
 * Base class for all level scenes to ensure consistent worm cleanup
 * and prevent audio persistence bugs
 */
export default class BaseLevelScene extends Phaser.Scene {
    constructor(config = {}) {
        super(config);
        
        // Victory state tracking
        this.victoryAchieved = false;
        this.victoryReturnTimer = null;
        
        // Worm reference - should be set by subclasses
        this.worm = null;
    }
    
    create() {
        // Clean up any existing objects
        this.cleanup();
        
        // Clean up when scene shuts down
        this.events.once('shutdown', () => {
            this.cleanup();
        });
    }
    
    cleanup() {
        // Destroy existing worm if it exists
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        // Reset victory state
        this.victoryAchieved = false;
        
        // Cancel any existing timers
        if (this.victoryReturnTimer) {
            this.victoryReturnTimer.destroy();
            this.victoryReturnTimer = null;
        }
    }
    
    /**
     * Called when victory condition is met
     * Subclasses should call super.victory() first
     */
    victory() {
        // Set victory flag to handle input differently
        this.victoryAchieved = true;
        
        // Immediately stop worm audio and clean up worm
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
    }
    
    /**
     * Update method that subclasses should call via super.update(time, delta)
     * Handles worm updates if worm exists and victory isn't achieved
     */
    update(time, delta) {
        // Don't update worm during victory state
        if (this.victoryAchieved) {
            return;
        }
        
        // Update worm if it exists
        if (this.worm && typeof this.worm.update === 'function') {
            this.worm.update(delta);
        }
    }
}