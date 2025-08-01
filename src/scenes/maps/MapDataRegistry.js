// Central registry for all map data
// Uses dynamic loading in development, static imports in production

// Static imports for production builds
import Map001Data from './data/Map001.json';
import Map002Data from './data/Map002.json';
import Map003Data from './data/Map003.json';
import Map004Data from './data/Map004.json';
import SwingMapData from './data/Swing.json';
import TowerData from './data/Tower.json';
import MiniTower from './data/Mini-Tower-005.json';
import TryAnglesData from './data/Try-angles.json';
import Electric from './data/Electric-Slide.json';
import Morgan from './data/Morgan.json';
import PendulumTest from './data/Pendulum-Test.json';
import BlackholeTest from './data/blackhole-test.json';
import SimpleMoves from './data/simple-moves.json';
import SlopeRun from './data/Slope-Run.json';


// Static registry for production
const STATIC_MAP_REGISTRY = {
    'Map001': Map001Data,
    'Map002': Map002Data,
    'Map003': Map003Data,
    'Map004': Map004Data,
    'Swing': SwingMapData,
    'Tower': TowerData,
    'Mini-Tower': MiniTower,
    'Try-angles': TryAnglesData,
    'Electric-Slide': Electric,
    'Morgan': Morgan,
    'Pendulum-Test': PendulumTest,
    'blackhole-test': BlackholeTest,
    'simple-moves': SimpleMoves,
    'Slope-Run': SlopeRun
};

import { hasAPISupport } from '../../utils/buildMode';

// Dynamic map discovery - no need for hardcoded lists when API is available

// Cache for loaded map data
let mapDataCache = null;

// Helper function to load all map data (hybrid approach)
async function loadAllMapData() {
    if (mapDataCache) {
        return mapDataCache;
    }
    
    let mapData = {};
    
    // Check if API is available
    const apiAvailable = await hasAPISupport();
    
    if (apiAvailable) {
        // Load dynamically via API when available
        try {
            // First, get the list of all maps
            const listResponse = await fetch('/api/maps');
            if (listResponse.ok) {
                const listResult = await listResponse.json();
                if (listResult.maps) {
                    // Load each map's data
                    for (const mapInfo of listResult.maps) {
                        const key = mapInfo.filename.replace('.json', '');
                        try {
                            const response = await fetch(`/api/maps/${mapInfo.filename}`);
                            if (response.ok) {
                                const result = await response.json();
                                if (result.mapData) {
                                    mapData[key] = result.mapData;
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to load ${mapInfo.filename}:`, error);
                            // Fallback to static data if available
                            if (STATIC_MAP_REGISTRY[key]) {
                                mapData[key] = STATIC_MAP_REGISTRY[key];
                            }
                        }
                    }
                }
            } else {
                console.warn('Failed to list maps, falling back to static registry');
                mapData = STATIC_MAP_REGISTRY;
            }
        } catch (error) {
            console.warn('Failed to load maps from API, falling back to static registry:', error);
            mapData = STATIC_MAP_REGISTRY;
        }
    } else {
        // No API available: Use static imports (bundled at build time)
        console.log('Using static map registry (no API available)');
        mapData = STATIC_MAP_REGISTRY;
    }
    
    mapDataCache = mapData;
    return mapData;
}

// Helper function to load map metadata
export async function loadMapMetadata() {
    const maps = [];
    const mapDataRegistry = await loadAllMapData();
    
    Object.entries(mapDataRegistry).forEach(([key, mapData]) => {
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
export async function getMapKeys() {
    const mapDataRegistry = await loadAllMapData();
    const mapKeys = Object.keys(mapDataRegistry);
    
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
    const mapDataRegistry = await loadAllMapData();
    const mapData = mapDataRegistry[key];
    
    if (!mapData) {
        console.error(`No map data found for key: ${key}`);
        return null;
    }
    
    // Use MapLoader to create the scene
    const { default: MapLoader } = await import('../../services/MapLoader');
    return MapLoader.createMapScene(key, mapData);
}

// Helper function to load map data
export async function loadMapData(mapKey) {
    // Clean up the map key - remove .json extension if present
    const cleanMapKey = mapKey.replace(/\.json$/i, '');
    
    const mapDataRegistry = await loadAllMapData();
    const mapData = mapDataRegistry[cleanMapKey];
    
    if (!mapData) {
        console.error(`No map data found for key: ${cleanMapKey}`);
        return null;
    }
    
    return mapData;
}

// Helper function to clear the cache (useful when maps are updated in development)
export function clearMapCache() {
    // For now, always allow cache clearing since we don't have a reliable isDevelopment check
    mapDataCache = null;
    console.log('Map cache cleared - next load will fetch fresh data');
}
