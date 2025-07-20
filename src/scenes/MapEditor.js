import Phaser from 'phaser';
import * as dat from 'dat.gui';
import JsonMapBase from './JsonMapBase';
import DoubleWorm from '../entities/DoubleWorm';

export default class MapEditor extends Phaser.Scene {
    constructor() {
        super({ key: 'MapEditor' });
        
        // Editor state
        this.isTestMode = false;
        this.selectedTool = 'rectangle';
        this.selectedPlatform = null;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.platforms = [];
        this.entities = {
            wormStart: { x: 200, y: 900 },
            goal: { x: 1700, y: 200 }
        };
        
        // Transform handles
        this.transformHandles = [];
        this.activeHandle = null;
        this.transformMode = 'move'; // 'move', 'resize', 'rotate'
        this.isTransforming = false;
        this.originalTransform = null;
        
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
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0,
            polygonSides: 6,
            polygonRadius: 2,
            trapezoidSlope: 0.3
        };
        
        // Preview objects
        this.previewGraphics = null;
        this.previewVertices = [];
        
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
        
        // Setup camera
        this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);
        this.cameras.main.setZoom(0.8);
        this.cameras.main.centerOn(levelWidth / 2, levelHeight / 2);
        
        // Create GUI
        this.setupGUI();
        
        // Create preview graphics
        this.previewGraphics = this.add.graphics();
        this.previewGraphics.setDepth(100);
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
                
                // Update entity positions using pixel coordinates
                if (gameObject === this.wormSprite) {
                    this.entities.wormStart = { x: dragX, y: dragY };
                    // Update text position to follow sprite
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
    }
    
    setupInput() {
        // Mouse controls for platform creation
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        
        // Keyboard shortcuts
        this.input.keyboard.on('keydown-R', () => this.selectedTool = 'rectangle');
        this.input.keyboard.on('keydown-C', () => this.selectedTool = 'circle');
        this.input.keyboard.on('keydown-P', () => this.selectedTool = 'polygon');
        this.input.keyboard.on('keydown-T', () => this.selectedTool = 'trapezoid');
        this.input.keyboard.on('keydown-V', () => this.selectedTool = 'custom');
        this.input.keyboard.on('keydown-SPACE', () => this.toggleTestMode());
        this.input.keyboard.on('keydown-DELETE', () => this.deleteSelectedPlatform());
        
        // Set up worm controls for test mode
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Camera controls - scroll to pan camera
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const camera = this.cameras.main;
            const panSpeed = 50 / camera.zoom; // Adjust pan speed based on zoom level
            
            // Pan camera based on scroll direction
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
    }
    
    onPointerDown(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        // Check if clicking on draggable entities (worm/star) first
        const clickedOnEntity = this.isClickOnEntity(worldX, worldY);
        if (clickedOnEntity) {
            // Let Phaser's built-in drag system handle entity dragging
            return;
        }
        
        // Check if clicking on transform handle
        const clickedHandle = this.getHandleAtPosition(worldX, worldY);
        if (clickedHandle) {
            this.startTransform(clickedHandle, worldX, worldY);
            return;
        }
        
        // Check if clicking on existing platform
        const clickedPlatform = this.platforms.find(p => {
            return this.isPlatformAtPosition(p, worldX, worldY);
        });
        
        if (clickedPlatform) {
            if (this.selectedPlatform === clickedPlatform) {
                // Start dragging if clicking on already selected platform
                this.startPlatformDrag(worldX, worldY);
            } else {
                // Select different platform
                this.selectPlatform(clickedPlatform);
            }
            return;
        }
        
        // Deselect if clicking on empty space
        if (this.selectedPlatform) {
            this.selectPlatform(null);
        }
        
        // Start creating new platform
        this.isDragging = true;
        this.dragStart = { x: worldX, y: worldY };
        
        if (this.gridSnapEnabled) {
            this.dragStart.x = Math.round(worldX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            this.dragStart.y = Math.round(worldY / this.ROW_SPACING) * this.ROW_SPACING;
        }
        
        if (this.selectedTool === 'custom') {
            this.startCustomPolygon(this.dragStart);
        }
    }
    
    onPointerMove(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        if (this.isTransforming) {
            this.updateTransform(worldX, worldY);
        } else if (this.isDragging && this.selectedTool !== 'custom') {
            this.updatePreview(worldX, worldY);
        }
        
        // Update cursor based on what's under the mouse
        this.updateCursor(worldX, worldY);
    }
    
    onPointerUp(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        if (this.isTransforming) {
            this.endTransform();
        } else if (this.isDragging && this.selectedTool !== 'custom') {
            this.createPlatform(worldX, worldY);
            this.isDragging = false;
            this.clearPreview();
        }
    }
    
    updatePreview(worldX, worldY) {
        this.clearPreview();
        
        let snapX = worldX, snapY = worldY;
        if (this.gridSnapEnabled) {
            snapX = Math.round(worldX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            snapY = Math.round(worldY / this.ROW_SPACING) * this.ROW_SPACING;
        }
        
        this.previewGraphics.lineStyle(2, 0x00ff00, 0.8);
        this.previewGraphics.fillStyle(parseInt(this.toolSettings.platformColor.replace('#', '0x')), 0.3);
        
        switch (this.selectedTool) {
            case 'rectangle':
                const width = Math.abs(snapX - this.dragStart.x);
                const height = Math.abs(snapY - this.dragStart.y);
                const rectX = Math.min(this.dragStart.x, snapX);
                const rectY = Math.min(this.dragStart.y, snapY);
                this.previewGraphics.fillRect(rectX, rectY, width, height);
                this.previewGraphics.strokeRect(rectX, rectY, width, height);
                break;
                
            case 'circle':
                const radius = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, snapX, snapY);
                this.previewGraphics.fillCircle(this.dragStart.x, this.dragStart.y, radius);
                this.previewGraphics.strokeCircle(this.dragStart.x, this.dragStart.y, radius);
                break;
                
            case 'polygon':
                const polyRadius = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, snapX, snapY);
                const vertices = this.generatePolygonVertices(this.dragStart.x, this.dragStart.y, polyRadius, this.toolSettings.polygonSides);
                this.previewGraphics.fillPoints(vertices);
                this.previewGraphics.strokePoints(vertices, true);
                break;
        }
    }
    
    clearPreview() {
        if (this.previewGraphics) {
            this.previewGraphics.clear();
        }
    }
    
    createPlatform(worldX, worldY) {
        let snapX = worldX, snapY = worldY;
        if (this.gridSnapEnabled) {
            snapX = Math.round(worldX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            snapY = Math.round(worldY / this.ROW_SPACING) * this.ROW_SPACING;
        }
        
        let platformData;
        
        switch (this.selectedTool) {
            case 'rectangle':
                platformData = this.createRectangleData(snapX, snapY);
                break;
            case 'circle':
                platformData = this.createCircleData(snapX, snapY);
                break;
            case 'polygon':
                platformData = this.createPolygonData(snapX, snapY);
                break;
            case 'trapezoid':
                platformData = this.createTrapezoidData(snapX, snapY);
                break;
        }
        
        if (platformData) {
            this.addPlatformToScene(platformData);
            this.autoSave();
        }
    }
    
    createRectangleData(worldX, worldY) {
        const width = Math.abs(worldX - this.dragStart.x);
        const height = Math.abs(worldY - this.dragStart.y);
        
        if (width < 20 || height < 20) return null;
        
        const centerX = (this.dragStart.x + worldX) / 2;
        const centerY = (this.dragStart.y + worldY) / 2;
        
        return {
            id: `platform_${Date.now()}`,
            type: 'rectangle',
            x: centerX,
            y: centerY,
            width: width,
            height: height,
            color: this.toolSettings.platformColor,
            physics: {
                friction: this.toolSettings.friction,
                frictionStatic: this.toolSettings.frictionStatic,
                restitution: this.toolSettings.restitution
            }
        };
    }
    
    createCircleData(worldX, worldY) {
        const radius = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, worldX, worldY);
        
        if (radius < 10) return null;
        
        return {
            id: `platform_${Date.now()}`,
            type: 'circle',
            x: this.dragStart.x,
            y: this.dragStart.y,
            radius: radius,
            color: this.toolSettings.platformColor,
            physics: {
                friction: this.toolSettings.friction,
                frictionStatic: this.toolSettings.frictionStatic,
                restitution: this.toolSettings.restitution
            }
        };
    }
    
    createPolygonData(worldX, worldY) {
        const radius = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, worldX, worldY);
        
        if (radius < 10) return null;
        
        return {
            id: `platform_${Date.now()}`,
            type: 'polygon',
            x: this.dragStart.x,
            y: this.dragStart.y,
            sides: this.toolSettings.polygonSides,
            radius: radius,
            rotation: 0,
            color: this.toolSettings.platformColor,
            physics: {
                friction: this.toolSettings.friction,
                frictionStatic: this.toolSettings.frictionStatic,
                restitution: this.toolSettings.restitution
            }
        };
    }
    
    createTrapezoidData(worldX, worldY) {
        const width = Math.abs(worldX - this.dragStart.x);
        const height = Math.abs(worldY - this.dragStart.y);
        
        if (width < 20 || height < 20) return null;
        
        const centerX = (this.dragStart.x + worldX) / 2;
        const centerY = (this.dragStart.y + worldY) / 2;
        
        return {
            id: `platform_${Date.now()}`,
            type: 'trapezoid',
            x: centerX,
            y: centerY,
            width: width,
            height: height,
            slope: this.toolSettings.trapezoidSlope,
            color: this.toolSettings.platformColor,
            physics: {
                friction: this.toolSettings.friction,
                frictionStatic: this.toolSettings.frictionStatic,
                restitution: this.toolSettings.restitution
            }
        };
    }
    
    addPlatformToScene(platformData) {
        // Create visual representation
        const visual = this.createPlatformVisual(platformData);
        
        const platform = {
            data: platformData,
            visual: visual,
            id: platformData.id
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
                const { x, y, width, height } = platformData;
                visual = this.add.rectangle(x, y, width, height, colorValue);
                break;
                
            case 'circle':
                visual = this.add.circle(platformData.x, platformData.y, platformData.radius, colorValue);
                break;
                
            case 'polygon':
                const vertices = this.generatePolygonVertices(platformData.x, platformData.y, platformData.radius, platformData.sides);
                visual = this.add.polygon(platformData.x, platformData.y, vertices, colorValue);
                break;
                
            case 'trapezoid':
                const trapVertices = this.generateTrapezoidVertices(platformData.x, platformData.y, platformData.width, platformData.height, platformData.slope);
                visual = this.add.polygon(platformData.x, platformData.y, trapVertices, colorValue);
                break;
                
            case 'custom':
                const centerX = platformData.vertices.reduce((sum, v) => sum + v.x, 0) / platformData.vertices.length;
                const centerY = platformData.vertices.reduce((sum, v) => sum + v.y, 0) / platformData.vertices.length;
                visual = this.add.polygon(centerX, centerY, platformData.vertices, colorValue);
                break;
        }
        
        if (visual) {
            visual.setInteractive();
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
        }
        
        // Clear existing transform handles
        this.clearTransformHandles();
        
        // Select new platform
        this.selectedPlatform = platform;
        if (platform && platform.visual) {
            platform.visual.setStrokeStyle(4, 0x00ff00, 1);
            // Create transform handles for selected platform
            this.createTransformHandles(platform);
        }
        
        // Update GUI to show platform properties
        this.updateGUIForSelectedPlatform();
    }
    
    deleteSelectedPlatform() {
        if (this.selectedPlatform) {
            // Remove visual
            if (this.selectedPlatform.visual) {
                this.selectedPlatform.visual.destroy();
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
        
        // Create physics bodies for platforms
        this.testPlatformBodies = [];
        this.platforms.forEach(platform => {
            const body = this.createPhysicsBodyForPlatform(platform.data);
            if (body) {
                this.testPlatformBodies.push(body);
            }
        });
        
        // Hide editor entity sprites during test (but keep goal visible)
        this.wormSprite.setVisible(false);
        // Keep goal sprite visible during test mode so player can see the target
        
        // Show test mode indicator
        this.testModeText = this.add.text(20, 20, 'TEST MODE - Press SPACE to exit', {
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
        
        // Show entity sprites
        this.wormSprite.setVisible(true);
        this.goalSprite.setVisible(true);
        
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
                // Use pixel coordinates directly
                body = this.matter.add.rectangle(x, y, width, height, appliedPhysics);
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
                
                // Calculate trapezoid vertices based on slope
                const halfWidth = trapWidth / 2;
                const halfHeight = trapHeight / 2;
                const slopeOffset = slope * halfHeight;
                
                const trapVertices = [
                    { x: trapX - halfWidth + slopeOffset, y: trapY - halfHeight },  // top left
                    { x: trapX + halfWidth - slopeOffset, y: trapY - halfHeight },  // top right
                    { x: trapX + halfWidth, y: trapY + halfHeight },                // bottom right
                    { x: trapX - halfWidth, y: trapY + halfHeight }                 // bottom left
                ];
                
                body = this.matter.add.fromVertices(trapX, trapY, trapVertices, appliedPhysics);
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
• Press SPACE to test your level
• Control worm with WASD/arrows
• Press SPACE again to return to editing

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
SPACE - Toggle test mode
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
    
    // Platform detection and transform methods
    isPlatformAtPosition(platform, x, y) {
        if (!platform.visual) return false;
        
        const { type } = platform.data;
        
        switch (type) {
            case 'rectangle':
            case 'trapezoid':
                if (platform.visual.getBounds) {
                    const bounds = platform.visual.getBounds();
                    return Phaser.Geom.Rectangle.Contains(bounds, x, y);
                }
                break;
                
            case 'circle':
                const distance = Phaser.Math.Distance.Between(
                    platform.visual.x, platform.visual.y, x, y
                );
                return distance <= platform.data.radius;
                
            case 'polygon':
            case 'custom':
                // Use bounds check for now - could implement proper polygon containment
                if (platform.visual.getBounds) {
                    const bounds = platform.visual.getBounds();
                    return Phaser.Geom.Rectangle.Contains(bounds, x, y);
                }
                break;
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
    
    createTransformHandles(platform) {
        this.clearTransformHandles();
        
        if (!platform.visual) return;
        
        const { type } = platform.data;
        const visual = platform.visual;
        
        // Create different handles based on platform type
        switch (type) {
            case 'rectangle':
            case 'trapezoid':
                this.createRectangleHandles(visual, platform.data);
                break;
                
            case 'circle':
                this.createCircleHandles(visual, platform.data);
                break;
                
            case 'polygon':
                this.createPolygonHandles(visual, platform.data);
                break;
                
            case 'custom':
                this.createCustomHandles(visual, platform.data);
                break;
        }
    }
    
    createRectangleHandles(visual, data) {
        const { x, y, width, height } = data;
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Corner handles for resizing
        const handles = [
            { type: 'resize', position: 'nw', x: x - halfWidth, y: y - halfHeight },
            { type: 'resize', position: 'ne', x: x + halfWidth, y: y - halfHeight },
            { type: 'resize', position: 'sw', x: x - halfWidth, y: y + halfHeight },
            { type: 'resize', position: 'se', x: x + halfWidth, y: y + halfHeight },
            // Edge handles for resizing
            { type: 'resize', position: 'n', x: x, y: y - halfHeight },
            { type: 'resize', position: 's', x: x, y: y + halfHeight },
            { type: 'resize', position: 'w', x: x - halfWidth, y: y },
            { type: 'resize', position: 'e', x: x + halfWidth, y: y },
        ];
        
        handles.forEach(handleData => {
            const handle = this.add.rectangle(handleData.x, handleData.y, 12, 12, 0x00ffff);
            handle.setStrokeStyle(2, 0x0088aa);
            handle.setInteractive();
            handle.setDepth(200);
            handle.handleData = handleData;
            this.transformHandles.push(handle);
        });
    }
    
    createCircleHandles(visual, data) {
        const { x, y, radius } = data;
        
        // Radius handles
        const handles = [
            { type: 'resize', position: 'n', x: x, y: y - radius },
            { type: 'resize', position: 's', x: x, y: y + radius },
            { type: 'resize', position: 'e', x: x + radius, y: y },
            { type: 'resize', position: 'w', x: x - radius, y: y },
        ];
        
        handles.forEach(handleData => {
            const handle = this.add.circle(handleData.x, handleData.y, 6, 0x00ffff);
            handle.setStrokeStyle(2, 0x0088aa);
            handle.setInteractive();
            handle.setDepth(200);
            handle.handleData = handleData;
            this.transformHandles.push(handle);
        });
    }
    
    createPolygonHandles(visual, data) {
        const { x, y, radius } = data;
        
        // Simple radius handles for regular polygons
        const handles = [
            { type: 'resize', position: 'n', x: x, y: y - radius },
            { type: 'resize', position: 's', x: x, y: y + radius },
            { type: 'resize', position: 'e', x: x + radius, y: y },
            { type: 'resize', position: 'w', x: x - radius, y: y },
        ];
        
        handles.forEach(handleData => {
            const handle = this.add.polygon(handleData.x, handleData.y, 
                [[-6, -6], [6, -6], [6, 6], [-6, 6]], 0x00ffff);
            handle.setStrokeStyle(2, 0x0088aa);
            handle.setInteractive();
            handle.setDepth(200);
            handle.handleData = handleData;
            this.transformHandles.push(handle);
        });
    }
    
    createCustomHandles(visual, data) {
        // Create vertex handles for custom polygons
        data.vertices.forEach((vertex, index) => {
            const handle = this.add.circle(vertex.x, vertex.y, 6, 0xffff00);
            handle.setStrokeStyle(2, 0xcc8800);
            handle.setInteractive();
            handle.setDepth(200);
            handle.handleData = { 
                type: 'vertex', 
                position: index, 
                x: vertex.x, 
                y: vertex.y 
            };
            this.transformHandles.push(handle);
        });
    }
    
    clearTransformHandles() {
        this.transformHandles.forEach(handle => {
            handle.destroy();
        });
        this.transformHandles = [];
    }
    
    getHandleAtPosition(x, y) {
        return this.transformHandles.find(handle => {
            if (handle.handleData.type === 'vertex') {
                const distance = Phaser.Math.Distance.Between(handle.x, handle.y, x, y);
                return distance <= 8;
            } else {
                const bounds = handle.getBounds();
                return Phaser.Geom.Rectangle.Contains(bounds, x, y);
            }
        });
    }
    
    startTransform(handle, startX, startY) {
        this.isTransforming = true;
        this.activeHandle = handle;
        this.originalTransform = {
            startX: startX,
            startY: startY,
            platformData: { ...this.selectedPlatform.data }
        };
    }
    
    startPlatformDrag(startX, startY) {
        this.isTransforming = true;
        this.transformMode = 'move';
        this.originalTransform = {
            startX: startX,
            startY: startY,
            platformData: { ...this.selectedPlatform.data }
        };
    }
    
    updateTransform(currentX, currentY) {
        if (!this.isTransforming || !this.selectedPlatform) return;
        
        const deltaX = currentX - this.originalTransform.startX;
        const deltaY = currentY - this.originalTransform.startY;
        
        if (this.gridSnapEnabled) {
            // Snap deltas to grid
            const snappedDeltaX = Math.round(deltaX / this.CHAR_WIDTH) * this.CHAR_WIDTH;
            const snappedDeltaY = Math.round(deltaY / this.ROW_SPACING) * this.ROW_SPACING;
            this.applyTransform(snappedDeltaX, snappedDeltaY);
        } else {
            this.applyTransform(deltaX, deltaY);
        }
    }
    
    applyTransform(deltaX, deltaY) {
        const platform = this.selectedPlatform;
        const original = this.originalTransform.platformData;
        
        if (this.activeHandle) {
            const handleData = this.activeHandle.handleData;
            
            if (handleData.type === 'resize') {
                this.applyResize(platform, original, handleData, deltaX, deltaY);
            } else if (handleData.type === 'vertex') {
                this.applyVertexMove(platform, original, handleData, deltaX, deltaY);
            }
        } else if (this.transformMode === 'move') {
            this.applyMove(platform, original, deltaX, deltaY);
        }
        
        // Update visual and handles
        this.updatePlatformVisual(platform);
        this.createTransformHandles(platform);
    }
    
    applyMove(platform, original, deltaX, deltaY) {
        const newData = { ...original };
        
        switch (platform.data.type) {
            case 'rectangle':
            case 'circle':
            case 'polygon':
            case 'trapezoid':
                newData.x = original.x + deltaX;
                newData.y = original.y + deltaY;
                break;
                
            case 'custom':
                newData.vertices = original.vertices.map(v => ({
                    x: v.x + deltaX,
                    y: v.y + deltaY
                }));
                break;
        }
        
        platform.data = newData;
    }
    
    applyResize(platform, original, handleData, deltaX, deltaY) {
        const newData = { ...original };
        const { position } = handleData;
        
        switch (platform.data.type) {
            case 'rectangle':
            case 'trapezoid':
                this.resizeRectangle(newData, position, deltaX, deltaY);
                break;
                
            case 'circle':
                this.resizeCircle(newData, position, deltaX, deltaY);
                break;
                
            case 'polygon':
                this.resizePolygon(newData, position, deltaX, deltaY);
                break;
        }
        
        platform.data = newData;
    }
    
    resizeRectangle(data, position, deltaX, deltaY) {
        const minSize = 20;
        
        switch (position) {
            case 'nw':
                data.width = Math.max(minSize, data.width - deltaX);
                data.height = Math.max(minSize, data.height - deltaY);
                data.x = data.x + deltaX / 2;
                data.y = data.y + deltaY / 2;
                break;
            case 'ne':
                data.width = Math.max(minSize, data.width + deltaX);
                data.height = Math.max(minSize, data.height - deltaY);
                data.x = data.x + deltaX / 2;
                data.y = data.y + deltaY / 2;
                break;
            case 'sw':
                data.width = Math.max(minSize, data.width - deltaX);
                data.height = Math.max(minSize, data.height + deltaY);
                data.x = data.x + deltaX / 2;
                data.y = data.y + deltaY / 2;
                break;
            case 'se':
                data.width = Math.max(minSize, data.width + deltaX);
                data.height = Math.max(minSize, data.height + deltaY);
                data.x = data.x + deltaX / 2;
                data.y = data.y + deltaY / 2;
                break;
            case 'n':
                data.height = Math.max(minSize, data.height - deltaY);
                data.y = data.y + deltaY / 2;
                break;
            case 's':
                data.height = Math.max(minSize, data.height + deltaY);
                data.y = data.y + deltaY / 2;
                break;
            case 'w':
                data.width = Math.max(minSize, data.width - deltaX);
                data.x = data.x + deltaX / 2;
                break;
            case 'e':
                data.width = Math.max(minSize, data.width + deltaX);
                data.x = data.x + deltaX / 2;
                break;
        }
    }
    
    resizeCircle(data, position, deltaX, deltaY) {
        const minRadius = 10;
        let radiusDelta = 0;
        
        switch (position) {
            case 'n':
            case 's':
                radiusDelta = Math.abs(deltaY);
                break;
            case 'e':
            case 'w':
                radiusDelta = Math.abs(deltaX);
                break;
        }
        
        if ((position === 'n' && deltaY < 0) || (position === 's' && deltaY > 0) ||
            (position === 'e' && deltaX > 0) || (position === 'w' && deltaX < 0)) {
            data.radius = Math.max(minRadius, data.radius + radiusDelta);
        } else {
            data.radius = Math.max(minRadius, data.radius - radiusDelta);
        }
    }
    
    resizePolygon(data, position, deltaX, deltaY) {
        const minRadius = 10;
        let radiusDelta = 0;
        
        switch (position) {
            case 'n':
            case 's':
                radiusDelta = Math.abs(deltaY);
                break;
            case 'e':
            case 'w':
                radiusDelta = Math.abs(deltaX);
                break;
        }
        
        if ((position === 'n' && deltaY < 0) || (position === 's' && deltaY > 0) ||
            (position === 'e' && deltaX > 0) || (position === 'w' && deltaX < 0)) {
            data.radius = Math.max(minRadius, data.radius + radiusDelta);
        } else {
            data.radius = Math.max(minRadius, data.radius - radiusDelta);
        }
    }
    
    applyVertexMove(platform, original, handleData, deltaX, deltaY) {
        const newData = { ...original };
        newData.vertices = [...original.vertices];
        newData.vertices[handleData.position] = {
            x: original.vertices[handleData.position].x + deltaX,
            y: original.vertices[handleData.position].y + deltaY
        };
        platform.data = newData;
    }
    
    updatePlatformVisual(platform) {
        // Destroy old visual
        if (platform.visual) {
            platform.visual.destroy();
        }
        
        // Create new visual with updated data
        platform.visual = this.createPlatformVisual(platform.data);
        
        // Reapply selection highlighting
        if (this.selectedPlatform === platform) {
            platform.visual.setStrokeStyle(4, 0x00ff00, 1);
        }
    }
    
    endTransform() {
        this.isTransforming = false;
        this.activeHandle = null;
        this.transformMode = 'move';
        this.originalTransform = null;
        
        // Update map data
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.autoSave();
    }
    
    updateCursor(x, y) {
        // Change cursor based on what's under the mouse
        const handle = this.getHandleAtPosition(x, y);
        
        if (handle) {
            const { type, position } = handle.handleData;
            
            if (type === 'resize') {
                // Set resize cursors based on handle position
                const cursors = {
                    'nw': 'nw-resize', 'ne': 'ne-resize',
                    'sw': 'sw-resize', 'se': 'se-resize',
                    'n': 'n-resize', 's': 's-resize',
                    'w': 'w-resize', 'e': 'e-resize'
                };
                this.input.setDefaultCursor(cursors[position] || 'pointer');
            } else {
                this.input.setDefaultCursor('pointer');
            }
        } else if (this.selectedPlatform && this.isPlatformAtPosition(this.selectedPlatform, x, y)) {
            this.input.setDefaultCursor('move');
        } else {
            this.input.setDefaultCursor('default');
        }
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
}