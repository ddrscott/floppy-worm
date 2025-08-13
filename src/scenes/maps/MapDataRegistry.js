// Central registry for all map data
// Uses Vite's import.meta.glob to dynamically import all map JSON files at build time

// Use Vite's glob import to get all map JSON files at build time
// This creates a single bundle with all maps included
const mapModules = import.meta.glob('/src/../levels/**/*.json', { 
    eager: true,  // Load all modules immediately
    import: 'default'  // Import the default export
});

// Build the static registry from the glob imports
const STATIC_MAP_REGISTRY = {};
const CATEGORY_REGISTRY = {};

// Process all imported modules
for (const path in mapModules) {
    // Parse path like '/src/../levels/010-tutorial/001-Left.json'
    const pathParts = path.split('/');
    const categoryFolder = pathParts[pathParts.length - 2]; // e.g., '010-tutorial'
    const filename = pathParts[pathParts.length - 1].replace('.json', ''); // e.g., '001-Left'
    
    // Parse category info
    const categoryMatch = categoryFolder.match(/^(\d+)-(.+)$/);
    if (categoryMatch) {
        const categoryOrder = parseInt(categoryMatch[1]);
        const categoryName = categoryMatch[2];
        
        // Parse map info
        const mapMatch = filename.match(/^(\d+)-(.+)$/);
        const mapOrder = mapMatch ? parseInt(mapMatch[1]) : 999;
        const mapKey = mapMatch ? mapMatch[2] : filename;
        
        // Store in flat registry with simplified key
        STATIC_MAP_REGISTRY[mapKey] = mapModules[path];
        
        // Build category structure
        if (!CATEGORY_REGISTRY[categoryName]) {
            CATEGORY_REGISTRY[categoryName] = {
                name: categoryName,
                displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1).replace(/-/g, ' '),
                order: categoryOrder,
                maps: []
            };
        }
        
        // Add map to category
        CATEGORY_REGISTRY[categoryName].maps.push({
            key: mapKey,
            order: mapOrder,
            filename: filename,
            mapData: mapModules[path]
        });
    } else {
        // Fallback for non-categorized maps
        const mapKey = filename;
        STATIC_MAP_REGISTRY[mapKey] = mapModules[path];
    }
}

// Sort maps within each category
Object.values(CATEGORY_REGISTRY).forEach(category => {
    category.maps.sort((a, b) => {
        // First sort by order number
        if (a.order !== b.order) {
            return a.order - b.order;
        }
        // Then by filename
        return a.filename.localeCompare(b.filename);
    });
});

// Get all categories sorted by order
export function getCategories() {
    const categories = Object.values(CATEGORY_REGISTRY).sort((a, b) => a.order - b.order);
    
    // Return category objects with a getMaps method
    return categories.map(cat => ({
        name: cat.name,
        displayName: cat.displayName,
        order: cat.order,
        getMaps: () => cat.maps.map(m => ({
            key: m.key,
            title: m.mapData.metadata?.name || m.key,
            difficulty: m.mapData.metadata?.difficulty || 1,
            description: m.mapData.metadata?.description || '',
            mapData: m.mapData
        }))
    }));
}

// Get maps for a specific category
export function getCategoryMaps(categoryName) {
    const category = CATEGORY_REGISTRY[categoryName];
    if (!category) return [];
    
    return category.maps.map(m => ({
        key: m.key,
        title: m.mapData.metadata?.name || m.key,
        difficulty: m.mapData.metadata?.difficulty || 1,
        description: m.mapData.metadata?.description || '',
        mapData: m.mapData
    }));
}

// Helper function to load map metadata (backwards compatibility)
export function loadMapMetadata() {
    const maps = [];
    
    // Collect all maps from all categories
    Object.values(CATEGORY_REGISTRY).forEach(category => {
        category.maps.forEach(mapInfo => {
            const mapData = mapInfo.mapData;
            try {
                maps.push({
                    key: mapInfo.key,
                    title: mapData.metadata?.name || mapInfo.key,
                    difficulty: mapData.metadata?.difficulty || 1,
                    description: mapData.metadata?.description || '',
                    category: category.name,
                    mapData: mapData
                });
            } catch (error) {
                console.warn(`Failed to process map data for key ${mapInfo.key}:`, error);
            }
        });
    });
    
    return maps;
}

// Helper function to get ordered map keys
export function getMapKeys() {
    return Object.keys(STATIC_MAP_REGISTRY);
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