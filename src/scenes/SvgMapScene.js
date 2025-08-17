import JsonMapBase from './JsonMapBase';
import SvgPathParser from '../utils/SvgPathParser';

/**
 * SVG Map Scene - Loads and parses SVG files as game maps
 * Extends JsonMapBase to maintain compatibility with existing map system
 */
export default class SvgMapScene extends JsonMapBase {
    constructor(config = {}) {
        super(config);
        
        this.svgPath = config.svgPath || null;
        this.svgContent = null;
        this.svgDoc = null;
    }
    
    preload() {
        super.preload();
        
        if (this.svgPath) {
            // Create a unique cache key based on the SVG path to avoid caching issues
            this.svgCacheKey = 'svg_' + this.svgPath.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Clear any existing cached version of this SVG
            if (this.cache.text.exists(this.svgCacheKey)) {
                this.cache.text.remove(this.svgCacheKey);
            }
            
            // Load SVG as text with unique key
            this.load.text(this.svgCacheKey, this.svgPath);
        }
    }
    
    create() {
        // If we have an SVG path, load and parse it
        if (this.svgPath && this.svgCacheKey) {
            const svgText = this.cache.text.get(this.svgCacheKey);
            if (svgText) {
                this.parseSvgToMapData(svgText);
            }
        }
        
        // Call parent create which will use our parsed mapData
        super.create();
    }
    
    /**
     * Parse SVG text into mapData format compatible with JsonMapBase
     */
    parseSvgToMapData(svgText) {
        // Parse SVG string to DOM
        const parser = new DOMParser();
        this.svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        
        // Check for parse errors
        const parseError = this.svgDoc.querySelector('parsererror');
        if (parseError) {
            console.error('SVG Parse Error:', parseError.textContent);
            return;
        }
        
        const svg = this.svgDoc.documentElement;
        
        // Extract world dimensions from viewBox
        const viewBox = svg.viewBox.baseVal;
        const width = viewBox.width || 1920;
        const height = viewBox.height || 1080;
        
        // Initialize mapData structure
        const metadata = this.extractMetadata(svg);
        console.log('Extracted SVG metadata:', metadata);
        
        this.mapData = {
            metadata: metadata,
            dimensions: {
                width: width,
                height: height
            },
            entities: this.extractEntities(svg),
            platforms: this.extractPlatforms(svg),
            stickers: this.extractStickers(svg),
            constraints: [] // Not implemented yet
        };
        
        console.log('Parsed SVG map data:', this.mapData);
    }
    
    /**
     * Extract metadata from SVG
     */
    extractMetadata(svg) {
        // First try to get dc:title and dc:description from metadata
        let mapName = null;
        let mapDescription = null;
        
        // Look for Dublin Core metadata
        const metadata = this.svgDoc.querySelector('metadata');
        if (metadata) {
            // Try to find dc:title
            const dcTitle = metadata.querySelector('Work > title');
            mapName = dcTitle?.textContent?.trim();
            
            // Try to find dc:description
            const dcDesc = metadata.querySelector('Work > description');
            mapDescription = dcDesc?.textContent?.trim();
        }
        
        // Fallback to regular title and desc elements if no metadata found
        if (!mapName) {
            const title = svg.querySelector('title');
            mapName = title?.textContent?.trim() || 'Untitled SVG Map';
        }

        return {
            name: mapName,
            description: mapDescription,
            difficulty: 1,
            category: 'svg',
            modified: new Date().toISOString()
        };
    }
    
    /**
     * Extract entities (worm start, goals) from SVG
     */
    extractEntities(svg) {
        const entities = {};
        
        // Find worm start position
        const wormStart = svg.querySelector('.worm-start');
        if (wormStart) {
            const pos = this.getElementPosition(wormStart);
            entities.wormStart = { x: pos.x, y: pos.y };
        } else {
            // Default position if not found
            entities.wormStart = { x: 100, y: 100 };
            console.warn('No worm-start found in SVG, using default position');
        }
        
        // Find goals (support multiple goals)
        const goals = svg.querySelectorAll('.goal');
        console.log(`Found ${goals.length} goals in SVG`);
        
        if (goals.length === 1) {
            // Single goal - use traditional format
            const pos = this.getElementPosition(goals[0]);
            entities.goal = { x: pos.x, y: pos.y };
        } else if (goals.length > 1) {
            // Multiple goals - store as array
            entities.goals = Array.from(goals).map((goal, index) => {
                const pos = this.getElementPosition(goal);
                console.log(`Goal ${index + 1}: x=${pos.x}, y=${pos.y}`);
                return { 
                    x: pos.x, 
                    y: pos.y
                };
            });
            // Also set primary goal for compatibility
            const primaryPos = this.getElementPosition(goals[0]);
            entities.goal = { x: primaryPos.x, y: primaryPos.y };
            console.log(`Created ${entities.goals.length} goals in entities.goals`);
        } else {
            // Default goal if not found
            entities.goal = { x: 1800, y: 540 };
            console.warn('No goal found in SVG, using default position');
        }
        
        return entities;
    }
    
