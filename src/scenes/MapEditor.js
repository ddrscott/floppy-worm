import Phaser from 'phaser';
// import * as dat from 'dat.gui'; // Replaced with React PropertyPanel
import DoubleWorm from '../entities/DoubleWorm';
import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';
import Sticker from '../entities/Sticker';

export default class MapEditor extends Phaser.Scene {
    constructor() {
        super({ key: 'MapEditor' });
        
        // Editor state
        this.isTestMode = false;
        this.selectedTool = 'rectangle';
        this.selectedPlatform = null;
        this.selectedSticker = null;
        this.platforms = [];
        this.stickers = [];
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
        this.CHAR_WIDTH = 96;  // Visual grid spacing (matches game)
        this.CHAR_HEIGHT = 48;
        this.ROW_SPACING = 96; // Visual grid spacing (matches game)
        this.SNAP_SIZE = 8;    // Fine snap resolution
        // Note: gridSnapEnabled is now read from React PropertyPanel via window.editorCallbacks
        
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
            platforms: this.platforms,
            stickers: this.stickers
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
            trapezoidSlope: 0.3,
            // Sticker settings
            stickerText: "New Sticker",
            stickerPreset: "tip",
            stickerFontSize: "18px",
            stickerColor: "#ffffff"
        };
        
        // Input will be set up in create() method
        
        // UI elements
        this.wormSprite = null;
        this.wormText = null;
        this.goalSprite = null;
        this.testWorm = null;
        
        // Auto-save settings - 100ms delay as requested for server integration
        this.autoSaveTimer = null;
        this.autoSaveDelay = 100; // Auto-save 100ms after last change
        
        // Saved maps list
        this.savedMaps = this.getSavedMaps();
        
        // Try to restore the current editing session
        this.restoreEditingSession();
        
