import Phaser from 'phaser';
import DoubleWorm from '../entities/DoubleWorm';
import Stopwatch from '../components/Stopwatch';
import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';
import BlackholePlatform from '../entities/BlackholePlatform';
import WaterPlatform from '../entities/WaterPlatform';
import WaterfallPlatform from '../entities/WaterfallPlatform';
import Sticker from '../entities/Sticker';
import GhostRecorder from '../components/ghost/GhostRecorder';
import GhostPlayer from '../components/ghost/GhostPlayer';
import GhostStorage from '../components/ghost/GhostStorage';
import RecordingDatabase from '../storage/RecordingDatabase';
import VictoryDialog from './VictoryDialog';
import PauseMenu from './PauseMenu';
import { getCachedBuildMode } from '../utils/buildMode';
import GameStateManager from '../services/GameStateManager';
import Random from '../utils/Random';

export default class JsonMapBase extends Phaser.Scene {
    constructor(config = {}) {
        super(config);
        
        // Victory state tracking (from BaseLevelScene)
        this.victoryAchieved = false;
        this.victoryReturnTimer = null;
        
        // Worm reference - should be set by subclasses
        this.worm = null;
        
        
        // Level dimension constants - can be overridden in subclasses
        this.CHAR_WIDTH = config.charWidth || 96;
        this.CHAR_HEIGHT = config.charHeight || 48;
        this.ROW_SPACING = config.rowSpacing || 96;
        
        // JSON level data - should be provided in subclasses or config
        this.mapData = config.mapData || this.getDefaultMapData();
        
        // Scene configuration
        this.sceneTitle = config.title || this.mapData.metadata?.name || 'JSON Level';
        this.returnScene = config.returnScene || 'MapSelectScene';
        this.mapKey = config.key || config.mapKey || 'unknown';
        
        // Victory state tracking
        this.victoryAchieved = false;
        
        this.platforms = [];
        this.stickers = [];
        this.constraints = [];
        this.platformColors = config.platformColors || [0xff6b6b, 0x4ecdc4, 0x95e1d3, 0xfeca57, 0xa29bfe];
        
        // Mini-map configuration
        this.miniMapConfig = {
            width: 200,
            height: 200,
            padding: 20,
            visible: true
        };
        this.minimap = null;
        
        // Store elements to hide from mini-map
        this.minimapIgnoreList = [];
        
        // Track gamepad button state for mini-map toggle
        this.buttonMWasPressed = false;
        this.button0WasPressed = false;
        this.button1WasPressed = false;
        
        // Ghost system
        this.ghostRecorder = null;
        this.ghostPlayer = null;
        this.ghostStorage = new GhostStorage();
        this.ghostVisible = true;
        
        // State manager - will be initialized in init()
        this.stateManager = null;
        
        // Track pause menu state
        this.isPaused = false;
        this.optionButtonWasPressed = false;
    }
    
    getDefaultMapData() {
        return {
            metadata: {
                name: "Default Level",
                difficulty: 1,
                description: "A basic test level"
            },
            dimensions: {
                width:  800,
                height: 600 
            },
            entities: {
                wormStart: { x: 2, y: 1 },
                goal: { x: 14, y: 6 }
            },
            platforms: [
                {
                    id: "ground",
                    type: "rectangle",
                    x: 0, y: 0, width: 16, height: 1,
                    color: "#ff6b6b",
                    physics: {
                        friction: 0.8,
                        frictionStatic: 1.0,
                        restitution: 0
                    }
                }
            ]
        };
    }
    
    renderConstraints() {
        // Clear previous constraint graphics if any
        if (!this.constraintGraphics) {
            this.constraintGraphics = this.add.graphics();
            this.constraintGraphics.setDepth(10); // Render above platforms but below UI
        }
        this.constraintGraphics.clear();
        
        this.constraints.forEach(({ constraint, data }) => {
            if (!constraint || !data.render || !data.render.visible) return;
            
            const bodyA = constraint.bodyA;
            const bodyB = constraint.bodyB;
            
            // Calculate attachment points
            let pointA = { x: 0, y: 0 };
            let pointB = { x: 0, y: 0 };
            
            if (bodyA) {
                pointA.x = bodyA.position.x + (constraint.pointA ? constraint.pointA.x : 0);
                pointA.y = bodyA.position.y + (constraint.pointA ? constraint.pointA.y : 0);
            } else if (constraint.pointA) {
                pointA = constraint.pointA;
            }
            
            if (bodyB) {
                pointB.x = bodyB.position.x + (constraint.pointB ? constraint.pointB.x : 0);
                pointB.y = bodyB.position.y + (constraint.pointB ? constraint.pointB.y : 0);
            } else if (constraint.pointB) {
                pointB = constraint.pointB;
            }
            
            // Set line style
            const strokeColor = data.render.strokeStyle ? 
                parseInt(data.render.strokeStyle.replace('#', '0x')) : 0x90A4AE;
            const lineWidth = data.render.lineWidth || 2;
            
            this.constraintGraphics.lineStyle(lineWidth, strokeColor);
            
            // Matter.js automatically picks constraint rendering based on stiffness
            // High stiffness (close to 1) = rigid line
            // Low stiffness = spring
            const stiffness = constraint.stiffness || 1;
            
            if (stiffness > 0.5) {
                // Rigid constraint - draw as line
                this.constraintGraphics.moveTo(pointA.x, pointA.y);
                this.constraintGraphics.lineTo(pointB.x, pointB.y);
            } else {
                // Spring constraint - draw as zigzag
                const dx = pointB.x - pointA.x;
                const dy = pointB.y - pointA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const segments = Math.max(8, Math.floor(distance / 20));
                const amplitude = 8;
                
                this.constraintGraphics.beginPath();
                this.constraintGraphics.moveTo(pointA.x, pointA.y);
                
                for (let i = 1; i <= segments; i++) {
                    const t = i / segments;
                    const x = pointA.x + dx * t;
                    const y = pointA.y + dy * t;
                    
                    // Add perpendicular offset for zigzag
                    const perpX = -dy / distance * amplitude * (i % 2 === 0 ? 1 : -1);
                    const perpY = dx / distance * amplitude * (i % 2 === 0 ? 1 : -1);
                    
                    this.constraintGraphics.lineTo(x + perpX, y + perpY);
                }
                
                this.constraintGraphics.lineTo(pointB.x, pointB.y);
                this.constraintGraphics.strokePath();
            }
            
            // Draw anchor points if enabled
            if (data.render.anchors) {
                this.constraintGraphics.fillStyle(strokeColor);
                this.constraintGraphics.fillCircle(pointA.x, pointA.y, 3);
                this.constraintGraphics.fillCircle(pointB.x, pointB.y, 3);
            }
        });
    }
    