    /**
     * Extract platforms from SVG
     */
    extractPlatforms(svg) {
        const platforms = [];
        
        // Find all elements with platform class (including those in groups)
        const platformElements = this.findPlatformElements(svg);
        
        platformElements.forEach(element => {
            const platform = this.parseElementToPlatform(element);
            if (platform) {
                platforms.push(platform);
            }
        });
        
        return platforms;
    }
    
    /**
     * Find all platform elements, including those that inherit from groups
     */
    findPlatformElements(svg) {
        const platforms = [];
        
        // Direct platform elements
        const directPlatforms = svg.querySelectorAll('.platform');
        platforms.push(...Array.from(directPlatforms));
        
        // Elements inside platform groups
        const platformGroups = svg.querySelectorAll('g.platform');
        platformGroups.forEach(group => {
            // Get all shape elements inside the group
            const shapes = group.querySelectorAll('rect, circle, ellipse, polygon, path');
            shapes.forEach(shape => {
                // Mark that this inherits from a platform group
                shape._platformGroup = group;
                platforms.push(shape);
            });
        });
        
        return platforms;
    }
    
    /**
     * Parse an SVG element into a platform object
     */
    parseElementToPlatform(element) {
        const tagName = element.tagName.toLowerCase();
        let platform = null;
        
        switch (tagName) {
            case 'rect':
                platform = this.parseRectangle(element);
                break;
            case 'circle':
                platform = this.parseCircle(element);
                break;
            case 'ellipse':
                platform = this.parseEllipse(element);
                break;
            case 'polygon':
                platform = this.parsePolygon(element);
                break;
            case 'path':
                platform = this.parsePath(element);
                break;
            case 'line':
                // Lines might be constraints in the future
                console.log('Line elements not yet supported for platforms');
                break;
            default:
                console.warn(`Unknown platform element type: ${tagName}`);
        }
        
        if (platform) {
            // Store the original position before transformation
            platform.originalX = platform.x;
            platform.originalY = platform.y;
            
            // Add common properties (including transform handling)
            this.addCommonPlatformProperties(platform, element);
        }
        
        return platform;
    }
    
    /**
     * Parse rectangle element
     */
    parseRectangle(element) {
        const x = parseFloat(element.getAttribute('x') || 0);
        const y = parseFloat(element.getAttribute('y') || 0);
        const width = parseFloat(element.getAttribute('width') || 100);
        const height = parseFloat(element.getAttribute('height') || 50);
        
        // Rectangle x,y is top-left, but we need center
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        const platform = {
            type: 'rectangle',
            x: centerX,
            y: centerY,
            width: width,
            height: height,
            // Store original SVG rectangle data for transform calculations
            svgRect: { x, y, width, height }
        };
        
        // Handle rounded corners (rx/ry) as chamfer
        const rx = parseFloat(element.getAttribute('rx') || 0);
        const ry = parseFloat(element.getAttribute('ry') || 0);
        
        if (rx > 0 || ry > 0) {
            // Use the larger of rx/ry for uniform chamfer radius
            // (Matter.js doesn't support different x/y corner radii)
            const radius = Math.max(rx, ry);
            
            // Add chamfer to platform
            platform.chamfer = {
                radius: radius
            };
            
            // Also add to physics for JsonMapBase compatibility
            if (!platform.physics) {
                platform.physics = {};
            }
            platform.physics.chamfer = {
                radius: radius
            };
        }
        
        return platform;
    }
    
