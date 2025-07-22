import Phaser from 'phaser';
import * as dat from 'dat.gui';
import JsonMapBase from './JsonMapBase';
import DoubleWorm from '../entities/DoubleWorm';
import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';

export default class MapEditor extends Phaser.Scene {
    constructor() {
        super({ key: 'MapEditor' });
        
        // Editor state
        this.isTestMode = false;
        this.selectedTool = 'rectangle';
        this.selectedPlatform = null;
        this.platforms = [];
        this.entities = {
            wormStart: { x: 200, y: 900 },
            goal: { x: 1700, y: 200 }
        };
        
        // Simple selection and resize handles
        this.selectedPlatform = null;
        this.resizeHandles = [];
        this.isResizing = false;
        this.activeResizeHandle = null;
        
        // Grid settings
        this.CHAR_WIDTH = 96;
        this.CHAR_HEIGHT = 48;
        this.ROW_SPACING = 96;
        this.gridSnapEnabled = true;
        
        // Map settings
        this.mapData = {
            metadata: {
                name: "New Map",
                difficulty: 1,
                description: "A custom level"
            },
            dimensions: {
                width: 1920,
                height: 1152
            },
            entities: this.entities,
            platforms: this.platforms
        };
        
        // Tool settings
        this.toolSettings = {
            platformColor: "#ff6b6b",
            platformType: "standard",
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0,
            polygonSides: 6,
            polygonRadius: 2,
            trapezoidSlope: 0.3
        };
        
        // Input will be set up in create() method
        
        // UI elements
        this.wormSprite = null;
        this.wormText = null;
        this.goalSprite = null;
        this.testWorm = null;
        
        // Auto-save settings
        this.autoSaveTimer = null;
        this.autoSaveDelay = 1000; // Auto-save 1 second after last change
        
        // Saved maps list
        this.savedMaps = this.getSavedMaps();
        
        // Try to restore the current editing session
        this.restoreEditingSession();
    }
    
    create() {
        // Turn off debug rendering initially
        this.matter.world.drawDebug = false;
        
        // Use pixel dimensions directly
        const levelWidth = this.mapData.dimensions.width;
        const levelHeight = this.mapData.dimensions.height;
        
        // Set world bounds
        this.matter.world.setBounds(0, 0, levelWidth, levelHeight, 1000);
        
        // Create grid
        this.createGrid(levelWidth, levelHeight);
        
        // Create boundary walls (visual only in editor)
        this.createBoundaryWalls(levelWidth, levelHeight);
        
        // Restore platforms from session if any
        if (this.mapData.platforms && this.mapData.platforms.length > 0) {
            this.mapData.platforms.forEach(platformData => {
                this.addPlatformToScene(platformData);
            });
        }
        
        // Create entities
        this.createEntitySprites();
        
        // Setup input
        this.setupInput();
        
        // Simple click selection (not drag-based)
        this.input.on('pointerup', (pointer) => {
            // Don't process platform selection if we just finished resizing
            if (this.justFinishedResizing) {
                this.justFinishedResizing = false;
                return;
            }
            
            if (this.isTestMode) return;
            
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            
            // Check if clicking on platform container
            const clickedPlatform = this.platforms.find(p => 
                this.isContainerAtPosition(p, worldX, worldY)
            );
            
            if (clickedPlatform) {
                this.selectPlatform(clickedPlatform);
            } else {
                this.selectPlatform(null);
            }
        });
        
        // Setup camera
        this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);
        this.cameras.main.setZoom(0.8);
        this.cameras.main.centerOn(levelWidth / 2, levelHeight / 2);
        
