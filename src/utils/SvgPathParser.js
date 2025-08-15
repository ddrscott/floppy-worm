/**
 * SVG Path Parser - Converts SVG path data to polygon points
 * Handles basic path commands and curves
 */
export default class SvgPathParser {
    /**
     * Parse SVG path data string and convert to polygon points
     * @param {string} pathData - SVG path d attribute
     * @param {number} sampleCount - Number of points to sample for curves
     * @returns {Array} Array of {x, y} points
     */
    static pathToPoints(pathData, sampleCount = 20) {
        const points = [];
        const commands = this.parsePathCommands(pathData);
        
        let currentX = 0;
        let currentY = 0;
        let startX = 0;
        let startY = 0;
        
        commands.forEach(cmd => {
            switch (cmd.type) {
                case 'M': // Move to absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    startX = currentX;
                    startY = currentY;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'm': // Move to relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    startX = currentX;
                    startY = currentY;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'L': // Line to absolute
                    currentX = cmd.x;
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'l': // Line to relative
                    currentX += cmd.x;
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'H': // Horizontal line absolute
                    currentX = cmd.x;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'h': // Horizontal line relative
                    currentX += cmd.x;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'V': // Vertical line absolute
                    currentY = cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'v': // Vertical line relative
                    currentY += cmd.y;
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'C': // Cubic bezier absolute
                    const cubicPoints = this.sampleCubicBezier(
                        currentX, currentY,
                        cmd.x1, cmd.y1,
                        cmd.x2, cmd.y2,
                        cmd.x, cmd.y,
                        Math.ceil(sampleCount / 2)
                    );
                    points.push(...cubicPoints.slice(1)); // Skip first point (current position)
                    currentX = cmd.x;
                    currentY = cmd.y;
                    break;
                    
                case 'c': // Cubic bezier relative
                    const relCubicPoints = this.sampleCubicBezier(
                        currentX, currentY,
                        currentX + cmd.x1, currentY + cmd.y1,
                        currentX + cmd.x2, currentY + cmd.y2,
                        currentX + cmd.x, currentY + cmd.y,
                        Math.ceil(sampleCount / 2)
                    );
                    points.push(...relCubicPoints.slice(1));
                    currentX += cmd.x;
                    currentY += cmd.y;
                    break;
                    
                case 'Q': // Quadratic bezier absolute
                    const quadPoints = this.sampleQuadraticBezier(
                        currentX, currentY,
                        cmd.x1, cmd.y1,
                        cmd.x, cmd.y,
                        Math.ceil(sampleCount / 3)
                    );
                    points.push(...quadPoints.slice(1));
                    currentX = cmd.x;
                    currentY = cmd.y;
                    break;
                    
                case 'q': // Quadratic bezier relative
                    const relQuadPoints = this.sampleQuadraticBezier(
                        currentX, currentY,
                        currentX + cmd.x1, currentY + cmd.y1,
                        currentX + cmd.x, currentY + cmd.y,
                        Math.ceil(sampleCount / 3)
                    );
                    points.push(...relQuadPoints.slice(1));
                    currentX += cmd.x;
                    currentY += cmd.y;
                    break;
                    
                case 'A': // Arc absolute
                case 'a': // Arc relative
                    // Simplified arc handling - just add endpoint for now
                    // TODO: Proper arc to bezier conversion
                    if (cmd.type === 'A') {
                        currentX = cmd.x;
                        currentY = cmd.y;
                    } else {
                        currentX += cmd.x;
                        currentY += cmd.y;
                    }
                    points.push({ x: currentX, y: currentY });
                    break;
                    
                case 'Z': // Close path
                case 'z':
                    if (currentX !== startX || currentY !== startY) {
                        points.push({ x: startX, y: startY });
                    }
                    currentX = startX;
                    currentY = startY;
                    break;
            }
        });
        
        return points;
    }
    
    /**
     * Parse path data string into command objects
     */
    static parsePathCommands(pathData) {
        const commands = [];
        const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
        let match;
        
        while ((match = regex.exec(pathData)) !== null) {
            const type = match[1];
            const args = match[2].trim();
            
            if (args || type.toLowerCase() === 'z') {
                const numbers = args ? args.match(/-?\d*\.?\d+/g) : [];
                const floats = numbers ? numbers.map(parseFloat) : [];
                
                // Parse based on command type
                switch (type) {
                    case 'M':
                    case 'm':
                    case 'L':
                    case 'l':
                        for (let i = 0; i < floats.length; i += 2) {
                            commands.push({
                                type: type,
                                x: floats[i],
                                y: floats[i + 1]
                            });
                        }
                        break;
                        
                    case 'H':
                    case 'h':
                        floats.forEach(x => {
                            commands.push({ type: type, x: x });
                        });
                        break;
                        
                    case 'V':
                    case 'v':
                        floats.forEach(y => {
                            commands.push({ type: type, y: y });
                        });
                        break;
                        
                    case 'C':
                    case 'c':
                        for (let i = 0; i < floats.length; i += 6) {
                            commands.push({
                                type: type,
                                x1: floats[i],
                                y1: floats[i + 1],
                                x2: floats[i + 2],
                                y2: floats[i + 3],
                                x: floats[i + 4],
                                y: floats[i + 5]
                            });
                        }
                        break;
                        
                    case 'Q':
                    case 'q':
                        for (let i = 0; i < floats.length; i += 4) {
                            commands.push({
                                type: type,
                                x1: floats[i],
                                y1: floats[i + 1],
                                x: floats[i + 2],
                                y: floats[i + 3]
                            });
                        }
                        break;
                        
                    case 'A':
                    case 'a':
                        for (let i = 0; i < floats.length; i += 7) {
                            commands.push({
                                type: type,
                                rx: floats[i],
                                ry: floats[i + 1],
                                rotation: floats[i + 2],
                                largeArc: floats[i + 3],
                                sweep: floats[i + 4],
                                x: floats[i + 5],
                                y: floats[i + 6]
                            });
                        }
                        break;
                        
                    case 'Z':
                    case 'z':
                        commands.push({ type: type });
                        break;
                }
            }
        }
        
        return commands;
    }
    
    /**
     * Sample points along a cubic bezier curve
     */
    static sampleCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, samples) {
        const points = [];
        
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const t2 = t * t;
            const t3 = t2 * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            
            const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
            const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
            
            points.push({ x, y });
        }
        
        return points;
    }
    
    /**
     * Sample points along a quadratic bezier curve
     */
    static sampleQuadraticBezier(x0, y0, x1, y1, x2, y2, samples) {
        const points = [];
        
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const t2 = t * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            
            const x = mt2 * x0 + 2 * mt * t * x1 + t2 * x2;
            const y = mt2 * y0 + 2 * mt * t * y1 + t2 * y2;
            
            points.push({ x, y });
        }
        
        return points;
    }
    
    /**
     * Calculate bounding box for array of points
     */
    static calculateBounds(points) {
        if (points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;
        
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    /**
     * Simplify polygon by removing collinear points
     */
    static simplifyPolygon(points, tolerance = 1) {
        if (points.length <= 3) return points;
        
        const simplified = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // Calculate cross product to check collinearity
            const cross = (next.x - prev.x) * (curr.y - prev.y) - 
                         (curr.x - prev.x) * (next.y - prev.y);
            
            // If points are not collinear, keep the middle point
            if (Math.abs(cross) > tolerance) {
                simplified.push(curr);
            }
        }
        
        simplified.push(points[points.length - 1]);
        return simplified;
    }
}