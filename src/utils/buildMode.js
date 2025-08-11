/**
 * @deprecated This entire module is deprecated in favor of build-time constants.
 * 
 * Build mode detection utilities
 * Uses build-time constants set by Vite configuration
 * 
 * Instead of using functions from this module, use Vite's build constants directly:
 * - import.meta.env.BUILD_MODE ('static' | 'server')
 * - import.meta.env.HAS_API (boolean)
 * - import.meta.env.HAS_EDITOR (boolean)
 * 
 * This module is kept for backward compatibility but will be removed in a future version.
 */

/**
 * Check if API endpoints are available
 * @deprecated Use import.meta.env.HAS_API directly
 * @returns {Promise<boolean>} True if API is available, false otherwise
 */
export async function hasAPISupport() {
    // Now uses build-time constant instead of runtime detection
    // @ts-ignore - import.meta.env is defined by Vite
    return import.meta?.env?.HAS_API === true || import.meta?.env?.HAS_API === 'true';
}

/**
 * Get the current build mode
 * @deprecated Use import.meta.env.BUILD_MODE directly
 * @returns {Promise<'static' | 'server'>} The current build mode
 */
export async function getBuildMode() {
    // Now uses build-time constant
    // @ts-ignore - import.meta.env is defined by Vite
    return import.meta?.env?.BUILD_MODE || 'static';
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
 * @deprecated Use import.meta.env constants directly
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
 * Get cached build mode - no longer needs caching as it's a build constant
 * @deprecated Use import.meta.env.BUILD_MODE directly
 */
export async function getCachedBuildMode() {
    return getBuildMode();
}

/**
 * Clear all caches - no longer needed with build constants
 * @deprecated No longer needed with build-time constants
 */
export function clearBuildModeCache() {
    // No-op - caching is no longer needed with build-time constants
}