    cleanup() {
        // Remove event listeners
        this.events.off('resume');
        
        // Destroy existing worm if it exists (from BaseLevelScene)
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        // Reset victory state (from BaseLevelScene)
        this.victoryAchieved = false;
        
        // Cancel any existing timers (from BaseLevelScene)
        if (this.victoryReturnTimer) {
            this.victoryReturnTimer.destroy();
            this.victoryReturnTimer = null;
        }
        
        // Cleanup special platforms
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.destroy) {
                platform.instance.destroy();
            }
        });
        
        // Clear platforms array
        this.platforms = [];
        
        // Cleanup constraints
        if (this.constraints) {
            this.constraints.forEach(({ constraint }) => {
                if (constraint && this.matter.world) {
                    this.matter.world.removeConstraint(constraint);
                }
            });
            this.constraints = [];
        }
        
        // Cleanup constraint graphics
        if (this.constraintGraphics) {
            this.constraintGraphics.destroy();
            this.constraintGraphics = null;
        }
        
        // Clear mini-map ignore list
        this.minimapIgnoreList = [];
        
        // Remove mouse constraint if it exists
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
        
        // Cleanup stopwatch
        if (this.stopwatch) {
            this.stopwatch.destroy();
            this.stopwatch = null;
        }
        
        // Cleanup controls display
        if (this.controlsDisplay) {
            this.controlsDisplay.destroy();
            this.controlsDisplay = null;
        }
        
        // Cleanup ghost system
        if (this.ghostRecorder) {
            this.ghostRecorder.reset();
            this.ghostRecorder = null;
        }
        
        if (this.ghostPlayer) {
            this.ghostPlayer.destroy(); // This destroys the graphics objects
            this.ghostPlayer = null;
        }
    }

    init(data) {
        // Reset random seed for deterministic behavior
        // IMPORTANT: Each map ALWAYS gets the same seed, so players can master
        // the exact patterns. Electric sparks, ice crystals, water bubbles, etc.
        // will always appear in the same pattern for a given map.
        // This is crucial for speedrunning and skill-based gameplay.
        const seed = this.mapKey ? 
            this.mapKey.split('').reduce((acc, char, index) => {
                // Generate a stable hash from the map key
                return acc + (char.charCodeAt(0) * (index + 1));
            }, 42) : // Start with 42 as base seed
            12345; // Fallback seed if no map key
        Random.setSeed(seed);
        
        // Reset state on scene init (called before preload)
        this.victoryAchieved = false;
        this.victoryReturnTimer = null;
        this.worm = null;
        this.platforms = [];
        this.stickers = [];
        this.constraints = [];
        this.minimapIgnoreList = [];
        this.buttonMWasPressed = false;
        this.button0WasPressed = false;
        this.button1WasPressed = false;
        this.ghostRecorder = null;
        this.ghostPlayer = null;
        this.ghostVisible = true;
        
        // Initialize state manager
        this.stateManager = GameStateManager.getFromScene(this);
        
        // Initialize recording database
        this.recordingDb = new RecordingDatabase();
        
        // Store data passed from scene transition
        if (data) {
            this.returnScene = data.returnScene || this.returnScene;
        }
    }
    
    preload() {
        // Audio is now handled by synthesizers, no need to load wav files
    }
    
    async create() {
        // Clean up when scene shuts down (from BaseLevelScene)
        this.events.once('shutdown', () => {
            this.cleanup();
        });
        
        // Reset pause state when resuming from pause menu
        this.events.on('resume', () => {
            this.isPaused = false;
        });
        
        // Get build mode
        this.buildMode = await getCachedBuildMode();
        
        // Enable debug rendering based on config
        // Default to false, but can be overridden by worm config
        this.matter.world.drawDebug = false;
        
        // Use pixel dimensions directly from JSON data
        const levelWidth = this.mapData.dimensions.width;
        const levelHeight = this.mapData.dimensions.height;
        
        // Store level dimensions
        this.levelHeight = levelHeight;
        this.levelWidth = levelWidth;
        this.LEVEL_WIDTH = levelWidth;

        // Update mini-map size based on level proportions
        this.updateMiniMapSize();
        
        // Set world bounds
        this.matter.world.setBounds(0, 0, levelWidth, levelHeight, 1000);
        
        // Create level elements
        this.createGrid(levelHeight);
        this.createBoundaryWalls(levelHeight);
        this.loadMapFromJSON();

        // Create mini-map camera (after level is parsed)
        this.createMiniMap(levelHeight);
        
        // Create UI
        this.createUI();
        
        // Set up controls
        this.setupControls();
        
        // Initialize ghost system and start timer after it's loaded
        this.initializeGhostSystem().then(() => {
            // Start the timer and ghost
            if (this.stopwatch) {
                this.stopwatch.start();
                
                // Start ghost playback if loaded
                if (this.ghostPlayer && this.ghostPlayer.frames.length > 0) {
                    console.log('Starting ghost player with', this.ghostPlayer.frames.length, 'frames');
                    this.ghostPlayer.start();
                } else {
                    console.log('Ghost not started - player:', !!this.ghostPlayer, 'frames:', this.ghostPlayer?.frames?.length);
                }
            }
        });
    }


    createLabel({x, y, width, height, text, fontSize}) {
        //  32px radius on the corners
        const frame = this.add.graphics();
        const container = this.add.container(400, 300);

        frame.fillStyle(0x3333ff, 1);
        frame.lineStyle(1, borderColor, 1);
        frame.strokeRoundedRect(-width/2, 0, width, height, chamfer)
        frame.fillRoundedRect(-width/2, 0, width, height, chamfer);
        
        const textObj = this.add.text(-width/2, 0, text, { 
            fontFamily: 'Arial', 
            align: 'center',
            fixedWidth: width,
            color: '#ff0000',
            fontSize,
        })

        container.add([frame, textObj])
    }

    
    loadMapFromJSON() {
        const { platforms, entities, stickers = [], constraints = [] } = this.mapData;
        
        // Create platforms
        platforms.forEach(platformData => {
            this.createPlatformFromJSON(platformData);
        });
        
        // Create stickers
        stickers.forEach(stickerData => {
            this.createStickerFromJSON(stickerData);
        });
        
        // Create entities
        this.createEntitiesFromJSON(entities);
        
        // Create constraints (after platforms and entities are created)
        this.createConstraintsFromJSON(constraints);
    }
    
    createPlatformFromJSON(platformData) {
        const { type, platformType = 'standard', physics = {}, motion, color, id } = platformData;
        
        // Check if this is a special platform type or has motion
        if ((platformType && platformType !== 'standard') || motion) {
            const platformInstance = this.createSpecialPlatform({
                ...platformData,
                platformType: platformType || 'standard'
            });
            if (platformInstance) {
                this.platforms.push({ 
                    instance: platformInstance,
                    data: platformData, 
                    id: id || `platform_${this.platforms.length}`,
                    isSpecial: true
                });
                return;
            }
        }
        
        // Handle standard platforms (existing logic)
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
                return;
        }
        
        // Apply physics properties from JSON
        if (physics) {
            Object.keys(physics).forEach(key => {
                this.matter.body.set(body, key, physics[key]);
            });
        }
        
        const platformId = id || platformData.id || `platform_${this.platforms.length}`;
        this.platforms.push({ 
            body, visual, data: platformData, id: platformId
        });
        
        // Additional debug for pendulum platform
        if (platformId === 'pendulum_platform') {
            console.log('Pendulum platform created:', {
                id: platformId,
                body: body,
                isStatic: body.isStatic,
                isSensor: body.isSensor,
                position: body.position,
                bounds: body.bounds,
                matter: platformData.matter
            });
        }
    }
    
    createStickerFromJSON(stickerData) {
        try {
            // Create sticker instance from JSON data
            const sticker = Sticker.fromJSON(this, stickerData);
            
            // Add to stickers array for management
            this.stickers.push(sticker);
            
            // Stickers should not appear in the minimap
            if (this.minimap && sticker.textObject) {
                this.minimap.ignore(sticker.textObject);
            }
            
            console.log(`Created sticker: "${stickerData.text}" at (${stickerData.x}, ${stickerData.y})`);
        } catch (error) {
            console.warn('Failed to create sticker from JSON:', stickerData, error);
        }
    }
    
    createSpecialPlatform(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, motion, color, chamfer } = platformData;
        
        // Use the same coordinate transformations as regular platforms
        const centerX = x;
        const centerY = y;
        
        // Apply physics from JSON with proper defaults
        // Don't pass color for special platform types as they have their own colors
        const config = {
            shape: type, // Pass the shape type (rectangle, circle, etc.)
            motion: motion, // Pass motion config if present
            chamfer: chamfer, // Pass chamfer config if present
            ...physics,
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
        console.log(`Level bounds: ${this.levelWidth}x${this.levelHeight}`);
        
        switch(platformType) {
            case 'ice':
                return new IcePlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'bouncy':
                return new BouncyPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'electric':
                return new ElectricPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'fire':
                return new FirePlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'blackhole':
                return new BlackholePlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'water':
                return new WaterPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'waterfall':
                return new WaterfallPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'standard':
                // Standard platform with motion needs to use PlatformBase
                return new PlatformBase(this, centerX, centerY, platformWidth, platformHeight, {
                    ...config,
                    color: parseInt(color?.replace('#', '0x')) || 0x666666
                });
                
            default:
                console.warn(`Unknown special platform type: ${platformType}`);
                return null;
        }
    }
    
    createConstraintsFromJSON(constraints) {
        if (!constraints || constraints.length === 0) return;
        
        // Initialize constraints array if not exists
        this.constraints = this.constraints || [];
        
        console.log(`Creating ${constraints.length} constraints from JSON`);
        
        constraints.forEach(constraintData => {
            try {
                // Copy constraint data to avoid modifying original
                const options = { ...constraintData };
                
                // Resolve body references
                if (options.bodyA && typeof options.bodyA === 'string') {
                    console.log(`Looking for bodyA: ${options.bodyA}`);
                    const bodyA = this.findBodyById(options.bodyA);
                    if (!bodyA) {
                        console.warn(`Constraint bodyA not found: ${options.bodyA}`);
                        console.log('Available platforms at constraint creation:', this.platforms.map(p => ({
                            id: p.id,
                            dataId: p.data?.id,
                            hasBody: !!p.body
                        })));
                        return;
                    }
                    console.log(`Found bodyA:`, bodyA);
                    options.bodyA = bodyA;
                }
                
                if (options.bodyB && typeof options.bodyB === 'string') {
                    const bodyB = this.findBodyById(options.bodyB);
                    if (!bodyB) {
                        console.warn(`Constraint bodyB not found: ${options.bodyB}`);
                        return;
                    }
                    options.bodyB = bodyB;
                }
                
                // Remove non-Matter.js properties from options
                const constraintId = options.id;
                delete options.id;
                delete options.render;  // render is for our custom rendering, not Matter.js
                
                console.log('Creating constraint with options:', options);
                
                // Create the constraint - use Matter.Constraint.create directly like the worm does
                let constraint;
                
                // For world constraints, ensure bodyB is undefined
                if (!options.bodyB) {
                    delete options.bodyB;
                }
                
                console.log('Final constraint options:', options);
                
                try {
                    // Use Matter.Constraint.create directly
                    constraint = Phaser.Physics.Matter.Matter.Constraint.create(options);
                    
                    // Add to world
                    this.matter.world.add(constraint);
                    console.log('Constraint created and added to world');
                } catch (innerError) {
                    console.error('Direct constraint creation failed:', innerError);
                    throw innerError;
                }
                
                // Check if constraint was actually added to the world
                if (this.matter.world.constraints) {
                    console.log('Constraint in world?', this.matter.world.constraints.includes(constraint));
                    console.log('Total constraints in world:', this.matter.world.constraints.length);
                } else {
                    console.log('World constraints array not accessible');
                }
                
                // Store reference with original id
                this.constraints.push({
                    id: constraintId,
                    constraint: constraint,
                    data: constraintData
                });
                
                console.log(`Created constraint: ${constraintId}`, {
                    constraint: constraint,
                    bodyA: constraint.bodyA,
                    bodyB: constraint.bodyB,
                    pointA: constraint.pointA,
                    pointB: constraint.pointB,
                    length: constraint.length,
                    constraintData: constraintData
                });
            } catch (error) {
                console.error('Failed to create constraint:', error, constraintData);
            }
        });
    }
    
    findBodyById(id) {
        console.log(`findBodyById called with id: ${id}`);
        console.log('Available platforms:', this.platforms.map(p => ({ id: p.id, dataId: p.data?.id, hasBody: !!p.body })));
        
        // Check platforms
        for (const platform of this.platforms) {
            if (platform.id === id || platform.data?.id === id) {
                console.log(`Found platform match for ${id}:`, platform);
                // Return the physics body
                if (platform.instance && platform.instance.body) {
                    return platform.instance.body;
                } else if (platform.body) {
                    return platform.body;
                }
            }
        }
        
        // Check worm segments if id starts with 'worm'
        if (id.startsWith('worm') && this.worm) {
            const segmentIndex = parseInt(id.replace('worm_segment_', ''));
            if (!isNaN(segmentIndex) && this.worm.segments && this.worm.segments[segmentIndex]) {
                return this.worm.segments[segmentIndex];
            }
        }
        
        console.log(`Body not found for id: ${id}`);
        return null;
    }
    
    setupSpecialPlatformCollisions() {
        // Set up Matter.js collision events for special platforms
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;

                if (bodyA.isWorm && bodyB.isWorm) {
                    return
                }
                
                // Check if one body is a worm segment and the other is a special platform
                const wormSegment = this.isWormSegment(bodyA) ? bodyA : (this.isWormSegment(bodyB) ? bodyB : null);
                const platformBody = wormSegment === bodyA ? bodyB : bodyA;
                
                // Debug collision for dynamic platforms
                if (wormSegment && !platformBody.isStatic) {
                    console.log('Collision with dynamic platform detected!', {
                        platform: platformBody,
                        wormSeg: wormSegment,
                    });
                }
                
                if (wormSegment && platformBody.platformInstance) {
                    const platform = platformBody.platformInstance;
                    if (platform.onCollision) {
                        platform.onCollision(wormSegment, pair.collision);
                    }
                }
            });
        });
        
        this.matter.world.on('collisionend', (event) => {
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                
                if (bodyA.isWorm && bodyB.isWorm) {
                    return
                }

                const wormSegment = this.isWormSegment(bodyA) ? bodyA : (this.isWormSegment(bodyB) ? bodyB : null);
                const platformBody = wormSegment === bodyA ? bodyB : bodyA;
                
                if (wormSegment && platformBody.platformInstance) {
                    const platform = platformBody.platformInstance;
                    if (platform.onCollisionEnd) {
                        platform.onCollisionEnd(wormSegment);
                    }
                }
            });
        });
    }
    
    isWormSegment(body) {
        return this.worm && this.worm.segments && this.worm.segments.includes(body);
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
        
        const body = this.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, {
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
            this.matter.body.set(body, 'isSensor', false);
        }
        
        // Create visual with rounded corners if chamfer is specified
        let visual;
        if (chamfer && chamfer.radius) {
            // Use a graphics object to draw rounded rectangle
            const graphics = this.add.graphics();
            const fillColor = parseInt(color.replace('#', '0x'));
            graphics.fillStyle(fillColor);
            graphics.strokeStyle(2, 0x000000, 0.8);
            
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
            visual = this.add.container(centerX, centerY, [graphics]);
        } else {
            // Regular rectangle without chamfer
            visual = this.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, parseInt(color.replace('#', '0x')));
            visual.setStrokeStyle(2, 0x000000, 0.8);
        }
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        // Dynamic bodies will be synced manually in the update loop
        
        return { body, visual };
    }
    
    createCirclePlatform(platformData) {
        const { x, y, radius, color = "#4ecdc4", angle = 0, matter = {} } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, radius in pixels
        const centerX = x;
        const centerY = y;
        const pixelRadius = radius;
        
        // Merge matter properties with defaults
        const bodyOptions = {
            isStatic: true,
            ...matter  // This allows matter properties from JSON to override defaults
        };
        
        const body = this.matter.add.circle(centerX, centerY, pixelRadius, {
            label: platformData.id || 'platform_circle',
            ...bodyOptions
        });
        
        const visual = this.add.circle(centerX, centerY, pixelRadius, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified (though visually irrelevant for circles)
        if (angle !== 0) {
            this.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createPolygonPlatform(platformData) {
        const { x, y, sides, radius, rotation = 0, angle = 0, color = "#95e1d3", matter = {}, chamfer } = platformData;
        const actualRotation = rotation || angle; // Support both 'rotation' and 'angle' properties
        
        // Use pixel coordinates directly - x,y is center position, radius in pixels
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
            ...matter  // This allows matter properties from JSON to override defaults
        };
        
        // For polygons, we need to use the polygon method with chamfer
        let body;
        if (chamfer) {
            body = this.matter.add.polygon(centerX, centerY, sides, pixelRadius, {
                label: platformData.id || 'platform_polygon',
                angle: actualRotation,
                chamfer: chamfer,
                ...bodyOptions
            });
        } else {
            body = this.matter.add.fromVertices(centerX, centerY, vertices, {
                label: platformData.id || 'platform_polygon',
                ...bodyOptions
            });
        }
        
        // Create visual polygon
        const visual = this.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        visual.setStrokeStyle(2, 0x000000, 0.8);
        
        return { body, visual };
    }
    
    createTrapezoidPlatform(platformData) {
        const { x, y, width, height, slope = 0, color = "#feca57", angle = 0, matter = {} } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, width/height in pixels
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
            ...matter  // This allows matter properties from JSON to override defaults
        };
        
        const body = this.matter.add.fromVertices(centerX, centerY, vertices, {
            label: platformData.id || 'platform_trapezoid',
            ...bodyOptions
        });
        
        // Create visual trapezoid
        const visual = this.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.matter.body.setAngle(body, angle);
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
            ...matter  // This allows matter properties from JSON to override defaults
        };
        
        const body = this.matter.add.fromVertices(centerX, centerY, pixelVertices, {
            label: platformData.id || 'platform_custom',
            ...bodyOptions
        });
        
        // Create visual polygon
        const visual = this.add.polygon(centerX, centerY, pixelVertices, parseInt(color.replace('#', '0x')));
        
        // Apply rotation if specified
        if (angle !== 0) {
            this.matter.body.setAngle(body, angle);
            visual.setRotation(angle);
        }
        
        return { body, visual };
    }
    
    createEntitiesFromJSON(entitiesData) {
        const { wormStart, goal } = entitiesData;
        
        // Use pixel coordinates directly for entity placement
        const wormX = wormStart.x;
        const wormY = wormStart.y;
        
        // Check URL for debug parameter
        const urlParams = new URLSearchParams(window.location.search);
        const debugEnabled = urlParams.get('debug') === '1';
        
        this.worm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: debugEnabled
        });

        // Set Matter.js debug rendering based on worm's showDebug config
        this.matter.world.drawDebug = this.worm.config.showDebug;

        // Initial impulse is now handled automatically in WormBase
        
        // Create camera target
        this.cameraTarget = this.add.rectangle(wormX, wormY, 10, 10, 0xff0000, 0);
        
        // Create goal at pixel coordinates
        const goalX = goal.x;
        const goalY = goal.y;
        
        this.goal = this.add.star(goalX, goalY, 5, 15, 25, 0xffd700);
        this.add.star(goalX, goalY, 5, 10, 20, 0xffed4e).setDepth(1);
        
        // Rotate the goal
        this.tweens.add({
            targets: this.goal,
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
        
        // Set up camera
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        this.handleResize();
        this.scale.on('resize', this.handleResize, this);
        
        // Set up collision detection for special platforms
        this.setupSpecialPlatformCollisions();
    }
    
    // Import grid, boundary walls, UI, controls, and other methods from TextBaseScene
    // (For brevity, I'll include key methods - the full implementation would include all methods)
    
    updateMiniMapSize() {
        const levelAspectRatio = this.levelWidth / this.levelHeight;
        const maxMiniMapWidth = 150;
        const maxMiniMapHeight = 250;
        const minMiniMapSize = 80;
        
        // Calculate ideal mini-map size while maintaining aspect ratio
        let miniMapWidth, miniMapHeight;
        
        if (levelAspectRatio > 1) {
            // Level is wider than tall
            miniMapWidth = Math.min(maxMiniMapWidth, minMiniMapSize * Math.sqrt(levelAspectRatio * 2));
            miniMapHeight = miniMapWidth / levelAspectRatio;
        } else {
            // Level is taller than wide
            miniMapHeight = Math.min(maxMiniMapHeight, minMiniMapSize * Math.sqrt(2 / levelAspectRatio));
            miniMapWidth = miniMapHeight * levelAspectRatio;
        }
        
        // Ensure minimum sizes
        this.miniMapConfig.width = Math.max(minMiniMapSize, miniMapWidth);
        this.miniMapConfig.height = Math.max(minMiniMapSize, miniMapHeight);
    }
    
    createGrid(height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x888888, 0.5);
        
        // Vertical lines
        for (let x = 0; x <= this.levelWidth; x += this.CHAR_WIDTH) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let gridLine = 0; gridLine * this.CHAR_WIDTH <= height; gridLine++) {
            const y = height - (gridLine * this.CHAR_WIDTH);
            graphics.moveTo(0, y);
            graphics.lineTo(this.levelWidth, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
        
        this.minimapIgnoreList.push(graphics);
        
        // Add height markers every 5 grid lines
        for (let y = 0; y <= height; y += this.CHAR_WIDTH) {
            const gridLineNumber = Math.round(y / this.CHAR_WIDTH);
            
            if (gridLineNumber % 5 === 0 && gridLineNumber > 0) {
                const leftText = this.add.text(10, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                
                const rightText = this.add.text(this.levelWidth - 40, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                
                const markerGraphics = this.add.graphics();
                markerGraphics.lineStyle(2, 0x4ecdc4, 0.6);
                markerGraphics.moveTo(0, height - y);
                markerGraphics.lineTo(this.levelWidth, height - y);
                markerGraphics.strokePath();
                markerGraphics.setDepth(-50);
                
                this.minimapIgnoreList.push(leftText, rightText, markerGraphics);
            }
        }
    }
    
    createBoundaryWalls(height) {
        const wallThickness = 150;
        const wallColor = 0x2c3e50;
        
        // Create visual boundary
        const graphics = this.add.graphics();
        graphics.fillStyle(wallColor, 0.8);
        graphics.lineStyle(3, 0x34495e, 1);
        
        // Left wall
        graphics.fillRect(-wallThickness, 0, wallThickness, height);
        graphics.strokeRect(-wallThickness, 0, wallThickness, height);
        
        // Right wall
        graphics.fillRect(this.levelWidth, 0, wallThickness, height);
        graphics.strokeRect(this.levelWidth, 0, wallThickness, height);
        
        // Top wall
        graphics.fillRect(0, -wallThickness, this.levelWidth, wallThickness);
        graphics.strokeRect(0, -wallThickness, this.levelWidth, wallThickness);
        
        // Bottom wall
        graphics.fillRect(0, height, this.levelWidth, wallThickness);
        graphics.strokeRect(0, height, this.levelWidth, wallThickness);
        
        // Red boundary line
        graphics.lineStyle(4, 0xe74c3c, 0.8);
        graphics.strokeRect(0, 0, this.levelWidth, height);
        
        // Create physics walls
        // Left and right walls use normal dimensions
        this.matter.add.rectangle(-wallThickness/2, height/2, wallThickness, height, { 
            isStatic: true,
            label: 'wall_left'
        });
        this.matter.add.rectangle(this.levelWidth + wallThickness/2, height/2, wallThickness, height, { 
            isStatic: true,
            label: 'wall_right'
        });
        
        // Top and bottom walls extend 2x the stage width to prevent objects from falling through diagonal corners
        const extendedWidth = this.levelWidth * 2;
        this.matter.add.rectangle(this.levelWidth/2, -wallThickness/2, extendedWidth, wallThickness, { 
            isStatic: true,
            label: 'wall_top'
        });
        this.matter.add.rectangle(this.levelWidth/2, height + wallThickness/2, extendedWidth, wallThickness, { 
            isStatic: true,
            label: 'wall_bottom'
        });
    }
    
    setupControls() {
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        
        // Don't capture WASD keys - let the worm use them for movement
        
        // Ghost toggle
        this.gKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
        
        // Fullscreen toggle
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        
        // Set up F11 fullscreen toggle
        this.f11Key.on('down', function () {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        }, this);
        
        // Track gamepad button states
        this.button0WasPressed = false;
    }
    
    createUI() {
        // Title
        const title = this.add.text(20, 20, this.sceneTitle, {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        this.minimapIgnoreList.push(title);
        
        
        // Pause hint (small text in top right)
        const pauseHint = this.add.text(this.scale.width - 20, 20, 'ESC: Pause', {
            fontSize: '14px',
            color: '#95a5a6',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 2 }
        }).setOrigin(1, 0).setScrollFactor(0);
        
        this.minimapIgnoreList.push(pauseHint);
        
        // Create stopwatch in top center
        this.stopwatch = new Stopwatch(this, this.scale.width / 2, 20);
        // Load best time from state manager
        const bestTime = this.stateManager.getBestTime(this.mapKey);
        if (bestTime !== null) {
            this.stopwatch.setBestTime(bestTime);
        }
        this.minimapIgnoreList.push(this.stopwatch.timerText);
        if (this.stopwatch.bestTimeText) {
            this.minimapIgnoreList.push(this.stopwatch.bestTimeText);
        }
        
        // Ghost indicator (will be shown when ghost is loaded)
        this.ghostIndicator = null;
    }
    
    createMiniMap(levelHeight) {
        // Calculate mini-map position (upper-right corner)
        const screenWidth = this.scale.width;
        const mapX = screenWidth - this.miniMapConfig.width - this.miniMapConfig.padding;
        const mapY = this.miniMapConfig.padding;
        
        // Create mini-map camera
        this.minimap = this.cameras.add(mapX, mapY, this.miniMapConfig.width, this.miniMapConfig.height);
        this.minimap.setBounds(0, 0, this.levelWidth, levelHeight);
        
        // Calculate zoom to fit entire level in mini-map
        const zoomX = this.miniMapConfig.width / this.levelWidth;
        const zoomY = this.miniMapConfig.height / levelHeight;
        const zoom = Math.min(zoomX, zoomY) * 0.9;
        
        this.minimap.setZoom(zoom);
        this.minimap.setBackgroundColor(0x2c3e50);
        this.minimap.centerOn(this.levelWidth / 2, levelHeight / 2);
        this.minimap.setName('minimap');
        
        // Apply ignore list to hide clutter from mini-map
        this.minimapIgnoreList.forEach(element => {
            this.minimap.ignore(element);
        });
        
        if (this.controlsDisplay && this.controlsDisplay.elements) {
            this.minimap.ignore(this.controlsDisplay.elements);
        }
        
        // Hide touch controls from minimap
        if (this.worm && this.worm.inputManager && this.worm.inputManager.touchControls && this.worm.inputManager.touchControls.container) {
            this.minimap.ignore(this.worm.inputManager.touchControls.container);
        }
        
        this.minimapIgnoreList = [];
        
        // Add visual border and viewport indicator
        this.createMiniMapBorder(mapX, mapY);
        this.createViewportIndicator();
    }
    
    createMiniMapBorder(x, y) {
        this.miniMapBorder = this.add.graphics();
        this.miniMapBorder.lineStyle(2, 0x34495e, 1);
        this.miniMapBorder.strokeRect(x, y, this.miniMapConfig.width, this.miniMapConfig.height);
        this.miniMapBorder.setScrollFactor(0);
        this.miniMapBorder.setDepth(1001);
        
        this.miniMapLabel = this.add.text(x + 5, y - 20, 'Map (M)', {
            fontSize: '12px',
            color: '#4ecdc4',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 4, y: 2 }
        }).setScrollFactor(0).setDepth(1001);
        
        if (this.minimap) {
            this.minimap.ignore(this.miniMapBorder);
            this.minimap.ignore(this.miniMapLabel);
        }
    }
    
    createViewportIndicator() {
        // Remove any existing viewport indicator to prevent duplicates
        if (this.viewportIndicator) {
            this.viewportIndicator.destroy();
        }
        
        // Create viewport indicator rectangle  
        // We'll use the actual viewport dimensions from the start
        const mainCam = this.cameras.main;
        const viewWidth = mainCam.width / mainCam.zoom;
        const viewHeight = mainCam.height / mainCam.zoom;
        
        this.viewportIndicator = this.add.rectangle(0, 0, viewWidth, viewHeight, 0x4ecdc4);
        this.viewportIndicator.setStrokeStyle(2, 0x4ecdc4, 0.8);
        this.viewportIndicator.setFillStyle(0x4ecdc4, 0.1);
        this.viewportIndicator.setDepth(100);
        
        // IMPORTANT: Main camera should ignore it, but minimap should see it
        this.cameras.main.ignore(this.viewportIndicator);
    }
    
    handleResize() {
        const width = this.scale.width;
        
        // Safety check for camera existence
        if (this.cameras && this.cameras.main && this.cameraTarget) {
            this.cameras.main.startFollow(this.cameraTarget, true);
            this.cameras.main.setZoom(1);
            this.cameras.main.setDeadzone(100, 100);
        }
        
        if (this.minimap) {
            const mapX = width - this.miniMapConfig.width - this.miniMapConfig.padding;
            const mapY = this.miniMapConfig.padding;
            this.minimap.setPosition(mapX, mapY);
            this.updateMiniMapBorder(mapX, mapY);
            // Don't update viewport indicator during initial setup
            // It will be created and updated later in createMiniMap
        }
    }
    
    updateMiniMapBorder(x, y) {
        if (this.miniMapBorder) {
            this.miniMapBorder.clear();
            this.miniMapBorder.lineStyle(2, 0x34495e, 1);
            this.miniMapBorder.strokeRect(x, y, this.miniMapConfig.width, this.miniMapConfig.height);
        }
        
        if (this.miniMapLabel) {
            this.miniMapLabel.setPosition(x + 5, y - 20);
        }
    }
    
    updateViewportIndicator() {
        if (!this.viewportIndicator || !this.minimap || !this.miniMapConfig.visible) return;
        
        const mainCam = this.cameras.main;
        if (!mainCam || !mainCam.width || !mainCam.height || !mainCam.zoom) return;
        
        // Calculate the actual world view dimensions of the main camera
        const viewWidth = mainCam.width / mainCam.zoom;
        const viewHeight = mainCam.height / mainCam.zoom;
        
        if (!mainCam.worldView) return;
        
        const centerX = mainCam.worldView.centerX;
        const centerY = mainCam.worldView.centerY;
        
        // Update position to match camera center
        if (this.viewportIndicator.setPosition) {
            this.viewportIndicator.setPosition(centerX, centerY);
        }
        
        // Update size to match viewport dimensions
        // Check if setSize method exists (it may not be available during initialization)
        if (this.viewportIndicator.setSize) {
            this.viewportIndicator.setSize(viewWidth, viewHeight);
        }
    }
    
    update(time, delta) {
        // Guard against update being called before create() finishes
        if (!this.escKey || !this.tabKey || !this.rKey) {
            return;
        }
        
        // Don't update during victory or pause states
        if (this.victoryAchieved || this.isPaused) {
            // Victory dialog or pause menu handles all interactions
            return;
        }
        
        // Update worm if it exists (from BaseLevelScene)
        if (this.worm && typeof this.worm.update === 'function') {
            this.worm.update(delta);
        }
        
        // Update stopwatch
        if (this.stopwatch && !this.victoryAchieved) {
            this.stopwatch.update();
        }
        
        // Record ghost frame with input state
        if (this.ghostRecorder && this.ghostRecorder.isRecording && this.worm && this.worm.segments) {
            // Get current input state from the worm's input manager
            let inputState = null;
            if (this.worm.inputManager && this.worm.inputManager.getInputState) {
                inputState = this.worm.inputManager.getInputState(delta);
            }
            this.ghostRecorder.recordFrame(this.worm.segments, this.stopwatch.elapsedTime, inputState);
        }
        
        // Update ghost playback
        if (this.ghostPlayer && this.stopwatch) {
            this.ghostPlayer.update(this.stopwatch.elapsedTime);
        }
        
        // Server mode keyboard shortcuts
        if (this.buildMode === 'server') {
            // TAB key to toggle between play and edit modes
            if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
                // If we have a returnScene of MapEditor, go back to it
                if (this.returnScene === 'MapEditor' && this.scene.manager.getScene('MapEditor')) {
                    this.scene.stop();
                    this.scene.start('MapEditor');
                } else {
                    console.warn('Map editor not available or not set as return scene');
                }
                return;
            }
            
            // R key to reset level (only in play mode)
            if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
                this.handleRestart('manual_restart');
                return;
            }
        }
        
        // ESC key opens pause menu
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.showPauseMenu();
            return;
        }
        
        // Check for gamepad option button (button 9 is typically Options/Start)
        const pad = this.input.gamepad.getPad(0);
        if (pad && pad.buttons[9]) {
            const optionButtonPressed = pad.buttons[9].pressed;
            if (optionButtonPressed && !this.optionButtonWasPressed) {
                this.showPauseMenu();
            }
            this.optionButtonWasPressed = optionButtonPressed;
        } else {
            this.optionButtonWasPressed = false;
        }
        
        // Update special platforms and dynamic platforms
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.update) {
                platform.instance.update(time, delta);
            }
            
            // Sync visual with physics body for dynamic platforms
            if (platform.body && !platform.body.isStatic && platform.visual) {
                platform.visual.x = platform.body.position.x;
                platform.visual.y = platform.body.position.y;
                platform.visual.rotation = platform.body.angle;
            }
        });
        
        // Render constraints (Matter.js doesn't render them by default in production)
        if (this.constraints && this.constraints.length > 0) {
            // console.log(`Rendering ${this.constraints.length} constraints`);
            this.renderConstraints();
        }
        
        // Check for M key to toggle mini-map
        if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
            this.toggleMiniMap();
        }
        
        // Check for G key to toggle ghost
        if (Phaser.Input.Keyboard.JustDown(this.gKey)) {
            this.toggleGhost();
        }
        
        // Check for gamepad button M to toggle mini-map
        if (pad && pad.buttons[2] && pad.buttons[2].pressed && !this.buttonMWasPressed) {
            this.toggleMiniMap();
        }
        this.buttonMWasPressed = pad && pad.buttons[2] && pad.buttons[2].pressed;
        
        // Update camera target to follow worm
        if (this.cameraTarget && this.worm) {
            const head = this.worm.getHead();
            const tail = this.worm.getTail();
            if (head && tail) {
                this.cameraTarget.x = (head.position.x + tail.position.x) / 2;
                this.cameraTarget.y = (head.position.y + tail.position.y) / 2;
            }
        }
        
        // Update mini-map
        if (this.minimap && this.worm && this.miniMapConfig.visible) {
            const head = this.worm.getHead();
            if (head && head.position) {
                this.minimap.centerOn(head.position.x, head.position.y);
            }
            // Only update viewport indicator if it exists
            if (this.viewportIndicator) {
                this.updateViewportIndicator();
            }
        }
        
        // Check if worm has fallen off the map
        this.checkWormFallOff();
        
        // Check victory condition - any part of worm touching goal
        if (this.goal && this.worm && this.worm.segments) {
            for (let i = 0; i < this.worm.segments.length; i++) {
                const segment = this.worm.segments[i];
                const distance = Phaser.Math.Distance.Between(
                    segment.position.x, segment.position.y,
                    this.goal.x, this.goal.y
                );
                
                const segmentRadius = this.worm.segmentRadii[i] || 15;
                const goalRadius = 20;
                const collisionDistance = segmentRadius + goalRadius;
                
                if (distance < collisionDistance) {
                    this.victory();
                    return;
                }
            }
        }
    }
    
    
    async setupVictoryUI() {
        // Add VictoryDialog scene if not already added
        if (!this.scene.manager.getScene('VictoryDialog')) {
            this.scene.manager.add('VictoryDialog', VictoryDialog, false);
        }
        
        // Sleep this scene (better than pause for overlay scenes)
        this.scene.sleep();
        this.scene.launch('VictoryDialog', {
            gameScene: this,
            mapKey: this.mapKey || this.scene.key,
            sceneTitle: this.sceneTitle,
            stopwatch: this.stopwatch,
            getBestTime: () => this.stateManager.getBestTime(this.mapKey)
        });
    }
    
    toggleMiniMap() {
        if (this.minimap) {
            this.miniMapConfig.visible = !this.miniMapConfig.visible;
            this.minimap.setVisible(this.miniMapConfig.visible);
            
            if (this.miniMapBorder) {
                this.miniMapBorder.setVisible(this.miniMapConfig.visible);
            }
            if (this.miniMapLabel) {
                this.miniMapLabel.setVisible(this.miniMapConfig.visible);
            }
            if (this.viewportIndicator) {
                this.viewportIndicator.setVisible(this.miniMapConfig.visible);
            }
            
            const text = this.add.text(this.scale.width / 2, 50, 
                this.miniMapConfig.visible ? 'Mini-map ON' : 'Mini-map OFF', {
                fontSize: '20px',
                color: this.miniMapConfig.visible ? '#4ecdc4' : '#ff6b6b',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setScrollFactor(0);
            
            if (this.minimap) {
                this.minimap.ignore(text);
            }
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 1500,
                onComplete: () => text.destroy()
            });
        }
    }
    
    async victory() {
        // Set victory flag to handle input differently (from BaseLevelScene)
        this.victoryAchieved = true;
        
        // Stop the timer and save best time
        if (this.stopwatch) {
            const completionTime = this.stopwatch.stop();

            const elapsedTime = this.stopwatch.elapsedTime;
            
            // Get recording data ONCE
            if (this.ghostRecorder && this.ghostRecorder.isRecording) {
                this.ghostRecorder.stopRecording();
            }
            const recordingData = this.ghostRecorder ? await this.ghostRecorder.getRecordingData() : null;
            
            // Save to IndexedDB (all recordings)
            if (recordingData) {
                await this.saveRecordingToIndexedDBWithData(true, elapsedTime, null, recordingData);
            }
        
            this.saveBestTime(completionTime);
            
            // Save ghost if best (localStorage)
            await this.saveGhostIfBest(completionTime, recordingData);
        }
        
        // NOW clean up worm after screenshot is taken
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        // Set up victory UI last
        this.setupVictoryUI();
    }
    
    
    saveBestTime(time) {
        // Update best time and mark as completed through state manager
        const isNewBest = this.stateManager.updateBestTime(this.mapKey, time);
        
        if (isNewBest) {
            this.stopwatch.setBestTime(time);
        }
        
        // Mark map as completed
        this.stateManager.completeMap(this.mapKey, time);
    }
    
    // Ghost system methods
    async initializeGhostSystem() {
        // Initialize recorder
        this.ghostRecorder = new GhostRecorder(this, this.worm ? this.worm.segments.length : 12);
        this.ghostRecorder.startRecording();
        
        // Try to load existing ghost
        const ghostData = await this.ghostStorage.loadGhost(this.mapKey, this.mapData);
        if (ghostData) {
            console.log('Ghost data loaded:', {
                segmentCount: ghostData.segmentCount,
                frameCount: ghostData.frameCount,
                duration: ghostData.duration,
                completionTime: ghostData.completionTime,
                dataLength: ghostData.data?.length
            });
            const segmentCount = ghostData.segmentCount || 12; // Default to 12 if missing
            this.ghostPlayer = new GhostPlayer(this, segmentCount);
            const loaded = await this.ghostPlayer.loadGhostData(ghostData);
            // Don't start the ghost yet - wait for stopwatch to start
            
            if (loaded) {
                console.log(`Ghost loaded successfully with ${this.ghostPlayer.frames.length} frames, time: ${this.formatTime(ghostData.completionTime)}`);
            } else {
                console.error('Failed to load ghost data into player');
            }
            
            // Create ghost indicator UI
            this.createGhostIndicator(ghostData.completionTime);
        }
    }
    
    createGhostIndicator(ghostTime) {
        // Ghost race indicator
        this.ghostIndicator = this.add.text(20, 60, `Racing ghost! (${this.formatTime(ghostTime)})`, {
            fontSize: '18px',
            color: '#9b59b6',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0).setDepth(1000);
        
        // Add pulsing effect to indicator
        this.tweens.add({
            targets: this.ghostIndicator,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        if (this.minimap) {
            this.minimap.ignore(this.ghostIndicator);
        }
    }
    
    captureScreenshot() {
        // Simple synchronous capture that works for death events
        try {
            const canvas = this.game.canvas;
            if (!canvas) {
                console.warn('📸 No canvas found for screenshot');
                return null;
            }
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            console.log('📸 Screenshot captured, size:', dataUrl.length);
            return dataUrl;
        } catch (error) {
            console.error('📸 Error capturing screenshot:', error);
            return null;
        }
    }
    
    async saveRecordingToIndexedDBWithData(success, completionTime = null, deathReason = null, recordingData = null) {
        console.log('🎬 saveRecordingToIndexedDBWithData called:', {
            success,
            completionTime,
            deathReason,
            mapKey: this.mapKey,
            hasRecorder: !!this.ghostRecorder,
            hasDb: !!this.recordingDb,
            hasRecordingData: !!recordingData
        });
        
        if (!this.recordingDb) {
            console.warn('Missing recording database');
            return;
        }
        
        // Capture screenshot BEFORE any other operations
        const screenshot = this.captureScreenshot();
        console.log('📸 Screenshot captured:', screenshot ? `success (${screenshot.length} bytes)` : 'failed');
        
        // Use provided recording data or get it from recorder
        if (!recordingData && this.ghostRecorder) {
            // Only stop and get data if not already provided
            if (this.ghostRecorder.isRecording) {
                this.ghostRecorder.stopRecording();
            }
            recordingData = await this.ghostRecorder.getRecordingData();
        }
        
        if (!recordingData) {
            console.warn('No recording data available');
            return;
        }
        
        console.log('📹 Recording data obtained:', {
            frameCount: recordingData.frameCount,
            duration: recordingData.duration,
            dataLength: recordingData.data?.length
        });
        
        // Prepare recording data for IndexedDB
        const dbRecordingData = {
            mapKey: this.mapKey,
            mapTitle: this.sceneTitle || this.mapKey,
            success: success,
            completionTime: completionTime,
            deathReason: deathReason,
            timestamp: new Date().toISOString(),
            duration: recordingData.duration,
            frameCount: recordingData.frameCount,
            segmentCount: recordingData.segmentCount,
            compression: recordingData.compression,
            encoding: recordingData.encoding,
            data: recordingData.data,
            screenshot: screenshot
        };
        
        console.log('💾 Attempting to save to IndexedDB:', {
            mapKey: this.mapKey,
            success: success,
            deathReason: deathReason,
            screenshotSize: screenshot ? screenshot.length : 0
        });
        
        try {
            const recordingId = await this.recordingDb.saveRecording(dbRecordingData);
            console.log(`✅ Recording saved to IndexedDB with ID: ${recordingId}`);
            
            // Show confirmation
            const text = this.add.text(this.scale.width / 2, 100, 
                success ? '📹 Victory saved!' : '💀 Death saved!', {
                fontSize: '24px',
                color: success ? '#4ecdc4' : '#e74c3c',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                y: 50,
                duration: 2000,
                ease: 'Power2',
                onComplete: () => text.destroy()
            });
        } catch (error) {
            console.error('Failed to save recording to IndexedDB:', error);
        }
    }
    
    async saveRecordingToIndexedDB(success, completionTime = null, deathReason = null) {
        console.log('🎬 saveRecordingToIndexedDB called:', {
            success,
            completionTime,
            deathReason,
            mapKey: this.mapKey,
            hasRecorder: !!this.ghostRecorder,
            hasDb: !!this.recordingDb
        });
        
        if (!this.ghostRecorder || !this.recordingDb) {
            console.warn('Missing recorder or database:', {
                recorder: !!this.ghostRecorder,
                db: !!this.recordingDb
            });
            return;
        }
        
        // Capture screenshot BEFORE stopping recording or getting data
        const screenshot = this.captureScreenshot();
        console.log('📸 Screenshot captured:', screenshot ? `success (${screenshot.length} bytes)` : 'failed');
        
        // Now stop recording and get data
        if (this.ghostRecorder.isRecording) {
            this.ghostRecorder.stopRecording();
        }
        const recordingData = await this.ghostRecorder.getRecordingData();
        
        if (!recordingData) {
            console.warn('No recording data available');
            return;
        }
        
        console.log('📹 Recording data obtained:', {
            frameCount: recordingData.frameCount,
            duration: recordingData.duration,
            dataLength: recordingData.data?.length
        });
        
        // Prepare recording data for IndexedDB
        const dbRecordingData = {
            mapKey: this.mapKey,
            mapTitle: this.sceneTitle || this.mapKey,
            success: success,
            completionTime: completionTime,
            deathReason: deathReason,
            timestamp: new Date().toISOString(),
            duration: recordingData.duration,
            frameCount: recordingData.frameCount,
            segmentCount: recordingData.segmentCount,
            compression: recordingData.compression,
            encoding: recordingData.encoding,
            screenshot: screenshot,
            recordingData: recordingData.data, // The actual frame data
            mapData: {
                // Store minimal map data for validation
                platforms: this.mapData.platforms?.length || 0,
                entities: this.mapData.entities?.length || 0,
                dimensions: this.mapData.dimensions
            }
        };
        
        console.log('💾 Attempting to save to IndexedDB:', {
            mapKey: dbRecordingData.mapKey,
            success: dbRecordingData.success,
            deathReason: dbRecordingData.deathReason,
            screenshotSize: screenshot?.length || 0
        });
        
        try {
            const recordingId = await this.recordingDb.saveRecording(dbRecordingData);
            console.log(`✅ Recording saved to IndexedDB with ID: ${recordingId}`);
            
            // Show feedback to user
            const message = success ? 'Victory recording saved!' : 'Recording saved!';
            const color = success ? '#4ecdc4' : '#e74c3c';
            
            const text = this.add.text(this.scale.width / 2, 120, message, {
                fontSize: '18px',
                color: color,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 2000,
                delay: 1000,
                onComplete: () => text.destroy()
            });
        } catch (error) {
            console.error('Failed to save recording to IndexedDB:', error);
        }
    }
    
    async saveGhostIfBest(completionTime, recordingData = null) {
        if (!this.ghostRecorder || !this.ghostStorage) {
            return;
        }
        
        // Check if this is the best time for localStorage ghost
        if (!this.ghostStorage.shouldSaveGhost(this.mapKey, completionTime)) {
            return;
        }
        
        // Use provided recording data or get it from recorder
        if (!recordingData) {
            // Only stop and get data if not already provided
            if (this.ghostRecorder.isRecording) {
                this.ghostRecorder.stopRecording();
            }
            recordingData = await this.ghostRecorder.getRecordingData();
        }
        
        if (recordingData) {
            await this.ghostStorage.saveGhost(
                this.mapKey,
                this.mapData,
                recordingData,
                completionTime
            );
        }
    }
    
    async handleRestart(reason = 'unknown') {
        console.log('🔄 handleRestart called with reason:', reason);
        
        // Save the recording as a failure before restarting
        const elapsedTime = this.stopwatch ? this.stopwatch.elapsedTime : 0;
        console.log('⏱️ Elapsed time before restart:', elapsedTime);
        
        await this.saveRecordingToIndexedDB(false, elapsedTime, reason);
        
        console.log('🔄 Restarting scene now...');
        // Now restart the scene
        this.scene.restart();
    }
    
    checkWormFallOff() {
        if (!this.worm || !this.worm.segments || this.victoryAchieved) {
            return;
        }
        
        // Check if any segment has fallen below the level
        const fallThreshold = this.levelHeight + 100; // Some buffer below the level
        
        for (let segment of this.worm.segments) {
            if (segment.position.y > fallThreshold) {
                // Worm has fallen off the map
                this.handleRestart('fell_off_map');
                return;
            }
        }
    }
    
    toggleGhost() {
        this.ghostVisible = !this.ghostVisible;
        
        if (this.ghostPlayer) {
            this.ghostPlayer.setVisible(this.ghostVisible);
        }
        
        // Show feedback
        const text = this.add.text(this.scale.width / 2, 80, 
            this.ghostVisible ? 'Ghost ON' : 'Ghost OFF', {
            fontSize: '20px',
            color: this.ghostVisible ? '#9b59b6' : '#e74c3c',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        if (this.minimap) {
            this.minimap.ignore(text);
        }
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    showPauseMenu() {
        // Add PauseMenu scene if not already added
        if (!this.scene.manager.getScene('PauseMenu')) {
            this.scene.manager.add('PauseMenu', PauseMenu, false);
        }
        
        // Mark as paused
        this.isPaused = true;
        
        // Pause this scene (it will still render but not update) and launch pause menu
        this.scene.pause();
        this.scene.launch('PauseMenu', {
            gameScene: this,
            mapKey: this.mapKey || this.scene.key
        });
    }
}