        // Create GUI
        this.setupGUI();
    }
    
    getSavedMaps() {
        try {
            const saved = localStorage.getItem('floppy-worm-editor-maps');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Failed to load saved maps:', e);
            return {};
        }
    }
    
    restoreEditingSession() {
        try {
            const session = localStorage.getItem('floppy-worm-editor-session');
            if (session) {
                const sessionData = JSON.parse(session);
                this.mapData = sessionData.mapData;
                this.entities = sessionData.entities;
                this.platforms = []; // Will be rebuilt from mapData.platforms
                console.log('Restored editing session');
            }
        } catch (e) {
            console.warn('Failed to restore editing session:', e);
        }
    }
    
    autoSave() {
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        // Set new timer
        this.autoSaveTimer = setTimeout(() => {
            this.saveEditingSession();
        }, this.autoSaveDelay);
    }
    
    saveEditingSession() {
        try {
            // Update map data with current state
            this.mapData.entities = this.entities;
            this.mapData.platforms = this.platforms.map(p => p.data);
            this.mapData.metadata.modified = new Date().toISOString();
            
            // Save to localStorage
            const sessionData = {
                mapData: this.mapData,
                entities: this.entities,
                lastSaved: new Date().toISOString()
            };
            
            localStorage.setItem('floppy-worm-editor-session', JSON.stringify(sessionData));
            console.log('Auto-saved editing session');
        } catch (e) {
            console.error('Failed to auto-save editing session:', e);
        }
    }
    
    saveMapsToStorage() {
        try {
            localStorage.setItem('floppy-worm-editor-maps', JSON.stringify(this.savedMaps));
        } catch (e) {
            console.error('Failed to save maps to localStorage:', e);
        }
    }
    
    createGrid(width, height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x444444, 0.5);
        
        // Vertical lines
        for (let x = 0; x <= width; x += this.CHAR_WIDTH) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += this.ROW_SPACING) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
        
        this.gridGraphics = graphics;
        
        // Add grid markers every 5 lines
        for (let x = 0; x <= width; x += this.CHAR_WIDTH * 5) {
            const gridX = x / this.CHAR_WIDTH;
            if (gridX > 0) {
                this.add.text(x - 10, height + 10, `${gridX}`, {
                    fontSize: '12px',
                    color: '#888888'
                });
            }
        }
        
        for (let y = 0; y <= height; y += this.ROW_SPACING * 5) {
            const gridY = y / this.ROW_SPACING;
            if (gridY > 0) {
                this.add.text(-25, height - y - 6, `${gridY}`, {
                    fontSize: '12px',
                    color: '#888888'
                });
            }
        }
    }
    
    createBoundaryWalls(width, height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(3, 0xe74c3c, 0.8);
        graphics.strokeRect(0, 0, width, height);
        graphics.setDepth(-50);
    }
    
    createEntitySprites() {
        // Create worm start indicator using pixel coordinates
        const wormX = this.entities.wormStart.x;
        const wormY = this.entities.wormStart.y;
        
        this.wormSprite = this.add.circle(wormX, wormY, 20, 0x00ff00, 0.7);
        this.wormSprite.setStrokeStyle(3, 0x00aa00);
        this.wormSprite.setInteractive();
        this.wormSprite.setDepth(50);
        
        this.wormText = this.add.text(wormX, wormY, 'W', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(51);
        
        // Create goal indicator using pixel coordinates
        const goalX = this.entities.goal.x;
        const goalY = this.entities.goal.y;
        
        this.goalSprite = this.add.star(goalX, goalY, 5, 15, 25, 0xffd700);
        this.goalSprite.setInteractive();
        this.goalSprite.setDepth(50);
        
        // Make entities draggable
        this.setupEntityDragging();
    }
    
    setupEntityDragging() {
        this.input.setDraggable([this.wormSprite, this.goalSprite]);
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (!this.isTestMode) {
                if (this.gridSnapEnabled) {
                    dragX = Math.round(dragX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
                    dragY = Math.round(dragY / this.ROW_SPACING) * this.ROW_SPACING;
                }
                
                gameObject.x = dragX;
                gameObject.y = dragY;
                
                // Update entity positions
                if (gameObject === this.wormSprite) {
                    this.entities.wormStart = { x: dragX, y: dragY };
                    if (this.wormText) {
                        this.wormText.setPosition(dragX, dragY);
                    }
                    this.autoSave();
                } else if (gameObject === this.goalSprite) {
                    this.entities.goal = { x: dragX, y: dragY };
                    this.autoSave();
                }
            }
        });
        
        // Ensure pixel-perfect positioning when drag ends
        this.input.on('dragend', (pointer, gameObject) => {
            if (!this.isTestMode && (gameObject === this.wormSprite || gameObject === this.goalSprite)) {
                // Round positions to pixels
                const roundedX = Math.round(gameObject.x);
                const roundedY = Math.round(gameObject.y);
                
                gameObject.x = roundedX;
                gameObject.y = roundedY;
                
                // Update entity data with rounded positions
                if (gameObject === this.wormSprite) {
                    this.entities.wormStart = { x: roundedX, y: roundedY };
                    if (this.wormText) {
                        this.wormText.setPosition(roundedX, roundedY);
                    }
                } else if (gameObject === this.goalSprite) {
                    this.entities.goal = { x: roundedX, y: roundedY };
                }
                this.autoSave();
            }
        });
    }
    
    setupPlatformDragging() {
        // Platform drag events
        this.input.on('dragstart', (pointer, gameObject) => {
            if (this.isTestMode) return;
            
            // Check if dragging a resize handle
            if (gameObject.handleType) {
                this.isResizing = true;
                this.resizeStartData = { ...gameObject.platformData };
                return;
            }
            
            // Bring dragged platform container to top
            if (gameObject.platformData) {
                this.children.bringToTop(gameObject);
                this.selectPlatform(this.platforms.find(p => p.container === gameObject));
            }
        });
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.isTestMode) return;
            
            // Handle resize operations (key fix: don't recreate handles during resize)
            if (gameObject.handleType && this.isResizing) {
                this.handleResize(gameObject, dragX, dragY);
                return;
            }
            
            // Handle platform movement
            if (gameObject.platformData && !gameObject.handleType) {
                if (this.gridSnapEnabled) {
                    dragX = Math.round(dragX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
                    dragY = Math.round(dragY / this.ROW_SPACING) * this.ROW_SPACING;
                }
                
                gameObject.x = dragX;
                gameObject.y = dragY;
                
                // Update platform data (no handle recreation here)
                const platform = this.platforms.find(p => p.container === gameObject);
                if (platform) {
                    platform.data.x = dragX;
                    platform.data.y = dragY;
                    this.autoSave();
                }
            }
        });
        
        this.input.on('dragend', (pointer, gameObject) => {
            if (gameObject.handleType) {
                this.isResizing = false;
                this.resizeStartData = null;
                this.justFinishedResizing = true; // Prevent platform selection
                
                // Round platform dimensions to pixels after resize
                const platform = this.platforms.find(p => p.data === gameObject.platformData);
                if (platform) {
                    const data = platform.data;
                    
                    // Round all dimensions to pixels
                    if (data.width !== undefined) data.width = Math.round(data.width);
                    if (data.height !== undefined) data.height = Math.round(data.height);
                    if (data.radius !== undefined) data.radius = Math.round(data.radius);
                    
                    // Update visual and handle positions
                    this.updatePlatformVisual(platform);
                    this.updateHandlePositions(platform);
                    this.autoSave();
                }
            } else if (gameObject.platformData) {
                // Round platform position to pixels after drag
                const platform = this.platforms.find(p => p.container === gameObject);
                if (platform) {
                    platform.data.x = Math.round(platform.data.x);
                    platform.data.y = Math.round(platform.data.y);
                    
                    // Update container position to match rounded data
                    gameObject.x = platform.data.x;
                    gameObject.y = platform.data.y;
                    this.autoSave();
                }
            }
        });
    }
    
    handleResize(handle, dragX, dragY) {
        const platform = this.platforms.find(p => p.data === handle.platformData);
        if (!platform) return;
        
        const data = platform.data;
        const original = this.resizeStartData;
        
        // The dragX, dragY are the handle's new position relative to its container
        // Since handles are inside the container, dragX/dragY are container-relative coordinates
        let relativeX = dragX;
        let relativeY = dragY;
        
        if (this.gridSnapEnabled) {
            relativeX = Math.round(relativeX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            relativeY = Math.round(relativeY / this.ROW_SPACING) * this.ROW_SPACING;
        }
        
        if (data.type === 'rectangle' || data.type === 'trapezoid') {
            this.resizeRectangleFromHandle(data, original, handle.handleType, relativeX, relativeY);
        } else if (data.type === 'circle') {
            this.resizeCircleFromHandle(data, original, handle.handleType, relativeX, relativeY);
        }
        
        // During resize: ONLY update visual, don't touch handles
        this.updatePlatformVisual(platform);
        this.autoSave();
    }
    
    resizeRectangleFromHandle(data, original, handleType, relativeX, relativeY) {
        const minSize = 20;
        
        // With top-left origin, relativeX and relativeY are the handle's position from (0,0)
        switch (handleType) {
            case 'nw':
                // Top-left handle: this is the new (0,0) position
                data.width = Math.max(minSize, original.width - relativeX);
                data.height = Math.max(minSize, original.height - relativeY);
                break;
            case 'ne':
                // Top-right handle: width = relativeX, height shrinks from top
                data.width = Math.max(minSize, relativeX);
                data.height = Math.max(minSize, original.height - relativeY);
                break;
            case 'sw':
                // Bottom-left handle: width shrinks from left, height = relativeY
                data.width = Math.max(minSize, original.width - relativeX);
                data.height = Math.max(minSize, relativeY);
                break;
            case 'se':
                // Bottom-right handle: width = relativeX, height = relativeY
                data.width = Math.max(minSize, relativeX);
                data.height = Math.max(minSize, relativeY);
                break;
        }
        
        console.log(`New size: ${data.width}x${data.height}`);
    }
    
    resizeCircleFromHandle(data, original, handleType, relativeX, relativeY) {
        const minRadius = 10;
        let newRadius;
        
        // Handle positions relative to container center:
        // n: (0, -radius), e: (+radius, 0), s: (0, +radius), w: (-radius, 0)
        
        switch (handleType) {
            case 'n':
                // North handle: dragging changes Y distance from center
                newRadius = Math.max(minRadius, Math.abs(relativeY));
                break;
            case 'e':
                // East handle: dragging changes X distance from center  
                newRadius = Math.max(minRadius, Math.abs(relativeX));
                break;
            case 's':
                // South handle: dragging changes Y distance from center
                newRadius = Math.max(minRadius, Math.abs(relativeY));
                break;
            case 'w':
                // West handle: dragging changes X distance from center
                newRadius = Math.max(minRadius, Math.abs(relativeX));
                break;
        }
        
        data.radius = newRadius;
        console.log(`New radius: ${newRadius}`);
    }
    
    updatePlatformVisual(platform) {
        // Remove old visual from container
        if (platform.visual) {
            platform.container.remove(platform.visual);
            platform.visual.destroy();
        }
        
        // Create new visual
        platform.visual = this.createPlatformVisual(platform.data);
        platform.visual.setPosition(0, 0); // Center in container
        
        // Add back to container
        platform.container.add(platform.visual);
        
        // Reapply selection highlighting
        if (this.selectedPlatform === platform) {
            platform.visual.setStrokeStyle(4, 0x00ff00, 1);
        }
    }
    
    updateHandlePositions(platform) {
        if (!platform.handles) return;
        
        // Update handle positions based on current platform size
        // Handles are inside the container, so use container-relative coordinates
        const { width, height, radius, type } = platform.data;
        
        platform.handles.forEach((handle, index) => {
            if (type === 'rectangle' || type === 'trapezoid') {
                const positions = [
                    { x: 0, y: 0 },          // nw
                    { x: width, y: 0 },      // ne
                    { x: 0, y: height },     // sw
                    { x: width, y: height }  // se
                ];
                if (positions[index]) {
                    handle.setPosition(positions[index].x, positions[index].y);
                }
            } else if (type === 'circle') {
                const positions = [
                    { x: 0, y: -radius },     // n
                    { x: radius, y: 0 },      // e
                    { x: 0, y: radius },      // s
                    { x: -radius, y: 0 }      // w
                ];
                if (positions[index]) {
                    handle.setPosition(positions[index].x, positions[index].y);
                }
            }
        });
    }
    
    updateHandles(platform) {
        this.clearHandlesFromContainer(platform);
        this.addHandlesToPlatform(platform);
    }
    
    setupInput() {
        // Keyboard shortcuts
        this.input.keyboard.on('keydown-R', () => this.selectedTool = 'rectangle');
        this.input.keyboard.on('keydown-C', () => this.selectedTool = 'circle');
        this.input.keyboard.on('keydown-P', () => this.selectedTool = 'polygon');
        this.input.keyboard.on('keydown-T', () => this.selectedTool = 'trapezoid');
        this.input.keyboard.on('keydown-V', () => this.selectedTool = 'custom');
        this.input.keyboard.on('keydown-TAB', () => this.toggleTestMode());
        this.input.keyboard.on('keydown-DELETE', () => this.deleteSelectedPlatform());
        
        // Set up worm controls for test mode
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Camera controls - scroll to pan camera
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const camera = this.cameras.main;
            const panSpeed = 50 / camera.zoom;
            camera.scrollX += deltaY > 0 ? panSpeed : -panSpeed;
        });
        
        // Pan with middle mouse
        this.input.on('pointermove', (pointer) => {
            if (pointer.middleButtonDown()) {
                const camera = this.cameras.main;
                camera.scrollX -= pointer.velocity.x / camera.zoom;
                camera.scrollY -= pointer.velocity.y / camera.zoom;
            }
        });
        
        // Double-click to create platforms (manual detection)
        let lastClickTime = 0;
        this.input.on('pointerup', (pointer) => {
            const now = Date.now();
            if (now - lastClickTime < 400) { // 400ms double-click threshold
                this.createPlatformAtPointer(pointer);
            }
            lastClickTime = now;
        });
        
        // Setup drag events for platforms
        this.setupPlatformDragging();
    }
    
    createPlatformAtPointer(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        // Check if clicking on existing objects first
        if (this.isClickOnEntity(worldX, worldY) || 
            this.platforms.some(p => this.isContainerAtPosition(p, worldX, worldY))) {
            return;
        }
        
        // Create platform at pointer location with default size
        let platformData = this.createDefaultPlatform(worldX, worldY);
        
        if (platformData) {
            this.addPlatformToScene(platformData);
            this.autoSave();
        }
    }
    
    createDefaultPlatform(x, y) {
        let snapX = x, snapY = y;
        if (this.gridSnapEnabled) {
            snapX = Math.round(x / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            snapY = Math.round(y / this.ROW_SPACING) * this.ROW_SPACING;
        }
        
        const defaultSizes = {
            rectangle: { width: 96, height: 48 },
            circle: { radius: 40 },
            polygon: { radius: 40, sides: this.toolSettings.polygonSides },
            trapezoid: { width: 96, height: 48, slope: this.toolSettings.trapezoidSlope }
        };
        
        const size = defaultSizes[this.selectedTool];
        if (!size) return null;
        
        const baseData = {
            id: `platform_${Date.now()}`,
            type: this.selectedTool,
            platformType: this.toolSettings.platformType,
            x: snapX,
            y: snapY,
            color: this.toolSettings.platformColor,
            physics: {
                friction: this.toolSettings.friction,
                frictionStatic: this.toolSettings.frictionStatic,
                restitution: this.toolSettings.restitution
            }
        };
        
        return { ...baseData, ...size };
    }
    
    
    
    addPlatformToScene(platformData) {
        // Create container for platform + handles
        const container = this.add.container(platformData.x, platformData.y);
        
        // Create visual representation (centered in container)
        const visual = this.createPlatformVisual(platformData);
        visual.setPosition(0, 0); // Center in container
        
        // Add visual to container
        container.add(visual);
        
        // Make container draggable with proper size based on platform type
        if (platformData.type === 'rectangle' || platformData.type === 'trapezoid') {
            // For rectangles with top-left origin, set interactive area to match visual size
            container.setSize(platformData.width, platformData.height);
        } else if (platformData.type === 'circle') {
            const diameter = platformData.radius * 2;
            container.setSize(diameter, diameter);
        } else {
            // Default fallback
            container.setSize(100, 100);
        }
        container.setInteractive();
        this.input.setDraggable(container);
        container.platformData = platformData;
        
        const platform = {
            data: platformData,
            container: container,
            visual: visual,
            id: platformData.id,
            handles: []
        };
        
        this.platforms.push(platform);
        this.mapData.platforms = this.platforms.map(p => p.data);
    }
    
    createPlatformVisual(platformData) {
        const { type, color } = platformData;
        const colorValue = parseInt(color.replace('#', '0x'));
        
        let visual;
        
        switch (type) {
            case 'rectangle':
                const { width, height } = platformData;
                visual = this.add.rectangle(0, 0, width, height, colorValue);
                visual.setOrigin(0, 0);
                break;
                
            case 'circle':
                visual = this.add.circle(0, 0, platformData.radius, colorValue);
                break;
                
            case 'polygon':
                const vertices = this.generatePolygonVertices(0, 0, platformData.radius, platformData.sides);
                visual = this.add.polygon(0, 0, vertices, colorValue);
                break;
                
            case 'trapezoid':
                const trapVertices = this.generateTrapezoidVertices(0, 0, platformData.width, platformData.height, platformData.slope);
                visual = this.add.polygon(0, 0, trapVertices, colorValue);
                break;
                
            case 'custom':
                // For custom, center the vertices around (0,0)
                const centerX = platformData.vertices.reduce((sum, v) => sum + v.x, 0) / platformData.vertices.length;
                const centerY = platformData.vertices.reduce((sum, v) => sum + v.y, 0) / platformData.vertices.length;
                const centeredVertices = platformData.vertices.map(v => ({
                    x: v.x - centerX,
                    y: v.y - centerY
                }));
                visual = this.add.polygon(0, 0, centeredVertices, colorValue);
                break;
        }
        
        if (visual) {
            visual.setStrokeStyle(2, 0x000000, 0.5);
            visual.setDepth(10);
        }
        
        return visual;
    }
    
    generatePolygonVertices(centerX, centerY, radius, sides) {
        const vertices = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i / sides);
            vertices.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }
        return vertices;
    }
    
    generateTrapezoidVertices(centerX, centerY, width, height, slope) {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const slopeOffset = slope * halfHeight;
        
        return [
            { x: centerX - halfWidth + slopeOffset, y: centerY - halfHeight },
            { x: centerX + halfWidth - slopeOffset, y: centerY - halfHeight },
            { x: centerX + halfWidth, y: centerY + halfHeight },
            { x: centerX - halfWidth, y: centerY + halfHeight }
        ];
    }
    
    selectPlatform(platform) {
        // Deselect previous platform
        if (this.selectedPlatform && this.selectedPlatform.visual) {
            this.selectedPlatform.visual.setStrokeStyle(2, 0x000000, 0.5);
            this.clearHandlesFromContainer(this.selectedPlatform);
        }
        
        // Select new platform
        this.selectedPlatform = platform;
        if (platform && platform.visual) {
            platform.visual.setStrokeStyle(4, 0x00ff00, 1);
            // Add resize handles
            this.addHandlesToPlatform(platform);
        }
    }
    
    clearHandlesFromContainer(platform) {
        if (platform.handles) {
            platform.handles.forEach(handle => {
                platform.container.remove(handle);
                handle.destroy();
            });
            platform.handles = [];
        }
    }
    
    addHandlesToPlatform(platform) {
        const data = platform.data;
        
        // Only create resize handles for rectangles and circles for simplicity
        if (data.type === 'rectangle' || data.type === 'trapezoid') {
            this.createRectangleHandles(platform);
        } else if (data.type === 'circle') {
            this.createCircleHandles(platform);
        }
    }
    
    createRectangleHandles(platform) {
        const { width, height } = platform.data;
        
        // Corner handles relative to top-left origin
        const handlePositions = [
            { x: 0, y: 0, type: 'nw' },
            { x: width, y: 0, type: 'ne' },
            { x: 0, y: height, type: 'sw' },
            { x: width, y: height, type: 'se' }
        ];
        
        handlePositions.forEach(pos => {
            const handle = this.add.rectangle(pos.x, pos.y, 12, 12, 0x00ffff);
            handle.setStrokeStyle(2, 0x0088aa);
            handle.setInteractive();
            handle.handleType = pos.type;
            handle.platformData = platform.data;
            handle.setDepth(300); // High depth so they're on top
            
            // Use Phaser's drag system
            this.input.setDraggable(handle);
            
            // Visual feedback
            handle.on('pointerover', () => handle.setFillStyle(0xffff88));
            handle.on('pointerout', () => handle.setFillStyle(0x00ffff));
            
            // Add to container and track it
            platform.container.add(handle);
            platform.handles.push(handle);
            
            console.log('Created handle:', pos.type, 'interactive:', handle.input.enabled);
        });
    }
    
    createCircleHandles(platform) {
        const { radius } = platform.data;
        
        // Four resize handles around the circle relative to container center
        const handlePositions = [
            { x: 0, y: -radius, type: 'n' },
            { x: radius, y: 0, type: 'e' },
            { x: 0, y: radius, type: 's' },
            { x: -radius, y: 0, type: 'w' }
        ];
        
        handlePositions.forEach(pos => {
            const handle = this.add.circle(pos.x, pos.y, 6, 0x00ffff);
            handle.setStrokeStyle(2, 0x0088aa);
            handle.setInteractive();
            handle.handleType = pos.type;
            handle.platformData = platform.data;
            handle.setDepth(300); // High depth so they're on top
            
            // Use Phaser's drag system
            this.input.setDraggable(handle);
            
            // Visual feedback
            handle.on('pointerover', () => handle.setFillStyle(0xffff88));
            handle.on('pointerout', () => handle.setFillStyle(0x00ffff));
            
            // Add to container and track it
            platform.container.add(handle);
            platform.handles.push(handle);
            
            console.log('Created circle handle:', pos.type, 'interactive:', handle.input.enabled);
        });
    }
    
    deleteSelectedPlatform() {
        if (this.selectedPlatform) {
            // Clear resize handles first
            this.clearHandlesFromContainer(this.selectedPlatform);
            
            // Remove container (which removes visual and handles)
            if (this.selectedPlatform.container) {
                this.selectedPlatform.container.destroy();
            }
            
            // Remove from platforms array
            const index = this.platforms.indexOf(this.selectedPlatform);
            if (index > -1) {
                this.platforms.splice(index, 1);
            }
            
            // Update map data
            this.mapData.platforms = this.platforms.map(p => p.data);
            
            this.selectedPlatform = null;
            this.autoSave();
        }
    }
    
    toggleTestMode() {
        this.isTestMode = !this.isTestMode;
        
        if (this.isTestMode) {
            this.enterTestMode();
        } else {
            this.exitTestMode();
        }
        
        // Update GUI button
        if (this.gui && this.testModeController) {
            this.testModeController.updateDisplay();
        }
    }
    
    enterTestMode() {
        // Create temporary JsonMapBase scene to test the map
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        
        // Spawn test worm using pixel coordinates
        const wormX = this.entities.wormStart.x;
        const wormY = this.entities.wormStart.y;
        
        this.testWorm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: false
        });
        
        // Create physics bodies and special platforms for testing
        this.testPlatformBodies = [];
        this.testSpecialPlatforms = [];
        this.testPlatformVisuals = [];
        this.platforms.forEach(platform => {
            const platformData = platform.data;
            const { platformType = 'standard' } = platformData;
            
            if (platformType !== 'standard') {
                // Create special platform with all properties
                const specialPlatform = this.createSpecialPlatformForTest(platformData);
                if (specialPlatform) {
                    this.testSpecialPlatforms.push(specialPlatform);
                }
            } else {
                // Create regular physics body and visual
                const { body, visual } = this.createStandardPlatformForTest(platformData);
                if (body) {
                    this.testPlatformBodies.push(body);
                }
                if (visual) {
                    console.log(`Created test visual for ${platformData.type} platform:`, visual.type || 'unknown', 'at', visual.x, visual.y);
                    this.testPlatformVisuals.push(visual);
                } else {
                    console.warn(`Failed to create visual for ${platformData.type} platform`);
                }
            }
        });
        
        // Set up collision detection for special platforms
        this.setupSpecialPlatformCollisions();
        
        // Add mouse constraint for debugging physics in test mode
        this.setupMouseConstraint();
        
        // Set up camera to follow worm
        this.setupTestModeCamera();
        
        // Hide editor entity sprites during test (but keep goal visible)
        this.wormSprite.setVisible(false);
        // Keep goal sprite visible during test mode so player can see the target
        
        // Hide all editor platform visuals during test mode
        this.platforms.forEach(platform => {
            if (platform.container) {
                platform.container.setVisible(false);
            }
        });
        
        // Show test mode indicator
        this.testModeText = this.add.text(20, 20, 'TEST MODE - Press TAB to exit', {
            fontSize: '20px',
            color: '#ff0000',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0).setDepth(1000);
    }
    
    exitTestMode() {
        // Remove test worm
        if (this.testWorm) {
            this.testWorm.destroy();
            this.testWorm = null;
        }
        
        // Remove test platform bodies
        if (this.testPlatformBodies) {
            this.testPlatformBodies.forEach(body => {
                if (body && body.world) {
                    this.matter.world.remove(body);
                }
            });
            this.testPlatformBodies = [];
        }
        
        // Destroy special platforms
        if (this.testSpecialPlatforms) {
            this.testSpecialPlatforms.forEach(platform => {
                if (platform && platform.destroy) {
                    platform.destroy();
                }
            });
            this.testSpecialPlatforms = [];
        }
        
        // Remove mouse constraint
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
        
        // Reset camera
        this.resetEditorCamera();
        
        // Remove test platform visuals
        if (this.testPlatformVisuals) {
            console.log(`Cleaning up ${this.testPlatformVisuals.length} test platform visuals`);
            this.testPlatformVisuals.forEach((visual, index) => {
                if (visual && visual.destroy) {
                    console.log(`Destroying visual ${index}:`, visual.type || 'unknown');
                    visual.destroy();
                } else {
                    console.warn(`Visual ${index} is null or has no destroy method:`, visual);
                }
            });
            this.testPlatformVisuals = [];
        }
        
        // Additional cleanup: Remove any remaining test mode objects
        // This catches any visuals that might not have been properly tracked
        this.children.getChildren().forEach(child => {
            // Look for objects that might be test platform visuals based on their properties
            if (child && child.depth === 10 && 
                (child.type === 'Rectangle' || child.type === 'Circle' || child.type === 'Polygon') &&
                child !== this.wormSprite && child !== this.goalSprite && 
                !this.platforms.some(p => p.visual === child)) {
                console.log(`Cleaning up orphaned test visual:`, child.type, child.x, child.y);
                child.destroy();
            }
        });
        
        // Show entity sprites
        this.wormSprite.setVisible(true);
        this.goalSprite.setVisible(true);
        
        // Show all editor platform visuals when returning to editor mode
        this.platforms.forEach(platform => {
            if (platform.container) {
                platform.container.setVisible(true);
            }
        });
        
        // Remove test mode indicator
        if (this.testModeText) {
            this.testModeText.destroy();
            this.testModeText = null;
        }
    }
    
    createPhysicsBodyForPlatform(platformData) {
        const { type, physics = {} } = platformData;
        const defaultPhysics = {
            isStatic: true,
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0
        };
        const appliedPhysics = { ...defaultPhysics, ...physics };
        
        let body;
        
        switch (type) {
            case 'rectangle':
                const { x, y, width, height } = platformData;
                // Position physics body so its top-left corner matches the visual
                body = this.matter.add.rectangle(x + width/2, y + height/2, width, height, appliedPhysics);
                break;
                
            case 'circle':
                const { x: circleX, y: circleY, radius } = platformData;
                // Use pixel coordinates directly
                body = this.matter.add.circle(circleX, circleY, radius, appliedPhysics);
                break;
                
            case 'polygon':
                const { x: polyX, y: polyY, sides, radius: polyRadius, rotation = 0 } = platformData;
                const vertices = [];
                
                for (let i = 0; i < sides; i++) {
                    const angle = (2 * Math.PI * i / sides) + rotation;
                    vertices.push({
                        x: polyX + polyRadius * Math.cos(angle),
                        y: polyY + polyRadius * Math.sin(angle)
                    });
                }
                
                body = this.matter.add.fromVertices(polyX, polyY, vertices, appliedPhysics);
                break;
                
            case 'trapezoid':
                const { x: trapX, y: trapY, width: trapWidth, height: trapHeight, slope = 0 } = platformData;
                
                // Calculate trapezoid vertices with top-left origin
                const slopeOffset = slope * trapHeight / 2;
                const trapVertices = [
                    { x: trapX + slopeOffset, y: trapY },                    // top left
                    { x: trapX + trapWidth - slopeOffset, y: trapY },       // top right  
                    { x: trapX + trapWidth, y: trapY + trapHeight },        // bottom right
                    { x: trapX, y: trapY + trapHeight }                     // bottom left
                ];
                
                // Position physics body at center of trapezoid bounds
                body = this.matter.add.fromVertices(trapX + trapWidth/2, trapY + trapHeight/2, trapVertices, appliedPhysics);
                break;
                
            case 'custom':
                const { vertices: customVertices } = platformData;
                
                // Calculate center point for body positioning
                const centerX = customVertices.reduce((sum, v) => sum + v.x, 0) / customVertices.length;
                const centerY = customVertices.reduce((sum, v) => sum + v.y, 0) / customVertices.length;
                
                body = this.matter.add.fromVertices(centerX, centerY, customVertices, appliedPhysics);
                break;
        }
        
        return body;
    }
    
    createStandardPlatformForTest(platformData) {
        // Create both physics body and visual representation for standard platforms
        const body = this.createPhysicsBodyForPlatform(platformData);
        const visual = this.createTestPlatformVisual(platformData);
        
        return { body, visual };
    }
    
    createTestPlatformVisual(platformData) {
        const { type, color } = platformData;
        const colorValue = parseInt(color.replace('#', '0x'));
        
        let visual;
        
        switch (type) {
            case 'rectangle':
                const { x, y, width, height } = platformData;
                // Position visual at top-left corner (matching physics body positioning)
                visual = this.add.rectangle(x + width/2, y + height/2, width, height, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
                
            case 'circle':
                const { x: circleX, y: circleY, radius } = platformData;
                visual = this.add.circle(circleX, circleY, radius, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
                
            case 'polygon':
                const { x: polyX, y: polyY, sides, radius: polyRadius, rotation = 0 } = platformData;
                const vertices = [];
                for (let i = 0; i < sides; i++) {
                    const angle = (2 * Math.PI * i / sides) + rotation;
                    vertices.push({
                        x: polyX + polyRadius * Math.cos(angle),
                        y: polyY + polyRadius * Math.sin(angle)
                    });
                }
                visual = this.add.polygon(polyX, polyY, vertices, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
                
            case 'trapezoid':
                const { x: trapX, y: trapY, width: trapWidth, height: trapHeight, slope = 0 } = platformData;
                const halfWidth = trapWidth / 2;
                const halfHeight = trapHeight / 2;
                const slopeOffset = slope * halfHeight;
                const trapVertices = [
                    { x: trapX - halfWidth + slopeOffset, y: trapY - halfHeight },
                    { x: trapX + halfWidth - slopeOffset, y: trapY - halfHeight },
                    { x: trapX + halfWidth, y: trapY + halfHeight },
                    { x: trapX - halfWidth, y: trapY + halfHeight }
                ];
                visual = this.add.polygon(trapX, trapY, trapVertices, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
                
            case 'custom':
                const { vertices: customVertices } = platformData;
                const centerX = customVertices.reduce((sum, v) => sum + v.x, 0) / customVertices.length;
                const centerY = customVertices.reduce((sum, v) => sum + v.y, 0) / customVertices.length;
                visual = this.add.polygon(centerX, centerY, customVertices, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
        }
        
        if (visual) {
            visual.setDepth(10);
        }
        
        return visual;
    }
    
    createSpecialPlatformForTest(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, color } = platformData;
        
        // Adjust coordinates for top-left origin (like regular physics bodies)
        let centerX, centerY;
        
        if (type === 'rectangle') {
            // For rectangles with top-left origin, center is at x + width/2, y + height/2
            centerX = x + width / 2;
            centerY = y + height / 2;
        } else if (type === 'circle') {
            // For circles, x,y is already the center
            centerX = x;
            centerY = y;
        } else {
            // For other shapes, assume x,y is center for now
            centerX = x;
            centerY = y;
        }
        
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
        
        console.log(`Creating special platform ${platformType} ${type} at (${centerX}, ${centerY}) size: ${platformWidth}x${platformHeight}`);
        
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
        // Check if this body belongs to the test worm
        return this.testWorm && this.testWorm.segments && this.testWorm.segments.includes(body);
    }
    
    setupMouseConstraint() {
        // Add mouse constraint for dragging physics bodies in test mode
        this.mouseConstraint = this.matter.add.mouseSpring({
            length: 0.01,
            stiffness: 0.8,
            damping: 0
        });
    }
    
    setupTestModeCamera() {
        // Create camera target if it doesn't exist
        if (!this.cameraTarget) {
            const wormX = this.entities.wormStart.x;
            const wormY = this.entities.wormStart.y;
            this.cameraTarget = this.add.rectangle(wormX, wormY, 10, 10, 0xff0000, 0);
        }
        
        // Set camera to follow the target with smooth movement
        this.cameras.main.startFollow(this.cameraTarget, true);
        
        // Use compatible camera methods
        if (this.cameras.main.setLerpFactor) {
            this.cameras.main.setLerpFactor(0.1, 0.1); // Smooth following if available
        }
        if (this.cameras.main.setDeadzone) {
            this.cameras.main.setDeadzone(100, 100); // Dead zone for smoother movement
        }
        this.cameras.main.setZoom(1); // Reset zoom to 1:1
    }
    
    resetEditorCamera() {
        // Stop following and reset camera to editor mode
        this.cameras.main.stopFollow();
        this.cameras.main.setZoom(0.8); // Back to editor zoom
        this.cameras.main.centerOn(this.mapData.dimensions.width / 2, this.mapData.dimensions.height / 2);
        
        // Use compatible camera methods - only call if they exist
        if (this.cameras.main.setLerpFactor) {
            this.cameras.main.setLerpFactor(1, 1); // Instant movement in editor
        }
        if (this.cameras.main.setDeadzone) {
            this.cameras.main.setDeadzone(0, 0); // No deadzone in editor
        }
    }
    
    saveMapToLibrary() {
        if (!this.mapData.metadata.name || this.mapData.metadata.name.trim() === '') {
            alert('Please enter a map name before saving to library.');
            return;
        }
        
        // Update map data
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.metadata.modified = new Date().toISOString();
        
        // Save to named maps library
        this.savedMaps[this.mapData.metadata.name] = JSON.stringify(this.mapData);
        this.saveMapsToStorage();
        
        // Update dropdown
        this.updateMapDropdown();
        
        alert(`Map "${this.mapData.metadata.name}" saved to library!`);
    }
    
    loadMap(mapName) {
        if (!this.savedMaps[mapName]) {
            alert('Map not found!');
            return;
        }
        
        try {
            const loadedData = JSON.parse(this.savedMaps[mapName]);
            
            // Clear existing platforms
            this.clearAllPlatforms();
            
            // Load map data
            this.mapData = loadedData;
            this.entities = this.mapData.entities;
            this.platforms = [];
            
            // Recreate platforms
            this.mapData.platforms.forEach(platformData => {
                this.addPlatformToScene(platformData);
            });
            
            // Update entities
            this.updateEntityPositions();
            
            // Update GUI
            this.updateGUIFromMapData();
            
            alert(`Map "${mapName}" loaded successfully!`);
        } catch (e) {
            console.error('Failed to load map:', e);
            alert('Failed to load map. The data might be corrupted.');
        }
    }
    
    newMap() {
        if (confirm('Create a new map? This will clear the current map.')) {
            this.clearAllPlatforms();
            
            // Reset to default map data
            this.mapData = {
                metadata: {
                    name: "New Map",
                    difficulty: 1,
                    description: "A custom level"
                },
                dimensions: {
                    width: 20,
                    height: 12
                },
                entities: {
                    wormStart: { x: 2, y: 1 },
                    goal: { x: 14, y: 6 }
                },
                platforms: []
            };
            
            this.entities = this.mapData.entities;
            this.platforms = [];
            
            this.updateEntityPositions();
            this.updateGUIFromMapData();
            this.autoSave();
        }
    }
    
    clearAllPlatforms() {
        this.platforms.forEach(platform => {
            if (platform.visual) {
                platform.visual.destroy();
            }
        });
        this.platforms = [];
        this.selectedPlatform = null;
        this.mapData.platforms = [];
    }
    
    updateEntityPositions() {
        const wormX = this.entities.wormStart.x;
        const wormY = this.entities.wormStart.y;
        this.wormSprite.setPosition(wormX, wormY);
        if (this.wormText) {
            this.wormText.setPosition(wormX, wormY);
        }
        
        const goalX = this.entities.goal.x;
        const goalY = this.entities.goal.y;
        this.goalSprite.setPosition(goalX, goalY);
    }
    
    exportJSON() {
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        
        const dataStr = JSON.stringify(this.mapData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.mapData.metadata.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    async copyJSONToClipboard() {
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        
        const dataStr = JSON.stringify(this.mapData, null, 2);
        
        try {
            await navigator.clipboard.writeText(dataStr);
            alert('Map JSON copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = dataStr;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert('Map JSON copied to clipboard!');
            } catch (fallbackErr) {
                alert('Failed to copy to clipboard. Please use Export JSON instead.');
            }
            document.body.removeChild(textArea);
        }
    }
    
    importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const mapData = JSON.parse(e.target.result);
                        
                        // Validate map data structure
                        if (!mapData.metadata || !mapData.dimensions || !mapData.entities || !mapData.platforms) {
                            throw new Error('Invalid map format');
                        }
                        
                        // Clear existing and load imported map
                        this.clearAllPlatforms();
                        this.mapData = mapData;
                        this.entities = mapData.entities;
                        this.platforms = [];
                        
                        // Recreate platforms
                        mapData.platforms.forEach(platformData => {
                            this.addPlatformToScene(platformData);
                        });
                        
                        this.updateEntityPositions();
                        this.updateGUIFromMapData();
                        
                        alert(`Map "${mapData.metadata.name}" imported successfully!`);
                    } catch (error) {
                        console.error('Import error:', error);
                        alert('Failed to import map. Please check the file format.');
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }
    
    setupGUI() {
        this.gui = new dat.GUI({ width: 300 });
        
        // Map Management folder
        const mapFolder = this.gui.addFolder('Map Management');
        mapFolder.add(this.mapData.metadata, 'name').name('Map Name').onChange(() => {
            this.autoSave();
        });
        
        // Only add load dropdown if there are saved maps
        const savedMapKeys = Object.keys(this.savedMaps);
        if (savedMapKeys.length > 0) {
            // Initialize selectedSavedMap property
            this.selectedSavedMap = savedMapKeys[0];
            mapFolder.add(this, 'selectedSavedMap', savedMapKeys).name('Load Map').onChange((value) => {
                this.loadMap(value);
            });
        }
        
        const mapActions = {
            'New Map': () => this.newMap(),
            'Save to Library': () => this.saveMapToLibrary(),
            'Export JSON': () => this.exportJSON(),
            'Copy JSON to Clipboard': () => this.copyJSONToClipboard(),
            'Import JSON': () => this.importJSON()
        };
        
        Object.keys(mapActions).forEach(action => {
            mapFolder.add(mapActions, action);
        });
        mapFolder.open();
        
        // Map Properties folder
        const propsFolder = this.gui.addFolder('Map Properties');
        propsFolder.add(this.mapData.metadata, 'difficulty', 1, 5).step(1).name('Difficulty').onChange(() => {
            this.autoSave();
        });
        propsFolder.add(this.mapData.dimensions, 'width', 480, 3840).step(96).name('Width (pixels)').onChange(() => {
            this.autoSave();
        });
        propsFolder.add(this.mapData.dimensions, 'height', 288, 2160).step(96).name('Height (pixels)').onChange(() => {
            this.autoSave();
        });
        propsFolder.open();
        
        // Shape Tools folder
        const toolsFolder = this.gui.addFolder('Shape Tools');
        toolsFolder.add(this, 'selectedTool', ['rectangle', 'circle', 'polygon', 'trapezoid', 'custom']).name('Tool Mode');
        toolsFolder.add(this.toolSettings, 'platformType', {
            'Standard': 'standard',
            'Ice (Slippery)': 'ice', 
            'Bouncy': 'bouncy',
            'Electric (Shock)': 'electric',
            'Fire (Burning)': 'fire'
        }).name('Platform Type').onChange((value) => {
            // Update color to match platform type
            const colors = {
                'standard': '#ff6b6b',
                'ice': '#b3e5fc',
                'bouncy': '#ff9800', 
                'electric': '#9c27b0',
                'fire': '#f44336'
            };
            this.toolSettings.platformColor = colors[value] || '#ff6b6b';
            this.gui.updateDisplay();
        });
        toolsFolder.addColor(this.toolSettings, 'platformColor').name('Platform Color');
        toolsFolder.add(this, 'gridSnapEnabled').name('Snap to Grid');
        toolsFolder.open();
        
        // Physics Properties folder
        const physicsFolder = this.gui.addFolder('Physics Properties');
        physicsFolder.add(this.toolSettings, 'friction', 0, 2).name('Friction');
        physicsFolder.add(this.toolSettings, 'frictionStatic', 0, 1).name('Static Friction');
        physicsFolder.add(this.toolSettings, 'restitution', 0, 1).name('Restitution');
        physicsFolder.open();
        
        // Shape Settings folder
        const shapeFolder = this.gui.addFolder('Shape Settings');
        shapeFolder.add(this.toolSettings, 'polygonSides', 3, 12).step(1).name('Polygon Sides');
        shapeFolder.add(this.toolSettings, 'polygonRadius', 0.5, 5).name('Polygon Radius');
        shapeFolder.add(this.toolSettings, 'trapezoidSlope', -1, 1).name('Trapezoid Slope');
        shapeFolder.open();
        
        // Test Mode folder
        const testFolder = this.gui.addFolder('Test Mode');
        this.testModeController = testFolder.add(this, 'isTestMode').name('Enable Testing').onChange(() => {
            this.toggleTestMode();
        });
        testFolder.add(this.matter.world, 'drawDebug').name('Show Physics Debug');
        testFolder.open();
        
        // View Controls folder
        const viewFolder = this.gui.addFolder('View Controls');
        viewFolder.add(this.cameras.main, 'zoom', 0.3, 3).name('Zoom').onChange((value) => {
            this.cameras.main.setZoom(value);
        });
        
        const gridControls = {
            'Show Grid': true,
            'Clear All Platforms': () => {
                if (confirm('Delete all platforms?')) {
                    this.clearAllPlatforms();
                }
            }
        };
        
        viewFolder.add(gridControls, 'Show Grid').onChange((value) => {
            this.gridGraphics.setVisible(value);
        });
        viewFolder.add(gridControls, 'Clear All Platforms');
        viewFolder.open();
        
        // Help & Instructions folder
        const helpFolder = this.gui.addFolder('Help & Instructions');
        
        const helpActions = {
            'Show Basic Usage': () => {
                alert(`Map Editor Usage:

BASIC EDITING:
• Drag mouse to create platforms
• Click platforms to select/move them
• Drag green circle (W) to set worm start
• Drag star (★) to set goal position

TOOLS (or use keyboard):
• Rectangle (R) - Basic platforms
• Circle (C) - Round platforms  
• Polygon (P) - Multi-sided shapes
• Trapezoid (T) - Sloped platforms
• Custom (V) - Click to draw vertices

TESTING:
• Press TAB to test your level
• Control worm with WASD/arrows + SPACE to jump
• Press TAB again to return to editing

SHORTCUTS:
• DELETE - Remove selected platform
• Scroll wheel - Pan camera
• Grid snap - Align to grid lines`);
            },
            'Show Keyboard Shortcuts': () => {
                alert(`Keyboard Shortcuts:

TOOLS:
R - Rectangle tool
C - Circle tool  
P - Polygon tool
T - Trapezoid tool
V - Custom polygon tool

ACTIONS:
TAB - Toggle test mode
DELETE - Remove selected platform
ESC - Exit editor (with confirmation)

CAMERA:
Scroll wheel - Pan camera up/down
Middle mouse drag - Pan camera
Zoom slider - Use GUI panel

EDITING:
Click & drag - Create new platform
Click platform - Select for editing
Drag entities - Move worm start (W) or goal (★)`);
            },
            'Show Advanced Tips': () => {
                alert(`Advanced Editor Tips:

PLATFORM SELECTION:
• Selected platforms show resize handles
• Drag handles to resize platforms
• Click empty space to deselect

CUSTOM POLYGONS:
• Click points to create vertices
• Right-click or press V to finish
• Create organic cave shapes

PHYSICS SETTINGS:
• Friction - How slippery platforms are
• Restitution - How bouncy platforms are  
• Higher values = more effect

MAP MANAGEMENT:
• Auto-saves every second while editing
• Export JSON to save to files
• Import JSON to load external maps
• Save to Library for quick access

TESTING TIPS:
• Test frequently while building
• Check if worm can reach the goal
• Adjust platform spacing for difficulty`);
            }
        };
        
        Object.keys(helpActions).forEach(action => {
            helpFolder.add(helpActions, action);
        });
        // Keep help folder closed by default to avoid clutter
        
        // Initialize selected saved map if any exist
        if (Object.keys(this.savedMaps).length > 0) {
            this.selectedSavedMap = Object.keys(this.savedMaps)[0];
        }
    }
    
    updateMapDropdown() {
        // This would typically recreate the dropdown with updated map list
        // For simplicity, we'll just update the internal list
        this.savedMaps = this.getSavedMaps();
    }
    
    updateGUIFromMapData() {
        if (this.gui) {
            // Refresh GUI controllers to reflect loaded data
            this.gui.updateDisplay();
        }
    }
    
    updateGUIForSelectedPlatform() {
        // Update GUI to show selected platform properties
        // This could expand to show platform-specific settings
    }
    
    update(time, delta) {
        if (this.isTestMode && this.testWorm) {
            this.testWorm.update(delta);
            
            // Update special platforms during test mode
            if (this.testSpecialPlatforms) {
                this.testSpecialPlatforms.forEach(platform => {
                    if (platform && platform.update) {
                        platform.update(delta);
                    }
                });
            }
            
            // Update camera target to follow worm center
            if (this.cameraTarget && this.testWorm.segments) {
                const head = this.testWorm.getHead();
                const tail = this.testWorm.getTail();
                if (head && tail) {
                    this.cameraTarget.x = (head.position.x + tail.position.x) / 2;
                    this.cameraTarget.y = (head.position.y + tail.position.y) / 2;
                }
            }
            
            // Check goal collision during test mode
            this.checkGoalCollision();
        }
    }
    
    checkGoalCollision() {
        if (!this.testWorm || !this.testWorm.segments) return;
        
        const goalX = this.entities.goal.x;
        const goalY = this.entities.goal.y;
        const goalRadius = 25; // Star collision radius
        
        // Check if any worm segment touches the goal
        for (let i = 0; i < this.testWorm.segments.length; i++) {
            const segment = this.testWorm.segments[i];
            const distance = Phaser.Math.Distance.Between(
                segment.position.x, segment.position.y,
                goalX, goalY
            );
            
            const segmentRadius = this.testWorm.segmentRadii[i] || 15;
            const collisionDistance = segmentRadius + goalRadius;
            
            if (distance < collisionDistance) {
                this.showTestVictory();
                return;
            }
        }
    }
    
    showTestVictory() {
        // Create victory notification
        const victoryText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'GOAL REACHED!', {
            fontSize: '48px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
        
        const instructionText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 60, 'Press SPACE to return to editing', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
        
        // Auto-remove after 3 seconds
        this.time.delayedCall(3000, () => {
            if (victoryText && victoryText.active) {
                victoryText.destroy();
            }
            if (instructionText && instructionText.active) {
                instructionText.destroy();
            }
        });
    }
    
    // Platform detection methods
    isContainerAtPosition(platform, x, y) {
        if (!platform.container) return false;
        
        const { type } = platform.data;
        const containerX = platform.container.x;
        const containerY = platform.container.y;
        
        switch (type) {
            case 'rectangle':
            case 'trapezoid':
                const halfW = platform.data.width / 2;
                const halfH = platform.data.height / 2;
                return (x >= containerX - halfW && x <= containerX + halfW &&
                        y >= containerY - halfH && y <= containerY + halfH);
                
            case 'circle':
                const distance = Phaser.Math.Distance.Between(containerX, containerY, x, y);
                return distance <= platform.data.radius;
                
            case 'polygon':
            case 'custom':
                // Simple radius check for now
                const distance2 = Phaser.Math.Distance.Between(containerX, containerY, x, y);
                return distance2 <= (platform.data.radius || 50);
        }
        
        return false;
    }
    
    isClickOnEntity(x, y) {
        // Check if clicking on worm sprite (circle with 20px radius)
        if (this.wormSprite && this.wormSprite.visible) {
            const wormDistance = Phaser.Math.Distance.Between(
                this.wormSprite.x, this.wormSprite.y, x, y
            );
            if (wormDistance <= 20) {
                return true;
            }
        }
        
        // Check if clicking on goal sprite (star shape, approximate with radius)
        if (this.goalSprite && this.goalSprite.visible) {
            const goalDistance = Phaser.Math.Distance.Between(
                this.goalSprite.x, this.goalSprite.y, x, y
            );
            if (goalDistance <= 25) { // Star is slightly larger
                return true;
            }
        }
        
        return false;
    }
    
}