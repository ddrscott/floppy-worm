import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export async function loader({ params }: LoaderFunctionArgs) {
  const { filename } = params;
  
  if (!filename) {
    throw new Response("Filename is required", { status: 400 });
  }
  
  // Ensure filename has .json extension
  const fileWithExt = filename.endsWith('.json') ? filename : `${filename}.json`;
  const mapPath = join(process.cwd(), "src", "scenes", "maps", "data", fileWithExt);
  
  try {
    const content = await readFile(mapPath, 'utf-8');
    const mapData = JSON.parse(content);
    
    return json({ mapData, filename });
  } catch (error) {
    console.error(`Failed to load map ${filename}:`, error);
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
  
  // Ensure filename has .json extension
  const fileWithExt = filename.endsWith('.json') ? filename : `${filename}.json`;
  const mapPath = join(process.cwd(), "src", "scenes", "maps", "data", fileWithExt);
  
  try {
    const formData = await request.formData();
    const mapDataString = formData.get("mapData");
    
    if (!mapDataString || typeof mapDataString !== "string") {
      throw new Response("Invalid map data", { status: 400 });
    }
    
    // Validate JSON
    const mapData = JSON.parse(mapDataString);
    
    // Write the file with pretty formatting
    await writeFile(mapPath, JSON.stringify(mapData, null, 2), 'utf-8');
    
    return json({ success: true, filename });
  } catch (error) {
    console.error(`Failed to save map ${filename}:`, error);
    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON data" }, { status: 400 });
    }
    return json({ error: "Failed to save map" }, { status: 500 });
  }
}