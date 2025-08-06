import Phaser from 'phaser';
// import * as dat from 'dat.gui'; // Replaced with React PropertyPanel
import DoubleWorm from '../entities/DoubleWorm';
import PlatformBase from '../entities/PlatformBase';
import IcePlatform from '../entities/IcePlatform';
import BouncyPlatform from '../entities/BouncyPlatform';
import ElectricPlatform from '../entities/ElectricPlatform';
import FirePlatform from '../entities/FirePlatform';
import BlackholePlatform from '../entities/BlackholePlatform';
import WaterPlatform from '../entities/WaterPlatform';
import WaterfallPlatform from '../entities/WaterfallPlatform';
import Sticker from '../entities/Sticker';

export default class MapEditor extends Phaser.Scene {
    constructor() {
        super({ key: 'MapEditor' });
        
        this.CONFIG = this.initializeConfig();
        this.initializeState();
        this.initializeMapData();
        this.initializeStorage();
    }
    
    initializeConfig() {
        return {
            GRID: {
                CHAR_WIDTH: 96,
                CHAR_HEIGHT: 48,
                ROW_SPACING: 96,
                SNAP_SIZE: 12 
            },
            CAMERA: {
                EDITOR_ZOOM: 0.8,
                TEST_ZOOM: 1.0,
                MIN_ZOOM: 0.15,
                MAX_ZOOM: 2.0,
                ZOOM_SPEED: 0.05,
                PAN_SPEED: 10,
                MARGIN: 300
            },
            WORM: {
                BASE_RADIUS: 15,
                SEGMENT_SIZES: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
                SEGMENT_SPACING: 25,
                EYE_OFFSET_RATIO: 0.4,
                EYE_SIZE: 2
            },
            ENTITIES: {
                DEFAULT_WORM_START: { x: 200, y: 900 },
                DEFAULT_GOAL: { x: 1700, y: 200 },
                WORM_SPRITE_RADIUS: 20,
                GOAL_SPRITE_RADIUS: 25
            },
            DEFAULTS: {
                MAP_DIMENSIONS: { width: 1920, height: 1152 },
                PLATFORM_SIZES: {
                    rectangle: { width: 96, height: 48 },
                    circle: { radius: 40 },
                    polygon: { radius: 40, sides: 6 },
                    trapezoid: { width: 96, height: 48, slope: 0.3 }
                },
                PHYSICS: {
                    friction: 0.8,
                    frictionStatic: 1.0,
                    restitution: 0
                },
                PLATFORM_COLORS: {
                    standard: '#ff6b6b',
                    ice: '#b3e5fc',
                    bouncy: '#ff69b4',
                    electric: '#ffff00',
                    fire: '#f44336'
                }
            },
            HANDLES: {
                SIZE: 12,
                CIRCLE_SIZE: 6,
                ROTATION_SIZE: 8,
                COLOR: 0x00ffff,
                STROKE_COLOR: 0x0088aa,
                HOVER_COLOR: 0xffff88,
                ROTATION_COLOR: 0xff4444,
                ROTATION_STROKE_COLOR: 0xaa2222,
                DEPTH: 300
            },
            TIMING: {
                AUTO_SAVE_DELAY: 100,
                DOUBLE_CLICK_THRESHOLD: 400,
                VICTORY_DISPLAY_DURATION: 3000
            }
        };
    }
    
    initializeState() {
        this.isTestMode = false;
        this.selectedTool = 'rectangle';
        this.selectedPlatform = null;
        this.selectedSticker = null;
        this.selectedConstraint = null;
        this.platforms = [];
        this.stickers = [];
        this.constraints = [];
        this.entities = {
            wormStart: { ...this.CONFIG.ENTITIES.DEFAULT_WORM_START },
            goal: { ...this.CONFIG.ENTITIES.DEFAULT_GOAL }
        };
        this.resizeHandles = [];
        this.isResizing = false;
        this.activeResizeHandle = null;
        this.toolSettings = this.createDefaultToolSettings();
        this.autoSaveTimer = null;
        this.eventListeners = []; // Track all event listeners for cleanup
        
        // Constraint creation state
        this.constraintCreationMode = false;
        this.constraintFirstBody = null;
        this.constraintPreviewLine = null;
    }
    
    createDefaultToolSettings() {
        return {
            platformColor: this.CONFIG.DEFAULTS.PLATFORM_COLORS.standard,
            platformType: "standard",
            ...this.CONFIG.DEFAULTS.PHYSICS,
            polygonSides: 6,
            polygonRadius: 2,
            trapezoidSlope: 0.3,
            stickerText: "New Sticker",
            stickerPreset: "tip",
            stickerFontSize: "18px",
            stickerColor: "#ffffff",
            // Constraint settings
            constraintStiffness: 0.8,
            constraintDamping: 0.2,
            constraintLength: null, // null means auto-calculate
            constraintRender: true
        };
    }
    
    initializeMapData() {
        this.entities = {
            wormStart: { ...this.CONFIG.ENTITIES.DEFAULT_WORM_START },
            goal: { ...this.CONFIG.ENTITIES.DEFAULT_GOAL }
        };
        
        this.mapData = {
            metadata: {
                name: "New Map",
                difficulty: 1,
                description: "A custom level"
            },
            dimensions: { ...this.CONFIG.DEFAULTS.MAP_DIMENSIONS },
            entities: this.entities,
            platforms: this.platforms,
            stickers: this.stickers,
            constraints: this.constraints
        };
    }
    
    initializeStorage() {
        this.savedMaps = this.getSavedMaps();
        this.restoreEditingSession();
        this.initializeWithServerData();
    }
    
    create() {
        // Check URL for debug parameter
        const urlParams = new URLSearchParams(window.location.search);
        const debugEnabled = urlParams.get('debug') === '1';
        
        // Set debug rendering based on URL parameter
        this.matter.world.drawDebug = debugEnabled;
        
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
        const levelWidth = this.mapData.dimensions?.width || this.CONFIG.DEFAULTS.MAP_DIMENSIONS.width;
        const levelHeight = this.mapData.dimensions?.height || this.CONFIG.DEFAULTS.MAP_DIMENSIONS.height;
        
        console.log('MapEditor create() - dimensions:', { width: levelWidth, height: levelHeight });
        console.log('MapEditor create() - mapData:', this.mapData);
        
        // Set world bounds
        this.matter.world.setBounds(0, 0, levelWidth, levelHeight, 1000);
        
        // Create background with margin
        this.createBackgroundWithMargin(levelWidth, levelHeight);
        
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
        
        // Create constraint graphics layer BEFORE loading constraints
        this.constraintGraphics = this.add.graphics();
        this.constraintGraphics.setDepth(50); // Above platforms but below handles
        
        // Restore constraints from session if any
        if (this.mapData.constraints && this.mapData.constraints.length > 0) {
            console.log('Loading constraints from mapData:', this.mapData.constraints);
            this.mapData.constraints.forEach(constraintData => {
                this.addConstraintToScene(constraintData);
            });
            
            // Force a graphics update after all constraints are loaded
            this.updateConstraintGraphics();
        }
        
        // Setup input
        this.setupInput();
        
        // Keep default topOnly = true so we only interact with the topmost object
        
        // Combined click handler for selection and double-click creation
        let lastClickTime = 0;
        this.input.on('pointerup', (pointer) => {
            // Don't process if we just finished resizing
            if (this.justFinishedResizing) {
                this.justFinishedResizing = false;
                return;
            }
            
            if (this.isTestMode) return;
            
            const now = Date.now();
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            
            // Handle constraint tool separately
            if (this.getSelectedTool() === 'constraint') {
                this.handleConstraintClick(pointer);
                return;
            }
            
            // Check if this is a double-click
            if (now - lastClickTime < this.CONFIG.TIMING.DOUBLE_CLICK_THRESHOLD) {
                // Double-click detected - try to create item
                this.createItemAtPointer(pointer);
                lastClickTime = 0; // Reset to prevent triple-click issues
            } else {
                // Single click - handle selection
                // Check if clicking on constraint first
                const clickedConstraint = this.findConstraintAtPoint(worldX, worldY);
                
                if (clickedConstraint) {
                    this.selectConstraint(clickedConstraint);
                } else {
                    // Check if clicking on sticker (they're on top)
                    const clickedSticker = this.stickers.find(s => 
                        s.containsPoint(worldX, worldY)
                    );
                    
                    if (clickedSticker) {
                        this.selectSticker(clickedSticker);
                    } else {
                        // Check if clicking on platform graphics
                        const clickedPlatform = this.platforms.find(p => {
                            if (!p.graphics) return false;
                            
                            // Graphics objects don't have getBounds, check using data
                            if (p.graphics.type === 'Graphics') {
                                const { x, y, width, height, type, radius } = p.data;
                                if (type === 'rectangle') {
                                    return worldX >= x - width/2 && worldX <= x + width/2 &&
                                           worldY >= y - height/2 && worldY <= y + height/2;
                                } else if (type === 'circle') {
                                    const dx = worldX - x;
                                    const dy = worldY - y;
                                    return (dx * dx + dy * dy) <= (radius * radius);
                                }
                                return false;
                            } else {
                                // Regular shapes have getBounds
                                return p.graphics.getBounds().contains(worldX, worldY);
                            }
                        });
                        
                        if (clickedPlatform) {
                            this.selectPlatform(clickedPlatform);
                        } else {
                            this.selectPlatform(null);
                            this.selectSticker(null);
                            this.selectConstraint(null);
                        }
                    }
                }
                lastClickTime = now;
            }
        });
        
        // Setup camera - remove built-in bounds to use manual constraints
        this.cameras.main.removeBounds();
        
        // Calculate initial zoom to show entire map with margins
        const margin = this.CONFIG.CAMERA.MARGIN;
        const viewportWidth = this.cameras.main.width;
        const viewportHeight = this.cameras.main.height;
        const mapWidthWithMargin = levelWidth + (2 * margin);
        const mapHeightWithMargin = levelHeight + (2 * margin);
        
        // Calculate zoom level that fits entire map with margins
        const zoomX = viewportWidth / mapWidthWithMargin;
        const zoomY = viewportHeight / mapHeightWithMargin;
        const initialZoom = Math.max(this.CONFIG.CAMERA.MIN_ZOOM, Math.min(zoomX, zoomY, 0.8));
        
        this.cameras.main.setZoom(initialZoom);
        
        // Center camera on the map (not on worm position)
        this.cameras.main.centerOn(levelWidth / 2, levelHeight / 2);
        
        // Add camera info display
        this.createCameraInfoDisplay();
        
        // Create GUI
        // this.setupGUI(); // Replaced with React PropertyPanel
    }
    
    createCameraInfoDisplay() {
        // Create camera info text display
        // this.cameraInfoText = this.add.text(10, 10, '', {
        //     fontSize: '14px',
        //     fill: '#ffffff',
        //     backgroundColor: 'rgba(0, 0, 0, 0.7)',
        //     padding: { x: 8, y: 4 }
        // }).setScrollFactor(0).setDepth(1000);
        
        // // Create controls help text
        // this.controlsHelpText = this.add.text(10, this.cameras.main.height - 100, 
        //     'Controls:\nIJKL/Arrows: Move camera\nWASD: Control worm (test mode)\nMouse wheel: Scroll vertically\nShift+wheel: Scroll horizontally\nCtrl+wheel: Zoom in/out\nMiddle mouse: Pan\nDouble-click: Create platform', {
        //     fontSize: '12px',
        //     fill: '#ffffff',
        //     backgroundColor: 'rgba(0, 0, 0, 0.7)',
        //     padding: { x: 8, y: 4 }
        // }).setScrollFactor(0).setDepth(1000);
        
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
        // Maps are now stored on the server via API
        return {};
    }
    
