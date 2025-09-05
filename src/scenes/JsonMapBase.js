import Phaser from 'phaser';
import DoubleWorm from '../entities/DoubleWorm';
import Stopwatch from '../components/Stopwatch';
import PlatformFactory from '../factories/PlatformFactory';
import Sticker from '../entities/Sticker';
import GhostSystemManager from '../systems/GhostSystemManager';
import RecordingDatabase from '../storage/RecordingDatabase';
import VictoryDialog from './VictoryDialog';
import PauseMenu from './PauseMenu';
import GameUIScene from './GameUIScene';
import { getCachedBuildMode } from '../utils/buildMode';
import GoalCollectionManager from '../utils/GoalCollectionManager';
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
        this.mapKey = config.mapKey || config.key || 'unknown';
        
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
        this.ghostSystem = null;
        
        // Platform factory
        this.platformFactory = null;
        
        // State manager - will be initialized in init()
        this.stateManager = null;
        
        // Track pause menu state
        this.isPaused = false;
        this.optionButtonWasPressed = false;
        
        // Predictive camera system using angular velocity
        this.predictiveCameraConfig = {
            enabled: false,          // Enable predictive camera
            showTarget: false,       // Show camera target for debugging
            // maxOffset: 10300,         // Maximum predictive offset in pixels
            smoothing: 0.1,         // Lerp factor for smooth transitions
            angularWeight: 0,     // Weight of angular velocity in prediction
            linearWeight: 13.0,      // Weight of linear velocity in prediction
            historySize: 60,         // Number of frames to average for smoothing
            history: []             // Store recent predictions
        };

        this.bgMusicConfig = {
            loop: true,
            volume: 0.5,
            seek: 48.5,  // Start at 49.55 seconds
            slowdownDuration: 1600,  // Duration of death slowdown effect in ms
            slowdownRate: 0.02,  // Final playback rate (0.2 = 20% speed)
            slowdownVolume: 0.01  // Final volume during slowdown
        }
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
        this.events.off('worm-death', this.handleWormDeath, this);
        
        // Stop and clean up background music
        if (this.backgroundMusic) {
            try {
                if (this.backgroundMusic.isPlaying) {
                    this.backgroundMusic.stop();
                }
                this.backgroundMusic.destroy();
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.backgroundMusic = null;
        }
        
        // Destroy existing worm if it exists (from BaseLevelScene)
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        // Clean up goal manager
        if (this.goalManager) {
            this.goalManager.destroy();
            this.goalManager = null;
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
        
        // Cleanup videos
        if (this.videos) {
            this.videos.forEach(video => {
                if (video && video.destroy) {
                    video.stop();
                    video.destroy();
                }
            });
            this.videos = [];
        }
        
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
            if (this.matter && this.matter.world) {
                this.matter.world.removeConstraint(this.mouseConstraint);
            }
            this.mouseConstraint = null;
        }
        
        // Cleanup stopwatch
        if (this.stopwatch) {
            // Stopwatch is now a logic-only component, no destroy needed
            this.stopwatch = null;
        }
        
        // Cleanup controls display
        if (this.controlsDisplay) {
            this.controlsDisplay.destroy();
            this.controlsDisplay = null;
        }
        
        // Stop the UI scene
        this.scene.stop('GameUIScene');
        
        // Cleanup ghost system
        if (this.ghostSystem) {
            this.ghostSystem.destroy();
            this.ghostSystem = null;
        }
        
        // Cleanup minimap
        if (this.minimap) {
            this.cameras.remove(this.minimap);
            this.minimap = null;
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
        this.videos = [];
        this.constraints = [];
        this.minimapIgnoreList = [];
        this.buttonMWasPressed = false;
        this.button0WasPressed = false;
        this.button1WasPressed = false;
        this.ghostSystem = null;
        this.isDying = false;
        
        // Reset camera references
        this.minimap = null;
        
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
        // Background music is now preloaded in MapSelectScene to prevent hitches
        
        // Preload videos from map data
        if (this.mapData && this.mapData.videos) {
            this.mapData.videos.forEach((videoData, index) => {
                const key = `video_${this.mapKey}_${index}`;
                const autoplay = videoData.autoplay !== undefined ? videoData.autoplay : true;
                const loop = videoData.loop !== undefined ? videoData.loop : true;
                console.log(`📹 Preloading video: ${key} from ${videoData.url}`);
                this.load.video(key, videoData.url, autoplay, loop);
            });
        }
    }
    
    async create() {
        // Clean up when scene shuts down (from BaseLevelScene)
        this.events.once('shutdown', () => {
            this.cleanup();
        });
        
        // Reset pause state when resuming from pause menu
        this.events.on('resume', () => {
            this.isPaused = false;
            
            // Resume the stopwatch
            if (this.stopwatch) {
                this.stopwatch.resume();
            }
        });
        
        // Load saved volume from localStorage and apply
        const savedVolume = localStorage.getItem('gameVolume');
        const globalVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;
        this.sound.volume = globalVolume;
        
        // Play background music with volume adjustment
        try {
            // Check if the audio is in the cache and loaded
            if (this.cache.audio.exists('backgroundMusic')) {
                // First, clean up any existing background music
                const existingMusic = this.sound.get('backgroundMusic');
                if (existingMusic) {
                    console.log('🎵 Found existing background music, removing it');
                    existingMusic.stop();
                    existingMusic.destroy();
                }
                
                // Always create fresh background music instance
                console.log('🎵 Creating new background music instance');
                // Apply global volume to the configured volume
                const adjustedConfig = {
                    ...this.bgMusicConfig,
                    volume: this.bgMusicConfig.volume * globalVolume
                };
                this.backgroundMusic = this.sound.add('backgroundMusic', adjustedConfig);
                
                // Store original volume for pause menu to use
                this.bgMusicOriginalVolume = this.bgMusicConfig.volume;
                
                // Only play if the sound was successfully created
                if (this.backgroundMusic) {
                    console.log('🎵 Playing background music at', Math.round(globalVolume * 100) + '% global volume');
                    this.backgroundMusic.play();
                } else {
                    console.warn('🎵 Background music object was not created');
                }
            } else {
                console.log('🎵 Background music not loaded yet, skipping playback');
            }
        } catch (error) {
            console.warn('🎵 Failed to play background music:', error);
        }
        
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
        
        // Initialize platform factory (needed for loadMapFromJSON)
        this.platformFactory = new PlatformFactory(this);
        
        // Create level elements
        this.createGrid(levelHeight);
        this.createBoundaryWalls(levelHeight);
        this.loadMapFromJSON();

        // Create mini-map camera (after level is parsed)
        this.createMiniMap(levelHeight);
        
        // Set up controls
        this.setupControls();
        
        // Initialize ghost system
        this.ghostSystem = new GhostSystemManager(this, this.mapKey, this.mapData);
        this.ghostSystem.initialize(this.worm).then(() => {
            // Start the timer and ghost
            if (this.stopwatch) {
                this.stopwatch.start();
                this.ghostSystem.startPlayback();
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
        const { platforms, entities, stickers = [], constraints = [], videos = [] } = this.mapData;
        
        // Create platforms
        platforms.forEach(platformData => {
            this.createPlatformFromJSON(platformData);
        });
        
        // Create stickers
        stickers.forEach(stickerData => {
            this.createStickerFromJSON(stickerData);
        });
        
        // Create videos
        videos.forEach((videoData, index) => {
            this.createVideoFromJSON(videoData, index);
        });
        
        // Create entities
        this.createEntitiesFromJSON(entities);
        
        // Create constraints (after platforms and entities are created)
        this.createConstraintsFromJSON(constraints);
    }
    
    createPlatformFromJSON(platformData) {
        const platform = this.platformFactory.createFromJSON(platformData);
        
        if (platform) {
            this.platforms.push(platform);
            
            // Additional debug for pendulum platform
            if (platform.id === 'pendulum_platform' && platform.body) {
                console.log('Pendulum platform created:', {
                    id: platform.id,
                    body: platform.body,
                    isStatic: platform.body.isStatic,
                    isSensor: platform.body.isSensor,
                    position: platform.body.position,
                    bounds: platform.body.bounds,
                    matter: platformData.matter
                });
            }
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
    
    createVideoFromJSON(videoData, index) {
        try {
            const key = `video_${this.mapKey}_${index}`;

            console.log(`Creating video element: ${key}`, videoData);
            
            // Create video object
            const video = this.add.video(videoData.x, videoData.y, key);
            
            if (videoData.depth !== undefined) {
                video.setDepth(videoData.depth);
            } else {
                video.setDepth(5); // Default depth above platforms but below UI
            }
            video.setAlpha(0.25, 0.25, 1, 1);
            
            // Configure video properties
            if (videoData.alpha !== undefined) {
                video.setAlpha(videoData.alpha);
            }
            
            // Handle video playback
            const autoplay = videoData.autoplay !== undefined ? videoData.autoplay : true;
            const loop = videoData.loop !== undefined ? videoData.loop : true;
            
            if (autoplay) {
                // Play the video
                video.play(loop);
            }
            
            // Make video interactive if specified
            if (videoData.interactive) {
                video.setInteractive();
                
                video.on('pointerdown', () => {
                    if (video.isPlaying()) {
                        video.pause();
                    } else {
                        video.play(loop);
                    }
                });
            }
            
            // Hide video from minimap
            if (this.minimap) {
                this.minimap.ignore(video);
            }
            
            // Store reference for cleanup if needed
            if (!this.videos) {
                this.videos = [];
            }
            this.videos.push(video);
            
        } catch (error) {
            console.warn('Failed to create video from JSON:', videoData, error);
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
        
        // Set up death event listener for special platforms
        this.events.on('worm-death', this.handleWormDeath, this);
        
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
    
    createEntitiesFromJSON(entitiesData) {
        console.log('createEntitiesFromJSON received:', entitiesData);
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
            showDebug: debugEnabled,
            // Trail configuration
            trailEnabled: true,
            trailMaxLength: 60,
            trailHeadColor: 0xff6b6b,
            trailTailColor: 0x74b9ff
        });

        // Set Matter.js debug rendering based on worm's showDebug config
        this.matter.world.drawDebug = this.worm.config.showDebug;
        
        // Add trail graphics to minimap ignore list if they exist
        if (this.worm.headTrailGraphics) {
            this.minimapIgnoreList.push(this.worm.headTrailGraphics);
        }
        if (this.worm.tailTrailGraphics) {
            this.minimapIgnoreList.push(this.worm.tailTrailGraphics);
        }

        // Initial impulse is now handled automatically in WormBase
        
        // Create camera target - make it visible for debugging if predictive camera is enabled
        this.cameraTarget = this.add.rectangle(wormX, wormY, 10, 10, 0xff0000, 
            this.predictiveCameraConfig?.showTarget ? 0.5 : 0);
        
        // Initialize goal manager and create goals
        this.goalManager = new GoalCollectionManager(this);
        this.goalManager.initializeGoals(entitiesData);
        
        // For backward compatibility, expose goals and goal properties
        this.goals = this.goalManager.goals;
        this.collectedGoals = this.goalManager.collectedGoals;
        this.goal = this.goals[0]; // For single goal backward compatibility
        
        // Set up camera
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        this.handleResize();
        this.scale.on('resize', this.handleResize, this);
        
        // Launch UI overlay scene (after goals are created)
        this.launchUIScene();
        
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
        
        // Camera leading toggle
        this.lKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
        
        // Predictive camera toggle
        this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        
        // Trail toggle
        this.tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        
        // Mouse constraint toggle (number 0 key)
        this.zeroKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
        
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
    
    launchUIScene() {
        // Add GameUIScene if not already added
        if (!this.scene.manager.getScene('GameUIScene')) {
            this.scene.manager.add('GameUIScene', GameUIScene, false);
        }
        
        // Create stopwatch logic component
        this.stopwatch = new Stopwatch(this, {
            onPause: () => this.showPauseMenu()
        });
        
        // Load best time from state manager
        const bestTime = this.stateManager.getBestTime(this.mapKey);
        if (bestTime !== null) {
            this.stopwatch.setBestTime(bestTime);
        }
        
        // Launch the UI scene with initial data
        this.scene.launch('GameUIScene', {
            gameScene: this,
            levelName: this.sceneTitle,
            bestTime: bestTime,
            totalGoals: this.goals ? this.goals.length : 0
        });
        
        // Get reference to UI scene for camera adjustments
        this.uiScene = this.scene.manager.getScene('GameUIScene');
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
        const zoom = Math.min(zoomX, zoomY);
        
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
        
        // Also ignore worm trails if they exist
        if (this.worm) {
            if (this.worm.headTrailGraphics) {
                this.minimap.ignore(this.worm.headTrailGraphics);
            }
            if (this.worm.tailTrailGraphics) {
                this.minimap.ignore(this.worm.tailTrailGraphics);
            }
        }
        
        // Touch controls are now handled by TouchControlsScene
        
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
        
        // Make main camera and minimap ignore these UI elements
        this.cameras.main.ignore(this.miniMapBorder);
        this.cameras.main.ignore(this.miniMapLabel);
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
        
        // UI overlay camera removed - viewport indicator only needs main camera to ignore it
    }
    
    handleResize() {
        const width = this.scale.width;
        const height = this.scale.height;
        const minWidth = 720;
        const minHeight = 720;
        
        // Safety check for camera existence
        if (this.cameras && this.cameras.main && this.cameraTarget) {
            this.cameras.main.startFollow(this.cameraTarget, true);
            if (this.scale.isPortrait && width < minWidth) {
                this.cameras.main.setZoom(width / minWidth);
            }
            if (this.scale.isLandscape && height < minHeight) {
                this.cameras.main.setZoom(height / minHeight);

            }
            this.cameras.main.setDeadzone(60, 60);
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
    
    
    calculateWormVelocityVector() {
        if (!this.worm || !this.worm.segments) return { x: 0, y: 0, magnitude: 0 };
        
        // Calculate average velocity vector of all segments
        let totalVelX = 0;
        let totalVelY = 0;
        let segmentCount = 0;
        
        for (let segment of this.worm.segments) {
            if (segment && segment.velocity) {
                totalVelX += segment.velocity.x;
                totalVelY += segment.velocity.y;
                segmentCount++;
            }
        }
        
        if (segmentCount === 0) return { x: 0, y: 0, magnitude: 0 };
        
        // Average velocity vector
        const avgVelX = totalVelX / segmentCount;
        const avgVelY = totalVelY / segmentCount;
        const magnitude = Math.sqrt(avgVelX * avgVelX + avgVelY * avgVelY);
        
        return { x: avgVelX, y: avgVelY, magnitude };
    }
    
    updatePredictiveCamera(delta) {
        if (!this.worm || !this.cameraTarget) return;
        
        const head = this.worm.getHead();
        const tail = this.worm.getTail();
        if (!head || !tail) return;
        
        // Calculate midpoint (base position)
        const midX = (head.position.x + tail.position.x) / 2;
        const midY = (head.position.y + tail.position.y) / 2;
        
        // Calculate angular velocities
        const headAngularVel = head.angularVelocity || 0;
        const tailAngularVel = tail.angularVelocity || 0;
        const avgAngularVel = (headAngularVel + tailAngularVel) / 2;
        
        // Calculate linear velocities
        const headVelX = head.velocity?.x || 0;
        const headVelY = head.velocity?.y || 0;
        const tailVelX = tail.velocity?.x || 0;
        const tailVelY = tail.velocity?.y || 0;
        
        // Average linear velocity
        const avgVelX = (headVelX + tailVelX) / 2;
        const avgVelY = (headVelY + tailVelY) / 2;
        const linearMagnitude = Math.sqrt(avgVelX * avgVelX + avgVelY * avgVelY);
        
        // Calculate predictive offset based on angular velocity
        // Angular velocity contributes to perpendicular movement prediction
        const wormAngle = Math.atan2(head.position.y - tail.position.y, head.position.x - tail.position.x);
        const perpAngle = wormAngle + Math.PI / 2; // Perpendicular to worm direction
        
        // Angular prediction: predict where the worm will rotate
        const angularOffsetX = Math.cos(perpAngle) * avgAngularVel * this.predictiveCameraConfig.angularWeight;
        const angularOffsetY = Math.sin(perpAngle) * avgAngularVel * this.predictiveCameraConfig.angularWeight;
        
        // Linear prediction: predict where the worm will move
        const linearOffsetX = avgVelX * this.predictiveCameraConfig.linearWeight;
        const linearOffsetY = avgVelY * this.predictiveCameraConfig.linearWeight;
        
        // Combine predictions
        let predictedOffsetX = angularOffsetX + linearOffsetX;
        let predictedOffsetY = angularOffsetY + linearOffsetY;
        
        // // Clamp to max offset
        // const offsetMagnitude = Math.sqrt(predictedOffsetX * predictedOffsetX + predictedOffsetY * predictedOffsetY);
        // if (offsetMagnitude > this.predictiveCameraConfig.maxOffset) {
        //     const scale = this.predictiveCameraConfig.maxOffset / offsetMagnitude;
        //     predictedOffsetX *= scale;
        //     predictedOffsetY *= scale;
        // }
        
        // Add to history for smoothing
        this.predictiveCameraConfig.history.push({ x: predictedOffsetX, y: predictedOffsetY });
        if (this.predictiveCameraConfig.history.length > this.predictiveCameraConfig.historySize) {
            this.predictiveCameraConfig.history.shift();
        }
        
        // Calculate smoothed prediction
        let smoothedX = 0, smoothedY = 0;
        for (let pred of this.predictiveCameraConfig.history) {
            smoothedX += pred.x;
            smoothedY += pred.y;
        }
        smoothedX /= this.predictiveCameraConfig.history.length;
        smoothedY /= this.predictiveCameraConfig.history.length;
        
        // Apply smoothed prediction to camera target
        const targetX = midX + smoothedX;
        const targetY = midY + smoothedY;
        
        // Lerp camera target to predicted position
        this.cameraTarget.x += (targetX - this.cameraTarget.x) * this.predictiveCameraConfig.smoothing;
        this.cameraTarget.y += (targetY - this.cameraTarget.y) * this.predictiveCameraConfig.smoothing;
        
        // Update visibility of camera target for debugging
        if (this.predictiveCameraConfig.showTarget) {
            this.cameraTarget.alpha = 0.5;
            // Make it bigger for better visibility
            this.cameraTarget.setSize(20, 20);
        } else {
            this.cameraTarget.alpha = 0;
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
        
        // Don't update during victory, death, or pause states
        if (this.victoryAchieved || this.isDying || this.isPaused) {
            // Victory dialog, death sequence, or pause menu handles all interactions
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
        
        // Update ghost system
        if (this.ghostSystem && this.stopwatch) {
            // Record frame
            if (this.worm && this.worm.segments) {
                let inputState = null;
                if (this.worm.inputManager && this.worm.inputManager.getInputState) {
                    inputState = this.worm.inputManager.getInputState(delta);
                }
                this.ghostSystem.recordFrame(this.worm.segments, this.stopwatch.elapsedTime, inputState);
            }
            
            // Update playback
            this.ghostSystem.updatePlayback(this.stopwatch.elapsedTime);
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
            if (this.ghostSystem) {
                this.ghostSystem.toggle();
            }
        }
        
        // Check for P key to toggle predictive camera
        if (Phaser.Input.Keyboard.JustDown(this.pKey)) {
            this.togglePredictiveCamera();
        }
        
        // Check for T key to toggle trails
        if (Phaser.Input.Keyboard.JustDown(this.tKey)) {
            this.toggleTrails();
        }
        
        // Check for 0 key to toggle mouse constraint (debug tool)
        if (Phaser.Input.Keyboard.JustDown(this.zeroKey)) {
            this.toggleMouseConstraint();
        }
        
        // Check for gamepad button M to toggle mini-map
        if (pad && pad.buttons[2] && pad.buttons[2].pressed && !this.buttonMWasPressed) {
            this.toggleMiniMap();
        }
        this.buttonMWasPressed = pad && pad.buttons[2] && pad.buttons[2].pressed;
        
        // Update camera target with predictive system
        if (this.cameraTarget && this.worm) {
            if (this.predictiveCameraConfig.enabled) {
                this.updatePredictiveCamera(delta);
            } else {
                // Simple midpoint following
                const head = this.worm.getHead();
                const tail = this.worm.getTail();
                if (head && tail) {
                    this.cameraTarget.x = (head.position.x + tail.position.x) / 2;
                    this.cameraTarget.y = (head.position.y + tail.position.y) / 2;
                }
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
        
        // Check goal collection using the shared manager
        if (this.goalManager && this.worm && this.worm.segments) {
            const allCollected = this.goalManager.checkGoalCollisions(
                this.worm.segments,
                this.worm.segmentRadii
            );
            
            if (allCollected) {
                // All goals collected - victory!
                this.victory();
                return;
            }
            
            // Update exposed properties for backward compatibility
            this.collectedGoals = this.goalManager.collectedGoals;
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
                // Ensure cameras still ignore it after visibility change
                if (this.miniMapConfig.visible) {
                    this.cameras.main.ignore(this.viewportIndicator);
                }
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
        
        // Stop background music on victory (normal stop, no slowdown)
        if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            console.log('🎵 Stopping background music on victory');
            this.backgroundMusic.stop();
        }
        
        // Stop the timer and save best time
        if (this.stopwatch) {
            const completionTime = this.stopwatch.stop();

            const elapsedTime = this.stopwatch.elapsedTime;
            
            // Get recording data from ghost system
            const recordingData = this.ghostSystem ? await this.ghostSystem.stopRecording() : null;
            
            // Save to IndexedDB (all recordings)
            if (recordingData) {
                await this.saveRecordingToIndexedDBWithData(true, elapsedTime, null, recordingData);
            }
        
            this.saveBestTime(completionTime);
            
            // Save ghost if best
            if (this.ghostSystem) {
                await this.ghostSystem.saveIfBest(completionTime, recordingData);
            }
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
            hasRecorder: !!this.ghostSystem,
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
        
        // Use provided recording data or get it from ghost system
        if (!recordingData && this.ghostSystem) {
            recordingData = await this.ghostSystem.stopRecording();
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
            hasRecorder: !!this.ghostSystem,
            hasDb: !!this.recordingDb
        });
        
        if (!this.ghostSystem || !this.recordingDb) {
            console.warn('Missing ghost system or database:', {
                ghostSystem: !!this.ghostSystem,
                db: !!this.recordingDb
            });
            return;
        }
        
        // Capture screenshot BEFORE stopping recording or getting data
        const screenshot = this.captureScreenshot();
        console.log('📸 Screenshot captured:', screenshot ? `success (${screenshot.length} bytes)` : 'failed');
        
        // Get recording data from ghost system
        const recordingData = await this.ghostSystem.stopRecording();
        
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
    
    async handleWormDeath(deathData) {
        // Prevent multiple death events
        if (this.isDying || this.victoryAchieved) {
            return;
        }
        this.isDying = true;
        
        const { reason, platform, animationDuration = 0 } = deathData;
        
        console.log(`💀 Worm death event received: ${reason}`, deathData);
        
        // Suspend physics to freeze everything in place
        if (this.matter && this.matter.world) {
            this.matter.world.pause();
            console.log('⏸️ Physics paused - death freeze');
        }
        
        // Disable all input during death sequence
        this.input.enabled = false;
        if (this.worm && this.worm.inputManager) {
            this.worm.inputManager.enabled = false;
        }
        console.log('🎮 Input disabled during death sequence');
        
        // Fade out whoosh synth and slow down background music in parallel
        const audioPromises = [];
        
        // Fade out the whoosh synthesizer
        if (this.worm && this.worm.whooshSynthesizer) {
            console.log('🎵 Fading out whoosh synthesizer');
            audioPromises.push(this.fadeOutWhoosh());
        }
        
        // Slow down and stop background music like a record player stopping
        audioPromises.push(this.slowDownMusic());
        
        // Wait for all audio effects to complete
        await Promise.all(audioPromises);
        
        // If there's an animation duration, wait for it to complete
        if (animationDuration > 0) {
            await new Promise(resolve => {
                this.time.delayedCall(animationDuration, resolve);
            });
        }
        
        // Re-enable input just before restart (will be reset on scene restart anyway)
        this.input.enabled = true;
        console.log('🎮 Input re-enabled');
        
        // Now handle the restart
        await this.handleRestart(reason);
    }
    
    async handleRestart(reason = 'unknown') {
        console.log('🔄 handleRestart called with reason:', reason);
        
        // Save the recording as a failure before restarting
        const elapsedTime = this.stopwatch ? this.stopwatch.elapsedTime : 0;
        console.log('⏱️ Elapsed time before restart:', elapsedTime);
        
        await this.saveRecordingToIndexedDB(false, elapsedTime, reason);
        
        // Resume physics before restarting (in case it was paused)
        if (this.matter && this.matter.world) {
            this.matter.world.resume();
            console.log('▶️ Physics resumed before restart');
        }
        
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
    
    async fadeOutWhoosh() {
        if (!this.worm || !this.worm.whooshSynthesizer) {
            return;
        }
        
        console.log('🎵 Fading out whoosh synthesizer quickly');
        
        // Whoosh should fade out very quickly since movement has stopped
        const fadeDuration = 100; // 100ms - almost immediate
        
        return new Promise(resolve => {
            // Create a tween to fade the whoosh volume to 0
            const initialVolume = this.worm.whooshSynthesizer.volume || 1.0;
            const fadeTarget = { volume: initialVolume };
            
            this.tweens.add({
                targets: fadeTarget,
                volume: 0,
                duration: fadeDuration,
                ease: 'Power3.easeOut', // Quick ease out
                onUpdate: () => {
                    // Update the whoosh synthesizer volume
                    if (this.worm && this.worm.whooshSynthesizer) {
                        this.worm.whooshSynthesizer.update(fadeTarget.volume, this.worm.whooshSynthesizer.frequency || 0);
                    }
                },
                onComplete: () => {
                    console.log('🎵 Whoosh fade complete, stopping synthesizer');
                    // Stop the whoosh synthesizer
                    if (this.worm && this.worm.whooshSynthesizer) {
                        this.worm.stopAudio();
                    }
                    resolve();
                }
            });
        });
    }
    
    async slowDownMusic() {
        if (!this.backgroundMusic || !this.backgroundMusic.isPlaying) {
            return;
        }
        
        console.log(`🎵 Slowing down music like a record stopping (${this.bgMusicConfig.slowdownDuration}ms)...`);
        
        // Use configurable values for the slowdown effect
        return new Promise(resolve => {
            this.tweens.add({
                targets: this.backgroundMusic,
                rate: this.bgMusicConfig.slowdownRate,  // Configurable final speed
                volume: this.bgMusicConfig.slowdownVolume, // Configurable final volume
                duration: this.bgMusicConfig.slowdownDuration, // Configurable duration
                ease: 'Power2.easeIn',
                onComplete: () => {
                    console.log('🎵 Music slowdown complete, stopping playback');
                    if (this.backgroundMusic) {
                        this.backgroundMusic.stop();
                        // Reset rate and volume for next play
                        this.backgroundMusic.rate = 1.0;
                        this.backgroundMusic.volume = this.bgMusicConfig.volume;
                    }
                    resolve();
                }
            });
        });
    }
    
    togglePredictiveCamera() {
        this.predictiveCameraConfig.enabled = !this.predictiveCameraConfig.enabled;
        
        // If disabling, clear history
        if (!this.predictiveCameraConfig.enabled) {
            this.predictiveCameraConfig.history = [];
            // Hide the camera target
            if (this.cameraTarget) {
                this.cameraTarget.alpha = 0;
            }
        } else if (this.predictiveCameraConfig.showTarget && this.cameraTarget) {
            // Show the camera target if debugging is on
            this.cameraTarget.alpha = 0.5;
            this.cameraTarget.setSize(20, 20);
        }
        
        // Show feedback
        const text = this.add.text(this.scale.width / 2, 140, 
            this.predictiveCameraConfig.enabled ? 'Predictive Camera ON' : 'Predictive Camera OFF', {
            fontSize: '20px',
            color: this.predictiveCameraConfig.enabled ? '#3498db' : '#e74c3c',
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
    
    toggleTrails() {
        if (!this.worm) return;
        
        // Toggle trail state
        const currentEnabled = this.worm.trailConfig ? this.worm.trailConfig.enabled : false;
        const newEnabled = !currentEnabled;
        
        // Update worm trail state
        this.worm.setTrailsEnabled(newEnabled);
        
        // Update minimap to ignore/unignore trails
        if (this.minimap && this.worm) {
            if (newEnabled) {
                // If enabling trails, make sure minimap ignores them
                if (this.worm.headTrailGraphics) {
                    this.minimap.ignore(this.worm.headTrailGraphics);
                }
                if (this.worm.tailTrailGraphics) {
                    this.minimap.ignore(this.worm.tailTrailGraphics);
                }
            }
        }
        
        // Show feedback
        const text = this.add.text(this.scale.width / 2, 110, 
            newEnabled ? 'Trails ON' : 'Trails OFF', {
            fontSize: '20px',
            color: newEnabled ? '#9b59b6' : '#e74c3c',
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
    
    toggleMouseConstraint() {
        if (this.mouseConstraint) {
            // Remove existing mouse constraint
            if (this.matter && this.matter.world) {
                this.matter.world.removeConstraint(this.mouseConstraint);
            }
            this.mouseConstraint = null;
            
            // Show feedback
            const text = this.add.text(this.scale.width / 2, 170, 
                'Mouse Constraint OFF', {
                fontSize: '20px',
                color: '#e74c3c',
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
        } else {
            // Create mouse constraint
            this.mouseConstraint = this.matter.add.mouseSpring({
                length: 0.01,
                stiffness: 0.8,
                damping: 0
            });
            
            // Show feedback
            const text = this.add.text(this.scale.width / 2, 170, 
                'Mouse Constraint ON - Drag physics bodies!', {
                fontSize: '20px',
                color: '#2ecc71',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            
            if (this.minimap) {
                this.minimap.ignore(text);
            }
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 2000,
                onComplete: () => text.destroy()
            });
        }
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
        
        // Pause the stopwatch
        if (this.stopwatch) {
            this.stopwatch.pause();
        }
        
        // Pause this scene (it will still render but not update) and launch pause menu
        this.scene.pause();
        this.scene.launch('PauseMenu', {
            gameScene: this,
            mapKey: this.mapKey || this.scene.key
        });
    }
    
    // Goal collection effect - visual feedback when a goal is collected
    collectGoalEffect(goal) {
        // Stop rotation
        this.tweens.killTweensOf([goal, goal.innerStar]);
        
        // Hide from minimap immediately when collected
        if (this.minimap) {
            this.minimap.ignore(goal);
            this.minimap.ignore(goal.innerStar);
        }
        
        // Scale and fade out effect
        this.tweens.add({
            targets: [goal, goal.innerStar],
            scale: 2,
            alpha: 0.3,
            duration: 500,
            ease: 'Power2'
        });
        
        // Create sparkle effect with simple circles
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 150 + Math.random() * 100;
            const sparkle = this.add.circle(goal.x, goal.y, 4, 0xffd700);
            sparkle.setDepth(100);
            
            // Animate sparkles outward
            this.tweens.add({
                targets: sparkle,
                x: goal.x + Math.cos(angle) * speed,
                y: goal.y + Math.sin(angle) * speed,
                scale: 0,
                alpha: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => sparkle.destroy()
            });
        }
        
        // Play a collection sound if available
        if (this.sound && this.sound.get('goalCollect')) {
            this.sound.play('goalCollect');
        }
    }
    
    // Show progress when collecting multiple goals
    showGoalProgress() {
        // Don't show if we're already showing progress text
        if (this.activeProgressText) {
            return;
        }
        
        const remaining = this.goals.length - this.collectedGoals.size;
        const message = remaining === 1 
            ? '1 goal remaining!' 
            : `${remaining} goals remaining!`;
        
        // Create progress text
        const progressText = this.add.text(
            this.scale.width / 2, 
            100,
            message,
            {
                fontSize: '32px',
                color: '#ffd700',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        // Track the active progress text
        this.activeProgressText = progressText;
        
        // Ensure cameras ignore it for minimap
        if (this.minimap) {
            this.minimap.ignore(progressText);
        }
        
        // Animate the text
        this.tweens.add({
            targets: progressText,
            scale: 1.2,
            duration: 300,
            yoyo: true,
            ease: 'Power2'
        });
        
        // Fade out and destroy
        this.tweens.add({
            targets: progressText,
            alpha: 0,
            duration: 1500,
            delay: 500,
            onComplete: () => {
                progressText.destroy();
                // Clear the reference when destroyed
                if (this.activeProgressText === progressText) {
                    this.activeProgressText = null;
                }
            }
        });
    }
    
}