        // Check for server-provided map data
        this.initializeWithServerData();
    }
    
    create() {
        // Turn off debug rendering initially
        this.matter.world.drawDebug = false;
        
        // Re-check for server data in case it wasn't available during constructor
        if (typeof window !== 'undefined' && window.serverMapData && !this.mapData.dimensions) {
            console.log('Late initialization with server map data:', window.serverMapData);
            this.mapData = window.serverMapData;
            this.entities = window.serverMapData.entities || this.entities;
        }
        
        // Ensure entities is properly initialized with fallbacks
        if (!this.entities || !this.entities.wormStart) {
            console.log('Entities not properly initialized, using fallbacks');
            this.entities = {
                wormStart: this.mapData.entities?.wormStart || { x: 200, y: 900 },
                goal: this.mapData.entities?.goal || { x: 1700, y: 200 }
            };
        }
        
        // Use pixel dimensions directly with fallbacks
        const levelWidth = this.mapData.dimensions?.width || 1920;
        const levelHeight = this.mapData.dimensions?.height || 1152;
        
        console.log('MapEditor create() - dimensions:', { width: levelWidth, height: levelHeight });
        console.log('MapEditor create() - mapData:', this.mapData);
        
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
        
        // Restore stickers from session if any
        if (this.mapData.stickers && this.mapData.stickers.length > 0) {
            this.mapData.stickers.forEach(stickerData => {
                this.addStickerToScene(stickerData);
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
            
            // Check if clicking on sticker first (they're on top)
            const clickedSticker = this.stickers.find(s => 
                s.containsPoint(worldX, worldY)
            );
            
            if (clickedSticker) {
                this.selectSticker(clickedSticker);
            } else {
                // Check if clicking on platform container
                const clickedPlatform = this.platforms.find(p => 
                    this.isContainerAtPosition(p, worldX, worldY)
                );
                
                if (clickedPlatform) {
                    this.selectPlatform(clickedPlatform);
                } else {
                    this.selectPlatform(null);
                    this.selectSticker(null);
                }
            }
        });
        
        // Setup camera - remove built-in bounds to use manual constraints
        this.cameras.main.removeBounds();
        this.cameras.main.setZoom(0.8);
        this.cameras.main.centerOn(levelWidth / 2, levelHeight / 2);
        
        // Add camera info display
        this.createCameraInfoDisplay();
        
        // Create GUI
        // this.setupGUI(); // Replaced with React PropertyPanel
    }
    
    createCameraInfoDisplay() {
        // Create camera info text display
        this.cameraInfoText = this.add.text(10, 10, '', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        }).setScrollFactor(0).setDepth(1000);
        
        // Create controls help text
        this.controlsHelpText = this.add.text(10, this.cameras.main.height - 100, 
            'Controls:\nIJKL/Arrows: Move camera\nWASD: Control worm (test mode)\nMouse wheel: Scroll vertically\nShift+wheel: Scroll horizontally\nCtrl+wheel: Zoom in/out\nMiddle mouse: Pan\nDouble-click: Create platform', {
            fontSize: '12px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        }).setScrollFactor(0).setDepth(1000);
        
        this.updateCameraInfoDisplay();
    }
    
    updateCameraInfoDisplay() {
        if (this.cameraInfoText) {
            const camera = this.cameras.main;
            const x = Math.round(camera.scrollX);
            const y = Math.round(camera.scrollY);
            const zoom = (camera.zoom * 100).toFixed(0);
            
            this.cameraInfoText.setText(`Camera: (${x}, ${y}) | Zoom: ${zoom}%`);
        }
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
    
    initializeWithServerData() {
        // Check if we're running in server mode with provided map data
        if (typeof window !== 'undefined' && window.serverMapData) {
            console.log('Initializing editor with server map data:', window.serverMapData);
            this.mapData = window.serverMapData;
            this.entities = window.serverMapData.entities || {
                wormStart: { x: 200, y: 900 },
                goal: { x: 1700, y: 200 }
            };
            this.platforms = []; // Will be rebuilt from mapData.platforms
            
            // Store reference globally so server can access the scene
            window.mapEditorScene = this;
            
            console.log('MapEditor initialized with entities:', this.entities);
        }
    }
    
    // Helper method to get current grid snap state from React PropertyPanel
    getGridSnapEnabled() {
        if (typeof window !== 'undefined' && window.editorCallbacks) {
            return window.editorCallbacks.gridSnapEnabled;
        }
        return true; // Default fallback
    }
    
    getToolSettings() {
        // Read tool settings from React PropertyPanel
        if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.toolSettings) {
            return window.editorCallbacks.toolSettings;
        }
        // Fallback to local toolSettings
        return this.toolSettings;
    }
    
    getSelectedTool() {
        // Read selected tool from React PropertyPanel
        if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.selectedTool) {
            return window.editorCallbacks.selectedTool;
        }
        // Fallback to local selectedTool
        return this.selectedTool;
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
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
            this.mapData.stickers = this.stickers.map(s => s.toJSON());
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
        // Ensure entities exist before accessing them
        if (!this.entities || !this.entities.wormStart) {
            console.error('Entities not available in createEntitySprites, using defaults');
            this.entities = {
                wormStart: { x: 200, y: 900 },
                goal: { x: 1700, y: 200 }
            };
        }
        
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
        
        // Create reference worm for scale visualization
        this.createReferenceWorm();
    }
    
    setupEntityDragging() {
        this.input.setDraggable([this.wormSprite, this.goalSprite]);
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (!this.isTestMode) {
                if (this.getGridSnapEnabled()) {
                    dragX = Math.round(dragX / this.SNAP_SIZE) * this.SNAP_SIZE;
                    dragY = Math.round(dragY / this.SNAP_SIZE) * this.SNAP_SIZE;
                }
                
                gameObject.x = dragX;
                gameObject.y = dragY;
                
                // Update entity positions
                if (gameObject === this.wormSprite) {
                    this.entities.wormStart = { x: dragX, y: dragY };
                    if (this.wormText) {
                        this.wormText.setPosition(dragX, dragY);
                    }
                    this.updateReferenceWormPosition();
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
                    this.updateReferenceWormPosition();
                } else if (gameObject === this.goalSprite) {
                    this.entities.goal = { x: roundedX, y: roundedY };
                }
                this.autoSave();
            }
        });
    }
    
    createReferenceWorm() {
        // Create a visual reference worm to show scale and positioning
        // This gives a better sense of the actual worm size relative to platforms
        
        const wormX = this.entities.wormStart.x;
        const wormY = this.entities.wormStart.y;
        
        // Worm configuration matching DoubleWorm defaults
        const baseRadius = 15;
        const segmentSizes = [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8];
        const segmentSpacing = 25; // Approximate spacing between segments
        
        this.referenceWormSegments = [];
        
        // Create worm segments as simple circles (positioned vertically downwards)
        segmentSizes.forEach((sizeMultiplier, index) => {
            const segmentRadius = baseRadius * sizeMultiplier;
            const segmentX = wormX;
            const segmentY = wormY + (index * segmentSpacing); // Vertical positioning
            
            // Create segment circle with semi-transparent appearance
            const segment = this.add.circle(segmentX, segmentY, segmentRadius, 0x44aa44, 0.4);
            segment.setStrokeStyle(1, 0x228822, 0.6);
            segment.setDepth(5); // Below entity markers but above grid
            
            this.referenceWormSegments.push(segment);
        });
        
        // Add a simple head indicator
        const head = this.referenceWormSegments[0];
        if (head) {
            // Add eyes to the head
            const eyeOffset = baseRadius * 0.4;
            const leftEye = this.add.circle(head.x - eyeOffset/2, head.y - eyeOffset/2, 2, 0x000000);
            const rightEye = this.add.circle(head.x + eyeOffset/2, head.y - eyeOffset/2, 2, 0x000000);
            leftEye.setDepth(6);
            rightEye.setDepth(6);
            
            this.referenceWormSegments.push(leftEye, rightEye);
        }
        
        console.log(`Created reference worm with ${segmentSizes.length} segments at (${wormX}, ${wormY})`);
    }
    
    updateReferenceWormPosition() {
        // Update reference worm position when worm start position changes
        if (!this.referenceWormSegments || this.referenceWormSegments.length === 0) return;
        
        const wormX = this.entities.wormStart.x;
        const wormY = this.entities.wormStart.y;
        const segmentSpacing = 25;
        
        // Update main segments (excluding eyes)
        const mainSegments = this.referenceWormSegments.slice(0, -2);
        mainSegments.forEach((segment, index) => {
            segment.setPosition(wormX + (index * segmentSpacing), wormY);
        });
        
        // Update eyes if they exist
        if (this.referenceWormSegments.length >= 2) {
            const baseRadius = 15;
            const eyeOffset = baseRadius * 0.4;
            const leftEye = this.referenceWormSegments[this.referenceWormSegments.length - 2];
            const rightEye = this.referenceWormSegments[this.referenceWormSegments.length - 1];
            
            leftEye.setPosition(wormX - eyeOffset/2, wormY - eyeOffset/2);
            rightEye.setPosition(wormX + eyeOffset/2, wormY - eyeOffset/2);
        }
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
            
            // Handle sticker selection on drag start
            if (gameObject.stickerInstance) {
                this.selectSticker(gameObject.stickerInstance);
            }
        });
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.isTestMode) return;
            
            // Handle resize operations (key fix: don't recreate handles during resize)
            if (gameObject.handleType && this.isResizing) {
                if (gameObject.handleType === 'rotation') {
                    this.handleRotation(gameObject, dragX, dragY);
                } else {
                    this.handleResize(gameObject, dragX, dragY);
                }
                return;
            }
            
            // Handle platform movement
            if (gameObject.platformData && !gameObject.handleType) {
                if (this.getGridSnapEnabled()) {
                    dragX = Math.round(dragX / this.SNAP_SIZE) * this.SNAP_SIZE;
                    dragY = Math.round(dragY / this.SNAP_SIZE) * this.SNAP_SIZE;
                }
                
                gameObject.x = dragX;
                gameObject.y = dragY;
                
                // Update platform data (no handle recreation here)
                const platform = this.platforms.find(p => p.container === gameObject);
                if (platform) {
                    platform.data.x = dragX;
                    platform.data.y = dragY;
                    
                    // Synchronize platform instance position with editor container
                    if (platform.instance && platform.instance.setPosition) {
                        platform.instance.setPosition(dragX, dragY);
                    }
                    
                    this.autoSave();
                }
            }
            
            // Handle sticker movement
            if (gameObject.stickerInstance) {
                let newX = dragX;
                let newY = dragY;
                
                if (this.getGridSnapEnabled()) {
                    newX = Math.round(dragX / this.SNAP_SIZE) * this.SNAP_SIZE;
                    newY = Math.round(dragY / this.SNAP_SIZE) * this.SNAP_SIZE;
                }
                
                gameObject.stickerInstance.setPosition(newX, newY);
                this.autoSave();
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
                    
                    // Update handle positions to maintain rotation after move
                    this.updateHandlePositions(platform);
                    this.autoSave();
                }
            } else if (gameObject.stickerInstance) {
                // Update map data after sticker drag
                this.mapData.stickers = this.stickers.map(s => s.toJSON());
                this.autoSave();
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
        
        if (this.getGridSnapEnabled()) {
            relativeX = Math.round(relativeX / this.SNAP_SIZE) * this.SNAP_SIZE;
            relativeY = Math.round(relativeY / this.SNAP_SIZE) * this.SNAP_SIZE;
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
        
        // With center-based coordinates, relativeX and relativeY are distances from center
        switch (handleType) {
            case 'nw':
                // Northwest handle: both width and height grow outward from center
                data.width = Math.max(minSize, Math.abs(relativeX) * 2);
                data.height = Math.max(minSize, Math.abs(relativeY) * 2);
                break;
            case 'ne':
                // Northeast handle: width grows right, height grows up
                data.width = Math.max(minSize, Math.abs(relativeX) * 2);
                data.height = Math.max(minSize, Math.abs(relativeY) * 2);
                break;
            case 'sw':
                // Southwest handle: width grows left, height grows down
                data.width = Math.max(minSize, Math.abs(relativeX) * 2);
                data.height = Math.max(minSize, Math.abs(relativeY) * 2);
                break;
            case 'se':
                // Southeast handle: both width and height grow outward from center
                data.width = Math.max(minSize, Math.abs(relativeX) * 2);
                data.height = Math.max(minSize, Math.abs(relativeY) * 2);
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
    
    handleRotation(handle, dragX, dragY) {
        const platform = this.platforms.find(p => p.data === handle.platformData);
        if (!platform) return;
        
        // Calculate angle from platform center to handle position
        const centerX = 0; // Handle is relative to container center
        const centerY = 0;
        const angle = Math.atan2(dragY - centerY, dragX - centerX);
        
        // Convert to rotation (add 90 degrees so "up" is 0 rotation)
        const rotation = angle + Math.PI / 2;
        
        // Update platform data (use 'angle' to match platform instance config)
        platform.data.angle = rotation;
        
        // Update visual rotation
        this.updatePlatformVisual(platform);
        
        // Update handle positions to maintain relative positioning
        this.updateHandlePositions(platform);
        
        this.autoSave();
        console.log(`New rotation: ${(rotation * 180 / Math.PI).toFixed(1)} degrees`);
        console.log(`Platform data angle:`, platform.data.angle);
    }
    
    updatePlatformVisual(platform) {
        // Destroy old platform instance
        if (platform.instance) {
            platform.instance.destroy();
        }
        
        // Create new platform instance
        platform.instance = this.createPlatformInstance(platform.data);
        platform.visual = platform.instance.container || platform.instance.graphics;
        
        // Update editor container reference
        platform.container.platformInstance = platform.instance;
        
        // Reapply selection highlighting if needed
        if (this.selectedPlatform === platform) {
            this.highlightSelectedPlatform(platform);
        }
    }
    
    highlightSelectedPlatform(platform) {
        // Add selection highlight to platform instance
        if (platform.instance && platform.instance.graphics) {
            // Check if graphics object has setStrokeStyle method (standard platforms)
            if (typeof platform.instance.graphics.setStrokeStyle === 'function') {
                platform.instance.graphics.setStrokeStyle(4, 0x00ff00, 1);
            }
            // For special platforms with custom graphics, we could add other highlighting methods here
        }
    }
    
    updateHandlePositions(platform) {
        if (!platform.handles) return;
        
        // Update handle positions based on current platform size
        // Handles are inside the container, so use container-relative coordinates
        const { width, height, radius, type, angle = 0 } = platform.data;
        
        console.log(`updateHandlePositions: angle = ${angle}, type = ${type}`);
        
        // Helper function to rotate a point around origin
        const rotatePoint = (x, y, rotation) => {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return {
                x: x * cos - y * sin,
                y: x * sin + y * cos
            };
        };
        
        let resizeHandleCount = 0;
        platform.handles.forEach((handle, index) => {
            // Skip graphics objects (rotation icon)
            if (!handle.handleType) return;
            
            if (handle.handleType === 'rotation') {
                // Position rotation handle at the top edge of the shape
                let rotationDistance;
                if (type === 'circle') {
                    rotationDistance = radius; // Right at the edge of the circle
                } else if (type === 'rectangle' || type === 'trapezoid') {
                    rotationDistance = height / 2; // Right at the top edge of the rectangle
                } else {
                    rotationDistance = 30; // Default distance for other shapes
                }
                
                // Rotate the rotation handle position
                const rotatedPos = rotatePoint(0, -rotationDistance, angle);
                handle.setPosition(rotatedPos.x, rotatedPos.y);
                
                // Also update the rotation icon position (next item in array)
                const iconIndex = index + 1;
                if (iconIndex < platform.handles.length && !platform.handles[iconIndex].handleType) {
                    platform.handles[iconIndex].setPosition(rotatedPos.x, rotatedPos.y);
                }
            } else {
                // Handle resize handles
                if (type === 'rectangle' || type === 'trapezoid') {
                    // Use center-based coordinates (matching initial creation)
                    const halfWidth = width / 2;
                    const halfHeight = height / 2;
                    const positions = [
                        { x: -halfWidth, y: -halfHeight },   // nw
                        { x: halfWidth, y: -halfHeight },    // ne
                        { x: -halfWidth, y: halfHeight },    // sw
                        { x: halfWidth, y: halfHeight }      // se
                    ];
                    if (positions[resizeHandleCount]) {
                        // Apply rotation to handle position
                        const rotatedPos = rotatePoint(
                            positions[resizeHandleCount].x, 
                            positions[resizeHandleCount].y, 
                            angle
                        );
                        handle.setPosition(rotatedPos.x, rotatedPos.y);
                    }
                } else if (type === 'circle') {
                    const positions = [
                        { x: 0, y: -radius },     // n
                        { x: radius, y: 0 },      // e
                        { x: 0, y: radius },      // s
                        { x: -radius, y: 0 }      // w
                    ];
                    if (positions[resizeHandleCount]) {
                        // Apply rotation to handle position
                        const rotatedPos = rotatePoint(
                            positions[resizeHandleCount].x, 
                            positions[resizeHandleCount].y, 
                            angle
                        );
                        handle.setPosition(rotatedPos.x, rotatedPos.y);
                    }
                }
                resizeHandleCount++;
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
        
        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Use different keys for camera to avoid worm control conflicts
        this.cameraKeys = this.input.keyboard.addKeys('I,J,K,L'); // IJKL for camera
        
        // Camera controls - mouse wheel scroll (with Ctrl+wheel for zoom)
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const camera = this.cameras.main;
            
            // Prevent default browser scroll
            if (pointer.event) {
                pointer.event.preventDefault();
            }
            
            // Check if Ctrl is held for zoom, otherwise scroll
            if (pointer.event && pointer.event.ctrlKey) {
                // Zoom mode with Ctrl+wheel
                const zoomSpeed = 0.1;
                const oldZoom = camera.zoom;
                
                if (deltaY < 0) {
                    // Zoom in
                    camera.zoom = Phaser.Math.Clamp(camera.zoom + zoomSpeed, 0.2, 3.0);
                } else {
                    // Zoom out
                    camera.zoom = Phaser.Math.Clamp(camera.zoom - zoomSpeed, 0.2, 3.0);
                }
                
                // Zoom towards mouse cursor position
                if (camera.zoom !== oldZoom) {
                    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
                    const zoomRatio = camera.zoom / oldZoom;
                    
                    // Adjust camera position to zoom towards cursor
                    camera.scrollX += (worldPoint.x - camera.scrollX) * (1 - 1/zoomRatio);
                    camera.scrollY += (worldPoint.y - camera.scrollY) * (1 - 1/zoomRatio);
                }
            } else {
                // Pan mode - normal wheel scrolling
                const panSpeed = 20 / camera.zoom; // Adjust speed based on zoom level
                
                if (pointer.event && pointer.event.shiftKey) {
                    // Shift+wheel = horizontal scroll
                    camera.scrollX += deltaY > 0 ? panSpeed : -panSpeed;
                } else {
                    // Normal wheel = vertical scroll
                    camera.scrollY += deltaY > 0 ? panSpeed : -panSpeed;
                }
            }
            
            // Allow camera to pan beyond world boundaries with margin
            const mapWidth = this.mapData.dimensions.width;
            const mapHeight = this.mapData.dimensions.height;
            const margin = 500; // 500 pixel margin around the world
            camera.scrollX = Phaser.Math.Clamp(camera.scrollX, -margin, Math.max(-margin, mapWidth - camera.width / camera.zoom + margin));
            camera.scrollY = Phaser.Math.Clamp(camera.scrollY, -margin, Math.max(-margin, mapHeight - camera.height / camera.zoom + margin));
            
            // Update camera info display
            this.updateCameraInfoDisplay();
        });
        
        // Pan with middle mouse
        this.input.on('pointermove', (pointer) => {
            if (pointer.middleButtonDown()) {
                const camera = this.cameras.main;
                camera.scrollX -= pointer.velocity.x / camera.zoom;
                camera.scrollY -= pointer.velocity.y / camera.zoom;
                
                // Constrain to bounds
                const mapWidth = this.mapData.dimensions.width;
                const mapHeight = this.mapData.dimensions.height;
                camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, mapWidth - camera.width / camera.zoom));
                camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, mapHeight - camera.height / camera.zoom));
                
                // Update camera info display
                this.updateCameraInfoDisplay();
            }
        });
        
        // Double-click to create platforms (manual detection)
        let lastClickTime = 0;
        this.input.on('pointerup', (pointer) => {
            const now = Date.now();
            if (now - lastClickTime < 400) { // 400ms double-click threshold
                this.createItemAtPointer(pointer);
            }
            lastClickTime = now;
        });
        
        // Setup drag events for platforms
        this.setupPlatformDragging();
    }
    
    createItemAtPointer(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        // Check if clicking on existing objects first
        if (this.isClickOnEntity(worldX, worldY) || 
            this.platforms.some(p => this.isContainerAtPosition(p, worldX, worldY)) ||
            this.stickers.some(s => s.containsPoint(worldX, worldY))) {
            return;
        }
        
        // Create item based on selected tool
        const selectedTool = this.getSelectedTool();
        if (selectedTool === 'sticker') {
            // Create sticker at pointer location
            let stickerData = this.createDefaultSticker(worldX, worldY);
            
            if (stickerData) {
                this.addStickerToScene(stickerData);
                this.autoSave();
            }
        } else {
            // Create platform at pointer location with default size
            let platformData = this.createDefaultPlatform(worldX, worldY);
            
            if (platformData) {
                this.addPlatformToScene(platformData);
                this.autoSave();
            }
        }
    }
    
    createDefaultPlatform(x, y) {
        let snapX = x, snapY = y;
        if (this.getGridSnapEnabled()) {
            snapX = Math.round(x / this.SNAP_SIZE) * this.SNAP_SIZE;
            snapY = Math.round(y / this.SNAP_SIZE) * this.SNAP_SIZE;
        }
        
        const toolSettings = this.getToolSettings();
        const selectedTool = this.getSelectedTool();
        
        const defaultSizes = {
            rectangle: { width: 96, height: 48 },
            circle: { radius: 40 },
            polygon: { radius: 40, sides: toolSettings.polygonSides },
            trapezoid: { width: 96, height: 48, slope: toolSettings.trapezoidSlope }
        };
        
        const size = defaultSizes[selectedTool];
        if (!size) return null;
        
        console.log(`Creating platform data: toolSettings.platformType=${toolSettings.platformType}, toolSettings.platformColor=${toolSettings.platformColor}`);
        
        const baseData = {
            id: `platform_${Date.now()}`,
            type: selectedTool,
            platformType: toolSettings.platformType,
            x: snapX,
            y: snapY,
            rotation: 0, // Default rotation in radians
            color: toolSettings.platformColor,
            physics: {
                friction: toolSettings.friction,
                frictionStatic: toolSettings.frictionStatic,
                restitution: toolSettings.restitution
            }
        };
        
        return { ...baseData, ...size };
    }
    
    createDefaultSticker(x, y) {
        let snapX = x, snapY = y;
        if (this.getGridSnapEnabled()) {
            snapX = Math.round(x / this.SNAP_SIZE) * this.SNAP_SIZE;
            snapY = Math.round(y / this.SNAP_SIZE) * this.SNAP_SIZE;
        }
        
        const toolSettings = this.getToolSettings();
        
        // Get preset configuration
        const presets = Sticker.getPresets();
        const presetConfig = presets[toolSettings.stickerPreset] || presets.tip;
        
        const stickerData = {
            id: `sticker_${Date.now()}`,
            x: snapX,
            y: snapY,
            text: toolSettings.stickerText,
            config: {
                ...presetConfig,
                fontSize: toolSettings.stickerFontSize,
                color: toolSettings.stickerColor
            }
        };
        
        return stickerData;
    }
    
    addStickerToScene(stickerData) {
        // Create sticker instance
        const sticker = Sticker.fromJSON(this, stickerData);
        sticker.setInteractive(true);
        
        // Set up drag and selection
        this.input.setDraggable(sticker.textObject);
        
        // Add to stickers array
        this.stickers.push(sticker);
        
        // Update map data
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        
        return sticker;
    }
    
    selectSticker(sticker) {
        // Deselect previous sticker
        if (this.selectedSticker) {
            this.selectedSticker.setHighlight(false);
        }
        
        // Deselect platform if one is selected
        if (this.selectedPlatform) {
            this.selectPlatform(null);
        }
        
        // Select new sticker
        this.selectedSticker = sticker;
        if (sticker) {
            sticker.setHighlight(true);
        }
    }
    
    deleteSelectedSticker() {
        if (this.selectedSticker) {
            // Remove from stickers array
            const index = this.stickers.indexOf(this.selectedSticker);
            if (index > -1) {
                this.stickers.splice(index, 1);
            }
            
            // Destroy the sticker
            this.selectedSticker.destroy();
            
            // Update map data
            this.mapData.stickers = this.stickers.map(s => s.toJSON());
            
            this.selectedSticker = null;
            this.autoSave();
        }
    }
    
    
    
    addPlatformToScene(platformData) {
        // Create actual platform instance using unified system
        const platformInstance = this.createPlatformInstance(platformData);
        
        if (!platformInstance) {
            console.error('Failed to create platform instance for:', platformData);
            return null;
        }
        
        // Create editor container for handles and selection (transparent overlay)
        const editorContainer = this.add.container(platformData.x, platformData.y);
        
        // Make editor container draggable with proper size based on platform type
        // Set size and ensure center-based interaction area
        if (platformData.type === 'rectangle' || platformData.type === 'trapezoid') {
            editorContainer.setSize(platformData.width, platformData.height);
        } else if (platformData.type === 'circle') {
            const diameter = platformData.radius * 2;
            editorContainer.setSize(diameter, diameter);
        } else {
            // Default fallback
            editorContainer.setSize(100, 100);
        }
        
        // Set interactive area with center origin to match coordinate system
        editorContainer.setInteractive();
        this.input.setDraggable(editorContainer);
        editorContainer.platformData = platformData;
        editorContainer.platformInstance = platformInstance;
        
        const platform = {
            data: platformData,
            instance: platformInstance,        // Actual platform instance
            container: editorContainer,        // Editor-only container for handles
            visual: platformInstance.container || platformInstance.graphics,  // Reference to visual
            id: platformData.id,
            handles: []
        };
        
        this.platforms.push(platform);
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        
        return platform;
    }
    
    createPlatformInstance(platformData) {
        const { type, platformType = 'standard', x, y, width, height, radius, color = '#666666', angle = 0 } = platformData;
        
        console.log(`Creating platform instance: type=${type}, platformType=${platformType}, color=${color}`);
        
        // Convert color to hex number
        const colorValue = color.startsWith('#') ? parseInt(color.replace('#', '0x')) : 0x666666;
        
        // Determine dimensions
        let platformWidth, platformHeight;
        if (type === 'circle') {
            platformWidth = radius * 2;
            platformHeight = radius * 2;
        } else {
            platformWidth = width || 100;
            platformHeight = height || 50;
        }
        
        // Create config object - only set color for standard platforms
        const config = {
            angle: angle,
            shape: type === 'circle' ? 'circle' : 'rectangle',
            strokeColor: 0x333333,
            strokeWidth: 2
        };
        
        // Only set custom color for standard platforms - special platforms use their built-in colors
        if (platformType === 'standard' || !platformType) {
            config.color = colorValue;
        }
        
        // Create appropriate platform type
        switch(platformType) {
            case 'ice':
                return new IcePlatform(this, x, y, platformWidth, platformHeight, config);
            case 'bouncy':
                return new BouncyPlatform(this, x, y, platformWidth, platformHeight, config);
            case 'electric':
                return new ElectricPlatform(this, x, y, platformWidth, platformHeight, config);
            case 'fire':
                return new FirePlatform(this, x, y, platformWidth, platformHeight, config);
            default:
                return new PlatformBase(this, x, y, platformWidth, platformHeight, config);
        }
    }
    
    // Removed createPlatformVisual - now using unified platform instances
    
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
        if (this.selectedPlatform) {
            this.clearPlatformHighlight(this.selectedPlatform);
            this.clearHandlesFromContainer(this.selectedPlatform);
        }
        
        // Select new platform
        this.selectedPlatform = platform;
        if (platform) {
            this.highlightSelectedPlatform(platform);
            // Add resize handles
            this.addHandlesToPlatform(platform);
        }
        
        // Notify React PropertyPanel of platform selection
        if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
            window.editorCallbacks.onPlatformSelect(platform);
        }
    }
    
    updatePlatformProperty(property, value) {
        if (!this.selectedPlatform) return;
        
        const platform = this.selectedPlatform;
        const oldValue = platform.data[property];
        
        // Update the data
        platform.data[property] = value;
        
        // Handle position changes
        if (property === 'x' || property === 'y') {
            // Update physics body position
            if (platform.instance && platform.instance.body) {
                platform.instance.body.setPosition(platform.data.x, platform.data.y);
            }
            
            // Update graphics position
            if (platform.container) {
                platform.container.setPosition(platform.data.x, platform.data.y);
            }
        }
        
        // Handle size changes for rectangles
        else if ((property === 'width' || property === 'height') && platform.data.shape === 'rectangle') {
            // Recreate the platform with new dimensions
            this.recreatePlatform(platform);
        }
        
        // Handle radius changes for circles
        else if (property === 'radius' && platform.data.shape === 'circle') {
            // Recreate the platform with new radius
            this.recreatePlatform(platform);
        }
        
        // Handle other properties that might need platform recreation
        else if (property === 'friction' || property === 'frictionStatic' || property === 'restitution') {
            // Update physics properties
            if (platform.instance && platform.instance.body) {
                platform.instance.body.setFriction(platform.data.friction || 0.8);
                platform.instance.body.setFrictionStatic(platform.data.frictionStatic || 0.9);
                platform.instance.body.setBounce(platform.data.restitution || 0.3);
            }
        }
        
        console.log(`Updated platform ${property}: ${oldValue} -> ${value}`);
    }
    
    recreatePlatform(platform) {
        const wasSelected = this.selectedPlatform === platform;
        const index = this.platforms.indexOf(platform);
        
        // Store current position and data
        const currentData = { ...platform.data };
        
        // Remove old platform
        if (platform.container) {
            platform.container.destroy();
        }
        if (platform.instance && platform.instance.body) {
            this.matter.world.remove(platform.instance.body);
        }
        
        // Create new platform with updated data
        const newPlatform = this.addPlatformToScene(currentData);
        
        // Replace in platforms array
        this.platforms[index] = newPlatform;
        
        // Restore selection if it was selected
        if (wasSelected) {
            this.selectPlatform(newPlatform);
        }
    }
    
    clearPlatformHighlight(platform) {
        // Reset platform graphics to default styling
        if (platform.instance && platform.instance.graphics) {
            // Check if graphics object has setStrokeStyle method (standard platforms)
            if (typeof platform.instance.graphics.setStrokeStyle === 'function') {
                platform.instance.graphics.setStrokeStyle(2, 0x333333, 1);
            }
            // For special platforms with custom graphics, no action needed (they maintain their own styling)
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
        
        // Create resize handles for rectangles and circles
        if (data.type === 'rectangle' || data.type === 'trapezoid') {
            this.createRectangleHandles(platform);
        } else if (data.type === 'circle') {
            this.createCircleHandles(platform);
        }
        
        // Add rotation handle for all platform types
        this.createRotationHandle(platform);
    }
    
    createRectangleHandles(platform) {
        const { width, height, angle = 0 } = platform.data;
        
        // Helper function to rotate a point around origin
        const rotatePoint = (x, y, rotation) => {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return {
                x: x * cos - y * sin,
                y: x * sin + y * cos
            };
        };
        
        // Corner handles relative to center origin (like circles)
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const basePositions = [
            { x: -halfWidth, y: -halfHeight, type: 'nw' },
            { x: halfWidth, y: -halfHeight, type: 'ne' },
            { x: -halfWidth, y: halfHeight, type: 'sw' },
            { x: halfWidth, y: halfHeight, type: 'se' }
        ];
        
        // Apply rotation to handle positions
        const handlePositions = basePositions.map(pos => ({
            x: rotatePoint(pos.x, pos.y, angle).x,
            y: rotatePoint(pos.x, pos.y, angle).y,
            type: pos.type
        }));
        
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
        const { radius, angle = 0 } = platform.data;
        
        // Helper function to rotate a point around origin
        const rotatePoint = (x, y, rotation) => {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return {
                x: x * cos - y * sin,
                y: x * sin + y * cos
            };
        };
        
        // Four resize handles around the circle relative to container center
        const basePositions = [
            { x: 0, y: -radius, type: 'n' },
            { x: radius, y: 0, type: 'e' },
            { x: 0, y: radius, type: 's' },
            { x: -radius, y: 0, type: 'w' }
        ];
        
        // Apply rotation to handle positions
        const handlePositions = basePositions.map(pos => ({
            x: rotatePoint(pos.x, pos.y, angle).x,
            y: rotatePoint(pos.x, pos.y, angle).y,
            type: pos.type
        }));
        
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
    
    createRotationHandle(platform) {
        const { type, radius, width, height, angle = 0 } = platform.data;
        
        // Helper function to rotate a point around origin
        const rotatePoint = (x, y, rotation) => {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return {
                x: x * cos - y * sin,
                y: x * sin + y * cos
            };
        };
        
        // Position rotation handle at the top edge of the shape
        let rotationDistance;
        if (type === 'circle') {
            rotationDistance = radius; // Right at the edge of the circle
        } else if (type === 'rectangle' || type === 'trapezoid') {
            rotationDistance = height / 2; // Right at the top edge of the rectangle
        } else {
            rotationDistance = 30; // Default distance for other shapes
        }
        
        // Apply rotation to handle position
        const rotatedPos = rotatePoint(0, -rotationDistance, angle);
        const handle = this.add.circle(rotatedPos.x, rotatedPos.y, 8, 0xff4444);
        handle.setStrokeStyle(2, 0xaa2222);
        handle.setInteractive();
        handle.handleType = 'rotation';
        handle.platformData = platform.data;
        handle.setDepth(300);
        
        // Add rotation icon indicator
        const rotationIcon = this.add.graphics();
        rotationIcon.lineStyle(2, 0xffffff);
        rotationIcon.strokeCircle(0, 0, 4);
        rotationIcon.moveTo(-2, -2);
        rotationIcon.lineTo(2, 2);
        rotationIcon.moveTo(2, -2);
        rotationIcon.lineTo(-2, 2);
        rotationIcon.strokePath();
        rotationIcon.setPosition(rotatedPos.x, rotatedPos.y);
        rotationIcon.setDepth(301);
        
        // Make it draggable
        this.input.setDraggable(handle);
        
        // Visual feedback
        handle.on('pointerover', () => {
            handle.setFillStyle(0xff6666);
            rotationIcon.setAlpha(1.2);
        });
        handle.on('pointerout', () => {
            handle.setFillStyle(0xff4444);
            rotationIcon.setAlpha(1.0);
        });
        
        // Add both handle and icon to container
        platform.container.add(handle);
        platform.container.add(rotationIcon);
        platform.handles.push(handle);
        platform.handles.push(rotationIcon); // Track the icon too for cleanup
        
        console.log('Created rotation handle for platform type:', type);
    }
    
    deleteSelectedPlatform() {
        if (this.selectedPlatform) {
            // Clear resize handles first
            this.clearHandlesFromContainer(this.selectedPlatform);
            
            // Destroy the platform instance (which destroys container and physics body)
            if (this.selectedPlatform.instance && this.selectedPlatform.instance.destroy) {
                this.selectedPlatform.instance.destroy();
            }
            
            // Also destroy the editor container if it exists separately
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
            this.mapData.stickers = this.stickers.map(s => s.toJSON());
            
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
        // if (this.gui && this.testModeController) {
        //     this.testModeController.updateDisplay();
        // }
    }
    
    enterTestMode() {
        // Create temporary JsonMapBase scene to test the map
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        
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
        // No need to create additional physics bodies - using unified platform instances
        // The platform instances from the editor already have physics bodies and visuals
        console.log(`Test mode: Using ${this.platforms.length} unified platform instances`);
        
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
        const { type, physics = {}, rotation = 0 } = platformData;
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
                const { x: polyX, y: polyY, sides, radius: polyRadius } = platformData;
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
        
        // Apply rotation to the physics body
        if (body && rotation !== 0) {
            this.matter.body.setAngle(body, rotation);
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
        const { type, color, rotation = 0 } = platformData;
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
                const { x: polyX, y: polyY, sides, radius: polyRadius } = platformData;
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
            // Apply rotation to test visuals
            visual.setRotation(rotation);
        }
        
        return visual;
    }
    
    createSpecialPlatformForTest(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, color, rotation = 0 } = platformData;
        
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
            angle: rotation, // Pass rotation to special platforms
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
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
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
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        
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
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        
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
        
        // Different actions based on whether we're running in server mode
        const mapActions = this.isRunningInServerMode() ? {
            'Save': () => this.saveToServer()
        } : {
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
                'bouncy': '#ff69b4', 
                'electric': '#ffff00',
                'fire': '#f44336'
            };
            this.toolSettings.platformColor = colors[value] || '#ff6b6b';
            // this.gui.updateDisplay(); // Replaced with React PropertyPanel
        });
        toolsFolder.addColor(this.toolSettings, 'platformColor').name('Platform Color');
        // Note: Grid snap is now controlled by React PropertyPanel
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
    
    isRunningInServerMode() {
        return typeof window !== 'undefined' && window.serverMapData && window.saveCurrentMap;
    }
    
    saveToServer() {
        if (typeof window !== 'undefined' && window.saveCurrentMap) {
            window.saveCurrentMap();
        } else {
            console.warn('Server save function not available');
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
            // this.gui.updateDisplay(); // Replaced with React PropertyPanel
        }
    }
    
    updateGUIForSelectedPlatform() {
        // Update GUI to show selected platform properties
        // This could expand to show platform-specific settings
    }
    
    updateCameraControls(delta) {
        const camera = this.cameras.main;
        const cameraSpeed = 200 / camera.zoom; // Adjust speed based on zoom level
        const moveDistance = (cameraSpeed * delta) / 1000; // Convert to pixels per frame
        
        // IJKL and arrow key camera movement
        let moved = false;
        
        if (this.cameraKeys.I.isDown || this.cursors.up.isDown) {
            camera.scrollY -= moveDistance;
            moved = true;
        }
        if (this.cameraKeys.K.isDown || this.cursors.down.isDown) {
            camera.scrollY += moveDistance;
            moved = true;
        }
        if (this.cameraKeys.J.isDown || this.cursors.left.isDown) {
            camera.scrollX -= moveDistance;
            moved = true;
        }
        if (this.cameraKeys.L.isDown || this.cursors.right.isDown) {
            camera.scrollX += moveDistance;
            moved = true;
        }
        
        // Constrain camera to map bounds
        if (moved) {
            const bounds = camera.getBounds();
            const mapWidth = this.mapData.dimensions.width;
            const mapHeight = this.mapData.dimensions.height;
            
            // Allow camera to pan beyond world boundaries with margin
            const margin = 500; // 500 pixel margin around the world
            camera.scrollX = Phaser.Math.Clamp(camera.scrollX, -margin, Math.max(-margin, mapWidth - camera.width / camera.zoom + margin));
            camera.scrollY = Phaser.Math.Clamp(camera.scrollY, -margin, Math.max(-margin, mapHeight - camera.height / camera.zoom + margin));
            
            // Update camera info display
            this.updateCameraInfoDisplay();
        }
    }
    
    update(time, delta) {
        // Camera controls (only when not in test mode)
        if (!this.isTestMode) {
            this.updateCameraControls(delta);
        }
        
        if (this.isTestMode && this.testWorm) {
            this.testWorm.update(delta);
            
            // Update all platforms during test mode (now using unified system)
            this.platforms.forEach(platform => {
                if (platform.instance && platform.instance.update) {
                    platform.instance.update(delta);
                }
            });
            
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
    
    destroy() {
        // Clean up dat.gui instance
        // if (this.gui) {
        //     this.gui.destroy();
        //     this.gui = null;
        // }
        
        // Call parent destroy
        super.destroy();
    }
    
}