    restoreEditingSession() {
        // Session restoration removed - always start fresh from server data
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
            this.constraints = []; // Will be rebuilt from mapData.constraints
            
            // Ensure mapData has constraints array
            if (!this.mapData.constraints) {
                this.mapData.constraints = [];
            }
            
            // Store reference globally so server can access the scene
            window.mapEditorScene = this;
            
            // Also expose test method globally for debugging
            window.testPlatformTypeChange = () => this.testPropertyUpdate();
            
            console.log('MapEditor initialized with entities:', this.entities);
            console.log('MapEditor initialized with constraints:', this.mapData.constraints);
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
        }, this.CONFIG.TIMING.AUTO_SAVE_DELAY);
    }
    
    saveEditingSession() {
        // Auto-save removed - use explicit save to API instead
        // Map data is saved via the Save button which calls the API
    }
    
    saveMapsToStorage() {
        // Maps are now saved to server via API
    }
    
    createGrid(width, height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x444444, 0.5);
        
        this.drawGridLines(graphics, width, height);
        this.drawGridMarkers(width, height);
        
        graphics.strokePath();
        graphics.setDepth(-100);
        this.gridGraphics = graphics;
    }
    
    drawGridLines(graphics, width, height) {
        // Vertical lines
        for (let x = 0; x <= width; x += this.CONFIG.GRID.CHAR_WIDTH) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        // Horizontal lines - use CHAR_WIDTH for consistency with JsonMapBase
        for (let gridLine = 0; gridLine * this.CONFIG.GRID.CHAR_WIDTH <= height; gridLine++) {
            const y = height - (gridLine * this.CONFIG.GRID.CHAR_WIDTH);
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
    }
    
    drawGridMarkers(width, height) {
        // Add height markers every 5 grid lines (matching JsonMapBase.js style)
        for (let y = 0; y <= height; y += this.CONFIG.GRID.CHAR_WIDTH) {
            const gridLineNumber = Math.round(y / this.CONFIG.GRID.CHAR_WIDTH);
            
            if (gridLineNumber % 5 === 0 && gridLineNumber > 0) {
                // Left marker
                const leftText = this.add.text(10, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                leftText.setDepth(-90);
                
                // Right marker
                const rightText = this.add.text(width - 40, height - y - 10, `${gridLineNumber}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                rightText.setDepth(-90);
                
                // Horizontal marker line
                const markerGraphics = this.add.graphics();
                markerGraphics.lineStyle(2, 0x4ecdc4, 0.6);
                markerGraphics.moveTo(0, height - y);
                markerGraphics.lineTo(width, height - y);
                markerGraphics.strokePath();
                markerGraphics.setDepth(-95);
            }
        }
        
        // Add horizontal markers every 5 grid columns
        for (let x = 0; x <= width; x += this.CONFIG.GRID.CHAR_WIDTH * 5) {
            const gridX = x / this.CONFIG.GRID.CHAR_WIDTH;
            if (gridX > 0) {
                // Top marker
                const topText = this.add.text(x - 10, 10, `${gridX}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                topText.setDepth(-90);
                
                // Bottom marker
                const bottomText = this.add.text(x - 10, height - 30, `${gridX}`, {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 5, y: 2 }
                });
                bottomText.setDepth(-90);
            }
        }
    }
    
    createBackgroundWithMargin(width, height) {
        const margin = this.CONFIG.CAMERA.MARGIN;
        
        // Create a dark background that extends beyond the map
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x1a1a1a, 1);
        bgGraphics.fillRect(-margin, -margin, width + 2 * margin, height + 2 * margin);
        bgGraphics.setDepth(-200);
        
        // Create a lighter background for the actual map area
        const mapBg = this.add.graphics();
        mapBg.fillStyle(0x2a2a2a, 1);
        mapBg.fillRect(0, 0, width, height);
        mapBg.setDepth(-150);
    }
    
    createBoundaryWalls(width, height) {
        const graphics = this.add.graphics();
        graphics.lineStyle(3, 0xe74c3c, 0.8);
        graphics.strokeRect(0, 0, width, height);
        graphics.setDepth(-50);
    }
    
    createEntitySprites() {
        this.ensureEntitiesExist();
        this.createWormSprite();
        this.createGoalSprite();
        this.setupEntityDragging();
        this.createReferenceWorm();
    }
    
    ensureEntitiesExist() {
        if (!this.entities || !this.entities.wormStart) {
            console.error('Entities not available in createEntitySprites, using defaults');
            this.entities = {
                wormStart: { ...this.CONFIG.ENTITIES.DEFAULT_WORM_START },
                goal: { ...this.CONFIG.ENTITIES.DEFAULT_GOAL }
            };
        }
    }
    
    createWormSprite() {
        const { x: wormX, y: wormY } = this.entities.wormStart;
        const radius = this.CONFIG.ENTITIES.WORM_SPRITE_RADIUS;
        
        this.wormSprite = this.add.circle(wormX, wormY, radius, 0x00ff00, 0.7);
        this.wormSprite.setStrokeStyle(3, 0x00aa00);
        this.wormSprite.setInteractive();
        this.wormSprite.setDepth(50);
        
        this.wormText = this.add.text(wormX, wormY, 'W', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(51);
    }
    
    createGoalSprite() {
        const { x: goalX, y: goalY } = this.entities.goal;
        
        this.goalSprite = this.add.star(goalX, goalY, 5, 15, 25, 0xffd700);
        this.goalSprite.setInteractive();
        this.goalSprite.setDepth(50);
    }
    
    setupEntityDragging() {
        this.input.setDraggable([this.wormSprite, this.goalSprite]);
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (!this.isTestMode) {
                const snappedPos = this.applyGridSnap(dragX, dragY);
                this.updateEntityPosition(gameObject, snappedPos.x, snappedPos.y);
            }
        });
        
        this.input.on('dragend', (pointer, gameObject) => {
            if (!this.isTestMode && this.isEntitySprite(gameObject)) {
                this.finalizeEntityPosition(gameObject);
            }
        });
    }
    
    applyGridSnap(x, y) {
        if (this.getGridSnapEnabled()) {
            return {
                x: Math.round(x / this.CONFIG.GRID.SNAP_SIZE) * this.CONFIG.GRID.SNAP_SIZE,
                y: Math.round(y / this.CONFIG.GRID.SNAP_SIZE) * this.CONFIG.GRID.SNAP_SIZE
            };
        }
        return { x, y };
    }
    
    updateEntityPosition(gameObject, x, y) {
        gameObject.x = x;
        gameObject.y = y;
        
        if (gameObject === this.wormSprite) {
            this.entities.wormStart = { x, y };
            if (this.wormText) {
                this.wormText.setPosition(x, y);
            }
            this.updateReferenceWormPosition();
        } else if (gameObject === this.goalSprite) {
            this.entities.goal = { x, y };
        }
        this.autoSave();
    }
    
    isEntitySprite(gameObject) {
        return gameObject === this.wormSprite || gameObject === this.goalSprite;
    }
    
    finalizeEntityPosition(gameObject) {
        const roundedX = Math.round(gameObject.x);
        const roundedY = Math.round(gameObject.y);
        
        gameObject.x = roundedX;
        gameObject.y = roundedY;
        
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
    
    createReferenceWorm() {
        const { x: wormX, y: wormY } = this.entities.wormStart;
        const { BASE_RADIUS, SEGMENT_SIZES, SEGMENT_SPACING, EYE_OFFSET_RATIO, EYE_SIZE } = this.CONFIG.WORM;
        
        this.referenceWormSegments = [];
        
        // Create worm segments
        SEGMENT_SIZES.forEach((sizeMultiplier, index) => {
            const segment = this.createWormSegment(wormX, wormY, index, sizeMultiplier, BASE_RADIUS, SEGMENT_SPACING);
            this.referenceWormSegments.push(segment);
        });
        
        // Add eyes to the head
        this.addWormEyes(wormX, wormY, BASE_RADIUS, EYE_OFFSET_RATIO, EYE_SIZE);
        
        console.log(`Created reference worm with ${SEGMENT_SIZES.length} segments at (${wormX}, ${wormY})`);
    }
    
    createWormSegment(wormX, wormY, index, sizeMultiplier, baseRadius, segmentSpacing) {
        const segmentRadius = baseRadius * sizeMultiplier;
        const segmentX = wormX;
        const segmentY = wormY + (index * segmentSpacing);
        
        const segment = this.add.circle(segmentX, segmentY, segmentRadius, 0x44aa44, 0.4);
        segment.setStrokeStyle(1, 0x228822, 0.6);
        segment.setDepth(5);
        
        return segment;
    }
    
    addWormEyes(wormX, wormY, baseRadius, eyeOffsetRatio, eyeSize) {
        const head = this.referenceWormSegments[0];
        if (!head) return;
        
        const eyeOffset = baseRadius * eyeOffsetRatio;
        const leftEye = this.add.circle(head.x - eyeOffset/2, head.y - eyeOffset/2, eyeSize, 0x000000);
        const rightEye = this.add.circle(head.x + eyeOffset/2, head.y - eyeOffset/2, eyeSize, 0x000000);
        
        [leftEye, rightEye].forEach(eye => {
            eye.setDepth(6);
            this.referenceWormSegments.push(eye);
        });
    }
    
    updateReferenceWormPosition() {
        if (!this.referenceWormSegments || this.referenceWormSegments.length === 0) return;
        
        const { x: wormX, y: wormY } = this.entities.wormStart;
        const { SEGMENT_SPACING, BASE_RADIUS, EYE_OFFSET_RATIO } = this.CONFIG.WORM;
        
        this.updateWormSegmentPositions(wormX, wormY, SEGMENT_SPACING);
        this.updateWormEyePositions(wormX, wormY, BASE_RADIUS, EYE_OFFSET_RATIO);
    }
    
    updateWormSegmentPositions(wormX, wormY, segmentSpacing) {
        const mainSegments = this.referenceWormSegments.slice(0, -2);
        mainSegments.forEach((segment, index) => {
            segment.setPosition(wormX, wormY + (index * segmentSpacing));
        });
    }
    
    updateWormEyePositions(wormX, wormY, baseRadius, eyeOffsetRatio) {
        if (this.referenceWormSegments.length >= 2) {
            const eyeOffset = baseRadius * eyeOffsetRatio;
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
            
            // For platforms, bring to front and disable browser drag ghost
            if (gameObject.platformData) {
                gameObject.setDepth(1000);
                this.children.bringToTop(gameObject);
                this.selectPlatform(this.platforms.find(p => p.graphics === gameObject));
                
                // Prevent browser drag ghost image
                if (pointer.event && pointer.event.preventDefault) {
                    pointer.event.preventDefault();
                }
            }
            
            // Handle sticker selection on drag start
            if (gameObject.stickerInstance) {
                this.selectSticker(gameObject.stickerInstance);
            }
        });
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.isTestMode) return;
            
            // Handle resize operations
            if (gameObject.handleType && this.isResizing) {
                if (gameObject.handleType === 'rotation') {
                    this.handleRotation(gameObject, dragX, dragY);
                } else {
                    this.handleResize(gameObject, dragX, dragY);
                }
                return;
            }
            
            // Handle platform movement - much simpler now!
            if (gameObject.platformData && !gameObject.handleType) {
                const snappedPos = this.applyGridSnap(dragX, dragY);
                
                // Direct manipulation - just set position
                gameObject.x = snappedPos.x;
                gameObject.y = snappedPos.y;
                
                // Bring to front while dragging to avoid render artifacts
                gameObject.setDepth(1000);
                
                // Update platform data
                const platform = this.platforms.find(p => p.graphics === gameObject);
                if (platform) {
                    platform.data.x = snappedPos.x;
                    platform.data.y = snappedPos.y;
                    gameObject.platformData.x = snappedPos.x;
                    gameObject.platformData.y = snappedPos.y;
                    
                    // Update handle positions during drag
                    this.updateHandlePositions(platform);
                    
                    this.autoSave();
                }
            }
            
            // Handle sticker movement
            if (gameObject.stickerInstance) {
                const snappedPos = this.applyGridSnap(dragX, dragY);
                // gameObject is the container, so just set its position
                gameObject.x = snappedPos.x;
                gameObject.y = snappedPos.y;
                // Update the sticker's internal position tracking
                const sticker = this.stickers.find(s => s.container === gameObject);
                if (sticker) {
                    sticker.x = snappedPos.x;
                    sticker.y = snappedPos.y;
                    sticker.data.x = snappedPos.x;
                    sticker.data.y = snappedPos.y;
                }
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
                    
                    // Update visual (which will recreate at proper size) and handle positions
                    this.updatePlatformVisual(platform);
                    this.updateHandlePositions(platform);
                    this.autoSave();
                }
            } else if (gameObject.platformData) {
                // Round platform position to pixels after drag
                const platform = this.platforms.find(p => p.graphics === gameObject);
                if (platform) {
                    platform.data.x = Math.round(platform.data.x);
                    platform.data.y = Math.round(platform.data.y);
                    
                    // Update graphics position to match rounded data
                    gameObject.x = platform.data.x;
                    gameObject.y = platform.data.y;
                    gameObject.platformData.x = platform.data.x;
                    gameObject.platformData.y = platform.data.y;
                    
                    // Reset depth after dragging
                    gameObject.setDepth(0);
                    
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
        
        // dragX, dragY are world coordinates where the handle is being dragged to
        // Convert drag position to relative coordinates from original platform center
        let relativeX = dragX - original.x;
        let relativeY = dragY - original.y;
        
        // Account for platform rotation by rotating the relative coordinates back
        if (original.angle) {
            const unrotated = this.rotatePoint(relativeX, relativeY, -original.angle);
            relativeX = unrotated.x;
            relativeY = unrotated.y;
        }
        
        // Apply grid snapping to the relative position
        if (this.getGridSnapEnabled()) {
            relativeX = Math.round(relativeX / this.CONFIG.GRID.SNAP_SIZE) * this.CONFIG.GRID.SNAP_SIZE;
            relativeY = Math.round(relativeY / this.CONFIG.GRID.SNAP_SIZE) * this.CONFIG.GRID.SNAP_SIZE;
        }
        
        if (data.type === 'rectangle' || data.type === 'trapezoid') {
            this.resizeRectangleFromHandle(data, original, handle.handleType, relativeX, relativeY);
        } else if (data.type === 'circle') {
            this.resizeCircleFromHandle(data, original, handle.handleType, relativeX, relativeY);
        }
        
        // During resize: Update position and scale for preview
        if (platform.graphics) {
            if (data.type === 'rectangle' || data.type === 'trapezoid') {
                // Calculate scale based on new size vs original size
                const scaleX = data.width / this.resizeStartData.width;
                const scaleY = data.height / this.resizeStartData.height;
                platform.graphics.setScale(scaleX, scaleY);
                
                // Update position - ensure integer values to avoid sub-pixel jitter
                platform.graphics.x = Math.round(data.x);
                platform.graphics.y = Math.round(data.y);
            } else if (data.type === 'circle') {
                // For circles, uniform scale based on radius
                const scale = data.radius / this.resizeStartData.radius;
                platform.graphics.setScale(scale, scale);
                
                // Ensure integer position
                platform.graphics.x = Math.round(data.x);
                platform.graphics.y = Math.round(data.y);
            }
            
            // Update handle positions to follow the resize
            this.updateHandlePositions(platform);
        }
        this.autoSave();
    }
    
    resizeRectangleFromHandle(data, original, handleType, relativeX, relativeY) {
        const minSize = 20;
        
        // Get the original bounds
        const originalLeft = original.x - original.width / 2;
        const originalRight = original.x + original.width / 2;
        const originalTop = original.y - original.height / 2;
        const originalBottom = original.y + original.height / 2;
        
        // Calculate new bounds based on which handle is being dragged
        let newLeft = originalLeft;
        let newRight = originalRight;
        let newTop = originalTop;
        let newBottom = originalBottom;
        
        switch (handleType) {
            case 'nw': // Northwest - move top-left corner
                newLeft = original.x + relativeX;
                newTop = original.y + relativeY;
                break;
            case 'ne': // Northeast - move top-right corner
                newRight = original.x + relativeX;
                newTop = original.y + relativeY;
                break;
            case 'sw': // Southwest - move bottom-left corner
                newLeft = original.x + relativeX;
                newBottom = original.y + relativeY;
                break;
            case 'se': // Southeast - move bottom-right corner
                newRight = original.x + relativeX;
                newBottom = original.y + relativeY;
                break;
        }
        
        // Calculate new dimensions and position
        let newWidth = Math.max(minSize, Math.abs(newRight - newLeft));
        let newHeight = Math.max(minSize, Math.abs(newBottom - newTop));
        let newCenterX = (newLeft + newRight) / 2;
        let newCenterY = (newTop + newBottom) / 2;
        
        // Apply grid snapping to dimensions and position if enabled
        const snapSize = this.CONFIG.GRID.SNAP_SIZE;
        if (this.getGridSnapEnabled()) {
            newWidth = Math.round(newWidth / snapSize) * snapSize;
            newHeight = Math.round(newHeight / snapSize) * snapSize;
            newCenterX = Math.round(newCenterX / snapSize) * snapSize;
            newCenterY = Math.round(newCenterY / snapSize) * snapSize;
        } else {
            // Round to integers to avoid sub-pixel values
            newWidth = Math.round(newWidth);
            newHeight = Math.round(newHeight);
            newCenterX = Math.round(newCenterX);
            newCenterY = Math.round(newCenterY);
        }
        
        // Update the platform data
        data.width = newWidth;
        data.height = newHeight;
        data.x = newCenterX;
        data.y = newCenterY;
        
        console.log(`New size: ${data.width}x${data.height} at (${data.x}, ${data.y})`);
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
        
        // dragX, dragY are world coordinates since handles are positioned in world space
        // Calculate angle from platform center to handle position
        const angle = Math.atan2(dragY - platform.data.y, dragX - platform.data.x);
        
        // Convert to rotation (add 90 degrees so "up" is 0 rotation)
        let rotation = angle + Math.PI / 2;
        
        // Snap to 5-degree increments
        const snapAngleDegrees = 5;
        const snapAngleRadians = snapAngleDegrees * Math.PI / 180;
        rotation = Math.round(rotation / snapAngleRadians) * snapAngleRadians;
        
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
        // For simple graphics, we don't need to recreate - just update properties
        if (!platform.graphics) return;
        
        const { type, width, height, radius, angle = 0 } = platform.data;
        
        // For size changes, we need to recreate the graphics
        // But for rotation, we can just update the angle
        if (type === 'rectangle' || type === 'trapezoid') {
            // Check if size changed
            // For Graphics objects (chamfered rectangles), we can't check width/height directly
            const isGraphics = platform.graphics.type === 'Graphics';
            const needsRecreate = isGraphics || 
                                  platform.graphics.width !== width || 
                                  platform.graphics.height !== height;
            
            if (needsRecreate) {
                // Size changed - need to recreate
                const oldGraphics = platform.graphics;
                platform.graphics = this.createSimplePlatformVisual(platform.data);
                
                // Make sure the new graphics is interactive and draggable
                if (platform.graphics) {
                    // For containers, we already set interactive in createSimplePlatformVisual
                    if (!platform.graphics.input) {
                        platform.graphics.setInteractive();
                    }
                    this.input.setDraggable(platform.graphics);
                    platform.graphics.platformData = { ...platform.data };
                }
                
                // Destroy old graphics
                oldGraphics.destroy();
            } else {
                // Just rotation changed - update directly
                platform.graphics.setAngle(angle * 180 / Math.PI);
            }
        } else if (type === 'circle') {
            // For circles, we can't easily check/update radius, so recreate if needed
            const oldGraphics = platform.graphics;
            platform.graphics = this.createSimplePlatformVisual(platform.data);
            
            // Make sure the new graphics is interactive and draggable
            if (platform.graphics) {
                platform.graphics.setInteractive();
                this.input.setDraggable(platform.graphics);
                platform.graphics.platformData = { ...platform.data };
            }
            
            // Destroy old graphics
            oldGraphics.destroy();
        }
        
        // Reapply selection highlighting if needed
        if (this.selectedPlatform === platform) {
            this.highlightSelectedPlatform(platform);
        }
    }
    
    highlightSelectedPlatform(platform) {
        // Add selection highlight to platform graphics
        if (platform.graphics) {
            // For Graphics objects (chamfered rectangles), we need to redraw
            if (platform.graphics.type === 'Graphics') {
                const g = platform.graphics;
                // Clear existing style and reapply with highlight
                g.clear();
                g.fillStyle(platform.data.color ? parseInt(platform.data.color.replace('#', '0x')) : 0x666666);
                g.lineStyle(4, 0x00ff00); // Green highlight
                
                // Redraw the rounded rectangle
                const { width, height, chamfer } = platform.data;
                let cornerRadius = 0;
                if (chamfer && chamfer.radius) {
                    cornerRadius = Array.isArray(chamfer.radius) ? 
                        Math.min(chamfer.radius[0], width / 2, height / 2) :
                        Math.min(chamfer.radius, width / 2, height / 2);
                }
                g.fillRoundedRect(-width/2, -height/2, width, height, cornerRadius);
                g.strokeRoundedRect(-width/2, -height/2, width, height, cornerRadius);
            } else {
                // Regular shapes (Rectangle, Circle, etc.)
                platform.graphics.setStrokeStyle(4, 0x00ff00, 1);
            }
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
        
        // Also update motion indicators if they exist
        if (platform.motionIndicators) {
            this.updateMotionIndicators(platform);
        }
        
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
                
                // Rotate the rotation handle position and add platform position
                const rotatedPos = rotatePoint(0, -rotationDistance, angle);
                handle.setPosition(platform.data.x + rotatedPos.x, platform.data.y + rotatedPos.y);
                
                // Also update the rotation icon position (next item in array)
                const iconIndex = index + 1;
                if (iconIndex < platform.handles.length && !platform.handles[iconIndex].handleType) {
                    platform.handles[iconIndex].setPosition(platform.data.x + rotatedPos.x, platform.data.y + rotatedPos.y);
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
                        handle.setPosition(platform.data.x + rotatedPos.x, platform.data.y + rotatedPos.y);
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
                        handle.setPosition(platform.data.x + rotatedPos.x, platform.data.y + rotatedPos.y);
                    }
                }
                resizeHandleCount++;
            }
        });
    }
    
    updateHandles(platform) {
        this.clearHandles(platform);
        this.addHandlesToPlatform(platform);
    }
    
    setupInput() {
        // Keyboard shortcuts
        this.input.keyboard.on('keydown-R', () => this.selectedTool = 'rectangle');
        this.input.keyboard.on('keydown-C', () => this.selectedTool = 'circle');
        this.input.keyboard.on('keydown-P', () => this.selectedTool = 'polygon');
        this.input.keyboard.on('keydown-T', () => this.selectedTool = 'trapezoid');
        this.input.keyboard.on('keydown-V', () => this.selectedTool = 'custom');
        this.input.keyboard.on('keydown-L', () => this.selectedTool = 'constraint');
        this.input.keyboard.on('keydown-TAB', async () => {
            // In server mode, TAB switches to play mode
            const { getCachedBuildMode } = await import('../utils/buildMode');
            const buildMode = await getCachedBuildMode();
            
            if (buildMode === 'server') {
                // Save current state and switch to play mode
                this.switchToPlayMode();
            } else {
                // In other modes, toggle test mode
                this.toggleTestMode();
            }
        });
        this.input.keyboard.on('keydown-DELETE', () => {
            if (this.selectedConstraint) {
                this.deleteSelectedConstraint();
            } else if (this.selectedPlatform) {
                this.deleteSelectedPlatform();
            } else if (this.selectedSticker) {
                this.deleteSelectedSticker();
            }
        });
        this.input.keyboard.on('keydown-BACKSPACE', () => this.deleteSelectedPlatform());
        
        // ESC key handling
        this.input.keyboard.on('keydown-ESC', () => {
            // Cancel constraint creation mode if active
            if (this.constraintCreationMode) {
                this.constraintCreationMode = false;
                this.constraintFirstBody = null;
                if (this.constraintPreviewLine) {
                    this.constraintPreviewLine.destroy();
                    this.constraintPreviewLine = null;
                }
                this.showConstraintFeedback('Constraint creation cancelled');
                return;
            }
            
            // In editor mode, ESC should undo last action if available
            // For now, just deselect
            this.selectPlatform(null);
            this.selectSticker(null);
            this.selectConstraint(null);
        });
        
        // Copy/paste support
        this.input.keyboard.on('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey)) {
                if (event.key === 'c' || event.key === 'C') {
                    this.copySelected();
                } else if (event.key === 'v' || event.key === 'V') {
                    this.paste();
                }
            }
        });
        
        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        // Don't capture WASD keys - let the worm use them in test mode
        
        // Use different keys for camera to avoid worm control conflicts
        this.cameraKeys = this.input.keyboard.addKeys('I,J,K,L'); // IJKL for camera
        
        // Camera controls - mouse wheel scroll (with Ctrl+wheel for zoom)
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.handleWheelInput(pointer, deltaX, deltaY);
        });
        
        // Pan with middle mouse
        this.input.on('pointermove', (pointer) => {
            if (pointer.middleButtonDown()) {
                this.handleMiddleMousePan(pointer);
            }
        });
        
        // Setup drag events for platforms
        this.setupPlatformDragging();
    }
    
    createItemAtPointer(pointer) {
        if (this.isTestMode) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        // Don't create on top of entities
        if (this.isClickOnEntity(worldX, worldY)) {
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
        const snappedPos = this.applyGridSnap(x, y);
        const toolSettings = this.getToolSettings();
        const selectedTool = this.getSelectedTool();
        
        const size = this.getPlatformSize(selectedTool, toolSettings);
        if (!size) return null;
        
        console.log(`Creating platform data: toolSettings.platformType=${toolSettings.platformType}, toolSettings.platformColor=${toolSettings.platformColor}`);
        
        const baseData = this.createBasePlatformData(selectedTool, snappedPos.x, snappedPos.y, toolSettings);
        return { ...baseData, ...size };
    }
    
    getPlatformSize(selectedTool, toolSettings) {
        const defaultSizes = {
            ...this.CONFIG.DEFAULTS.PLATFORM_SIZES,
            polygon: { 
                radius: this.CONFIG.DEFAULTS.PLATFORM_SIZES.polygon.radius, 
                sides: toolSettings.polygonSides 
            },
            trapezoid: { 
                ...this.CONFIG.DEFAULTS.PLATFORM_SIZES.trapezoid, 
                slope: toolSettings.trapezoidSlope 
            }
        };
        
        return defaultSizes[selectedTool];
    }
    
    createBasePlatformData(selectedTool, x, y, toolSettings) {
        const data = {
            id: `platform_${Date.now()}`,
            type: selectedTool,
            platformType: toolSettings.platformType,
            x,
            y,
            angle: 0,
            color: toolSettings.platformColor,
            physics: {
                friction: toolSettings.friction,
                frictionStatic: toolSettings.frictionStatic,
                restitution: toolSettings.restitution
            }
        };
        
        // Add motion if enabled
        if (toolSettings.motionEnabled) {
            data.motion = {
                type: toolSettings.motionType,
                distance: toolSettings.motionDistance,
                speed: toolSettings.motionSpeed
            };
        }
        
        return data;
    }
    
    createDefaultSticker(x, y) {
        const snappedPos = this.applyGridSnap(x, y);
        const toolSettings = this.getToolSettings();
        
        const presets = Sticker.getPresets();
        const presetConfig = presets[toolSettings.stickerPreset] || presets.tip;
        
        return {
            id: `sticker_${Date.now()}`,
            x: snappedPos.x,
            y: snappedPos.y,
            text: toolSettings.stickerText,
            config: {
                ...presetConfig,
                fontSize: toolSettings.stickerFontSize,
                color: toolSettings.stickerColor
            }
        };
    }
    
    addStickerToScene(stickerData) {
        // Create sticker instance
        const sticker = Sticker.fromJSON(this, stickerData);
        // The sticker already sets up interactivity in createContainer
        
        sticker.container.setInteractive();
        this.input.setDraggable(sticker.container);
        
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
        // In edit mode, just create simple graphics - no physics
        const graphics = this.createSimplePlatformVisual(platformData);
        
        if (!graphics) {
            console.error('Failed to create platform visual for:', platformData);
            return null;
        }
        
        // Make the graphics object interactive and draggable
        if (!graphics.input) {
            graphics.setInteractive();
        }
        this.input.setDraggable(graphics);
        
        // Store platform data on the graphics object
        graphics.platformData = { ...platformData };
        
        // Create platform object
        const platform = {
            data: platformData,
            graphics: graphics,
            id: platformData.id,
            handles: []
        };
        
        this.platforms.push(platform);
        this.mapData.platforms = this.platforms.map(p => p.data);
        
        return platform;
    }
    
    createPlatformInstance(platformData) {
        const { type, platformType = 'standard', x, y, width, height, radius, color = '#666666', angle = 0, motion } = platformData;
        
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
            strokeWidth: 2,
            motion: motion // Pass motion config through
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
            case 'blackhole':
                return new BlackholePlatform(this, x, y, platformWidth, platformHeight, config);
            case 'water':
                return new WaterPlatform(this, x, y, platformWidth, platformHeight, config);
            case 'waterfall':
                return new WaterfallPlatform(this, x, y, platformWidth, platformHeight, config);
            default:
                return new PlatformBase(this, x, y, platformWidth, platformHeight, config);
        }
    }
    
    createSimplePlatformVisual(platformData) {
        const { type, x, y, width, height, radius, color = '#666666', angle = 0, platformType = 'standard', chamfer } = platformData;
        
        console.log('createSimplePlatformVisual called with:', {
            type, x, y, width, height, radius, color, angle, platformType, chamfer
        });
        
        // Get appropriate color for platform type
        let fillColor;
        if (platformType === 'standard' || !platformType) {
            fillColor = parseInt(color.replace('#', '0x'));
        } else {
            // Use default colors for special platform types
            const specialColors = {
                ice: 0xb3e5fc,
                bouncy: 0xff69b4,
                electric: 0xffff00,
                fire: 0xf44336,
                blackhole: 0x1a1a1a,
                water: 0x2980b9,
                waterfall: 0x3498db
            };
            fillColor = specialColors[platformType] || parseInt(color.replace('#', '0x'));
        }
        
        let graphics;
        
        switch (type) {
            case 'rectangle':
                // Check if we need rounded corners
                if (chamfer && chamfer.radius) {
                    // Use a graphics object to draw rounded rectangle
                    const g = this.add.graphics();
                    g.fillStyle(fillColor);
                    g.lineStyle(2, 0x333333);
                    
                    // Determine corner radius
                    let cornerRadius;
                    if (Array.isArray(chamfer.radius)) {
                        // Use the first value as a uniform radius for visual
                        cornerRadius = Math.min(chamfer.radius[0], width / 2, height / 2);
                    } else {
                        cornerRadius = Math.min(chamfer.radius, width / 2, height / 2);
                    }
                    
                    g.fillRoundedRect(-width/2, -height/2, width, height, cornerRadius);
                    g.strokeRoundedRect(-width/2, -height/2, width, height, cornerRadius);
                    
                    // For now, just use the graphics object directly without a container
                    // This ensures drag and drop works properly
                    graphics = g;
                    graphics.x = x;
                    graphics.y = y;
                    graphics.setDepth(0);
                    // Graphics objects need a hit area to be interactive
                    graphics.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), Phaser.Geom.Rectangle.Contains);
                } else {
                    graphics = this.add.rectangle(x, y, width, height, fillColor);
                    graphics.setStrokeStyle(2, 0x333333);
                    graphics.setDepth(0);
                }
                break;
                
            case 'circle':
                graphics = this.add.circle(x, y, radius, fillColor);
                graphics.setStrokeStyle(2, 0x333333);
                graphics.setDepth(0);
                break;
                
            case 'polygon':
                const vertices = this.generatePolygonVertices(0, 0, radius, platformData.sides || 6);
                graphics = this.add.polygon(x, y, vertices, fillColor);
                graphics.setStrokeStyle(2, 0x333333);
                graphics.setDepth(0);
                break;
                
            case 'trapezoid':
                const trapVertices = this.generateTrapezoidVertices(0, 0, width, height, platformData.slope || 0.3);
                graphics = this.add.polygon(x, y, trapVertices, fillColor);
                graphics.setStrokeStyle(2, 0x333333);
                graphics.setDepth(0);
                break;
                
            default:
                console.warn(`Unknown platform type: ${type}`);
                return null;
        }
        
        // Apply rotation
        if (graphics && angle !== 0) {
            graphics.setAngle(angle * 180 / Math.PI); // Convert radians to degrees
        }
        
        // Set proper rendering properties to avoid artifacts
        if (graphics) {
            graphics.setDepth(0);
            // Ensure origin is centered for proper rotation (containers already have centered origin)
            if (type !== 'rectangle' || !chamfer) {
                graphics.setOrigin(0.5, 0.5);
            }
        }
        
        console.log('createSimplePlatformVisual returning:', graphics ? `${type} graphics object` : 'null');
        
        return graphics;
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
        if (this.selectedPlatform) {
            this.clearPlatformHighlight(this.selectedPlatform);
            this.clearHandles(this.selectedPlatform);
            // Clear motion indicators
            if (this.selectedPlatform.motionIndicators) {
                this.selectedPlatform.motionIndicators.forEach(indicator => indicator.destroy());
                this.selectedPlatform.motionIndicators = [];
            }
        }
        
        // Select new platform
        this.selectedPlatform = platform;
        if (platform) {
            this.highlightSelectedPlatform(platform);
            // Add resize handles
            this.addHandlesToPlatform(platform);
            // Add motion indicators if platform has motion
            this.updateMotionIndicators(platform);
        }
        
        // Notify React PropertyPanel of platform selection
        if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
            console.log('MapEditor: Calling onPlatformSelect with platform:', platform);
            console.log('MapEditor: Platform data being sent to React:', JSON.stringify(platform?.data, null, 2));
            window.editorCallbacks.onPlatformSelect(platform);
        } else {
            console.warn('MapEditor: editorCallbacks.onPlatformSelect not available');
        }
    }
    
    destroyPlatform(platform) {
        // Clear selection if this platform is selected
        if (this.selectedPlatform === platform) {
            this.selectedPlatform = null;
        }
        
        // Destroy graphics object
        if (platform.graphics) {
            platform.graphics.destroy();
        }
        
        // Destroy handles
        if (platform.handles) {
            platform.handles.forEach(handle => {
                if (handle && handle.destroy) {
                    handle.destroy();
                }
            });
            platform.handles = [];
        }
        
        // Remove from platforms array (will be re-added by caller)
        const index = this.platforms.indexOf(platform);
        if (index >= 0) {
            this.platforms.splice(index, 1);
        }
    }
    
    recreateEntirePlatform(platform) {
        // Store current state
        const wasSelected = this.selectedPlatform === platform;
        const platformIndex = this.platforms.indexOf(platform);
        
        // Remove old platform from array but don't destroy yet
        if (platformIndex >= 0) {
            this.platforms.splice(platformIndex, 1);
        }
        
        // Clear selection and handles first
        if (this.selectedPlatform === platform) {
            this.selectedPlatform = null;
        }
        
        // Destroy graphics and handles
        if (platform.graphics) {
            platform.graphics.destroy();
        }
        if (platform.handles) {
            platform.handles.forEach(handle => {
                if (handle && handle.destroy) {
                    handle.destroy();
                }
            });
            platform.handles = [];
        }
        
        // Create new platform with updated data (this will push to end of array)
        const newPlatform = this.addPlatformToScene(platform.data);
        
        // Move new platform to correct position in array
        if (platformIndex >= 0 && platformIndex < this.platforms.length - 1) {
            // Remove from end
            const movedPlatform = this.platforms.pop();
            // Insert at correct position
            this.platforms.splice(platformIndex, 0, movedPlatform);
        }
        
        // Update map data
        this.mapData.platforms = this.platforms.map(p => p.data);
        
        // Restore selection
        if (wasSelected) {
            this.selectPlatform(newPlatform);
        }
        
        return newPlatform;
    }
    
    setDefaultPropertiesForType(platformData, type) {
        // Set default properties based on the new type, preserving position and color
        const currentX = platformData.x;
        const currentY = platformData.y;
        const currentColor = platformData.color;
        const currentPhysics = platformData.physics || {};
        
        switch (type) {
            case 'rectangle':
                platformData.width = platformData.width || 100;
                platformData.height = platformData.height || 50;
                // Remove circle/polygon specific properties
                delete platformData.radius;
                delete platformData.sides;
                delete platformData.slope;
                break;
                
            case 'circle':
                platformData.radius = platformData.radius || 50;
                // Remove rectangle/polygon specific properties
                delete platformData.width;
                delete platformData.height;
                delete platformData.sides;
                delete platformData.slope;
                break;
                
            case 'polygon':
                platformData.radius = platformData.radius || 50;
                platformData.sides = platformData.sides || 6;
                // Remove rectangle/trapezoid specific properties
                delete platformData.width;
                delete platformData.height;
                delete platformData.slope;
                break;
                
            case 'trapezoid':
                platformData.width = platformData.width || 100;
                platformData.height = platformData.height || 50;
                platformData.slope = platformData.slope || 0.5;
                // Remove circle/polygon specific properties
                delete platformData.radius;
                delete platformData.sides;
                break;
        }
        
        // Preserve essential properties
        platformData.x = currentX;
        platformData.y = currentY;
        platformData.color = currentColor;
        platformData.physics = currentPhysics;
    }
    
    updatePlatformProperty(property, value) {
        if (!this.selectedPlatform) return;
        
        const platform = this.selectedPlatform;
        const oldValue = platform.data[property];
        
        console.log(`updatePlatformProperty called: ${property} = ${value} (was ${oldValue})`);
        console.log('Current platform data before update:', JSON.stringify(platform.data, null, 2));
        
        // Update the data
        platform.data[property] = value;
        
        // Handle different property changes
        if (property === 'x' || property === 'y') {
            // Update graphics position
            if (platform.graphics) {
                platform.graphics.x = platform.data.x;
                platform.graphics.y = platform.data.y;
            }
            this.updateHandlePositions(platform);
        }
        
        // Handle platform type change (normal, ice, bouncy, electric, fire)
        else if (property === 'platformType') {
            console.log('Handling platformType change from', platform.data.platformType, 'to', value);
            
            // Update the platform type (affects color and physics, not shape)
            platform.data.platformType = value;
            
            // Update color in data to match the platform type
            if (value !== 'standard') {
                const specialColors = {
                    ice: '#b3e5fc',
                    bouncy: '#ff69b4',
                    electric: '#ffff00',
                    fire: '#f44336'
                };
                if (specialColors[value]) {
                    platform.data.color = specialColors[value];
                }
            }
            
            console.log('Platform data after platformType change:', JSON.stringify(platform.data, null, 2));
            
            // Recreate visual to update color
            const newPlatform = this.recreateEntirePlatform(platform);
            
            console.log('New platform created with new type:', newPlatform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle shape change (rectangle, circle, polygon, trapezoid) - SAME as platformType for now
        else if (property === 'shape') {
            console.log('Handling shape change from', platform.data.type, 'to', value);
            
            // Update the actual type property
            platform.data.type = value;
            
            // Set default properties for the new shape
            this.setDefaultPropertiesForType(platform.data, value);
            
            console.log('Platform data after shape change:', JSON.stringify(platform.data, null, 2));
            
            // Completely recreate the platform
            const newPlatform = this.recreateEntirePlatform(platform);
            
            console.log('New platform created with new shape:', newPlatform);
            
            // Update the React property panel to show new shape's properties
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle color change
        else if (property === 'color') {
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle size changes for rectangles and trapezoids
        else if ((property === 'width' || property === 'height') && (platform.data.type === 'rectangle' || platform.data.type === 'trapezoid')) {
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle radius changes
        else if (property === 'radius' && (platform.data.type === 'circle' || platform.data.type === 'polygon')) {
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle polygon sides change
        else if (property === 'polygonSides' && platform.data.type === 'polygon') {
            platform.data.sides = value;
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle trapezoid slope change
        else if (property === 'trapezoidSlope' && platform.data.type === 'trapezoid') {
            platform.data.slope = value;
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        // Handle motion property
        else if (property === 'motion') {
            platform.data.motion = value;
            // Update or remove motion indicators
            this.updateMotionIndicators(platform);
        }
        
        // Handle physics properties (store for test mode)
        else if (property === 'friction' || property === 'frictionStatic' || property === 'restitution') {
            // Just update the data - physics will be applied in test mode
            platform.data.physics = platform.data.physics || {};
            platform.data.physics[property] = value;
        }
        
        // Handle chamfer property
        else if (property === 'chamfer') {
            platform.data.chamfer = value;
            // Recreate platform to apply chamfer visually
            const newPlatform = this.recreateEntirePlatform(platform);
            
            // Update the React property panel
            if (typeof window !== 'undefined' && window.editorCallbacks && window.editorCallbacks.onPlatformSelect) {
                window.editorCallbacks.onPlatformSelect(newPlatform);
            }
        }
        
        console.log(`Updated platform ${property}: ${oldValue} -> ${value}`);
    }
    
    // Test method to verify React-Phaser communication
    testPropertyUpdate() {
        console.log('testPropertyUpdate called - React-Phaser communication working!');
        console.log('Selected platform:', this.selectedPlatform);
        if (this.selectedPlatform) {
            console.log('Selected platform data:', JSON.stringify(this.selectedPlatform.data, null, 2));
        }
    }
    
    
    clearPlatformHighlight(platform) {
        // Reset platform graphics to default styling
        if (platform.graphics) {
            // For Graphics objects (chamfered rectangles), we need to redraw
            if (platform.graphics.type === 'Graphics') {
                const g = platform.graphics;
                // Clear existing style and reapply normal style
                g.clear();
                g.fillStyle(platform.data.color ? parseInt(platform.data.color.replace('#', '0x')) : 0x666666);
                g.lineStyle(2, 0x333333); // Normal stroke
                
                // Redraw the rounded rectangle
                const { width, height, chamfer } = platform.data;
                let cornerRadius = 0;
                if (chamfer && chamfer.radius) {
                    cornerRadius = Array.isArray(chamfer.radius) ? 
                        Math.min(chamfer.radius[0], width / 2, height / 2) :
                        Math.min(chamfer.radius, width / 2, height / 2);
                }
                g.fillRoundedRect(-width/2, -height/2, width, height, cornerRadius);
                g.strokeRoundedRect(-width/2, -height/2, width, height, cornerRadius);
            } else {
                // Regular shapes
                platform.graphics.setStrokeStyle(2, 0x333333, 1);
            }
        }
    }
    
    clearHandles(platform) {
        if (platform.handles) {
            platform.handles.forEach(handle => {
                // Handles are now standalone objects, not children of container
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
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        const basePositions = [
            { x: -halfWidth, y: -halfHeight, type: 'nw' },
            { x: halfWidth, y: -halfHeight, type: 'ne' },
            { x: -halfWidth, y: halfHeight, type: 'sw' },
            { x: halfWidth, y: halfHeight, type: 'se' }
        ];
        
        const handlePositions = basePositions.map(pos => ({
            x: this.rotatePoint(pos.x, pos.y, angle).x,
            y: this.rotatePoint(pos.x, pos.y, angle).y,
            type: pos.type
        }));
        
        handlePositions.forEach(pos => {
            const handle = this.createResizeHandle(pos, platform, 'rectangle');
            this.setupHandleInteraction(handle);
            // Position handle in world space relative to platform
            handle.x = platform.data.x + pos.x;
            handle.y = platform.data.y + pos.y;
            platform.handles.push(handle);
        });
    }
    
    rotatePoint(x, y, rotation) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    }
    
    createResizeHandle(pos, platform, shapeType) {
        const { SIZE, COLOR, STROKE_COLOR, DEPTH } = this.CONFIG.HANDLES;
        const handleSize = shapeType === 'rectangle' ? SIZE : this.CONFIG.HANDLES.CIRCLE_SIZE;
        
        const handle = shapeType === 'rectangle' 
            ? this.add.rectangle(pos.x, pos.y, handleSize, handleSize, COLOR)
            : this.add.circle(pos.x, pos.y, handleSize, COLOR);
            
        handle.setStrokeStyle(2, STROKE_COLOR);
        handle.setInteractive();
        handle.handleType = pos.type;
        handle.platformData = platform.data;
        handle.setDepth(DEPTH);
        
        this.input.setDraggable(handle);
        return handle;
    }
    
    setupHandleInteraction(handle) {
        const { HOVER_COLOR, COLOR } = this.CONFIG.HANDLES;
        handle.on('pointerover', () => handle.setFillStyle(HOVER_COLOR));
        handle.on('pointerout', () => handle.setFillStyle(COLOR));
    }
    
    createCircleHandles(platform) {
        const { radius, angle = 0 } = platform.data;
        
        const basePositions = [
            { x: 0, y: -radius, type: 'n' },
            { x: radius, y: 0, type: 'e' },
            { x: 0, y: radius, type: 's' },
            { x: -radius, y: 0, type: 'w' }
        ];
        
        const handlePositions = basePositions.map(pos => ({
            x: this.rotatePoint(pos.x, pos.y, angle).x,
            y: this.rotatePoint(pos.x, pos.y, angle).y,
            type: pos.type
        }));
        
        handlePositions.forEach(pos => {
            const handle = this.createResizeHandle(pos, platform, 'circle');
            this.setupHandleInteraction(handle);
            // Position handle in world space relative to platform
            handle.x = platform.data.x + pos.x;
            handle.y = platform.data.y + pos.y;
            platform.handles.push(handle);
            
            console.log('Created circle handle:', pos.type, 'interactive:', handle.input.enabled);
        });
    }
    
    createRotationHandle(platform) {
        const { type, radius, width, height, angle = 0 } = platform.data;
        const rotationDistance = this.getRotationHandleDistance(type, radius, height);
        const rotatedPos = this.rotatePoint(0, -rotationDistance, angle);
        
        const handle = this.createRotationHandleSprite(rotatedPos, platform);
        const rotationIcon = this.createRotationIcon(rotatedPos);
        
        this.setupRotationHandleInteraction(handle, rotationIcon);
        
        // Position handle and icon in world space
        handle.x = platform.data.x + rotatedPos.x;
        handle.y = platform.data.y + rotatedPos.y;
        rotationIcon.x = platform.data.x + rotatedPos.x;
        rotationIcon.y = platform.data.y + rotatedPos.y;
        
        platform.handles.push(handle, rotationIcon);
        
        console.log('Created rotation handle for platform type:', type);
    }
    
    getRotationHandleDistance(type, radius, height) {
        if (type === 'circle') {
            return radius;
        } else if (type === 'rectangle' || type === 'trapezoid') {
            return height / 2;
        }
        return 30; // Default distance
    }
    
    createRotationHandleSprite(position, platform) {
        const { ROTATION_SIZE, ROTATION_COLOR, ROTATION_STROKE_COLOR, DEPTH } = this.CONFIG.HANDLES;
        
        const handle = this.add.circle(position.x, position.y, ROTATION_SIZE, ROTATION_COLOR);
        handle.setStrokeStyle(2, ROTATION_STROKE_COLOR);
        handle.setInteractive();
        handle.handleType = 'rotation';
        handle.platformData = platform.data;
        handle.setDepth(DEPTH);
        
        this.input.setDraggable(handle);
        return handle;
    }
    
    createRotationIcon(position) {
        const rotationIcon = this.add.graphics();
        rotationIcon.lineStyle(2, 0xffffff);
        rotationIcon.strokeCircle(0, 0, 4);
        rotationIcon.moveTo(-2, -2);
        rotationIcon.lineTo(2, 2);
        rotationIcon.moveTo(2, -2);
        rotationIcon.lineTo(-2, 2);
        rotationIcon.strokePath();
        rotationIcon.setPosition(position.x, position.y);
        rotationIcon.setDepth(this.CONFIG.HANDLES.DEPTH + 1);
        
        return rotationIcon;
    }
    
    setupRotationHandleInteraction(handle, rotationIcon) {
        handle.on('pointerover', () => {
            handle.setFillStyle(0xff6666);
            rotationIcon.setAlpha(1.2);
        });
        handle.on('pointerout', () => {
            handle.setFillStyle(this.CONFIG.HANDLES.ROTATION_COLOR);
            rotationIcon.setAlpha(1.0);
        });
    }
    
    updateMotionIndicators(platform) {
        // Remove existing motion indicators
        if (platform.motionIndicators) {
            platform.motionIndicators.forEach(indicator => indicator.destroy());
            platform.motionIndicators = [];
        }
        
        // Only create indicators if motion is enabled
        if (!platform.data.motion) return;
        
        const { type, distance, speed } = platform.data.motion;
        const { x, y } = platform.data;
        
        platform.motionIndicators = [];
        
        // Create motion range indicators
        if (type === 'horizontal') {
            // Left and right endpoints
            const leftX = x - distance / 2;
            const rightX = x + distance / 2;
            
            // Motion path line
            const pathLine = this.add.graphics();
            pathLine.lineStyle(2, 0x4444ff, 0.5);
            pathLine.lineBetween(leftX, y, rightX, y);
            pathLine.setDepth(this.CONFIG.HANDLES.DEPTH - 1);
            platform.motionIndicators.push(pathLine);
            
            // Endpoint arrows
            const leftArrow = this.createMotionArrow(leftX, y, 'left');
            const rightArrow = this.createMotionArrow(rightX, y, 'right');
            platform.motionIndicators.push(leftArrow, rightArrow);
            
        } else if (type === 'vertical') {
            // Top and bottom endpoints
            const topY = y - distance / 2;
            const bottomY = y + distance / 2;
            
            // Motion path line
            const pathLine = this.add.graphics();
            pathLine.lineStyle(2, 0x44ff44, 0.5);
            pathLine.lineBetween(x, topY, x, bottomY);
            pathLine.setDepth(this.CONFIG.HANDLES.DEPTH - 1);
            platform.motionIndicators.push(pathLine);
            
            // Endpoint arrows
            const topArrow = this.createMotionArrow(x, topY, 'up');
            const bottomArrow = this.createMotionArrow(x, bottomY, 'down');
            platform.motionIndicators.push(topArrow, bottomArrow);
        }
        
        // Speed indicator (visual hint)
        if (platform.motionIndicators.length > 0) {
            const speedText = this.add.text(x, y - 30, `Speed: ${speed}`, {
                fontSize: '12px',
                fill: '#888888'
            });
            speedText.setOrigin(0.5);
            speedText.setDepth(this.CONFIG.HANDLES.DEPTH);
            platform.motionIndicators.push(speedText);
        }
    }
    
    createMotionArrow(x, y, direction) {
        const arrow = this.add.graphics();
        arrow.fillStyle(0x6666ff, 0.8);
        arrow.lineStyle(1, 0x4444ff);
        
        const arrowSize = 8;
        
        switch(direction) {
            case 'left':
                arrow.fillTriangle(
                    x - arrowSize, y,
                    x, y - arrowSize/2,
                    x, y + arrowSize/2
                );
                break;
            case 'right':
                arrow.fillTriangle(
                    x + arrowSize, y,
                    x, y - arrowSize/2,
                    x, y + arrowSize/2
                );
                break;
            case 'up':
                arrow.fillTriangle(
                    x, y - arrowSize,
                    x - arrowSize/2, y,
                    x + arrowSize/2, y
                );
                break;
            case 'down':
                arrow.fillTriangle(
                    x, y + arrowSize,
                    x - arrowSize/2, y,
                    x + arrowSize/2, y
                );
                break;
        }
        
        arrow.setDepth(this.CONFIG.HANDLES.DEPTH);
        return arrow;
    }
    
    deleteSelectedPlatform() {
        if (this.selectedPlatform) {
            // Clear resize handles first
            this.clearHandles(this.selectedPlatform);
            
            // Destroy the graphics
            if (this.selectedPlatform.graphics) {
                this.selectedPlatform.graphics.destroy();
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
    
    copySelectedPlatform() {
        if (this.selectedPlatform) {
            // Deep copy the platform data
            this.copiedPlatformData = JSON.parse(JSON.stringify(this.selectedPlatform.data));
            this.pasteOffsetCount = 0; // Reset paste offset counter
            console.log('Copied platform:', this.copiedPlatformData);
        }
    }
    
    pastePlatform() {
        if (!this.copiedPlatformData) {
            console.log('No platform data to paste');
            return;
        }
        
        // Create new platform data with offset position
        const newPlatformData = JSON.parse(JSON.stringify(this.copiedPlatformData));
        
        // Generate new ID
        newPlatformData.id = Date.now();
        
        // Increment paste offset for multiple pastes
        this.pasteOffsetCount = (this.pasteOffsetCount || 0) + 1;
        
        // Offset from the original copied position with increasing offset for each paste
        const offsetAmount = this.CONFIG.GRID.SNAP_SIZE * this.pasteOffsetCount;
        newPlatformData.x = this.copiedPlatformData.x + offsetAmount;
        newPlatformData.y = this.copiedPlatformData.y + offsetAmount;
        
        // Add the new platform
        const newPlatform = this.addPlatformToScene(newPlatformData);
        
        // Select the new platform
        this.selectPlatform(newPlatform);
        
        this.autoSave();
        console.log('Pasted platform at:', newPlatformData.x, newPlatformData.y);
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
    
    async switchToPlayMode() {
        // Update map data with current state
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        this.mapData.metadata.modified = new Date().toISOString();
        
        // Use MapLoader to start the game with current map data
        const { default: MapLoader } = await import('../services/MapLoader');
        
        // Create a temporary scene key for this play session
        const playKey = `play-${this.mapData.metadata?.name || 'test'}`;
        
        // Stop editor and start play mode
        this.scene.stop();
        
        // Create and start the play scene
        const SceneClass = MapLoader.createMapScene(playKey, this.mapData, {
            returnScene: 'MapEditor',
            editorMode: false // Regular play mode
        });
        
        // Add and start the scene
        this.scene.manager.add(playKey, SceneClass, true);
    }
    
    enterTestMode() {
        this.prepareMapDataForTesting();
        this.createTestWorm();
        this.initializeTestPlatforms();
        this.setupTestModePhysics();
        this.setupTestModeCamera();
        this.hideEditorVisuals();
        this.showTestModeIndicator();
    }
    
    prepareMapDataForTesting() {
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
    }
    
    createTestWorm() {
        const { x: wormX, y: wormY } = this.entities.wormStart;
        const { BASE_RADIUS, SEGMENT_SIZES } = this.CONFIG.WORM;
        
        this.testWorm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: BASE_RADIUS,
            segmentSizes: SEGMENT_SIZES,
            showDebug: true
        });
    }
    
    initializeTestPlatforms() {
        // Create platform instances with physics for test mode
        this.testPlatforms = [];
        
        this.platforms.forEach(platform => {
            const instance = this.createPlatformInstance(platform.data);
            if (instance) {
                this.testPlatforms.push({
                    data: platform.data,
                    instance: instance
                });
            }
        });
        
        console.log(`Test mode: Created ${this.testPlatforms.length} platform instances for testing`);
    }
    
    setupTestModePhysics() {
        this.setupSpecialPlatformCollisions();
        this.setupMouseConstraint();
    }
    
    hideEditorVisuals() {
        this.wormSprite.setVisible(false);
        this.goalSprite.setVisible(false);
        
        // Hide platform graphics
        this.platforms.forEach(platform => {
            if (platform.graphics) {
                platform.graphics.setVisible(false);
            }
            // Hide handles too
            if (platform.handles) {
                platform.handles.forEach(handle => handle.setVisible(false));
            }
        });
    }
    
    showTestModeIndicator() {
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
        
        // Remove test physics bodies
        if (this.testPlatforms) {
            this.testPlatforms.forEach(testPlatform => {
                if (testPlatform.instance && testPlatform.instance.destroy) {
                    testPlatform.instance.destroy();
                }
            });
            this.testPlatforms = [];
        }
        
        // Remove mouse constraint
        if (this.mouseConstraint) {
            this.matter.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
        
        // Reset camera
        this.resetEditorCamera();
        
        // Show entity sprites
        this.wormSprite.setVisible(true);
        this.goalSprite.setVisible(true);
        
        // Show all editor platform graphics when returning to editor mode
        this.platforms.forEach(platform => {
            if (platform.graphics) {
                platform.graphics.setVisible(true);
            }
            // Show handles for selected platform
            if (platform === this.selectedPlatform && platform.handles) {
                platform.handles.forEach(handle => handle.setVisible(true));
            }
        });
        
        // Remove test mode indicator
        if (this.testModeText) {
            this.testModeText.destroy();
            this.testModeText = null;
        }
    }
    
    createPhysicsBodyForPlatform(platformData) {
        const { type, physics = {}, angle = 0, chamfer } = platformData;
        const defaultPhysics = {
            isStatic: true,
            friction: 0.8,
            frictionStatic: 1.0,
            restitution: 0
        };
        const appliedPhysics = { ...defaultPhysics, ...physics };
        
        // Add chamfer if specified
        if (chamfer) {
            appliedPhysics.chamfer = chamfer;
        }
        
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
                    const angleRad = (2 * Math.PI * i / sides) + angle;
                    vertices.push({
                        x: polyX + polyRadius * Math.cos(angleRad),
                        y: polyY + polyRadius * Math.sin(angleRad)
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
        if (body && angle !== 0) {
            this.matter.body.setAngle(body, angle);
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
        const { type, color, angle = 0 } = platformData;
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
                    const angleRad = (2 * Math.PI * i / sides) + angle;
                    vertices.push({
                        x: polyX + polyRadius * Math.cos(angleRad),
                        y: polyY + polyRadius * Math.sin(angleRad)
                    });
                }
                visual = this.add.polygon(polyX, polyY, vertices, colorValue);
                visual.setStrokeStyle(2, 0x000000, 0.8);
                break;
                
            case 'trapezoid':
                const { x: trapX, y: trapY, width: trapWidth, height: trapHeight, slope = 0 } = platformData;
                // Match the physics body positioning (center of bounds)
                const trapCenterX = trapX + trapWidth / 2;
                const trapCenterY = trapY + trapHeight / 2;
                const halfWidth = trapWidth / 2;
                const halfHeight = trapHeight / 2;
                const slopeOffset = slope * halfHeight;
                // Create vertices relative to center
                const trapVertices = [
                    { x: -halfWidth + slopeOffset, y: -halfHeight },
                    { x: halfWidth - slopeOffset, y: -halfHeight },
                    { x: halfWidth, y: halfHeight },
                    { x: -halfWidth, y: halfHeight }
                ];
                visual = this.add.polygon(trapCenterX, trapCenterY, trapVertices, colorValue);
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
            visual.setRotation(angle);
        }
        
        return visual;
    }
    
    createSpecialPlatformForTest(platformData) {
        const { type, platformType, x, y, width, height, radius, physics = {}, color, angle = 0 } = platformData;
        
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
            angle: angle, // Pass angle to special platforms
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
                
            case 'blackhole':
                return new BlackholePlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'water':
                return new WaterPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
            case 'waterfall':
                return new WaterfallPlatform(this, centerX, centerY, platformWidth, platformHeight, config);
                
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
        this.createCameraTarget();
        this.configureCameraFollowing();
    }
    
    createCameraTarget() {
        if (!this.cameraTarget) {
            const { x: wormX, y: wormY } = this.entities.wormStart;
            this.cameraTarget = this.add.rectangle(wormX, wormY, 10, 10, 0xff0000, 0);
        }
    }
    
    configureCameraFollowing() {
        const camera = this.cameras.main;
        camera.startFollow(this.cameraTarget, true);
        
        if (camera.setLerpFactor) {
            camera.setLerpFactor(0.1, 0.1);
        }
        if (camera.setDeadzone) {
            camera.setDeadzone(100, 100);
        }
        camera.setZoom(this.CONFIG.CAMERA.TEST_ZOOM);
    }
    
    resetEditorCamera() {
        const camera = this.cameras.main;
        const { width, height } = this.mapData.dimensions;
        
        camera.stopFollow();
        camera.setZoom(this.CONFIG.CAMERA.EDITOR_ZOOM);
        camera.centerOn(width / 2, height / 2);
        
        if (camera.setLerpFactor) {
            camera.setLerpFactor(1, 1);
        }
        if (camera.setDeadzone) {
            camera.setDeadzone(0, 0);
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
        this.platforms.forEach(platform => this.destroyPlatform(platform));
        this.platforms = [];
        this.selectedPlatform = null;
        this.mapData.platforms = [];
    }
    
    destroyPlatform(platform) {
        if (platform.instance && platform.instance.destroy) {
            platform.instance.destroy();
        }
        if (platform.container) {
            platform.container.destroy();
        }
        if (platform.visual && platform.visual.destroy) {
            platform.visual.destroy();
        }
    }
    
    updateEntityPositions() {
        this.updateWormPosition();
        this.updateGoalPosition();
    }
    
    updateWormPosition() {
        const { x: wormX, y: wormY } = this.entities.wormStart;
        this.wormSprite.setPosition(wormX, wormY);
        if (this.wormText) {
            this.wormText.setPosition(wormX, wormY);
        }
    }
    
    updateGoalPosition() {
        const { x: goalX, y: goalY } = this.entities.goal;
        this.goalSprite.setPosition(goalX, goalY);
    }
    
    exportJSON() {
        this.mapData.entities = this.entities;
        this.mapData.platforms = this.platforms.map(p => p.data);
        this.mapData.stickers = this.stickers.map(s => s.toJSON());
        this.mapData.constraints = this.constraints.map(c => c.data);
        
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
        this.mapData.constraints = this.constraints.map(c => c.data);
        
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
        const moveDistance = this.calculateCameraMoveDistance(camera, delta);
        const moved = this.processCameraKeyInput(camera, moveDistance);
        
        if (moved) {
            this.constrainCameraToMapBounds(camera);
            this.updateCameraInfoDisplay();
        }
    }
    
    calculateCameraMoveDistance(camera, delta) {
        const cameraSpeed = 100 / camera.zoom; // Reduced from 200 to 100
        return (cameraSpeed * delta) / 1000;
    }
    
    processCameraKeyInput(camera, moveDistance) {
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
        
        return moved;
    }
    
    update(time, delta) {
        // Camera controls (only when not in test mode)
        if (!this.isTestMode) {
            this.updateCameraControls(delta);
            
            // Always apply camera constraints to ensure proper centering
            this.constrainCameraToMapBounds(this.cameras.main);
            
            // Update constraint preview line if in constraint creation mode
            if (this.constraintCreationMode && this.constraintPreviewLine && this.constraintFirstBody) {
                const pointer = this.input.activePointer;
                const worldX = pointer.worldX;
                const worldY = pointer.worldY;
                
                let startPos;
                if (this.constraintFirstBody.type === 'platform') {
                    startPos = { x: this.constraintFirstBody.platform.data.x, y: this.constraintFirstBody.platform.data.y };
                } else if (this.constraintFirstBody.type === 'worm') {
                    startPos = { ...this.entities.wormStart };
                } else if (this.constraintFirstBody.type === 'goal') {
                    startPos = { ...this.entities.goal };
                }
                
                if (startPos) {
                    this.constraintPreviewLine.setTo(startPos.x, startPos.y, worldX, worldY);
                }
            }
            
            // Update constraint graphics when platforms move
            if (this.selectedPlatform && this.isResizing) {
                this.updateConstraintGraphics();
            }
            
            // Update constraint handles positions if selected constraint
            if (this.selectedConstraint && this.selectedConstraint.handles) {
                const posA = this.getConstraintPointPosition(this.selectedConstraint, 'A');
                const posB = this.getConstraintPointPosition(this.selectedConstraint, 'B');
                
                this.selectedConstraint.handles.forEach(handle => {
                    if (handle.constraintPoint === 'A' && posA) {
                        handle.setPosition(posA.x, posA.y);
                    } else if (handle.constraintPoint === 'B' && posB) {
                        handle.setPosition(posB.x, posB.y);
                    }
                });
            }
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
        
        const { x: goalX, y: goalY } = this.entities.goal;
        const goalRadius = this.CONFIG.ENTITIES.GOAL_SPRITE_RADIUS;
        
        for (let i = 0; i < this.testWorm.segments.length; i++) {
            if (this.isWormSegmentTouchingGoal(this.testWorm.segments[i], i, goalX, goalY, goalRadius)) {
                this.showTestVictory();
                return;
            }
        }
    }
    
    isWormSegmentTouchingGoal(segment, segmentIndex, goalX, goalY, goalRadius) {
        const distance = Phaser.Math.Distance.Between(
            segment.position.x, segment.position.y,
            goalX, goalY
        );
        
        const segmentRadius = this.testWorm.segmentRadii[segmentIndex] || this.CONFIG.WORM.BASE_RADIUS;
        const collisionDistance = segmentRadius + goalRadius;
        
        return distance < collisionDistance;
    }
    
    showTestVictory() {
        const victoryText = this.createVictoryText();
        const instructionText = this.createVictoryInstructionText();
        this.scheduleVictoryTextRemoval(victoryText, instructionText);
    }
    
    createVictoryText() {
        return this.add.text(this.scale.width / 2, this.scale.height / 2, 'GOAL REACHED!', {
            fontSize: '48px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    }
    
    createVictoryInstructionText() {
        return this.add.text(this.scale.width / 2, this.scale.height / 2 + 60, 'Press SPACE to return to editing', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    }
    
    scheduleVictoryTextRemoval(victoryText, instructionText) {
        this.time.delayedCall(this.CONFIG.TIMING.VICTORY_DISPLAY_DURATION, () => {
            [victoryText, instructionText].forEach(text => {
                if (text && text.active) {
                    text.destroy();
                }
            });
        });
    }
    
    // Platform detection methods
    isPlatformAtPosition(platform, x, y) {
        if (!platform.graphics) return false;
        
        const { type } = platform.data;
        const { x: graphicsX, y: graphicsY } = platform.graphics;
        
        return this.checkCollisionByType(type, platform.data, graphicsX, graphicsY, x, y);
    }
    
    checkCollisionByType(type, data, platformX, platformY, x, y) {
        switch (type) {
            case 'rectangle':
            case 'trapezoid':
                return this.isPointInRectangle(x, y, platformX, platformY, data.width, data.height);
                
            case 'circle':
                return this.isPointInCircle(x, y, platformX, platformY, data.radius);
                
            case 'polygon':
            case 'custom':
                return this.isPointInCircle(x, y, platformX, platformY, data.radius || 50);
            
            default:
                return false;
        }
    }
    
    isPointInRectangle(x, y, centerX, centerY, width, height) {
        const halfW = width / 2;
        const halfH = height / 2;
        return (x >= centerX - halfW && x <= centerX + halfW &&
                y >= centerY - halfH && y <= centerY + halfH);
    }
    
    isPointInCircle(x, y, centerX, centerY, radius) {
        const distance = Phaser.Math.Distance.Between(centerX, centerY, x, y);
        return distance <= radius;
    }
    
    isClickOnEntity(x, y) {
        return this.isClickOnWorm(x, y) || this.isClickOnGoal(x, y);
    }
    
    isClickOnWorm(x, y) {
        if (!this.wormSprite || !this.wormSprite.visible) return false;
        
        const distance = Phaser.Math.Distance.Between(this.wormSprite.x, this.wormSprite.y, x, y);
        return distance <= this.CONFIG.ENTITIES.WORM_SPRITE_RADIUS;
    }
    
    isClickOnGoal(x, y) {
        if (!this.goalSprite || !this.goalSprite.visible) return false;
        
        const distance = Phaser.Math.Distance.Between(this.goalSprite.x, this.goalSprite.y, x, y);
        return distance <= this.CONFIG.ENTITIES.GOAL_SPRITE_RADIUS;
    }
    
    // Camera and input helper methods
    handleWheelInput(pointer, deltaX, deltaY) {
        const camera = this.cameras.main;
        
        if (pointer.event) {
            pointer.event.preventDefault();
        }
        
        if (pointer.event && pointer.event.ctrlKey) {
            this.handleCameraZoom(pointer, camera, deltaY);
        } else {
            this.handleCameraPan(pointer, camera, deltaX, deltaY);
        }
        
        this.constrainCameraToMapBounds(camera);
        this.updateCameraInfoDisplay();
    }
    
    handleCameraZoom(pointer, camera, deltaY) {
        const { ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM } = this.CONFIG.CAMERA;
        const oldZoom = camera.zoom;
        
        // Calculate new zoom level
        const newZoom = deltaY < 0 
            ? Phaser.Math.Clamp(camera.zoom + ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM)
            : Phaser.Math.Clamp(camera.zoom - ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM);
        
        if (newZoom !== oldZoom) {
            // Get the world position under the cursor before zoom
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            
            // Apply the new zoom
            camera.zoom = newZoom;
            
            // Calculate the new world position under the cursor after zoom
            // This would be different if we don't adjust the scroll
            const newWorldX = camera.scrollX + pointer.x / newZoom;
            const newWorldY = camera.scrollY + pointer.y / newZoom;
            
            // Adjust the camera scroll so the world position under the cursor remains the same
            camera.scrollX += worldX - newWorldX;
            camera.scrollY += worldY - newWorldY;
        }
    }
    
    handleCameraPan(pointer, camera, deltaX, deltaY) {
        const panSpeed = this.CONFIG.CAMERA.PAN_SPEED / camera.zoom;
        
        // Handle horizontal scrolling (e.g., trackpad horizontal swipe)
        if (deltaX !== 0) {
            camera.scrollX += deltaX > 0 ? panSpeed : -panSpeed;
        }
        
        // Handle vertical scrolling
        if (deltaY !== 0) {
            // Shift+scroll for horizontal pan (legacy support)
            if (pointer.event && pointer.event.shiftKey) {
                camera.scrollX += deltaY > 0 ? panSpeed : -panSpeed;
            } else {
                camera.scrollY += deltaY > 0 ? panSpeed : -panSpeed;
            }
        }
    }
    
    handleMiddleMousePan(pointer) {
        const camera = this.cameras.main;
        camera.scrollX -= pointer.velocity.x / camera.zoom;
        camera.scrollY -= pointer.velocity.y / camera.zoom;
        
        this.constrainCameraToMapBounds(camera);
        this.updateCameraInfoDisplay();
    }
    
    constrainCameraToMapBounds(camera) {
        const { width: mapWidth, height: mapHeight } = this.mapData.dimensions;
        
        // Always use fixed margin for consistent spacing
        const margin = this.CONFIG.CAMERA.MARGIN;
        
        // Calculate camera view dimensions
        const cameraViewWidth = camera.width / camera.zoom;
        const cameraViewHeight = camera.height / camera.zoom;
        
        // Allow panning with larger bounds when zoomed out
        // This ensures you can always see the margin area
        const allowedPanMargin = margin * 2; // Double margin for panning freedom
        
        // Horizontal constraints
        const minX = -allowedPanMargin;
        const maxX = mapWidth + allowedPanMargin - cameraViewWidth;
        
        // Only constrain if there's a valid range
        if (minX < maxX) {
            camera.scrollX = Phaser.Math.Clamp(camera.scrollX, minX, maxX);
        } else {
            // When map is smaller than viewport, allow limited panning
            const centerX = (mapWidth - cameraViewWidth) / 2;
            const panRange = margin; // Allow panning by margin amount
            camera.scrollX = Phaser.Math.Clamp(camera.scrollX, centerX - panRange, centerX + panRange);
        }
        
        // Vertical constraints
        const minY = -allowedPanMargin;
        const maxY = mapHeight + allowedPanMargin - cameraViewHeight;
        
        // Only constrain if there's a valid range
        if (minY < maxY) {
            camera.scrollY = Phaser.Math.Clamp(camera.scrollY, minY, maxY);
        } else {
            // When map is smaller than viewport, allow limited panning
            const centerY = (mapHeight - cameraViewHeight) / 2;
            const panRange = margin; // Allow panning by margin amount
            camera.scrollY = Phaser.Math.Clamp(camera.scrollY, centerY - panRange, centerY + panRange);
        }
    }
    
    
    // Constraint handling methods
    handleConstraintClick(pointer) {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
        // Handle paste mode for constraints
        if (this.pasteConstraintMode) {
            const body = this.findBodyAtPoint(worldX, worldY);
            if (body) {
                this.constraintFirstBody = body;
                this.constraintCreationMode = true;
                this.pasteConstraintMode = false;
                
                // Create preview line
                this.constraintPreviewLine = this.add.line(0, 0, 0, 0, 0, 0, 0x00ffff, 0.5);
                this.constraintPreviewLine.setDepth(100);
                
                // Show feedback
                this.showConstraintFeedback('Select second body for pasted constraint');
            }
            return;
        }
        
        if (!this.constraintCreationMode) {
            // First click - select first body
            const body = this.findBodyAtPoint(worldX, worldY);
            if (body) {
                this.constraintFirstBody = body;
                this.constraintCreationMode = true;
                
                // Create preview line
                this.constraintPreviewLine = this.add.line(0, 0, 0, 0, 0, 0, 0x00ffff, 0.5);
                this.constraintPreviewLine.setDepth(100);
                
                // Show feedback
                this.showConstraintFeedback('Select second body for constraint');
            }
        } else {
            // Second click - create constraint
            const body = this.findBodyAtPoint(worldX, worldY);
            if (body && body !== this.constraintFirstBody) {
                // Create constraint between the two bodies
                if (this.pasteConstraintData) {
                    // Use pasted constraint data
                    this.createConstraintFromData(this.constraintFirstBody, body, this.pasteConstraintData);
                    this.pasteConstraintData = null;
                } else {
                    // Create new constraint with default settings
                    this.createConstraint(this.constraintFirstBody, body);
                }
                
                // Reset state
                this.constraintCreationMode = false;
                this.constraintFirstBody = null;
                if (this.constraintPreviewLine) {
                    this.constraintPreviewLine.destroy();
                    this.constraintPreviewLine = null;
                }
            } else {
                // Cancel if clicking same body or empty space
                this.constraintCreationMode = false;
                this.constraintFirstBody = null;
                if (this.constraintPreviewLine) {
                    this.constraintPreviewLine.destroy();
                    this.constraintPreviewLine = null;
                }
                this.showConstraintFeedback('Constraint creation cancelled');
            }
        }
    }
    
    findBodyAtPoint(x, y) {
        // Check platforms
        const platform = this.platforms.find(p => {
            if (!p.graphics) return false;
            return p.graphics.getBounds().contains(x, y);
        });
        
        if (platform) {
            return { type: 'platform', id: platform.data.id, platform: platform };
        }
        
        // Check worm start
        const wormDist = Phaser.Math.Distance.Between(x, y, this.entities.wormStart.x, this.entities.wormStart.y);
        if (wormDist < 30) {
            return { type: 'worm', id: 'worm_start' };
        }
        
        // Check goal
        const goalDist = Phaser.Math.Distance.Between(x, y, this.entities.goal.x, this.entities.goal.y);
        if (goalDist < 30) {
            return { type: 'goal', id: 'goal' };
        }
        
        return null;
    }
    
    createConstraint(bodyA, bodyB) {
        const toolSettings = this.getToolSettings();
        
        // Calculate positions for constraint attachment
        let posA, posB;
        
        if (bodyA.type === 'platform') {
            const platformA = bodyA.platform;
            posA = { x: platformA.data.x, y: platformA.data.y };
        } else if (bodyA.type === 'worm') {
            posA = { ...this.entities.wormStart };
        } else if (bodyA.type === 'goal') {
            posA = { ...this.entities.goal };
        }
        
        if (bodyB.type === 'platform') {
            const platformB = bodyB.platform;
            posB = { x: platformB.data.x, y: platformB.data.y };
        } else if (bodyB.type === 'worm') {
            posB = { ...this.entities.wormStart };
        } else if (bodyB.type === 'goal') {
            posB = { ...this.entities.goal };
        }
        
        // Calculate default length if not specified
        const length = toolSettings.constraintLength || 
            Phaser.Math.Distance.Between(posA.x, posA.y, posB.x, posB.y);
        
        const constraintData = {
            id: `constraint_${Date.now()}`,
            bodyA: bodyA.id,
            bodyB: bodyB.id,
            pointA: { x: 0, y: 0 }, // Attachment point relative to body center
            pointB: { x: 0, y: 0 },
            stiffness: toolSettings.constraintStiffness,
            damping: toolSettings.constraintDamping,
            length: length,
            render: {
                visible: toolSettings.constraintRender,
                strokeStyle: '#90A4AE',
                lineWidth: 2
            }
        };
        
        this.addConstraintToScene(constraintData);
        this.autoSave();
        
        this.showConstraintFeedback(`Constraint created between ${bodyA.id} and ${bodyB.id}`);
    }
    
    createConstraintFromData(bodyA, bodyB, templateData) {
        // Calculate positions for constraint attachment  
        let posA, posB;
        
        if (bodyA.type === 'platform') {
            const platformA = bodyA.platform;
            posA = { x: platformA.data.x, y: platformA.data.y };
        } else if (bodyA.type === 'worm') {
            posA = { ...this.entities.wormStart };
        } else if (bodyA.type === 'goal') {
            posA = { ...this.entities.goal };
        }
        
        if (bodyB.type === 'platform') {
            const platformB = bodyB.platform;
            posB = { x: platformB.data.x, y: platformB.data.y };
        } else if (bodyB.type === 'worm') {
            posB = { ...this.entities.wormStart };
        } else if (bodyB.type === 'goal') {
            posB = { ...this.entities.goal };
        }
        
        // Calculate default length if not specified
        const length = templateData.length || 
            Phaser.Math.Distance.Between(posA.x, posA.y, posB.x, posB.y);
        
        const constraintData = {
            id: `constraint_${Date.now()}`,
            bodyA: bodyA.id,
            bodyB: bodyB.id,
            pointA: templateData.pointA || { x: 0, y: 0 },
            pointB: templateData.pointB || { x: 0, y: 0 },
            stiffness: templateData.stiffness || 0.8,
            damping: templateData.damping || 0.2,
            length: length,
            render: templateData.render || {
                visible: true,
                strokeStyle: '#90A4AE',
                lineWidth: 2
            }
        };
        
        this.addConstraintToScene(constraintData);
        this.autoSave();
        
        this.showConstraintFeedback(`Constraint pasted between ${bodyA.id} and ${bodyB.id}`);
    }
    
    addConstraintToScene(constraintData) {
        const bodyA = this.findBodyById(constraintData.bodyA);
        const bodyB = this.findBodyById(constraintData.bodyB);
        
        if (!bodyA) {
            console.warn(`Constraint bodyA not found: ${constraintData.bodyA}`);
            return;
        }
        if (!bodyB && constraintData.bodyB) { // bodyB can be null for world constraints
            console.warn(`Constraint bodyB not found: ${constraintData.bodyB}`);
            return;
        }
        
        const constraint = {
            data: constraintData,
            id: constraintData.id,
            bodyA: bodyA,
            bodyB: bodyB
        };
        
        this.constraints.push(constraint);
        console.log(`Added constraint ${constraintData.id} to scene`, constraint);
        this.updateConstraintGraphics();
    }
    
    findBodyById(id) {
        // Find platform by id
        const platform = this.platforms.find(p => p.data.id === id);
        if (platform) return platform;
        
        // Check if it's worm or goal
        if (id === 'worm_start') return { type: 'entity', id: 'worm_start', position: this.entities.wormStart };
        if (id === 'goal') return { type: 'entity', id: 'goal', position: this.entities.goal };
        
        return null;
    }
    
    updateConstraintGraphics() {
        if (!this.constraintGraphics) {
            console.warn('updateConstraintGraphics: constraintGraphics not initialized');
            return;
        }
        
        this.constraintGraphics.clear();
        
        console.log(`Updating constraint graphics for ${this.constraints.length} constraints`);
        
        this.constraints.forEach(constraint => {
            if (!constraint.data.render) {
                console.log(`Constraint ${constraint.id} has no render data, using defaults`);
                constraint.data.render = { visible: true, strokeStyle: '#90A4AE', lineWidth: 2 };
            }
            
            if (!constraint.data.render.visible) {
                console.log(`Constraint ${constraint.id} is not visible`);
                return;
            }
            
            let posA, posB;
            
            // Get position for bodyA
            if (constraint.bodyA) {
                if (constraint.bodyA.type === 'entity') {
                    posA = constraint.bodyA.position;
                } else if (constraint.bodyA.data) {
                    posA = { x: constraint.bodyA.data.x, y: constraint.bodyA.data.y };
                }
                
                // Add pointA offset if specified
                if (constraint.data.pointA) {
                    posA = {
                        x: posA.x + constraint.data.pointA.x,
                        y: posA.y + constraint.data.pointA.y
                    };
                }
            }
            
            // Get position for bodyB (can be null for world constraints)
            if (constraint.bodyB) {
                if (constraint.bodyB.type === 'entity') {
                    posB = constraint.bodyB.position;
                } else if (constraint.bodyB.data) {
                    posB = { x: constraint.bodyB.data.x, y: constraint.bodyB.data.y };
                }
                
                // Add pointB offset if specified
                if (constraint.data.pointB && posB) {
                    posB = {
                        x: posB.x + constraint.data.pointB.x,
                        y: posB.y + constraint.data.pointB.y
                    };
                }
            } else if (constraint.data.pointB) {
                // World constraint - pointB is absolute world position
                posB = constraint.data.pointB;
            }
            
            if (posA && posB) {
                const isSelected = constraint === this.selectedConstraint;
                const strokeColor = isSelected ? 0x00ffff : parseInt(constraint.data.render.strokeStyle.replace('#', '0x'));
                const lineWidth = isSelected ? (constraint.data.render.lineWidth || 2) + 2 : (constraint.data.render.lineWidth || 2);
                
                this.constraintGraphics.lineStyle(lineWidth, strokeColor);
                
                // Draw based on stiffness (high stiffness = line, low = spring)
                const stiffness = constraint.data.stiffness || 1;
                
                if (stiffness > 0.5) {
                    // Rigid constraint
                    this.constraintGraphics.moveTo(posA.x, posA.y);
                    this.constraintGraphics.lineTo(posB.x, posB.y);
                } else {
                    // Spring constraint
                    this.drawSpring(posA, posB);
                }
                
                // Draw anchor points if selected or specified in render
                if (isSelected || constraint.data.render.anchors) {
                    this.constraintGraphics.fillStyle(strokeColor);
                    this.constraintGraphics.fillCircle(posA.x, posA.y, 4);
                    this.constraintGraphics.fillCircle(posB.x, posB.y, 4);
                }
            }
        });
        
        this.constraintGraphics.strokePath();
    }
    
    drawSpring(posA, posB) {
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const segments = Math.max(8, Math.floor(distance / 20));
        const amplitude = 8;
        
        this.constraintGraphics.beginPath();
        this.constraintGraphics.moveTo(posA.x, posA.y);
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const x = posA.x + dx * t;
            const y = posA.y + dy * t;
            
            // Add perpendicular offset for zigzag
            const perpX = -dy / distance * amplitude * (i % 2 === 0 ? 1 : -1);
            const perpY = dx / distance * amplitude * (i % 2 === 0 ? 1 : -1);
            
            this.constraintGraphics.lineTo(x + perpX, y + perpY);
        }
        
        this.constraintGraphics.lineTo(posB.x, posB.y);
        this.constraintGraphics.strokePath();
    }
    
    findConstraintAtPoint(x, y) {
        // Simple line-point distance check for constraints
        for (const constraint of this.constraints) {
            let posA, posB;
            
            if (constraint.bodyA) {
                if (constraint.bodyA.type === 'entity') {
                    posA = constraint.bodyA.position;
                } else if (constraint.bodyA.data) {
                    posA = { x: constraint.bodyA.data.x, y: constraint.bodyA.data.y };
                }
                
                // Add pointA offset if specified
                if (constraint.data.pointA) {
                    posA = {
                        x: posA.x + constraint.data.pointA.x,
                        y: posA.y + constraint.data.pointA.y
                    };
                }
            }
            
            if (constraint.bodyB) {
                if (constraint.bodyB.type === 'entity') {
                    posB = constraint.bodyB.position;
                } else if (constraint.bodyB.data) {
                    posB = { x: constraint.bodyB.data.x, y: constraint.bodyB.data.y };
                }
                
                // Add pointB offset if specified
                if (constraint.data.pointB && posB) {
                    posB = {
                        x: posB.x + constraint.data.pointB.x,
                        y: posB.y + constraint.data.pointB.y
                    };
                }
            } else if (constraint.data.pointB) {
                // World constraint - pointB is absolute world position
                posB = constraint.data.pointB;
            }
            
            if (posA && posB) {
                const dist = this.distanceToLineSegment(x, y, posA.x, posA.y, posB.x, posB.y);
                if (dist < 10) { // 10 pixel threshold
                    return constraint;
                }
            }
        }
        
        return null;
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }
    
    selectConstraint(constraint) {
        // Clear previous constraint handles
        if (this.selectedConstraint && this.selectedConstraint !== constraint) {
            this.clearConstraintHandles(this.selectedConstraint);
        }
        
        this.selectedConstraint = constraint;
        this.selectedPlatform = null;
        this.selectedSticker = null;
        
        if (constraint) {
            // Add handles to the selected constraint
            this.addConstraintHandles(constraint);
            
            // Update property panel if available
            if (window.editorCallbacks && window.editorCallbacks.onConstraintSelected) {
                window.editorCallbacks.onConstraintSelected(constraint);
            }
        }
        
        this.updateConstraintGraphics();
    }
    
    addConstraintHandles(constraint) {
        if (!constraint.handles) {
            constraint.handles = [];
        }
        
        // Get current positions
        let posA, posB;
        
        if (constraint.bodyA) {
            if (constraint.bodyA.type === 'entity') {
                posA = { ...constraint.bodyA.position };
            } else if (constraint.bodyA.data) {
                posA = { x: constraint.bodyA.data.x, y: constraint.bodyA.data.y };
            }
            
            if (constraint.data.pointA) {
                posA.x += constraint.data.pointA.x;
                posA.y += constraint.data.pointA.y;
            }
        }
        
        if (constraint.bodyB) {
            if (constraint.bodyB.type === 'entity') {
                posB = { ...constraint.bodyB.position };
            } else if (constraint.bodyB.data) {
                posB = { x: constraint.bodyB.data.x, y: constraint.bodyB.data.y };
            }
            
            if (constraint.data.pointB && posB) {
                posB.x += constraint.data.pointB.x;
                posB.y += constraint.data.pointB.y;
            }
        } else if (constraint.data.pointB) {
            posB = { ...constraint.data.pointB };
        }
        
        // Create handle for point A
        if (posA) {
            const handleA = this.add.circle(
                posA.x, 
                posA.y, 
                this.CONFIG.HANDLES.SIZE, 
                this.CONFIG.HANDLES.COLOR
            );
            handleA.setStrokeStyle(2, this.CONFIG.HANDLES.STROKE_COLOR);
            handleA.setInteractive({ draggable: true });
            handleA.setDepth(this.CONFIG.HANDLES.DEPTH);
            handleA.constraintPoint = 'A';
            handleA.constraint = constraint;
            
            // Set up drag behavior
            this.setupConstraintHandleDrag(handleA);
            
            constraint.handles.push(handleA);
        }
        
        // Create handle for point B if not a world constraint or if it is a world constraint
        if (posB) {
            const handleB = this.add.circle(
                posB.x, 
                posB.y, 
                this.CONFIG.HANDLES.SIZE, 
                constraint.bodyB ? this.CONFIG.HANDLES.COLOR : this.CONFIG.HANDLES.ROTATION_COLOR
            );
            handleB.setStrokeStyle(2, constraint.bodyB ? this.CONFIG.HANDLES.STROKE_COLOR : this.CONFIG.HANDLES.ROTATION_STROKE_COLOR);
            handleB.setInteractive({ draggable: true });
            handleB.setDepth(this.CONFIG.HANDLES.DEPTH);
            handleB.constraintPoint = 'B';
            handleB.constraint = constraint;
            
            // Set up drag behavior
            this.setupConstraintHandleDrag(handleB);
            
            constraint.handles.push(handleB);
        }
    }
    
    clearConstraintHandles(constraint) {
        if (constraint && constraint.handles) {
            constraint.handles.forEach(handle => handle.destroy());
            constraint.handles = [];
        }
    }
    
    setupConstraintHandleDrag(handle) {
        handle.on('dragstart', () => {
            handle.setFillStyle(this.CONFIG.HANDLES.HOVER_COLOR);
        });
        
        handle.on('drag', (pointer, dragX, dragY) => {
            // Apply grid snap if enabled
            const snappedPos = this.applyGridSnap(dragX, dragY);
            handle.x = snappedPos.x;
            handle.y = snappedPos.y;
            
            // Update constraint data
            this.updateConstraintPoint(handle.constraint, handle.constraintPoint, snappedPos);
            
            // Update graphics in real-time
            this.updateConstraintGraphics();
        });
        
        handle.on('dragend', () => {
            handle.setFillStyle(
                handle.constraintPoint === 'B' && !handle.constraint.bodyB ? 
                this.CONFIG.HANDLES.ROTATION_COLOR : 
                this.CONFIG.HANDLES.COLOR
            );
            this.autoSave();
        });
    }
    
    updateConstraintPoint(constraint, point, newPos) {
        if (point === 'A' && constraint.bodyA) {
            // Calculate offset from body position
            let bodyPos;
            if (constraint.bodyA.type === 'entity') {
                bodyPos = constraint.bodyA.position;
            } else if (constraint.bodyA.data) {
                bodyPos = { x: constraint.bodyA.data.x, y: constraint.bodyA.data.y };
            }
            
            constraint.data.pointA = {
                x: newPos.x - bodyPos.x,
                y: newPos.y - bodyPos.y
            };
        } else if (point === 'B') {
            if (constraint.bodyB) {
                // Calculate offset from body position
                let bodyPos;
                if (constraint.bodyB.type === 'entity') {
                    bodyPos = constraint.bodyB.position;
                } else if (constraint.bodyB.data) {
                    bodyPos = { x: constraint.bodyB.data.x, y: constraint.bodyB.data.y };
                }
                
                constraint.data.pointB = {
                    x: newPos.x - bodyPos.x,
                    y: newPos.y - bodyPos.y
                };
            } else {
                // World constraint - absolute position
                constraint.data.pointB = { x: newPos.x, y: newPos.y };
            }
        }
        
        // Recalculate length if needed
        const posA = this.getConstraintPointPosition(constraint, 'A');
        const posB = this.getConstraintPointPosition(constraint, 'B');
        if (posA && posB) {
            constraint.data.length = Phaser.Math.Distance.Between(posA.x, posA.y, posB.x, posB.y);
        }
    }
    
    getConstraintPointPosition(constraint, point) {
        if (point === 'A' && constraint.bodyA) {
            let pos;
            if (constraint.bodyA.type === 'entity') {
                pos = { ...constraint.bodyA.position };
            } else if (constraint.bodyA.data) {
                pos = { x: constraint.bodyA.data.x, y: constraint.bodyA.data.y };
            }
            
            if (constraint.data.pointA) {
                pos.x += constraint.data.pointA.x;
                pos.y += constraint.data.pointA.y;
            }
            return pos;
        } else if (point === 'B') {
            if (constraint.bodyB) {
                let pos;
                if (constraint.bodyB.type === 'entity') {
                    pos = { ...constraint.bodyB.position };
                } else if (constraint.bodyB.data) {
                    pos = { x: constraint.bodyB.data.x, y: constraint.bodyB.data.y };
                }
                
                if (constraint.data.pointB) {
                    pos.x += constraint.data.pointB.x;
                    pos.y += constraint.data.pointB.y;
                }
                return pos;
            } else if (constraint.data.pointB) {
                return { ...constraint.data.pointB };
            }
        }
        return null;
    }
    
    deleteSelectedConstraint() {
        if (!this.selectedConstraint) return;
        
        const index = this.constraints.indexOf(this.selectedConstraint);
        if (index > -1) {
            this.constraints.splice(index, 1);
            this.selectedConstraint = null;
            this.updateConstraintGraphics();
            this.autoSave();
        }
    }
    
    showConstraintFeedback(message) {
        const text = this.add.text(this.cameras.main.centerX, 100, message, {
            fontSize: '20px',
            color: '#00ffff',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 2000,
            onComplete: () => text.destroy()
        });
    }
    
    updateConstraintProperty(constraint, property, value) {
        if (!constraint || !constraint.data) return;
        
        constraint.data[property] = value;
        
        // Special handling for render properties
        if (property === 'visible') {
            constraint.data.render = constraint.data.render || {};
            constraint.data.render.visible = value;
        }
        
        this.updateConstraintGraphics();
        this.autoSave();
    }
    
    // Copy/Paste functionality
    copySelected() {
        this.clipboard = null;
        
        if (this.selectedPlatform) {
            this.clipboard = {
                type: 'platform',
                data: JSON.parse(JSON.stringify(this.selectedPlatform.data))
            };
            this.showFeedback('Platform copied');
        } else if (this.selectedConstraint) {
            this.clipboard = {
                type: 'constraint',
                data: JSON.parse(JSON.stringify(this.selectedConstraint.data))
            };
            this.showFeedback('Constraint copied');
        } else if (this.selectedSticker) {
            this.clipboard = {
                type: 'sticker',
                data: this.selectedSticker.toJSON()
            };
            this.showFeedback('Sticker copied');
        }
    }
    
    paste() {
        if (!this.clipboard) {
            this.showFeedback('Nothing to paste');
            return;
        }
        
        const pointer = this.input.activePointer;
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const snappedPos = this.applyGridSnap(worldX, worldY);
        
        switch (this.clipboard.type) {
            case 'platform':
                const platformData = { ...this.clipboard.data };
                platformData.id = `platform_${Date.now()}`;
                platformData.x = snappedPos.x;
                platformData.y = snappedPos.y;
                this.addPlatformToScene(platformData);
                this.showFeedback('Platform pasted');
                break;
                
            case 'constraint':
                // For constraints, we need to select new bodies
                this.pasteConstraintMode = true;
                this.pasteConstraintData = { ...this.clipboard.data };
                this.selectedTool = 'constraint';
                this.showFeedback('Click first body for constraint');
                break;
                
            case 'sticker':
                const stickerData = { ...this.clipboard.data };
                stickerData.id = `sticker_${Date.now()}`;
                stickerData.x = snappedPos.x;
                stickerData.y = snappedPos.y;
                this.addStickerToScene(stickerData);
                this.showFeedback('Sticker pasted');
                break;
        }
        
        this.autoSave();
    }
    
    showFeedback(message) {
        const text = this.add.text(this.cameras.main.centerX, 50, message, {
            fontSize: '20px',
            color: '#4ecdc4',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });
    }

    destroy() {
        // Clean up event listeners
        this.cleanupEventListeners();
        
        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        // Clean up constraint handles
        if (this.selectedConstraint) {
            this.clearConstraintHandles(this.selectedConstraint);
        }
        
        // Clean up platforms
        this.platforms.forEach(platform => {
            if (platform.instance && platform.instance.destroy) {
                platform.instance.destroy();
            }
            if (platform.container) {
                platform.container.destroy();
            }
        });
        this.platforms = [];
        
        // Clean up stickers
        this.stickers.forEach(sticker => {
            if (sticker && sticker.destroy) {
                sticker.destroy();
            }
        });
        this.stickers = [];
        
        // Call parent destroy
        super.destroy();
    }
    
    cleanupEventListeners() {
        // Remove all tracked event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            if (target && target.off) {
                target.off(event, handler);
            }
        });
        this.eventListeners = [];
        
        // Remove collision event listeners
        if (this.matter && this.matter.world) {
            this.matter.world.off('collisionstart');
            this.matter.world.off('collisionend');
        }
    }
    
}