    /**
     * Parse circle element
     */
    parseCircle(element) {
        const cx = parseFloat(element.getAttribute('cx') || 0);
        const cy = parseFloat(element.getAttribute('cy') || 0);
        const r = parseFloat(element.getAttribute('r') || 50);
        
        return {
            type: 'circle',
            x: cx,
            y: cy,
            radius: r
        };
    }
    
    /**
     * Parse ellipse element
     */
    parseEllipse(element) {
        const cx = parseFloat(element.getAttribute('cx') || 0);
        const cy = parseFloat(element.getAttribute('cy') || 0);
        const rx = parseFloat(element.getAttribute('rx') || 50);
        const ry = parseFloat(element.getAttribute('ry') || 30);
        
        // Convert ellipse to circle using average radius
        // (Future: could support true ellipses with custom physics body)
        const avgRadius = (rx + ry) / 2;
        
        return {
            type: 'circle',
            x: cx,
            y: cy,
            radius: avgRadius
        };
    }
    
    /**
     * Parse polygon element
     */
    parsePolygon(element) {
        const pointsStr = element.getAttribute('points') || '';
        const points = this.parsePoints(pointsStr);
        
        if (points.length < 3) {
            console.warn('Polygon must have at least 3 points');
            return null;
        }
        
        // Calculate center
        const center = this.calculateCentroid(points);
        
        // Convert to vertices relative to center
        const vertices = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));
        
        return {
            type: 'custom',
            x: center.x,
            y: center.y,
            vertices: vertices
        };
    }
    
    /**
     * Parse path element
     */
    parsePath(element) {
        const d = element.getAttribute('d') || '';
        const collisionMode = element.dataset.collision || 'bbox';
        
        if (collisionMode === 'bbox') {
            // Use bounding box as rectangle
            const bbox = element.getBBox ? element.getBBox() : this.estimatePathBounds(d);
            return {
                type: 'rectangle',
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2,
                width: bbox.width,
                height: bbox.height
            };
        } else if (collisionMode.startsWith('sample:')) {
            // Sample points along path
            const sampleCount = parseInt(collisionMode.split(':')[1]) || 20;
            const points = SvgPathParser.pathToPoints(d, sampleCount);
            
            if (points.length < 3) {
                console.warn('Path has too few points for polygon');
                return null;
            }
            
            // Simplify polygon to remove redundant points
            const simplified = SvgPathParser.simplifyPolygon(points);
            
            // Calculate center
            const center = this.calculateCentroid(simplified);
            
            // Convert to vertices relative to center
            const vertices = simplified.map(p => ({
                x: p.x - center.x,
                y: p.y - center.y
            }));
            
            return {
                type: 'custom',
                x: center.x,
                y: center.y,
                vertices: vertices
            };
        } else if (collisionMode === 'hull') {
            // Convex hull mode - sample then create hull
            const points = SvgPathParser.pathToPoints(d, 30);
            // For now, just use the points as-is
            // TODO: Implement convex hull algorithm
            
            const center = this.calculateCentroid(points);
            const vertices = points.map(p => ({
                x: p.x - center.x,
                y: p.y - center.y
            }));
            
            return {
                type: 'custom',
                x: center.x,
                y: center.y,
                vertices: vertices
            };
        }
        
        return null;
    }
    
    /**
     * Add common platform properties from element attributes and classes
     */
    addCommonPlatformProperties(platform, element) {
        // Get effective classes (from element and parent groups)
        const classes = this.getEffectiveClasses(element);
        
        // Detect platform type from classes
        platform.platformType = this.detectPlatformType(classes);
        
        // Parse color from fill attribute
        const fill = element.getAttribute('fill');
        if (fill && fill !== 'none') {
            platform.color = fill;
        }
        
        // Parse physics properties from data-physics
        if (element.dataset.physics) {
            try {
                platform.physics = JSON.parse(element.dataset.physics);
            } catch (e) {
                console.error('Invalid physics JSON:', element.dataset.physics);
            }
        }
        
        // Parse motion properties from data-motion
        if (element.dataset.motion) {
            try {
                platform.motion = JSON.parse(element.dataset.motion);
            } catch (e) {
                console.error('Invalid motion JSON:', element.dataset.motion);
            }
        }
        
        // Parse platform-specific config from data-config
        if (element.dataset.config) {
            try {
                const config = JSON.parse(element.dataset.config);
                platform.physics = { ...(platform.physics || {}), ...config };
            } catch (e) {
                console.error('Invalid config JSON:', element.dataset.config);
            }
        }
        
        // Handle transforms
        const transform = element.getAttribute('transform');
        if (transform) {
            const rotation = this.extractRotationFromTransform(transform);
            if (rotation && rotation.angle !== 0) {
                // If rotation center is (0,0) and not explicitly set, 
                // check if we should use the object's center instead
                let centerX = rotation.cx;
                let centerY = rotation.cy;
                
                // For rectangles in SVG, if rotate doesn't specify center,
                // it rotates around (0,0), not the rectangle's center
                // We need to apply this rotation to both position and angle
                
                // Apply rotation around the specified center
                const dx = platform.x - centerX;
                const dy = platform.y - centerY;
                
                // Rotate the position around the rotation center
                const cos = Math.cos(rotation.angle);
                const sin = Math.sin(rotation.angle);
                const newX = centerX + (dx * cos - dy * sin);
                const newY = centerY + (dx * sin + dy * cos);
                
                // Update platform position
                platform.x = newX;
                platform.y = newY;
                
                // Set the rotation angle
                platform.angle = rotation.angle;
                
                // If platform has vertices (custom shape), they're already relative to center
                // so we just rotate them
                if (platform.vertices) {
                    platform.vertices = platform.vertices.map(v => ({
                        x: v.x * cos - v.y * sin,
                        y: v.x * sin + v.y * cos
                    }));
                }
                
                console.log(`Rotated platform: center=(${centerX}, ${centerY}), angle=${rotation.angle * 180/Math.PI}°, new pos=(${newX}, ${newY})`);
            }
        }
        
        // Add ID if present
        const id = element.getAttribute('id');
        if (id) {
            platform.id = id;
        }
    }
    
    /**
     * Get effective classes from element and parent groups
     */
    getEffectiveClasses(element) {
        const classes = new Set();
        
        // Add element's own classes
        if (element.classList) {
            element.classList.forEach(cls => classes.add(cls));
        }
        
        // Add classes from platform group if element was marked
        if (element._platformGroup) {
            element._platformGroup.classList.forEach(cls => classes.add(cls));
        }
        
        // Walk up the DOM tree to find parent groups with classes
        let parent = element.parentElement;
        while (parent && parent !== this.svgDoc.documentElement) {
            if (parent.tagName.toLowerCase() === 'g' && parent.classList.contains('platform')) {
                parent.classList.forEach(cls => classes.add(cls));
            }
            parent = parent.parentElement;
        }
        
        return classes;
    }
    
    /**
     * Detect platform type from classes
     */
    detectPlatformType(classes) {
        // Check for special platform types
        const platformTypes = [
            'ice', 'bouncy', 'electric', 'fire', 
            'blackhole', 'water', 'waterfall'
        ];
        
        for (const type of platformTypes) {
            if (classes.has(type)) {
                return type;
            }
        }
        
        return 'standard';
    }
    
    /**
     * Extract stickers (text elements) from SVG
     */
    extractStickers(svg) {
        const stickers = [];
        const textElements = svg.querySelectorAll('.sticker, text.sticker');
        
        textElements.forEach((element, index) => {
            const x = parseFloat(element.getAttribute('x') || 0);
            const y = parseFloat(element.getAttribute('y') || 0);
            const text = element.textContent.trim();
            
            if (text) {
                // Get text anchor (start, middle, end)
                const textAnchor = element.getAttribute('text-anchor') || 'start';
                
                // Get font size to estimate baseline offset
                const fontSize = parseFloat(element.getAttribute('font-size') || 
                                          window.getComputedStyle(element).fontSize || 
                                          '16');
                
                // Adjust x based on text-anchor
                let adjustedX = x;
                if (textAnchor === 'middle') {
                    // Text is already centered horizontally in SVG
                    // Sticker expects center position, so this is correct
                    adjustedX = x;
                } else if (textAnchor === 'end') {
                    // We'd need to measure text width, for now approximate
                    // This is tricky without rendering, so we'll leave a note
                    console.warn('text-anchor="end" not fully supported for stickers');
                    adjustedX = x;
                } else {
                    // text-anchor="start" (default)
                    // SVG x is at left edge, but Sticker expects center
                    // We need to measure or estimate text width
                    // For now, we'll approximate based on character count
                    const approxCharWidth = fontSize * 0.5;
                    const approxWidth = text.length * approxCharWidth;
                    adjustedX = x + approxWidth / 2;
                }
                
                // SVG y is at text baseline, but Sticker expects center
                // Approximate: baseline is roughly 0.8 * fontSize from top
                // So center would be baseline - (fontSize * 0.3)
                const adjustedY = y - fontSize * 0.3;
                
                stickers.push({
                    id: element.id || `sticker_${index}`,
                    x: adjustedX,
                    y: adjustedY,
                    text: text,
                    fontSize: fontSize
                });
            }
        });
        
        return stickers;
    }
    
    /**
     * Get element position (handles different element types)
     */
    getElementPosition(element) {
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
            case 'circle':
                return {
                    x: parseFloat(element.getAttribute('cx') || 0),
                    y: parseFloat(element.getAttribute('cy') || 0)
                };
            case 'rect':
                const x = parseFloat(element.getAttribute('x') || 0);
                const y = parseFloat(element.getAttribute('y') || 0);
                const width = parseFloat(element.getAttribute('width') || 0);
                const height = parseFloat(element.getAttribute('height') || 0);
                return {
                    x: x + width / 2,
                    y: y + height / 2
                };
            case 'ellipse':
                return {
                    x: parseFloat(element.getAttribute('cx') || 0),
                    y: parseFloat(element.getAttribute('cy') || 0)
                };
            default:
                // Try to get bounding box
                if (element.getBBox) {
                    const bbox = element.getBBox();
                    return {
                        x: bbox.x + bbox.width / 2,
                        y: bbox.y + bbox.height / 2
                    };
                }
                return { x: 0, y: 0 };
        }
    }
    
    /**
     * Parse points string (used by polygon and polyline)
     */
    parsePoints(pointsStr) {
        const points = [];
        const pairs = pointsStr.trim().split(/\s+/);
        
        for (let i = 0; i < pairs.length; i++) {
            const coords = pairs[i].split(',');
            if (coords.length === 2) {
                points.push({
                    x: parseFloat(coords[0]),
                    y: parseFloat(coords[1])
                });
            } else if (i < pairs.length - 1) {
                // Handle space-separated coordinates
                points.push({
                    x: parseFloat(pairs[i]),
                    y: parseFloat(pairs[i + 1])
                });
                i++; // Skip next item since we used it as y
            }
        }
        
        return points;
    }
    
    /**
     * Calculate centroid of polygon points
     */
    calculateCentroid(points) {
        let cx = 0, cy = 0;
        points.forEach(p => {
            cx += p.x;
            cy += p.y;
        });
        return {
            x: cx / points.length,
            y: cy / points.length
        };
    }
    
    /**
     * Extract rotation angle and center from transform string
     */
    extractRotationFromTransform(transform) {
        // Match rotate(angle) or rotate(angle cx cy)
        const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
        if (rotateMatch) {
            const params = rotateMatch[1].split(/[\s,]+/).map(parseFloat);
            const angle = params[0] * Math.PI / 180; // Convert to radians
            
            // If rotation center is specified, return it
            if (params.length === 3) {
                return {
                    angle: angle,
                    cx: params[1],
                    cy: params[2]
                };
            }
            
            // No center specified, SVG defaults to (0,0)
            return {
                angle: angle,
                cx: 0,
                cy: 0
            };
        }
        return null;
    }
    
    /**
     * Estimate path bounds when getBBox is not available
     */
    estimatePathBounds(pathData) {
        // Parse path and calculate bounds
        const points = SvgPathParser.pathToPoints(pathData, 20);
        if (points.length === 0) {
            console.warn('Could not parse path for bounds estimation');
            return { x: 0, y: 0, width: 100, height: 100 };
        }
        
        return SvgPathParser.calculateBounds(points);
    }
    
    /**
     * Clean up when scene is destroyed
     */
    shutdown() {
        // Clear cached SVG text when scene shuts down
        if (this.svgCacheKey && this.cache.text.exists(this.svgCacheKey)) {
            this.cache.text.remove(this.svgCacheKey);
        }
        
        super.shutdown();
    }
}
