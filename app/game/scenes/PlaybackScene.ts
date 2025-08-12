import JsonMapBase from '/src/scenes/JsonMapBase';
import DoubleWorm from '/src/entities/DoubleWorm';
import { loadMapDataSync } from '/src/scenes/maps/MapDataRegistry';
import Random from '/src/utils/Random';

/**
 * PlaybackScene extends JsonMapBase to provide recording playback functionality
 * This renders the map identically but controls the worm from recorded data
 */
export default class PlaybackScene extends JsonMapBase {
    // Playback-specific properties
    private recording: any;
    private frames: any[] = [];
    private currentFrameIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private elapsedTime: number = 0;
    
    // Use actual DoubleWorm component (physics disabled)
    private worm: any;
    private wormVisuals: Phaser.GameObjects.Arc[] = [];
    private headTrailGraphics: Phaser.GameObjects.Graphics;
    private tailTrailGraphics: Phaser.GameObjects.Graphics;
    private headTrailPoints: { x: number, y: number }[] = [];
    private tailTrailPoints: { x: number, y: number }[] = [];
    private maxTrailLength: number = 60; // Shorter trail for better fade visibility
    
    // Callbacks for UI integration
    private onFrameUpdate?: (frame: number) => void;
    private onPlayStateChange?: (playing: boolean) => void;
    
    // Return scene handling
    private returnScene: string = 'MapSelectScene';
    
    // Input visualization elements
    private inputIndicators: {
        leftStick: { range: Phaser.GameObjects.Graphics, indicator: Phaser.GameObjects.Graphics },
        rightStick: { range: Phaser.GameObjects.Graphics, indicator: Phaser.GameObjects.Graphics },
        jumpArrows: Phaser.GameObjects.Graphics[]
    } | null = null;
    private currentInputState: any = null;

    constructor(config: any = {}) {
        // Set the scene key for Phaser
        config.key = 'PlaybackScene';
        super(config);
    }

    init(data: any) {
        // Store recording data
        this.recording = data.recording;
        this.onFrameUpdate = data.onFrameUpdate;
        this.onPlayStateChange = data.onPlayStateChange;
        this.returnScene = data.returnScene || 'MapSelectScene';
        
        // Extract map key from recording and load map data immediately
        if (this.recording && this.recording.mapKey) {
            this.mapKey = this.recording.mapKey;
            
            // Use the same seed as the original map for identical random patterns
            // This ensures platforms behave exactly the same during playback
            const seed = this.mapKey.split('').reduce((acc: number, char: string, index: number) => {
                return acc + (char.charCodeAt(0) * (index + 1));
            }, 42);
            Random.setSeed(seed);
            
            // Load map data synchronously from the registry
            this.mapData = loadMapDataSync(this.recording.mapKey);
            
            if (this.mapData) {
                console.log('Init: Loaded map data for', this.recording.mapKey, 'with', this.mapData.platforms?.length, 'platforms');
            } else {
                console.error('Init: Map not found:', this.recording.mapKey);
            }
        }
        
        // Initialize frames array
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        
        // Call parent init
        super.init(data);
    }

    preload() {
        // Map data should already be loaded synchronously in init
        console.log('Preload: mapData status:', {
            hasMapData: !!this.mapData,
            platformCount: this.mapData?.platforms?.length || 0,
            mapKey: this.mapKey
        });
        
        super.preload();
    }

    async create() {
        // Ensure map data is available before calling parent create
        if (!this.mapData) {
            console.error('No map data available for playback scene');
            // Create a minimal empty map structure to prevent errors
            this.mapData = {
                metadata: { name: 'Unknown Map' },
                boundaries: { width: 1200, height: 800 },
                platforms: [],
                entities: {
                    wormStart: { x: 400, y: 300 },
                    goal: { x: 800, y: 300 }
                },
                constraints: []
            };
        }
        
        console.log('PlaybackScene.create() - mapData has', this.mapData?.platforms?.length || 0, 'platforms');
        console.log('PlaybackScene.create() - mapData entities:', this.mapData?.entities);
        
        // Call parent create - it should use the mapData we set in preload
        await super.create();
        
        // Create trail graphics for head and tail paths
        this.headTrailGraphics = this.add.graphics();
        this.headTrailGraphics.setDepth(5);
        
        this.tailTrailGraphics = this.add.graphics();
        this.tailTrailGraphics.setDepth(5);
        
        // Decode recording data
        await this.decodeRecordingData();
        
        // Create input indicators if we have input data
        if (this.frames.length > 0 && this.frames[0].input) {
            this.createInputIndicators();
        }
        
        // No timer needed - we'll use update() method with time-based interpolation
        
        // Auto-play
        this.play();
    }

