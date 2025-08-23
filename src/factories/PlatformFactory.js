import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';
import BlackholePlatform from '../entities/BlackholePlatform';
import WaterPlatform from '../entities/WaterPlatform';
import WaterfallPlatform from '../entities/WaterfallPlatform';
import SwitchPlatform from '../entities/SwitchPlatform';
import DoorPlatform from '../entities/DoorPlatform';

/**
 * PlatformFactory - Centralized platform creation from JSON data
 * 
 * Handles creation of all platform types:
 * - Standard geometric platforms (rectangle, circle, polygon, etc.)
 * - Special platforms (ice, bouncy, electric, etc.)
 * - Dynamic platforms with motion
 */
export default class PlatformFactory {
    constructor(scene) {
        this.scene = scene;
    }
    
    /**
     * Create a platform from JSON data
     * @param {Object} platformData - Platform configuration from JSON
     * @returns {Object|null} Platform object with body, visual, and metadata
     */
    createFromJSON(platformData) {
        const { type, platformType = 'standard', physics = {}, motion, color, id } = platformData;
        
        // Check if this is a special platform type or has motion
        if ((platformType && platformType !== 'standard') || motion) {
            const platformInstance = this.createSpecialPlatform({
                ...platformData,
                platformType: platformType || 'standard'
            });
            if (platformInstance) {
                return { 
                    instance: platformInstance,
                    data: platformData, 
                    id: id || `platform_${Date.now()}`,
                    isSpecial: true
                };
            }
        }
        
        // Handle standard platforms
        let body, visual;
        
        switch(type) {
            case 'rectangle':
                ({ body, visual } = this.createRectanglePlatform(platformData));
                break;
                
            case 'circle':
                ({ body, visual } = this.createCirclePlatform(platformData));
                break;
                
            case 'polygon':
                ({ body, visual } = this.createPolygonPlatform(platformData));
                break;
                
            case 'trapezoid':
                ({ body, visual } = this.createTrapezoidPlatform(platformData));
                break;
                
            case 'custom':
                ({ body, visual } = this.createCustomPlatform(platformData));
                break;
                
            default:
                console.warn(`Unknown platform type: ${type}`);
                return null;
        }
        
        // Apply physics properties from JSON
        if (physics && body) {
            Object.keys(physics).forEach(key => {
                this.scene.matter.body.set(body, key, physics[key]);
            });
        }
        
        return { 
            body, 
            visual, 
            data: platformData, 
            id: id || platformData.id || `platform_${Date.now()}`
        };
    }
    
    createRectanglePlatform(platformData) {
        const { x, y, width, height, color = "#ff6b6b", angle = 0, matter = {}, chamfer } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, width/height are in pixels
        const centerX = x;
        const centerY = y;
        const pixelWidth = width;
        const pixelHeight = height;
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            // Ensure dynamic bodies have proper collision detection
            collisionFilter: {
                category: 0x0002,  // Platform category
                mask: 0xFFFF       // Collide with everything
            },
            ...matter  // This allows matter properties from JSON to override defaults
        };
        
        // Add chamfer if specified
        if (chamfer) {
            bodyOptions.chamfer = chamfer;
        }
        
