// Central registry for all map data
// Uses Vite's import.meta.glob to dynamically import all map JSON files at build time

// Use Vite's glob import to get all map JSON files at build time
// This creates a single bundle with all maps included
const mapModules = import.meta.glob('/src/../levels/**/*.json', { 
    eager: true,  // Load all modules immediately
    import: 'default'  // Import the default export
});

// Import SVG files as URLs
const svgUrls = import.meta.glob('/src/../levels/**/*.svg', { 
    eager: true,
    query: '?url',
    import: 'default'
});

// Import SVG files as raw text for metadata extraction
const svgTexts = import.meta.glob('/src/../levels/**/*.svg', { 
    eager: true,
    query: '?raw',
    import: 'default'
});

// Helper function to extract metadata from SVG text using regex (client-safe, no jsdom)
function extractSvgMetadata(svgText, fallbackName) {
    let name = fallbackName;
    let description = '';
    
    try {
        // Simply grab the first <title> tag in the SVG - this is the correct one
        const titleMatch = svgText.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
            name = titleMatch[1].trim();
        }
        
        // For description, look in metadata > Work > description (this is working correctly)
        const metadataMatch = svgText.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/);
        
        if (metadataMatch) {
            const metadataContent = metadataMatch[1];
            
            // Look for cc:Work or Work element within metadata
            const workMatch = metadataContent.match(/<(?:cc:)?Work[^>]*>([\s\S]*?)<\/(?:cc:)?Work>/i);
            
            if (workMatch) {
                const workContent = workMatch[1];
                
                // Extract dc:description or description from within Work element
                const descMatch = workContent.match(/<(?:dc:)?description[^>]*>([^<]+)<\/(?:dc:)?description>/i);
                if (descMatch) {
                    description = descMatch[1].trim();
                }
            }
        }
        
        // Fallback to regular desc if no dc:description in Work
        if (!description) {
            const regularDescMatch = svgText.match(/<desc[^>]*>([^<]+)<\/desc>/);
            if (regularDescMatch) {
                description = regularDescMatch[1].trim();
            }
        }
    } catch (e) {
        console.warn('Failed to extract SVG metadata:', e);
    }
    
    return { name, description };
}

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

// Process SVG modules - same structure as JSON but with SVG-specific handling
const SVG_REGISTRY = {};
for (const path in svgUrls) {
    // Parse path like '/src/../levels/060-vector/010-tutorial.svg'
    const pathParts = path.split('/');
    const categoryFolder = pathParts[pathParts.length - 2]; // e.g., '060-vector'
    const filename = pathParts[pathParts.length - 1].replace('.svg', ''); // e.g., '010-tutorial'
    
    // Parse category info - same as JSON maps
    const categoryMatch = categoryFolder.match(/^(\d+)-(.+)$/);
    if (categoryMatch) {
        const categoryOrder = parseInt(categoryMatch[1]);
        const categoryName = categoryMatch[2];
        
        // Parse map info - same as JSON maps
        const mapMatch = filename.match(/^(\d+)-(.+)$/);
        const mapOrder = mapMatch ? parseInt(mapMatch[1]) : 999;
        const mapKey = mapMatch ? mapMatch[2] : filename;
        
        // Store SVG URL in registry
        SVG_REGISTRY[mapKey] = svgUrls[path];
        
        // Extract metadata from SVG text at build time
        const svgText = svgTexts[path];
        const fallbackName = mapKey.replace(/-/g, ' ');
        const { name, description } = extractSvgMetadata(svgText, fallbackName);
        
        // Create SVG map data structure with extracted metadata
        const svgMapData = {
            type: 'svg',
            svgPath: svgUrls[path],
            metadata: {
                name: name,
                description: description,
                category: categoryName,
                difficulty: 1
            }
        };
        
        // Store in flat registry with simplified key - same as JSON
        STATIC_MAP_REGISTRY[mapKey] = svgMapData;
        
        // Build category structure - same as JSON
        if (!CATEGORY_REGISTRY[categoryName]) {
            CATEGORY_REGISTRY[categoryName] = {
                name: categoryName,
                displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1).replace(/-/g, ' '),
                order: categoryOrder,
                maps: []
            };
        }
        
        // Add map to category - same as JSON
        CATEGORY_REGISTRY[categoryName].maps.push({
            key: mapKey,
            order: mapOrder,
            filename: filename,
            isSvg: true,
            svgUrl: svgUrls[path],
            mapData: svgMapData
        });
    } else {
        // Fallback for non-categorized SVG maps
        const mapKey = filename;
        SVG_REGISTRY[mapKey] = svgUrls[path];
        
        // Extract metadata from SVG text at build time
        const svgText = svgTexts[path];
        const fallbackName = filename.replace(/-/g, ' ');
        const { name, description } = extractSvgMetadata(svgText, fallbackName);
        
        STATIC_MAP_REGISTRY[mapKey] = {
            type: 'svg',
            svgPath: svgUrls[path],
            metadata: {
                name: name,
                description: description,
                category: 'uncategorized',
                difficulty: 1
            }
        };
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
    // Get all maps in order from all categories
    const orderedKeys = [];
    
    // Get categories in order
    const categories = Object.values(CATEGORY_REGISTRY).sort((a, b) => a.order - b.order);
    
    // For each category, add the map keys in order
    categories.forEach(category => {
        // Maps are already sorted within each category
        category.maps.forEach(map => {
            orderedKeys.push(map.key);
        });
    });
    
    return orderedKeys;
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
    // Clean up the map key - remove extensions if present
    const cleanMapKey = mapKey.replace(/\.(json|svg)$/i, '');
    
    // Get from the unified registry
    const mapData = STATIC_MAP_REGISTRY[cleanMapKey];
    
    if (!mapData) {
        console.error(`No map data found for key: ${cleanMapKey}`);
        return null;
    }
    
    return mapData;
}

// Synchronous version for immediate access (useful for Phaser scenes)
export function loadMapDataSync(mapKey) {
    const cleanMapKey = mapKey.replace(/\.(json|svg)$/i, '');
    
    // Get from the unified registry
    return STATIC_MAP_REGISTRY[cleanMapKey] || null;
}

// Export the registry for direct access if needed
export { STATIC_MAP_REGISTRY };
