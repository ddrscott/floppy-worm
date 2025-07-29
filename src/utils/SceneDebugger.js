/**
 * SceneDebugger - Utility for debugging Phaser scene transitions and lifecycle events
 * 
 * Enable this during development to log all scene transitions and state changes.
 */
export default class SceneDebugger {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.logLevel = 'info'; // 'info', 'verbose'
        
        // Scene lifecycle events to monitor
        this.sceneEvents = [
            'start',
            'ready',
            'create',
            'update',
            'preupdate',
            'postupdate',
            'pause',
            'resume',
            'sleep',
            'wake',
            'shutdown',
            'destroy',
            'boot'
        ];
    }
    
    /**
     * Enable scene debugging
     */
    enable(logLevel = 'info') {
        if (this.enabled) return;
        
        this.enabled = true;
        this.logLevel = logLevel;
        
        console.log('%c[SceneDebugger] Enabled', 'color: #4ecdc4; font-weight: bold');
        
        // Monitor all existing scenes
        this.game.scene.scenes.forEach(scene => {
            this.attachToScene(scene);
        });
        
        // Monitor scene manager events
        this.monitorSceneManager();
    }
    
    /**
     * Disable scene debugging
     */
    disable() {
        if (!this.enabled) return;
        
        this.enabled = false;
        console.log('%c[SceneDebugger] Disabled', 'color: #e74c3c; font-weight: bold');
        
        // Note: We don't remove existing listeners to avoid potential issues
        // They'll just stop logging when enabled is false
    }
    
    /**
     * Attach event listeners to a scene
     */
    attachToScene(scene) {
        const sceneName = scene.scene.key;
        
        // Only log essential events for info level
        const eventsToLog = this.logLevel === 'verbose' 
            ? this.sceneEvents 
            : ['start', 'ready', 'pause', 'resume', 'sleep', 'wake', 'shutdown'];
        
        eventsToLog.forEach(eventName => {
            scene.events.on(eventName, (...args) => {
                if (!this.enabled) return;
                
                const timestamp = new Date().toLocaleTimeString();
                const color = this.getEventColor(eventName);
                
                console.log(
                    `%c[${timestamp}] Scene "${sceneName}" → ${eventName}`,
                    `color: ${color}; font-weight: ${this.isImportantEvent(eventName) ? 'bold' : 'normal'}`,
                    args.length > 0 ? args : ''
                );
            });
        });
    }
    
    /**
     * Monitor scene manager events
     */
    monitorSceneManager() {
        const scenePlugin = this.game.scene;
        
        // Intercept scene operations
        const operations = ['start', 'stop', 'switch', 'launch', 'pause', 'resume', 'sleep', 'wake'];
        
        operations.forEach(op => {
            const original = scenePlugin[op].bind(scenePlugin);
            
            scenePlugin[op] = (key, ...args) => {
                if (this.enabled) {
                    const timestamp = new Date().toLocaleTimeString();
                    console.log(
                        `%c[${timestamp}] SceneManager.${op}("${key}")`,
                        'color: #f39c12; font-weight: bold',
                        args.length > 0 ? args : ''
                    );
                }
                
                return original(key, ...args);
            };
        });
    }
    
    /**
     * Get color for event type
     */
    getEventColor(eventName) {
        const colors = {
            'start': '#27ae60',      // Green
            'ready': '#2ecc71',      // Light Green
            'create': '#3498db',     // Blue
            'pause': '#f39c12',      // Orange
            'resume': '#e67e22',     // Dark Orange
            'sleep': '#9b59b6',      // Purple
            'wake': '#8e44ad',       // Dark Purple
            'shutdown': '#e74c3c',   // Red
            'destroy': '#c0392b',    // Dark Red
            'boot': '#34495e'        // Dark Gray
        };
        
        return colors[eventName] || '#95a5a6'; // Default gray
    }
    
    /**
     * Check if event is important (for bold display)
     */
    isImportantEvent(eventName) {
        return ['start', 'shutdown', 'destroy', 'pause', 'resume', 'sleep', 'wake'].includes(eventName);
    }
    
    /**
     * Log current scene states
     */
    logSceneStates() {
        if (!this.enabled) return;
        
        console.group('%c[SceneDebugger] Current Scene States', 'color: #4ecdc4; font-weight: bold');
        
        this.game.scene.scenes.forEach(scene => {
            const status = [];
            if (scene.scene.settings.active) status.push('active');
            if (scene.scene.settings.visible) status.push('visible');
            if (scene.scene.isPaused()) status.push('paused');
            if (scene.scene.isSleeping()) status.push('sleeping');
            
            console.log(
                `%c${scene.scene.key}: %c[${status.join(', ') || 'inactive'}]`,
                'font-weight: bold',
                'color: #7f8c8d'
            );
        });
        
        console.groupEnd();
    }
    
    /**
     * Log registry contents
     */
    logRegistry() {
        if (!this.enabled) return;
        
        console.group('%c[SceneDebugger] Registry Contents', 'color: #4ecdc4; font-weight: bold');
        
        const registry = this.game.registry;
        const entries = registry.list;
        
        Object.keys(entries).forEach(key => {
            const value = entries[key];
            console.log(`%c${key}:`, 'font-weight: bold', value);
        });
        
        console.groupEnd();
    }
}

// Export a singleton instance for easy access
let debuggerInstance = null;

export function getSceneDebugger(game) {
    if (!debuggerInstance && game) {
        debuggerInstance = new SceneDebugger(game);
    }
    return debuggerInstance;
}

// Helper to enable debugging from console
if (typeof window !== 'undefined') {
    window.enableSceneDebug = (logLevel = 'info') => {
        const game = window.game || (window.Phaser && window.Phaser.GAMES[0]);
        if (game) {
            const sceneDebugger = getSceneDebugger(game);
            sceneDebugger.enable(logLevel);
            return sceneDebugger;
        } else {
            console.error('No Phaser game instance found');
        }
    };
    
    window.disableSceneDebug = () => {
        if (debuggerInstance) {
            debuggerInstance.disable();
        }
    };
}