    /**
     * Create input visualization indicators
     */
    private createInputIndicators() {
        this.inputIndicators = {
            leftStick: {
                range: this.add.graphics(),
                indicator: this.add.graphics()
            },
            rightStick: {
                range: this.add.graphics(),
                indicator: this.add.graphics()
            },
            jumpArrows: []
        };
        
        // Set depth for all indicators
        this.inputIndicators.leftStick.range.setDepth(10);
        this.inputIndicators.leftStick.indicator.setDepth(11);
        this.inputIndicators.rightStick.range.setDepth(10);
        this.inputIndicators.rightStick.indicator.setDepth(11);
        
        // Add to minimap ignore list
        if (this.minimapIgnoreList) {
            this.minimapIgnoreList.push(
                this.inputIndicators.leftStick.range,
                this.inputIndicators.leftStick.indicator,
                this.inputIndicators.rightStick.range,
                this.inputIndicators.rightStick.indicator
            );
        }
    }
    
    /**
     * Override ghost system initialization to disable it completely
     */
    async initializeGhostSystem() {
        // Do nothing - we don't want ghost system in playback mode
        console.log('Ghost system disabled for PlaybackScene');
        return Promise.resolve();
    }
    
    /**
     * Override entity creation to create DoubleWorm with physics disabled
     */
    createEntitiesFromJSON(entitiesData: any) {
        const { wormStart, goal } = entitiesData;
        
        // Create DoubleWorm instance at starting position
        // We'll disable physics by setting bodies to kinematic and manually controlling positions
        const wormX = wormStart?.x || 400;
        const wormY = wormStart?.y || 300;
        
        // Create the worm with the same config as gameplay
        this.worm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: false
        });
        
        // Disable physics on all segments by making them kinematic
        // This prevents physics simulation while keeping the visual appearance
        if (this.worm && this.worm.segments) {
            // First, deactivate all abilities to remove their visual elements
            if (this.worm.movementAbility) {
                this.worm.movementAbility.deactivate();
                this.worm.movementAbility = null;
            }
            if (this.worm.jumpAbility) {
                this.worm.jumpAbility.deactivate();
                this.worm.jumpAbility = null;
            }
            if (this.worm.rollAbility) {
                this.worm.rollAbility.deactivate();
                this.worm.rollAbility = null;
            }
            if (this.worm.grabAbility) {
                this.worm.grabAbility.deactivate();
                this.worm.grabAbility = null;
            }
            
            // Disable the state machine
            if (this.worm.stateMachine) {
                if (typeof this.worm.stateMachine.destroy === 'function') {
                    this.worm.stateMachine.destroy();
                }
                this.worm.stateMachine = null;
            }
            
            this.worm.segments.forEach(segment => {
                // Set to kinematic to disable physics simulation
                this.matter.body.setStatic(segment, true);
                // Store reference to visual components
                if (segment.graphics) {
                    this.wormVisuals.push(segment.graphics);
                }
            });
            
            // Disable all constraints to prevent physics interactions
            if (this.worm.constraints) {
                this.worm.constraints.forEach(constraint => {
                    this.matter.world.remove(constraint);
                });
            }
            
            // Disable input handling and movement updates
            if (this.worm.inputManager) {
                this.worm.inputManager.destroy();
                this.worm.inputManager = null;
            }
            
            // Override updateMovement to prevent input errors
            this.worm.updateMovement = () => {};
        }
        
        // Create camera target that we'll update manually
        this.cameraTarget = this.add.rectangle(0, 0, 10, 10, 0xff0000, 0);
        this.cameraTarget.setVisible(false);
        
        // Create goal at pixel coordinates (visual only)
        if (goal) {
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
        }
        
        // Set up camera
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        this.cameras.main.startFollow(this.cameraTarget, true, 0.1, 0.1);
        this.cameras.main.setZoom(1);
        this.cameras.main.setDeadzone(100, 100);
    }

    /**
     * Override setupControls to add back button handling
     */
    setupControls() {
        // Add keyboard controls for back functionality
        const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey?.on('down', () => this.goBack());
        
        // Add gamepad button handling
        this.input.gamepad?.on('down', (pad: any, button: any) => {
            // B button (Xbox) or Circle button (PlayStation) - typically button 1
            if (button.index === 1) {
                this.goBack();
            }
        });
    }

    /**
     * Override createUI to create minimal UI with back button
     */
    createUI() {
        // Title
        const title = this.add.text(20, 20, `Playback: ${this.recording?.mapTitle || this.mapKey}`, {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        this.minimapIgnoreList.push(title);
        
        // Status indicator
        const status = this.recording?.success ? 'Victory' : 'Failed';
        const statusColor = this.recording?.success ? '#4ecdc4' : '#e74c3c';
        
        const statusText = this.add.text(20, 55, status, {
            fontSize: '18px',
            color: statusColor,
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0);
        
        this.minimapIgnoreList.push(statusText);
        
        // Back button visual indicator
        const backButton = this.add.text(this.scale.width - 20, 20, '← Back (ESC)', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setScrollFactor(0).setInteractive();
        
        backButton.on('pointerup', () => this.goBack());
        backButton.on('pointerover', () => {
            backButton.setColor('#4ecdc4');
        });
        backButton.on('pointerout', () => {
            backButton.setColor('#ffffff');
        });
        
        this.minimapIgnoreList.push(backButton);
        
        // Mobile back button (larger touch target)
        if (this.sys.game.device.input.touch) {
            const mobileBackButton = this.add.rectangle(60, 100, 100, 40, 0x000000, 0.7)
                .setStrokeStyle(2, 0x4ecdc4)
                .setScrollFactor(0)
                .setInteractive();
            
            const mobileBackText = this.add.text(60, 100, '← Back', {
                fontSize: '20px',
                color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0);
            
            mobileBackButton.on('pointerup', () => this.goBack());
            
            this.minimapIgnoreList.push(mobileBackButton);
            this.minimapIgnoreList.push(mobileBackText);
        }
    }

    /**
     * Decode recording data
     */
    private async decodeRecordingData() {
        // Support both old format (recordingData) and new format (data)
        if (!this.recording || (!this.recording.recordingData && !this.recording.data)) {
            console.error('No recording data available');
            return;
        }
        
        const encodedData = this.recording.recordingData || this.recording.data;
        
        try {
            // Decode base64 to array buffer
            const binaryString = atob(encodedData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const buffer = bytes.buffer;
            
            // Decompress if needed
            let decompressedBuffer = buffer;
            if (this.recording.compression === 'gzip' && typeof window !== 'undefined' && (window as any).DecompressionStream) {
                try {
                    console.log('Decompressing with DecompressionStream...');
                    const stream = new Blob([buffer]).stream();
                    const decompressedStream = stream.pipeThrough(new (window as any).DecompressionStream('gzip'));
                    const decompressedBlob = await new Response(decompressedStream).blob();
                    decompressedBuffer = await decompressedBlob.arrayBuffer();
                    console.log('Decompression successful');
                } catch (error) {
                    console.error('Decompression failed, trying as uncompressed:', error);
                }
            }
            
            // Decode frames from buffer
            this.frames = this.decodeFramesFromBuffer(decompressedBuffer);
            console.log('Successfully decoded frames:', this.frames.length);
            
            // Start at first frame if we have frames
            if (this.frames.length > 0) {
                this.renderFrameInterpolated(0);
                
                // Position camera at start
                if (this.frames[0]?.segments?.length > 0) {
                    const startPos = this.frames[0].segments[0];
                    this.cameras.main.centerOn(startPos.x, startPos.y);
                }
            }
        } catch (error) {
            console.error('Failed to decode recording data:', error);
            this.frames = [];
        }
    }

    /**
     * Decode frames from binary buffer
     */
    private decodeFramesFromBuffer(buffer: ArrayBuffer): any[] {
        const view = new DataView(buffer);
        const frames = [];
        const segmentCount = this.recording.segmentCount || 12;
        
        // Check encoding version to determine if input data is present
        const hasInputData = this.recording.encoding === 'binary-v2' || this.recording.hasInputData;
        const inputBytesPerFrame = hasInputData ? 24 : 0; // 6 floats * 4 bytes
        const bytesPerFrame = 4 + (segmentCount * 8) + inputBytesPerFrame;
        const frameCount = Math.floor(buffer.byteLength / bytesPerFrame);
        
        console.log('Decoding binary frames:', {
            bufferSize: buffer.byteLength,
            segmentCount,
            bytesPerFrame,
            expectedFrames: frameCount,
            encoding: this.recording.encoding,
            hasInputData
        });
        
        // Validate buffer size
        if (buffer.byteLength < bytesPerFrame) {
            console.error('Buffer too small for even one frame:', {
                bufferSize: buffer.byteLength,
                requiredSize: bytesPerFrame
            });
            return [];
        }
        
        let offset = 0;
        for (let f = 0; f < frameCount; f++) {
            // Check if we have enough bytes remaining
            if (offset + bytesPerFrame > buffer.byteLength) {
                console.warn(`Stopping at frame ${f}, not enough bytes remaining`);
                break;
            }
            
            try {
                const timestamp = view.getUint32(offset, true);
                offset += 4;
                
                const segments = [];
                for (let s = 0; s < segmentCount; s++) {
                    if (offset + 8 > buffer.byteLength) {
                        console.error(`Not enough bytes for segment ${s} at frame ${f}`);
                        return frames; // Return what we have so far
                    }
                    const x = view.getFloat32(offset, true);
                    offset += 4;
                    const y = view.getFloat32(offset, true);
                    offset += 4;
                    segments.push({ x, y });
                }
            
            // Create frame data
            const frameData: any = { timestamp, segments };
            
            // Decode input data if present
            if (hasInputData) {
                const leftTrigger = view.getFloat32(offset + 16, true);
                const rightTrigger = view.getFloat32(offset + 20, true);
                
                frameData.input = {
                    leftStick: {
                        x: view.getFloat32(offset, true),
                        y: view.getFloat32(offset + 4, true)
                    },
                    rightStick: {
                        x: view.getFloat32(offset + 8, true),
                        y: view.getFloat32(offset + 12, true)
                    },
                    leftTrigger: leftTrigger,
                    rightTrigger: rightTrigger
                };
                
                // Debug log decoded trigger values
                if (leftTrigger > 0.01 || rightTrigger > 0.01) {
                    console.log('Decoded triggers at frame', f, ':', {
                        leftTrigger,
                        rightTrigger,
                        timestamp
                    });
                }
                
                offset += 24;
            }
            
                frames.push(frameData);
            } catch (error) {
                console.error(`Error decoding frame ${f}:`, error);
                break; // Stop processing on error
            }
        }
        
        return frames;
    }

    /**
     * Main update loop for playback
     */
    update(time: number, delta: number) {
        // Update platforms (some might be animated)
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.update) {
                platform.instance.update(time, delta);
            }
        });
        
        // Update playback with time-based interpolation
        if (this.isPlaying && this.frames.length > 0) {
            this.updatePlaybackInterpolated(delta);
        }
        
        // Update worm visual if it exists
        if (this.worm && typeof this.worm.update === 'function') {
            // Call update to refresh graphics, but physics won't run since bodies are static
            this.worm.update(delta);
        }
        
        // Update minimap if visible
        if (this.minimap && this.miniMapConfig.visible && this.worm && this.worm.segments && this.worm.segments.length > 0) {
            const headSegment = this.worm.segments[0];
            this.minimap.centerOn(headSegment.position.x, headSegment.position.y);
            this.updateViewportIndicator();
        }
    }

    /**
     * Update playback with time-based interpolation (like GhostPlayer)
     */
    private updatePlaybackInterpolated(delta: number) {
        if (!this.isPlaying || this.frames.length === 0) return;
        
        // Update elapsed time based on playback speed
        this.elapsedTime += delta * this.playbackSpeed;
        
        // Find the appropriate frame for current time
        let targetFrameIndex = this.currentFrameIndex;
        
        // Search forward for the right frame
        while (targetFrameIndex < this.frames.length - 1 &&
               this.frames[targetFrameIndex + 1].timestamp <= this.elapsedTime) {
            targetFrameIndex++;
        }
        
        // Search backward if we've gone too far (e.g., after seek)
        while (targetFrameIndex > 0 &&
               this.frames[targetFrameIndex].timestamp > this.elapsedTime) {
            targetFrameIndex--;
        }
        
        // Update frame index if changed
        if (targetFrameIndex !== this.currentFrameIndex) {
            this.currentFrameIndex = targetFrameIndex;
            if (this.onFrameUpdate) {
                this.onFrameUpdate(this.currentFrameIndex);
            }
        }
        
        // Check if playback has finished
        if (this.currentFrameIndex >= this.frames.length - 1) {
            // Reached end, just pause at the last frame
            this.pause();
            this.currentFrameIndex = this.frames.length - 1;
            this.elapsedTime = this.frames[this.frames.length - 1].timestamp;
            // Keep the trails visible, don't clear them
            this.renderFrameInterpolated(this.currentFrameIndex);
            return;
        }
        
        // Get current and next frame for interpolation
        const currentFrame = this.frames[this.currentFrameIndex];
        const nextFrame = this.frames[this.currentFrameIndex + 1];
        
        if (!nextFrame) {
            // Last frame, just show current positions
            this.renderFrameInterpolated(this.currentFrameIndex);
            return;
        }
        
        // Calculate interpolation factor
        const frameDuration = nextFrame.timestamp - currentFrame.timestamp;
        const frameProgress = this.elapsedTime - currentFrame.timestamp;
        const t = Math.min(1, Math.max(0, frameProgress / frameDuration));
        
        // Render with interpolation
        this.renderFrameWithInterpolation(currentFrame, nextFrame, t);
    }

    /**
     * Render a specific frame without interpolation
     */
    private renderFrameInterpolated(frameIndex: number) {
        if (frameIndex < 0 || frameIndex >= this.frames.length) return;
        
        const frame = this.frames[frameIndex];
        this.updateWormPositions(frame.segments);
        
        // Update input indicators if available
        if (frame.input && this.inputIndicators) {
            this.updateInputIndicators(frame.input);
        } else if (this.inputIndicators) {
            // Clear indicators if no input data for this frame
            this.updateInputIndicators(null);
        }
    }
    
    /**
     * Render with interpolation between two frames
     */
    private renderFrameWithInterpolation(currentFrame: any, nextFrame: any, t: number) {
        // Interpolate segment positions
        const interpolatedSegments = currentFrame.segments.map((segment: any, i: number) => {
            const nextSegment = nextFrame.segments[i];
            return {
                x: segment.x + (nextSegment.x - segment.x) * t,
                y: segment.y + (nextSegment.y - segment.y) * t
            };
        });
        
        this.updateWormPositions(interpolatedSegments);
        
        // Interpolate input state if available
        if (this.inputIndicators) {
            if (currentFrame.input && nextFrame.input) {
                const interpolatedInput = {
                    leftStick: {
                        x: currentFrame.input.leftStick.x + (nextFrame.input.leftStick.x - currentFrame.input.leftStick.x) * t,
                        y: currentFrame.input.leftStick.y + (nextFrame.input.leftStick.y - currentFrame.input.leftStick.y) * t
                    },
                    rightStick: {
                        x: currentFrame.input.rightStick.x + (nextFrame.input.rightStick.x - currentFrame.input.rightStick.x) * t,
                        y: currentFrame.input.rightStick.y + (nextFrame.input.rightStick.y - currentFrame.input.rightStick.y) * t
                    },
                    leftTrigger: currentFrame.input.leftTrigger + (nextFrame.input.leftTrigger - currentFrame.input.leftTrigger) * t,
                    rightTrigger: currentFrame.input.rightTrigger + (nextFrame.input.rightTrigger - currentFrame.input.rightTrigger) * t
                };
                this.updateInputIndicators(interpolatedInput);
            } else if (currentFrame.input) {
                // Use current frame's input if next frame doesn't have it
                this.updateInputIndicators(currentFrame.input);
            } else {
                // Clear indicators if no input data
                this.updateInputIndicators(null);
            }
        }
    }
    
    /**
     * Update input indicators based on current input state
     */
    private updateInputIndicators(inputState: any) {
        if (!this.inputIndicators || !this.worm || !this.worm.segments || this.worm.segments.length < 2) {
            return;
        }
        
        const headColor = 0xff6b6b;
        const headStrokeColor = 0xe74c3c;
        const tailColor = 0x74b9ff;
        const tailStrokeColor = 0x3498db;
        const anchorRadius = 60;
        const indicatorRadius = 8;
        const rangeAlpha = 0.4;
        const deadzone = 0.06;
        
        // Get anchor positions (similar to MovementAbility)
        const headSegment = this.worm.segments[1]; // Attach to second segment like MovementAbility
        const tailSegment = this.worm.segments[this.worm.segments.length - 2]; // Second from last
        
        // Clear previous graphics
        this.inputIndicators.leftStick.range.clear();
        this.inputIndicators.leftStick.indicator.clear();
        this.inputIndicators.rightStick.range.clear();
        this.inputIndicators.rightStick.indicator.clear();
        
        // Always draw range circles (like in gameplay)
        this.inputIndicators.leftStick.range.lineStyle(1, headColor, rangeAlpha);
        this.inputIndicators.leftStick.range.strokeCircle(headSegment.position.x, headSegment.position.y, anchorRadius);
        
        this.inputIndicators.rightStick.range.lineStyle(1, tailColor, rangeAlpha);
        this.inputIndicators.rightStick.range.strokeCircle(tailSegment.position.x, tailSegment.position.y, anchorRadius);
        
        // Draw stick position indicators only if there's input
        if (inputState) {
            // Update left stick (head) indicator
            const leftStick = inputState.leftStick || { x: 0, y: 0 };
            const leftMagnitude = Math.sqrt(leftStick.x * leftStick.x + leftStick.y * leftStick.y);
            
            if (leftMagnitude > deadzone) {
                this.inputIndicators.leftStick.indicator.fillStyle(headColor, 0.8);
                this.inputIndicators.leftStick.indicator.lineStyle(2, headStrokeColor, 1);
                const indicatorX = headSegment.position.x + leftStick.x * anchorRadius;
                const indicatorY = headSegment.position.y + leftStick.y * anchorRadius;
                this.inputIndicators.leftStick.indicator.fillCircle(indicatorX, indicatorY, indicatorRadius);
                this.inputIndicators.leftStick.indicator.strokeCircle(indicatorX, indicatorY, indicatorRadius);
            }
            
            // Update right stick (tail) indicator
            const rightStick = inputState.rightStick || { x: 0, y: 0 };
            const rightMagnitude = Math.sqrt(rightStick.x * rightStick.x + rightStick.y * rightStick.y);
            
            if (rightMagnitude > deadzone) {
                this.inputIndicators.rightStick.indicator.fillStyle(tailColor, 0.8);
                this.inputIndicators.rightStick.indicator.lineStyle(2, tailStrokeColor, 1);
                const indicatorX = tailSegment.position.x + rightStick.x * anchorRadius;
                const indicatorY = tailSegment.position.y + rightStick.y * anchorRadius;
                this.inputIndicators.rightStick.indicator.fillCircle(indicatorX, indicatorY, indicatorRadius);
                this.inputIndicators.rightStick.indicator.strokeCircle(indicatorX, indicatorY, indicatorRadius);
            }
        }
        
        // Handle jump arrows (triggers)
        if (inputState) {
            const leftTrigger = inputState.leftTrigger || 0;
            const rightTrigger = inputState.rightTrigger || 0;
            const triggerThreshold = 0.01;
            
            // Check if triggers were just pressed (rising edge detection)
            const prevLeftTrigger = this.currentInputState ? (this.currentInputState.leftTrigger || 0) : 0;
            const prevRightTrigger = this.currentInputState ? (this.currentInputState.rightTrigger || 0) : 0;
            
            const leftJustPressed = leftTrigger > triggerThreshold && prevLeftTrigger <= triggerThreshold;
            const rightJustPressed = rightTrigger > triggerThreshold && prevRightTrigger <= triggerThreshold;
            
            if (leftJustPressed || rightJustPressed) {
                // Debug log to see when arrows should be created
                console.log('Creating jump arrows:', { 
                    leftJustPressed, 
                    rightJustPressed,
                    leftTrigger,
                    rightTrigger,
                    prevLeftTrigger,
                    prevRightTrigger
                });
                this.createJumpArrows(leftJustPressed, rightJustPressed);
            }
        }
        
        // Store current input state
        this.currentInputState = inputState;
    }
    
    /**
     * Create jump arrow effects similar to JumpAbility
     */
    private createJumpArrows(showHead: boolean, showTail: boolean) {
        if (!this.worm || !this.worm.segments || this.worm.segments.length < 3) {
            console.warn('Cannot create jump arrows - worm not ready');
            return;
        }
        
        const headColor = 0xff6b6b;
        const tailColor = 0x74b9ff;
        const laserLength = 200;
        const arrowSize = 15;
        const arrowOffset = 10;
        const fadeDuration = 5000;
        
        // Head jump arrow
        if (showHead) {
            const fromSegment = this.worm.segments[0];
            const toSegment = this.worm.segments[this.worm.segments.length - 2];
            console.log('Creating head arrow from segment 0 to segment', this.worm.segments.length - 2);
            this.createLaserArrow(fromSegment, toSegment, headColor, laserLength, arrowSize, arrowOffset, fadeDuration);
        }
        
        // Tail jump arrow
        if (showTail) {
            const fromSegment = this.worm.segments[this.worm.segments.length - 1];
            const toSegment = this.worm.segments[1];
            console.log('Creating tail arrow from segment', this.worm.segments.length - 1, 'to segment 1');
            this.createLaserArrow(fromSegment, toSegment, tailColor, laserLength, arrowSize, arrowOffset, fadeDuration);
        }
    }
    
    /**
     * Create a single laser arrow effect
     */
    private createLaserArrow(fromSegment: any, toSegment: any, color: number, length: number, arrowSize: number, arrowOffset: number, fadeDuration: number) {
        console.log('createLaserArrow called with:', {
            from: fromSegment.position,
            to: toSegment.position,
            color: color.toString(16),
            length
        });
        
        const laser = this.add.graphics();
        laser.setDepth(15);
        
        // Calculate direction
        const dx = toSegment.position.x - fromSegment.position.x;
        const dy = toSegment.position.y - fromSegment.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        console.log('Arrow direction:', { dx, dy, distance });
        
        if (distance > 0) {
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            // Calculate laser end point
            const endX = fromSegment.position.x + dirX * length;
            const endY = fromSegment.position.y + dirY * length;
            
            console.log('Drawing arrow from', fromSegment.position, 'to', { x: endX, y: endY });
            
            // Draw laser line
            laser.lineStyle(2, color, 0.8);
            laser.beginPath();
            laser.moveTo(fromSegment.position.x, fromSegment.position.y);
            laser.lineTo(endX, endY);
            laser.strokePath();
            
            // Draw arrowhead
            const arrowX = endX - dirX * arrowOffset;
            const arrowY = endY - dirY * arrowOffset;
            const perpX = -dirY;
            const perpY = dirX;
            
            laser.fillStyle(color, 0.8);
            laser.beginPath();
            laser.moveTo(endX, endY);
            laser.lineTo(arrowX - perpX * arrowSize/2, arrowY - perpY * arrowSize/2);
            laser.lineTo(arrowX + perpX * arrowSize/2, arrowY + perpY * arrowSize/2);
            laser.closePath();
            laser.fillPath();
            
            // Add to jump arrows list
            if (this.inputIndicators) {
                this.inputIndicators.jumpArrows.push(laser);
                console.log('Arrow added to list, total arrows:', this.inputIndicators.jumpArrows.length);
            }
            
            // Fade out animation
            this.tweens.add({
                targets: laser,
                alpha: 0,
                duration: fadeDuration,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    console.log('Arrow fade complete, destroying');
                    laser.clear();
                    laser.destroy();
                    // Remove from array
                    if (this.inputIndicators) {
                        const index = this.inputIndicators.jumpArrows.indexOf(laser);
                        if (index > -1) {
                            this.inputIndicators.jumpArrows.splice(index, 1);
                        }
                    }
                }
            });
        } else {
            console.warn('Arrow distance is 0, not drawing');
            laser.destroy();
        }
    }
    
    /**
     * Update worm positions from segment data
     */
    private updateWormPositions(segments: any[]) {
        // Update worm segment positions using Matter.js body positions
        if (this.worm && this.worm.segments) {
            for (let i = 0; i < this.worm.segments.length && i < segments.length; i++) {
                const segment = this.worm.segments[i];
                const position = segments[i];
                
                // Update trail for head segment
                if (i === 0) {
                    // Always add the point to keep a smooth trail
                    this.headTrailPoints.push({ x: position.x, y: position.y });
                    
                    // Limit trail length
                    if (this.headTrailPoints.length > this.maxTrailLength) {
                        this.headTrailPoints.shift();
                    }
                }
                
                // Update trail for tail segment
                if (i === segments.length - 1) {
                    const lastTailPoint = this.tailTrailPoints[this.tailTrailPoints.length - 1];
                    // Only add point if it's far enough from the last one
                    if (!lastTailPoint || 
                        Math.abs(lastTailPoint.x - position.x) > 2 || 
                        Math.abs(lastTailPoint.y - position.y) > 2) {
                        this.tailTrailPoints.push({ x: position.x, y: position.y });
                        
                        // Limit trail length
                        if (this.tailTrailPoints.length > this.maxTrailLength) {
                            this.tailTrailPoints.shift();
                        }
                    }
                }
                
                // Set the Matter.js body position directly
                // This works because we've made the bodies static
                this.matter.body.setPosition(segment, position);
            }
            
            // Redraw both trails
            this.renderTrails();
        }
        
        // Update camera target to follow worm
        if (this.cameraTarget && segments.length > 0) {
            // Position camera between head and tail for better view
            const head = segments[0];
            const tail = segments[segments.length - 1];
            this.cameraTarget.x = (head.x + tail.x) / 2;
            this.cameraTarget.y = (head.y + tail.y) / 2;
        }
    }

    /**
     * Render both trails efficiently
     */
    private renderTrails() {
        // Clear both trail graphics
        this.headTrailGraphics.clear();
        this.tailTrailGraphics.clear();
        
        // Draw head trail (red, fading from transparent to solid)
        if (this.headTrailPoints.length >= 2) {
            // Draw as a single path with varying alpha segments
            for (let i = 1; i < this.headTrailPoints.length; i++) {
                // Calculate alpha based on position in array
                // First segments (oldest) should be transparent, last segments (newest) should be solid
                const progress = i / (this.headTrailPoints.length - 1);
                const alpha = 0.8 * progress;
                
                // Draw this segment with its alpha
                this.headTrailGraphics.lineStyle(3, 0xff6b6b, alpha);
                this.headTrailGraphics.beginPath();
                this.headTrailGraphics.moveTo(this.headTrailPoints[i - 1].x, this.headTrailPoints[i - 1].y);
                this.headTrailGraphics.lineTo(this.headTrailPoints[i].x, this.headTrailPoints[i].y);
                this.headTrailGraphics.strokePath();
            }
        }
        
        // Draw tail trail (blue, fading from transparent to solid)
        if (this.tailTrailPoints.length >= 2) {
            // Draw as a single path with varying alpha segments
            for (let i = 1; i < this.tailTrailPoints.length; i++) {
                // Calculate alpha based on position in array
                // First segments (oldest) should be transparent, last segments (newest) should be solid
                const progress = i / (this.tailTrailPoints.length - 1);
                const alpha = 0.5 * progress; // Goes from 0 to 0.5
                
                // Draw this segment with its alpha
                this.tailTrailGraphics.lineStyle(3, 0x74b9ff, alpha);
                this.tailTrailGraphics.beginPath();
                this.tailTrailGraphics.moveTo(this.tailTrailPoints[i - 1].x, this.tailTrailPoints[i - 1].y);
                this.tailTrailGraphics.lineTo(this.tailTrailPoints[i].x, this.tailTrailPoints[i].y);
                this.tailTrailGraphics.strokePath();
            }
        }
    }

    /**
     * Start playback
     */
    public play() {
        // If we're at the last frame and user hits play, restart from beginning
        if (this.currentFrameIndex >= this.frames.length - 1 && this.frames.length > 0) {
            this.restart();
            return;
        }
        
        this.isPlaying = true;
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(true);
        }
    }

    /**
     * Pause playback
     */
    public pause() {
        this.isPlaying = false;
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
    }

    /**
     * Toggle play/pause
     */
    public togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Seek to specific frame
     */
    public seekToFrame(frameIndex: number) {
        if (frameIndex >= 0 && frameIndex < this.frames.length) {
            this.currentFrameIndex = frameIndex;
            
            // Set elapsed time to match the frame's timestamp
            this.elapsedTime = this.frames[frameIndex].timestamp;
            
            // Rebuild trail points up to current frame
            this.headTrailPoints = [];
            this.tailTrailPoints = [];
            const startFrame = Math.max(0, frameIndex - this.maxTrailLength);
            
            for (let i = startFrame; i <= frameIndex; i++) {
                if (this.frames[i] && this.frames[i].segments.length > 0) {
                    // Add head position
                    this.headTrailPoints.push({
                        x: this.frames[i].segments[0].x,
                        y: this.frames[i].segments[0].y
                    });
                    // Add tail position
                    const lastSegmentIndex = this.frames[i].segments.length - 1;
                    this.tailTrailPoints.push({
                        x: this.frames[i].segments[lastSegmentIndex].x,
                        y: this.frames[i].segments[lastSegmentIndex].y
                    });
                }
            }
            
            // Clear any active jump arrows when seeking
            if (this.inputIndicators) {
                this.inputIndicators.jumpArrows.forEach(arrow => {
                    arrow.clear();
                    arrow.destroy();
                });
                this.inputIndicators.jumpArrows = [];
            }
            
            // Reset current input state to force proper arrow creation
            this.currentInputState = null;
            
            // Render the current frame
            this.renderFrameInterpolated(frameIndex);
        }
    }

    /**
     * Set playback speed
     */
    public setPlaybackSpeed(speed: number) {
        this.playbackSpeed = speed;
    }

    /**
     * Restart playback
     */
    public restart() {
        this.currentFrameIndex = 0;
        this.elapsedTime = 0;
        this.headTrailPoints = []; // Clear head trail points
        this.tailTrailPoints = []; // Clear tail trail points
        this.headTrailGraphics.clear();
        this.tailTrailGraphics.clear();
        
        // Clear any active jump arrows when restarting
        if (this.inputIndicators) {
            this.inputIndicators.jumpArrows.forEach(arrow => {
                arrow.clear();
                arrow.destroy();
            });
            this.inputIndicators.jumpArrows = [];
        }
        
        // Reset current input state
        this.currentInputState = null;
        
        this.renderFrameInterpolated(0);
        this.play();
    }
    
    /**
     * Go back to the previous scene
     */
    private goBack() {
        this.cleanup();
        this.scene.stop();
        this.scene.start(this.returnScene);
    }

    /**
     * Clean up when scene shuts down
     */
    cleanup() {
        super.cleanup();
        
        // Clean up playback-specific elements
        if (this.headTrailGraphics) {
            this.headTrailGraphics.destroy();
        }
        if (this.tailTrailGraphics) {
            this.tailTrailGraphics.destroy();
        }
        
        // Clean up input indicators
        if (this.inputIndicators) {
            this.inputIndicators.leftStick.range.destroy();
            this.inputIndicators.leftStick.indicator.destroy();
            this.inputIndicators.rightStick.range.destroy();
            this.inputIndicators.rightStick.indicator.destroy();
            
            // Clean up any remaining jump arrows
            this.inputIndicators.jumpArrows.forEach(arrow => {
                arrow.clear();
                arrow.destroy();
            });
            
            this.inputIndicators = null;
        }
        
        // Clean up the worm instance
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        this.wormVisuals = [];
        this.frames = [];
        this.isPlaying = false;
    }
}
