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
        
        // Store initial worm position for resets
        this.wormStartPosition = { x: 0, y: 0 };
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
     * Reset worm to start position (used by electric platforms, death zones, etc.)
     */
    resetWorm() {
        if (!this.worm) return;
        
        console.log('Resetting worm to start position:', this.wormStartPosition);
        
        // Reset all worm segments to start position
        this.worm.segments.forEach((segment, index) => {
            // Position segments vertically spaced from start position
            const yOffset = index * (this.worm.segmentRadii[index] * 2 + 2);
            this.matter.body.setPosition(segment, {
                x: this.wormStartPosition.x,
                y: this.wormStartPosition.y + yOffset
            });
            
            // Completely zero all velocities for instant stop
            this.matter.body.setVelocity(segment, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(segment, 0);
            
            // Also reset forces to prevent momentum carryover
            segment.force.x = 0;
            segment.force.y = 0;
            segment.torque = 0;
        });
        
        // Reset any worm-specific state if needed
        if (typeof this.worm.resetState === 'function') {
            this.worm.resetState();
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