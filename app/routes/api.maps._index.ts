import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { getCategories } from "/src/scenes/maps/MapDataRegistry";

interface MapInfo {
  filename: string;
  category: string;
  categoryOrder: string;
  title: string;
  difficulty: number;
  lastModified: string;
  relativePath: string;
  error?: string;
  mapData?: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if client wants full data
  const url = new URL(request.url);
  const includeFullData = url.searchParams.get('fullData') === 'true';
  
  try {
    // Get all categories and maps from the MapDataRegistry
    // This includes both JSON and SVG maps processed at build time
    const categories = getCategories();
    const maps: MapInfo[] = [];
    
    // Process each category
    for (const category of categories) {
      const categoryMaps = category.getMaps();
      
      // Process each map in the category
      for (const map of categoryMaps) {
        const baseInfo: MapInfo = {
          filename: map.key,
          category: category.name,
          categoryOrder: category.order.toString().padStart(3, '0'),
          title: map.title,
          difficulty: map.difficulty,
          lastModified: new Date().toISOString(), // Build-time processed, so use current time
          relativePath: `${category.name}/${map.key}`
        };
        
        // Include full map data if requested
        if (includeFullData) {
          baseInfo.mapData = map.mapData;
        }
        
        maps.push(baseInfo);
      }
    }
    
    // Maps are already sorted by the MapDataRegistry
    
    return json({ maps });
  } catch (error) {
    console.error('Failed to load maps from registry:', error);
    return json({ maps: [], error: 'Failed to load maps from registry' });
  }
}