        const body = this.scene.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, {
            label: platformData.id || 'platform',
            ...bodyOptions
        });
        
        // Debug logging for dynamic platforms
        if (!bodyOptions.isStatic) {
            console.log('Created dynamic platform:', {
                x: centerX,
                y: centerY,
                width: pixelWidth,
                height: pixelHeight,
                isStatic: body.isStatic,
                isSensor: body.isSensor,
                density: body.density,
                mass: body.mass,
                collisionFilter: body.collisionFilter,
                chamfer: bodyOptions.chamfer
            });
            
            // Ensure the body is definitely not a sensor
            this.scene.matter.body.set(body, 'isSensor', false);
        }
        
        // Create visual with rounded corners if chamfer is specified
        let visual;
        if (chamfer && chamfer.radius) {
            // Use a graphics object to draw rounded rectangle
            const graphics = this.scene.add.graphics();
            const fillColor = parseInt(color.replace('#', '0x'));
            graphics.fillStyle(fillColor);
            
            // Determine corner radius
            let cornerRadius;
            if (Array.isArray(chamfer.radius)) {
                // Use the first value as a uniform radius for visual (Phaser doesn't support individual corner radii)
                cornerRadius = Math.min(chamfer.radius[0], pixelWidth / 2, pixelHeight / 2);
            } else {
                cornerRadius = Math.min(chamfer.radius, pixelWidth / 2, pixelHeight / 2);
            }
            
            graphics.fillRoundedRect(-pixelWidth/2, -pixelHeight/2, pixelWidth, pixelHeight, cornerRadius);
            graphics.strokeRoundedRect(-pixelWidth/2, -pixelHeight/2, pixelWidth, pixelHeight, cornerRadius);
            
            // Convert graphics to a container positioned at the platform center
            visual = this.scene.add.container(centerX, centerY, [graphics]);
        } else {
            // Regular rectangle without chamfer
            visual = this.scene.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, parseInt(color.replace('#', '0x')));
            visual.setStrokeStyle(2, 0x000000, 0.8);
        }
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.scene.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createCirclePlatform(platformData) {
        const { x, y, radius, color = "#4ecdc4", angle = 0, matter = {} } = platformData;
        
        // Use pixel coordinates directly
        const centerX = x;
        const centerY = y;
        const pixelRadius = radius;
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            ...matter
        };
        
        const body = this.scene.matter.add.circle(centerX, centerY, pixelRadius, {
            label: platformData.id || 'platform_circle',
            ...bodyOptions
        });
        
        const visual = this.scene.add.circle(centerX, centerY, pixelRadius, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified (though visually irrelevant for circles)
        if (angle !== 0) {
            this.scene.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createPolygonPlatform(platformData) {
        const { x, y, sides, radius, rotation = 0, angle = 0, color = "#95e1d3", matter = {}, chamfer } = platformData;
        const actualRotation = rotation || angle; // Support both 'rotation' and 'angle' properties
        
        // Use pixel coordinates directly
        const centerX = x;
        const centerY = y;
        const pixelRadius = radius;
        
        // Create regular polygon vertices
        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i / sides) + actualRotation;
            vertices.push({
                x: centerX + pixelRadius * Math.cos(angle),
                y: centerY + pixelRadius * Math.sin(angle)
            });
        }
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            ...matter
        };
        
        // For polygons, we need to use the polygon method with chamfer
        let body;
        if (chamfer) {
            body = this.scene.matter.add.polygon(centerX, centerY, sides, pixelRadius, {
                label: platformData.id || 'platform_polygon',
                angle: actualRotation,
                chamfer: chamfer,
                ...bodyOptions
            });
        } else {
            body = this.scene.matter.add.fromVertices(centerX, centerY, vertices, {
                label: platformData.id || 'platform_polygon',
                ...bodyOptions
            });
        }
        
        // Create visual polygon
        const visual = this.scene.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        visual.setStrokeStyle(2, 0x000000, 0.8);
        
        return { body, visual };
    }
    
    createTrapezoidPlatform(platformData) {
        const { x, y, width, height, slope = 0, color = "#feca57", angle = 0, matter = {} } = platformData;
        
        // Use pixel coordinates directly
        const centerX = x;
        const centerY = y;
        const pixelWidth = width;
        const pixelHeight = height;
        
        // Calculate trapezoid vertices based on slope
        const halfWidth = pixelWidth / 2;
        const halfHeight = pixelHeight / 2;
        const slopeOffset = slope * halfHeight;
        
        const vertices = [
            { x: centerX - halfWidth + slopeOffset, y: centerY - halfHeight },  // top left
            { x: centerX + halfWidth - slopeOffset, y: centerY - halfHeight },  // top right
            { x: centerX + halfWidth, y: centerY + halfHeight },                // bottom right
            { x: centerX - halfWidth, y: centerY + halfHeight }                 // bottom left
        ];
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            ...matter
        };
        
        const body = this.scene.matter.add.fromVertices(centerX, centerY, vertices, {
            label: platformData.id || 'platform_trapezoid',
            ...bodyOptions
        });
        
        // Create visual trapezoid
        const visual = this.scene.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.scene.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createCustomPlatform(platformData) {
        const { vertices, color = "#a29bfe", angle = 0, matter = {} } = platformData;
        
        // Use pixel coordinates directly - vertices are already in world coordinates
        const pixelVertices = vertices;
        
        // Calculate center point for body positioning
        const centerX = pixelVertices.reduce((sum, v) => sum + v.x, 0) / pixelVertices.length;
        const centerY = pixelVertices.reduce((sum, v) => sum + v.y, 0) / pixelVertices.length;
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            ...matter
        };
        
        const body = this.scene.matter.add.fromVertices(centerX, centerY, pixelVertices, {
            label: platformData.id || 'platform_custom',
            ...bodyOptions
        });
        
        // Create visual polygon
        const visual = this.scene.add.polygon(centerX, centerY, pixelVertices, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.scene.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createSpecialPlatform(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, motion, color, chamfer, ...otherProps } = platformData;
        
        // Use the same coordinate transformations as regular platforms
        const centerX = x;
        const centerY = y;
        
        // Apply physics from JSON with proper defaults
        // Include all platform-specific properties (switchId, doorId, etc.)
        const config = {
            shape: type, // Pass the shape type
            motion: motion, // Pass motion config if present
            chamfer: chamfer, // Pass chamfer config if present
            ...physics,
            ...otherProps, // Include all other properties like switchId, doorId, etc.
        };
        
        // Determine platform dimensions based on shape type
        let platformWidth, platformHeight;
        
        if (type === 'rectangle') {
            platformWidth = width;
            platformHeight = height;
        } else if (type === 'circle') {
            // For circles, use diameter as both width and height
            platformWidth = radius * 2;
            platformHeight = radius * 2;
        } else {
            // For other shapes, use bounding box approach
            platformWidth = width || radius * 2 || 100;
            platformHeight = height || radius * 2 || 100;
        }
        
        // Debug logging to understand coordinate issues
        console.log(`Creating special platform ${platformType} ${type} at (${centerX}, ${centerY}) size: ${platformWidth}x${platformHeight}`);
        console.log(`Level bounds: ${this.scene.levelWidth}x${this.scene.levelHeight}`);
        
        switch(platformType) {
            case 'ice':
                return new IcePlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'bouncy':
                return new BouncyPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'electric':
                return new ElectricPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'fire':
                return new FirePlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'blackhole':
                return new BlackholePlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'water':
                return new WaterPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'waterfall':
                return new WaterfallPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'switch':
                console.log(`Creating switch with config:`, config);
                return new SwitchPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'door':
                console.log(`Creating door with config:`, config);
                return new DoorPlatform(this.scene, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'standard':
                // Standard platform with motion needs to use PlatformBase
                return new PlatformBase(this.scene, centerX, centerY, platformWidth, platformHeight, {
                    ...config,
                    color: parseInt(color?.replace('#', '0x')) || 0x666666
                });
                
            default:
                console.warn(`Unknown special platform type: ${platformType}`);
                return null;
        }
    }
}
