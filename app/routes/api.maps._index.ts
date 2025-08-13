import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";

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
  const levelsDir = join(process.cwd(), "levels");
  
  // Check if client wants full data
  const url = new URL(request.url);
  const includeFullData = url.searchParams.get('fullData') === 'true';
  
  try {
    // Read all category directories
    const categories = await readdir(levelsDir);
    const maps: MapInfo[] = [];
    
    // Process each category directory
    for (const category of categories) {
      const categoryPath = join(levelsDir, category);
      const stats = await stat(categoryPath);
      
      if (stats.isDirectory()) {
        // Extract category order and name (e.g., "010-tutorial" -> order: "010", name: "tutorial")
        const match = category.match(/^(\d+)-(.+)$/);
        const categoryOrder = match ? match[1] : "999";
        const categoryName = match ? match[2] : category;
        
        // Read all JSON files in the category
        const files = await readdir(categoryPath);
        const mapFiles = files.filter(file => file.endsWith('.json'));
        
        // Process each map file
        for (const filename of mapFiles) {
          try {
            const filePath = join(categoryPath, filename);
            const content = await readFile(filePath, 'utf-8');
            const fileStats = await stat(filePath);
            const mapData = JSON.parse(content);
            
            // Extract map order from filename if it has numeric prefix
            const fileMatch = filename.match(/^(\d+)-(.+)\.json$/);
            const mapOrder = fileMatch ? fileMatch[1] : "999";
            const mapName = fileMatch ? fileMatch[2] : filename.replace('.json', '');
            
            const baseInfo: MapInfo = {
              filename,
              category: categoryName,
              categoryOrder,
              title: mapData.title || mapData.metadata?.name || mapName.replace(/-/g, ' '),
              difficulty: mapData.difficulty || mapData.metadata?.difficulty || 1,
              lastModified: fileStats.mtime.toISOString(),
              relativePath: `${category}/${filename}`
            };
            
            // Include full map data if requested
            if (includeFullData) {
              baseInfo.mapData = mapData;
            }
            
            maps.push(baseInfo);
          } catch (error) {
            maps.push({
              filename,
              category: categoryName,
              categoryOrder,
              title: filename.replace('.json', '').replace(/-/g, ' '),
              difficulty: 1,
              lastModified: new Date().toISOString(),
              relativePath: `${category}/${filename}`,
              error: 'Failed to parse map data'
            });
          }
        }
      }
    }
    
    // Sort maps by category order, then by filename
    maps.sort((a, b) => {
      // First sort by category order
      const categoryCompare = a.categoryOrder.localeCompare(b.categoryOrder);
      if (categoryCompare !== 0) return categoryCompare;
      
      // Then by filename (which may have numeric prefixes)
      const aNum = parseInt(a.filename.replace(/\D/g, '')) || 999;
      const bNum = parseInt(b.filename.replace(/\D/g, '')) || 999;
      if (aNum !== bNum) return aNum - bNum;
      
      // Fallback to alphabetical
      return a.filename.localeCompare(b.filename);
    });
    
    return json({ maps });
  } catch (error) {
    console.error('Failed to read levels directory:', error);
    return json({ maps: [], error: 'Failed to read levels directory' });
  }
}