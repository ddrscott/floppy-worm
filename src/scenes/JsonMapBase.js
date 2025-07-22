import Phaser from 'phaser';
import BaseLevelScene from './BaseLevelScene';
import DoubleWorm from '../entities/DoubleWorm';
import VirtualControls from '../components/VirtualControls';
import ControlsDisplay from '../components/ControlsDisplay';
import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';

export default class JsonMapBase extends BaseLevelScene {
    constructor(config = {}) {
        super(config);
        
        // Level dimension constants - can be overridden in subclasses
        this.CHAR_WIDTH = config.charWidth || 96;
        this.CHAR_HEIGHT = config.charHeight || 48;
        this.ROW_SPACING = config.rowSpacing || 96;
        
        // JSON level data - should be provided in subclasses or config
        this.mapData = config.mapData || this.getDefaultMapData();
        
        // Scene configuration
        this.sceneTitle = config.title || this.mapData.metadata?.name || 'JSON Level';
        this.returnScene = config.returnScene || 'MapSelectScene';
        
        // Victory state tracking
        this.victoryAchieved = false;
        
        this.platforms = [];
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
    }
    
    getDefaultMapData() {
        return {
            metadata: {
                name: "Default Level",
                difficulty: 1,
                description: "A basic test level"
            },
            dimensions: {
                width: 16,
                height: 8
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
    
    cleanup() {
        // Call parent cleanup (handles worm, victory state, timers)
        super.cleanup();
        
        // Cleanup special platforms
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.destroy) {
                platform.instance.destroy();
            }
        });
        
        // Clear platforms array
        this.platforms = [];
        
        // Clear mini-map ignore list
        this.minimapIgnoreList = [];
        
        // Remove mouse constraint if it exists
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
    }

    create() {
        // Call parent create (handles cleanup and shutdown event)
        super.create();
        
        // Turn off debug rendering for cleaner visuals
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
    }
    
    loadMapFromJSON() {
        const { platforms, entities } = this.mapData;
        
        // Create platforms
        platforms.forEach(platformData => {
            this.createPlatformFromJSON(platformData);
        });
        
        // Create entities
        this.createEntitiesFromJSON(entities);
    }
    
    createPlatformFromJSON(platformData) {
        const { type, platformType = 'standard', physics = {}, color, id } = platformData;
        
        // Check if this is a special platform type
        if (platformType && platformType !== 'standard') {
            const platformInstance = this.createSpecialPlatform(platformData);
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
        
        // Apply physics properties
        const defaultPhysics = {
            isStatic: true,
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0
        };
        
        const appliedPhysics = { ...defaultPhysics, ...physics };
        Object.keys(appliedPhysics).forEach(key => {
            if (key === 'isStatic') {
                // isStatic is set during body creation
                return;
            }
            this.matter.body.set(body, key, appliedPhysics[key]);
        });
        
        this.platforms.push({ 
            body, visual, data: platformData, id: id || `platform_${this.platforms.length}`
        });
    }
    
    createSpecialPlatform(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, color } = platformData;
        
        // Use the same coordinate transformations as regular platforms
        const centerX = x;
        const centerY = y;
        
        // Apply physics from JSON with proper defaults
        const config = {
            color: parseInt((color || '#ff6b6b').replace('#', '0x')),
            shape: type, // Pass the shape type (rectangle, circle, etc.)
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
                
            default:
                console.warn(`Unknown special platform type: ${platformType}`);
                return null;
        }
    }
    
    setupSpecialPlatformCollisions() {
        // Set up Matter.js collision events for special platforms
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                
                // Check if one body is a worm segment and the other is a special platform
                const wormSegment = this.isWormSegment(bodyA) ? bodyA : (this.isWormSegment(bodyB) ? bodyB : null);
                const platformBody = wormSegment === bodyA ? bodyB : bodyA;
                
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
        // Check if this body belongs to the worm
        return this.worm && this.worm.segments && this.worm.segments.includes(body);
    }
    
    createRectanglePlatform(platformData) {
        const { x, y, width, height, color = "#ff6b6b" } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, width/height are in pixels
        const centerX = x;
        const centerY = y;
        const pixelWidth = width;
        const pixelHeight = height;
        
        const body = this.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, {
            isStatic: true
        });
        
        const visual = this.add.rectangle(centerX, centerY, pixelWidth, pixelHeight, parseInt(color.replace('#', '0x')));
        
