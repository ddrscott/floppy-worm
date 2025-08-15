import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { loadMapDataSync } from "/src/scenes/maps/MapDataRegistry";

export async function loader({ params }: LoaderFunctionArgs) {
  const { filename } = params;
  
  if (!filename) {
    throw new Response("Filename is required", { status: 400 });
  }
  
  // Handle paths with category folders (e.g., "010-tutorial/001-Left.json")
  // The filename parameter will be URL encoded, so decode it
  const decodedPath = decodeURIComponent(filename);
  
  // First, try to load from MapDataRegistry (includes SVG maps processed at build time)
  const registryData = loadMapDataSync(decodedPath);
  if (registryData) {
    // For SVG maps, the data is already processed
    if (registryData.type === 'svg') {
      return json({ 
        mapData: registryData,
        filename: decodedPath,
        isSvg: true 
      });
    }
    // For JSON maps from registry
    return json({ 
      mapData: registryData,
      filename: decodedPath 
    });
  }
  
  // If not in registry, try loading JSON file directly (backwards compatibility)
  // Ensure filename has .json extension
  const fileWithExt = decodedPath.endsWith('.json') ? decodedPath : `${decodedPath}.json`;
  
  // Support both old path (src/scenes/maps/data) and new path (levels)
  const newPath = join(process.cwd(), "levels", fileWithExt);
  const oldPath = join(process.cwd(), "src", "scenes", "maps", "data", fileWithExt);
  
  // Try new path first, then fall back to old path
  let mapPath = existsSync(newPath) ? newPath : oldPath;
  
  try {
    const content = await readFile(mapPath, 'utf-8');
    const mapData = JSON.parse(content);
    
    return json({ mapData, filename: decodedPath });
  } catch (error) {
    console.error(`Failed to load map ${decodedPath}:`, error);
    return json({ error: "Map not found" }, { status: 404 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { filename } = params;
  
  if (!filename) {
    throw new Response("Filename is required", { status: 400 });
  }
  
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }
  
  // Handle paths with category folders
  const decodedPath = decodeURIComponent(filename);
  
  // Ensure filename has .json extension
  const fileWithExt = decodedPath.endsWith('.json') ? decodedPath : `${decodedPath}.json`;
  
  // Always save to new levels directory
  const mapPath = join(process.cwd(), "levels", fileWithExt);
  
  try {
    const formData = await request.formData();
    const mapDataString = formData.get("mapData");
    
    if (!mapDataString || typeof mapDataString !== "string") {
      throw new Response("Invalid map data", { status: 400 });
    }
    
    // Validate JSON
    const mapData = JSON.parse(mapDataString);
    
    // Ensure directory exists
    const dir = dirname(mapPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    // Write the file with pretty formatting
    await writeFile(mapPath, JSON.stringify(mapData, null, 2), 'utf-8');
    
    return json({ success: true, filename: decodedPath });
  } catch (error) {
    console.error(`Failed to save map ${decodedPath}:`, error);
    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON data" }, { status: 400 });
    }
    return json({ error: "Failed to save map" }, { status: 500 });
  }
}