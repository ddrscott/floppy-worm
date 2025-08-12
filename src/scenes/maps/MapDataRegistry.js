// Central registry for all map data
// Uses Vite's import.meta.glob to dynamically import all map JSON files at build time

// Use Vite's glob import to get all map JSON files at build time
// This creates a single bundle with all maps included
const mapModules = import.meta.glob('./data/*.json', { 
    eager: true,  // Load all modules immediately
    import: 'default'  // Import the default export
});

// Build the static registry from the glob imports
const STATIC_MAP_REGISTRY = {};

// Process all imported modules
for (const path in mapModules) {
    // Extract filename without extension from path like './data/Map001.json'
    const filename = path.split('/').pop().replace('.json', '');
    STATIC_MAP_REGISTRY[filename] = mapModules[path];
}

// No caching needed - all data is loaded at build time via import.meta.glob

// Helper function to load map metadata
export function loadMapMetadata() {
    const maps = [];
    
    Object.entries(STATIC_MAP_REGISTRY).forEach(([key, mapData]) => {
        try {
            maps.push({
                key: key,
                title: mapData.metadata.name,
                difficulty: mapData.metadata.difficulty,
                description: mapData.metadata.description,
                mapData: mapData
            });
        } catch (error) {
            console.warn(`Failed to process map data for key ${key}:`, error);
        }
    });
    
    // Sort maps by key to ensure consistent ordering
    maps.sort((a, b) => {
        // Extract numeric part for proper sorting (Map001, Map002, etc.)
        const numA = parseInt(a.key.replace(/\D/g, '')) || 999;
        const numB = parseInt(b.key.replace(/\D/g, '')) || 999;
        return numA - numB;
    });
    
    return maps;
}

// Helper function to get ordered map keys
export function getMapKeys() {
    const mapKeys = Object.keys(STATIC_MAP_REGISTRY);
    
    // Sort by numeric order
    mapKeys.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 999;
        const numB = parseInt(b.replace(/\D/g, '')) || 999;
        return numA - numB;
    });
    
    return mapKeys;
}

// Helper function to create scene class for a given map
export async function createMapScene(key) {
    const mapData = STATIC_MAP_REGISTRY[key];
    
    if (!mapData) {
        console.error(`No map data found for key: ${key}`);
        return null;
    }
    
    // Use MapLoader to create the scene
    const { default: MapLoader } = await import('../../services/MapLoader');
    return MapLoader.createMapScene(key, mapData);
}

// Helper function to load map data
export function loadMapData(mapKey) {
    // Clean up the map key - remove .json extension if present
    const cleanMapKey = mapKey.replace(/\.json$/i, '');
    const mapData = STATIC_MAP_REGISTRY[cleanMapKey];
    
    if (!mapData) {
        console.error(`No map data found for key: ${cleanMapKey}`);
        return null;
    }
    
    return mapData;
}

// Synchronous version for immediate access (useful for Phaser scenes)
export function loadMapDataSync(mapKey) {
    const cleanMapKey = mapKey.replace(/\.json$/i, '');
    return STATIC_MAP_REGISTRY[cleanMapKey] || null;
}

// Export the registry for direct access if needed
export { STATIC_MAP_REGISTRY };
