import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const { filename } = params;
  
  if (!filename) {
    throw new Response("Filename is required", { status: 400 });
  }
  
  const formData = await request.formData();
  const mapDataString = formData.get("mapData");
  
  if (typeof mapDataString !== "string") {
    throw new Response("Invalid map data", { status: 400 });
  }
  
  try {
    // Validate JSON before saving
    const mapData = JSON.parse(mapDataString);
    
    const mapPath = join(process.cwd(), "src", "scenes", "maps", "data", filename);
    await writeFile(mapPath, JSON.stringify(mapData, null, 2));
    
    return json({ success: true, message: "Map saved successfully" });
  } catch (error) {
    console.error("Failed to save map:", error);
    return json({ success: false, error: "Failed to save map data" }, { status: 500 });
  }
}