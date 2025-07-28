/**
 * Build mode detection utilities
 * Determines if we're running in static mode (game only) or server mode (with editor)
 */

/**
 * Check if API endpoints are available
 * @returns {Promise<boolean>} True if API is available, false otherwise
 */
export async function hasAPISupport() {
    try {
        // Try to fetch the maps list endpoint
        const response = await fetch('/api/maps', { 
            method: 'HEAD',
            // Add a short timeout to avoid hanging
            signal: AbortSignal.timeout(1000)
        });
        return response.ok || response.status === 405; // 405 if HEAD not supported but endpoint exists
    } catch (error) {
        // Network error or timeout means no API
        return false;
    }
}

/**
 * Get the current build mode
 * @returns {Promise<'static' | 'server'>} The current build mode
 */
export async function getBuildMode() {
    // Check if API is available
    const hasAPI = await hasAPISupport();
    return hasAPI ? 'server' : 'static';
}

/**
 * Check if currently in map editor
 * @returns {boolean} True if in map editor scene
 */
export function isInMapEditor() {
    return typeof window !== 'undefined' && (
        window.mapEditorScene !== undefined ||
        (window.game && window.game.scene && window.game.scene.isActive('MapEditor'))
    );
}

/**
 * Configuration based on build mode
 */
export const BuildConfig = {
    static: {
        // Static mode - game only, no editing
        hasMapEditor: false,
        hasAPI: false,
        canSaveMaps: false,
        canEditMaps: false,
        mapSource: 'registry', // Built-in maps only
        unlockProgression: false, // All levels available
        victoryOptions: ['replay', 'next', 'share', 'menu'],
        description: 'Game mode for players'
    },
    server: {
        // Server mode - full editor and play capabilities
        hasMapEditor: true,
        hasAPI: true,
        canSaveMaps: true,
        canEditMaps: true,
        mapSource: 'api', // API with registry fallback
        unlockProgression: false, // All levels available for testing
        victoryOptions: ['replay', 'editor', 'mapSelect'],
        description: 'Development mode for map creators'
    }
};

/**
 * Get configuration for current build mode
 * @returns {Promise<Object>} Configuration object
 */
export async function getCurrentConfig() {
    const mode = await getBuildMode();
    return {
        mode,
        ...BuildConfig[mode]
    };
}

/**
 * Cache the mode detection result for performance
 */
let cachedMode = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function getCachedBuildMode() {
    const now = Date.now();
    if (cachedMode && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedMode;
    }
    
    cachedMode = await getBuildMode();
    cacheTimestamp = now;
    return cachedMode;
}