import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export async function loader({ request }: LoaderFunctionArgs) {
  const mapsDir = join(process.cwd(), "src", "scenes", "maps", "data");
  
  try {
    const files = await readdir(mapsDir);
    const mapFiles = files.filter(file => file.endsWith('.json'));
    
    const maps = await Promise.all(
      mapFiles.map(async (filename) => {
        try {
          const filePath = join(mapsDir, filename);
          const content = await readFile(filePath, 'utf-8');
          const stats = await stat(filePath);
          const mapData = JSON.parse(content);
          
          return {
            filename,
            title: mapData.title || mapData.metadata?.name || filename.replace('.json', ''),
            difficulty: mapData.difficulty || mapData.metadata?.difficulty || 1,
            lastModified: stats.mtime.toISOString()
          };
        } catch (error) {
          return {
            filename,
            title: filename.replace('.json', ''),
            difficulty: 1,
            lastModified: new Date().toISOString(),
            error: 'Failed to parse map data'
          };
        }
      })
    );
    
    return json({ maps });
  } catch (error) {
    return json({ maps: [], error: 'Failed to read maps directory' });
  }
}