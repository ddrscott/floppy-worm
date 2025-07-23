// Central registry for all map data
// Add new JSON files here and they will automatically appear in the map selection

import Map001Data from './data/Map001.json';
import Map002Data from './data/Map002.json';
import SwingMapData from './data/SwingMap.json';
import JsonMapScene from '../JsonMapScene';

// Map registry with key -> data mappings
export const MAP_DATA_REGISTRY = {
    'Map001': Map001Data,
    'Map002': Map002Data,
    'Swinger': SwingMapData,
};

// Helper function to load map metadata
export function loadMapMetadata() {
    const maps = [];
    
    Object.entries(MAP_DATA_REGISTRY).forEach(([key, mapData]) => {
        try {
            maps.push({
                key: key,
                title: mapData.metadata.name,
                difficulty: mapData.metadata.difficulty,
                description: mapData.metadata.description,
                mapData: mapData
            });
        } catch (error) {
            console.warn(`Failed to load map data for key ${key}:`, error);
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
    const mapKeys = Object.keys(MAP_DATA_REGISTRY);
    
    // Sort by numeric order
    mapKeys.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 999;
        const numB = parseInt(b.replace(/\D/g, '')) || 999;
        return numA - numB;
    });
    
    return mapKeys;
}

// Helper function to create scene class for a given map
export function createMapScene(key) {
    const mapData = MAP_DATA_REGISTRY[key];
    if (!mapData) {
        console.error(`No map data found for key: ${key}`);
        return null;
    }
    
    return JsonMapScene.create(key, mapData);
}