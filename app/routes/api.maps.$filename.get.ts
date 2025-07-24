import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readFile } from "fs/promises";
import { join } from "path";

export async function loader({ params }: LoaderFunctionArgs) {
  const { filename } = params;
  
  if (!filename) {
    throw new Response("Filename is required", { status: 400 });
  }
  
  const mapPath = join(process.cwd(), "src", "scenes", "maps", "data", filename);
  
  try {
    const content = await readFile(mapPath, 'utf-8');
    const mapData = JSON.parse(content);
    
    return json({ mapData, filename });
  } catch (error) {
    console.error(`Failed to load map ${filename}:`, error);
    return json({ error: "Map not found" }, { status: 404 });
  }
}