        return { body, visual };
    }
    
    createCirclePlatform(platformData) {
        const { x, y, radius, color = "#4ecdc4" } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, radius in pixels
        const centerX = x;
        const centerY = y;
        const pixelRadius = radius;
        
        const body = this.matter.add.circle(centerX, centerY, pixelRadius, {
            isStatic: true
        });
        
        const visual = this.add.circle(centerX, centerY, pixelRadius, parseInt(color.replace('#', '0x')));
        
        return { body, visual };
    }
    
    createPolygonPlatform(platformData) {
        const { x, y, sides, radius, rotation = 0, color = "#95e1d3" } = platformData;
        
        // Use pixel coordinates directly - x,y is center position, radius in pixels
        const centerX = x;
        const centerY = y;
        const pixelRadius = radius;
        
        // Create regular polygon vertices
        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i / sides) + rotation;
            vertices.push({
                x: centerX + pixelRadius * Math.cos(angle),
                y: centerY + pixelRadius * Math.sin(angle)
            });
        }
        
        const body = this.matter.add.fromVertices(centerX, centerY, vertices, {
            isStatic: true
        });
        
        // Create visual polygon
        const visual = this.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        
        return { body, visual };
    }
    
    createTrapezoidPlatform(platformData) {
        const { x, y, width, height, slope = 0, color = "#feca57" } = platformData;
        
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
        
        const body = this.matter.add.fromVertices(centerX, centerY, vertices, {
            isStatic: true
        });
        
        // Create visual trapezoid
        const visual = this.add.polygon(centerX, centerY, vertices, parseInt(color.replace('#', '0x')));
        
        return { body, visual };
    }
    
    createCustomPlatform(platformData) {
        const { vertices, color = "#a29bfe" } = platformData;
        
        // Use pixel coordinates directly - vertices are already in world coordinates
        const pixelVertices = vertices;
        
        // Calculate center point for body positioning
        const centerX = pixelVertices.reduce((sum, v) => sum + v.x, 0) / pixelVertices.length;
        const centerY = pixelVertices.reduce((sum, v) => sum + v.y, 0) / pixelVertices.length;
        
        const body = this.matter.add.fromVertices(centerX, centerY, pixelVertices, {
            isStatic: true
        });
        
        // Create visual polygon
        const visual = this.add.polygon(centerX, centerY, pixelVertices, parseInt(color.replace('#', '0x')));
        
        return { body, visual };
    }
    
    createEntitiesFromJSON(entitiesData) {
        const { wormStart, goal } = entitiesData;
        
        // Use pixel coordinates directly for entity placement
        const wormX = wormStart.x;
        const wormY = wormStart.y;
        
        // Store start position for resets
        this.wormStartPosition = { x: wormX, y: wormY };
        
        this.worm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: false
        });

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
        this.matter.add.rectangle(-wallThickness/2, height/2, wallThickness, height, { isStatic: true });
        this.matter.add.rectangle(this.levelWidth + wallThickness/2, height/2, wallThickness, height, { isStatic: true });
        this.matter.add.rectangle(this.levelWidth/2, -wallThickness/2, this.levelWidth, wallThickness, { isStatic: true });
        this.matter.add.rectangle(this.levelWidth/2, height + wallThickness/2, this.levelWidth, wallThickness, { isStatic: true });
    }
    
    setupControls() {
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        
        // Camera controls
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Virtual controls (joystick + buttons)
        this.virtualControls = new VirtualControls(this);
        
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
        
        // Controls - only show on desktop
        const isTouchDevice = ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0) || 
                            (navigator.msMaxTouchPoints > 0);
        
        if (!isTouchDevice) {
            this.controlsDisplay = new ControlsDisplay(this, 20, 60);
            this.minimapIgnoreList.push(this.controlsDisplay.elements);
        }
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
        this.viewportIndicator = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x4ecdc4);
        this.viewportIndicator.setStrokeStyle(5, 0x4ecdc4, 0.8);
        this.viewportIndicator.setFillStyle(0x4ecdc4, 0.1);
        this.viewportIndicator.setDepth(100);
        
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
            this.updateViewportIndicator();
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
        const miniZoom = this.minimap.zoom;
        
        const viewWidth = mainCam.width / mainCam.zoom;
        const viewHeight = mainCam.height / mainCam.zoom;
        
        const centerX = mainCam.worldView.centerX;
        const centerY = mainCam.worldView.centerY;
        
        this.viewportIndicator.setPosition(centerX, centerY);
        
        const scaleX = viewWidth * miniZoom / 50;
        const scaleY = viewHeight * miniZoom / 30;
        this.viewportIndicator.setScale(scaleX, scaleY);
    }
    
    update(time, delta) {
        // Handle victory screen input
        if (this.victoryAchieved) {
            const pad = this.input.gamepad.getPad(0);
            
            // SPACE key to go to next level (if available)
            if (this.hasNextLevel && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this.scene.start(this.nextMapKey);
                return;
            }
            
            // ESC key to return to map select
            if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
                this.scene.start('MapSelectScene');
                return;
            }
            
            // Gamepad button A (0) for next level, B (1) for map select
            if (pad && pad.buttons[0] && pad.buttons[0].pressed && !this.button0WasPressed) {
                if (this.hasNextLevel) {
                    this.scene.start(this.nextMapKey);
                } else {
                    this.scene.start('MapSelectScene');
                }
                return;
            }
            
            // Gamepad button B (1) for map select
            if (pad && pad.buttons[1] && pad.buttons[1].pressed && !this.button1WasPressed) {
                this.scene.start('MapSelectScene');
                return;
            }
            
            this.button0WasPressed = pad && pad.buttons[0] && pad.buttons[0].pressed;
            this.button1WasPressed = pad && pad.buttons[1] && pad.buttons[1].pressed;
            
            // Don't process normal game logic during victory
            return;
        }
        
        // Normal ESC handling (only if not in victory state)
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start(this.returnScene);
            return;
        }
        
        this.worm.update(delta);
        
        // Update special platforms
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.update) {
                platform.instance.update(delta);
            }
        });
        
        // Check for gamepad button M to toggle mini-map
        const pad = this.input.gamepad.getPad(0);
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
            if (head) {
                this.minimap.centerOn(head.position.x, head.position.y);
            }
            this.updateViewportIndicator();
        }
        
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
    
    victory() {
        // Call parent victory (handles worm cleanup and victory state)
        super.victory();
        
        // Create dark overlay
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.8);
        overlay.setScrollFactor(0);
        overlay.setDepth(1000);
        
        // Victory dialog background
        const dialogBg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 500, 350, 0x2c3e50, 0.95);
        dialogBg.setScrollFactor(0);
        dialogBg.setDepth(1001);
        dialogBg.setStrokeStyle(4, 0x4ecdc4, 1);
        
        const victoryText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 120, 'LEVEL COMPLETE!', {
            fontSize: '48px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        
        const completionText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, `Well done!`, {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
        
        // Menu button
        const menuButton = this.add.rectangle(this.scale.width / 2, this.scale.height / 2 + 20, 180, 50, 0x3498db);
        menuButton.setScrollFactor(0).setDepth(1002);
        menuButton.setStrokeStyle(2, 0x4ecdc4, 1);
        menuButton.setInteractive();
        
        const menuText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, 'Return to Menu', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);
        
        menuButton.on('pointerdown', () => {
            this.scene.start('MapSelectScene');
        });
        
        menuButton.on('pointerover', () => {
            menuButton.setFillStyle(0x4ecdc4);
        });
        
        menuButton.on('pointerout', () => {
            menuButton.setFillStyle(0x3498db);
        });
        
        // Hide from minimap
        if (this.minimap) {
            this.minimap.ignore(overlay);
            this.minimap.ignore(dialogBg);
            this.minimap.ignore(victoryText);
            this.minimap.ignore(completionText);
            this.minimap.ignore(menuButton);
            this.minimap.ignore(menuText);
        }
        
        // Celebration effect
        for (let i = 0; i < 15; i++) {
            this.time.delayedCall(i * 100, () => {
                const star = this.add.star(
                    Phaser.Math.Between(200, this.scale.width - 200),
                    Phaser.Math.Between(100, this.scale.height - 100),
                    5, 8, 15,
                    Phaser.Display.Color.RandomRGB().color
                ).setScrollFactor(0).setDepth(999);
                
                if (this.minimap) {
                    this.minimap.ignore(star);
                }
                
                this.tweens.add({
                    targets: star,
                    alpha: 0,
                    scale: 1.5,
                    rotation: Math.PI * 2,
                    duration: 2000,
                    onComplete: () => star.destroy()
                });
            });
        }
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
}
