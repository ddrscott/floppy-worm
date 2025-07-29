/**
 * GameStateManager - Centralized state management for Floppy Worm
 * 
 * This service manages both runtime state (via Phaser's scene.registry) and
 * persistent state (via localStorage). It provides a clean separation between
 * temporary game state and data that needs to persist across sessions.
 */
export default class GameStateManager {
    constructor(registry) {
        this.registry = registry;
        this.storageKey = 'floppyWormProgress';
        this.initialized = false;
        
        // Events that can be listened to
        this.events = {
            PROGRESS_UPDATED: 'progressUpdated',
            MAP_COMPLETED: 'mapCompleted',
            MAP_UNLOCKED: 'mapUnlocked',
            BEST_TIME_UPDATED: 'bestTimeUpdated'
        };
    }
    
    /**
     * Initialize the state manager by loading persistent data
     */
    initialize() {
        if (this.initialized) return;
        
        // Load progress from localStorage
        const savedProgress = this.loadFromStorage();
        
        // Store in registry for runtime access
        this.registry.set('userProgress', savedProgress);
        this.registry.set('gameStateManager', this);
        
        this.initialized = true;
    }
    
    /**
     * Load progress from localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Failed to load progress from localStorage:', error);
            return {};
        }
    }
    
    /**
     * Save progress to localStorage
     */
    saveToStorage(progress = null) {
        try {
            const dataToSave = progress || this.getProgress();
            localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Failed to save progress to localStorage:', error);
        }
    }
    
    /**
     * Get the current runtime progress
     */
    getProgress() {
        return this.registry.get('userProgress') || {};
    }
    
    /**
     * Get progress for a specific map
     */
    getMapProgress(mapKey) {
        const progress = this.getProgress();
        if (!progress[mapKey]) {
            progress[mapKey] = {
                unlocked: true, // All maps are unlocked in current design
                completed: false,
                bestTime: null
            };
        }
        return progress[mapKey];
    }
    
    /**
     * Update progress for a specific map
     */
    updateMapProgress(mapKey, updates) {
        const progress = this.getProgress();
        
        if (!progress[mapKey]) {
            progress[mapKey] = {
                unlocked: true,
                completed: false,
                bestTime: null
            };
        }
        
        // Apply updates
        Object.assign(progress[mapKey], updates);
        
        // Update registry
        this.registry.set('userProgress', progress);
        
        // Emit appropriate events
        if (updates.completed) {
            this.registry.events.emit(this.events.MAP_COMPLETED, mapKey);
        }
        if (updates.bestTime !== undefined) {
            this.registry.events.emit(this.events.BEST_TIME_UPDATED, mapKey, updates.bestTime);
        }
        
        // Emit general update event
        this.registry.events.emit(this.events.PROGRESS_UPDATED, progress);
        
        // Save to storage
        this.saveToStorage(progress);
    }
    
    /**
     * Mark a map as completed and unlock the next one
     */
    completeMap(mapKey, completionTime = null) {
        const updates = { completed: true };
        
        // Update best time if provided
        if (completionTime !== null) {
            const currentBest = this.getMapProgress(mapKey).bestTime;
            if (!currentBest || completionTime < currentBest) {
                updates.bestTime = completionTime;
            }
        }
        
        this.updateMapProgress(mapKey, updates);
        
        // Note: In current design, all maps are always unlocked
        // If we want to implement progressive unlocking, we'd do it here
    }
    
    /**
     * Get the best time for a map
     */
    getBestTime(mapKey) {
        return this.getMapProgress(mapKey).bestTime;
    }
    
    /**
     * Update the best time for a map
     */
    updateBestTime(mapKey, time) {
        const currentBest = this.getBestTime(mapKey);
        if (!currentBest || time < currentBest) {
            this.updateMapProgress(mapKey, { bestTime: time });
            return true; // New best time
        }
        return false; // Not a new best
    }
    
    /**
     * Check if a map is completed
     */
    isMapCompleted(mapKey) {
        return this.getMapProgress(mapKey).completed;
    }
    
    /**
     * Get completion statistics
     */
    getCompletionStats() {
        const progress = this.getProgress();
        const totalMaps = Object.keys(progress).length;
        const completedMaps = Object.values(progress).filter(p => p.completed).length;
        
        return {
            total: totalMaps,
            completed: completedMaps,
            percentage: totalMaps > 0 ? (completedMaps / totalMaps) * 100 : 0
        };
    }
    
    /**
     * Reset all progress (with confirmation)
     */
    resetProgress() {
        // Clear registry
        this.registry.set('userProgress', {});
        
        // Clear localStorage
        localStorage.removeItem(this.storageKey);
        
        // Emit reset event
        this.registry.events.emit(this.events.PROGRESS_UPDATED, {});
    }
    
    /**
     * Ensure all maps in the list have progress entries
     */
    ensureAllMapsHaveProgress(mapKeys) {
        const progress = this.getProgress();
        let needsSave = false;
        
        mapKeys.forEach(mapKey => {
            if (!progress[mapKey]) {
                progress[mapKey] = {
                    unlocked: true,
                    completed: false,
                    bestTime: null
                };
                needsSave = true;
            }
        });
        
        if (needsSave) {
            this.registry.set('userProgress', progress);
            this.saveToStorage(progress);
        }
    }
    
    /**
     * Get a specific scene's GameStateManager instance
     */
    static getFromScene(scene) {
        const manager = scene.registry.get('gameStateManager');
        if (!manager) {
            // Create and initialize if doesn't exist
            const newManager = new GameStateManager(scene.registry);
            newManager.initialize();
            return newManager;
        }
        return manager;
    }
}