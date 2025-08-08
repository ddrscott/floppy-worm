import JsonMapBase from '/src/scenes/JsonMapBase';
import DoubleWorm from '/src/entities/DoubleWorm';

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
    private playbackStartTime: number = 0;
    private playbackPausedTime: number = 0;
    private elapsedTime: number = 0;
    
    // Use actual DoubleWorm component (physics disabled)
    private worm: any;
    private wormVisuals: Phaser.GameObjects.Arc[] = [];
    private trailGraphics: Phaser.GameObjects.Graphics;
    private trailPoints: { x: number, y: number }[] = [];
    private maxTrailLength: number = 200; // Limit trail length for performance
    
    // Callbacks for UI integration
    private onFrameUpdate?: (frame: number) => void;
    private onPlayStateChange?: (playing: boolean) => void;

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
        
        // Extract map key from recording
        if (this.recording && this.recording.mapKey) {
            this.mapKey = this.recording.mapKey;
        }
        
        // Initialize frames array
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        
        // Call parent init
        super.init(data);
    }

    async preload() {
        super.preload();
        
        // Load map data based on recording's mapKey
        if (this.recording && this.recording.mapKey) {
            try {
                // Try to load map data from API
                const response = await fetch(`/api/maps/${this.recording.mapKey}.json`);
                if (response.ok) {
                    const result = await response.json();
                    this.mapData = result.mapData;
                    console.log('Loaded map data for playback:', this.recording.mapKey);
                }
            } catch (error) {
                console.error('Failed to load map data:', error);
                
                // Try loading from static imports as fallback
                try {
                    const MapLoader = (await import('/src/services/MapLoader')).default;
                    this.mapData = await MapLoader.loadMapData(this.recording.mapKey);
                } catch (err) {
                    console.error('Failed to load map from MapLoader:', err);
                }
            }
        }
    }

    async create() {
        // Call parent create to set up the map
        await super.create();
        
        // Create trail graphics for worm path
        this.trailGraphics = this.add.graphics();
        this.trailGraphics.setAlpha(0.3);
        this.trailGraphics.setDepth(5);
        
        // Decode recording data
        await this.decodeRecordingData();
        
        // No timer needed - we'll use update() method with time-based interpolation
        
        // Auto-play
        this.play();
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
     * Override setupControls to skip input handling
     */
    setupControls() {
        // No input controls needed for playback
    }

    /**
     * Override createUI to create minimal UI
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
        
        // Frame counter
        this.frameCounterText = this.add.text(this.scale.width / 2, 20, '', {
            fontSize: '16px',
            color: '#95a5a6',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 2 }
        }).setOrigin(0.5, 0).setScrollFactor(0);
        
        this.minimapIgnoreList.push(this.frameCounterText);
    }

    /**
     * Decode recording data
     */
    private async decodeRecordingData() {
        if (!this.recording || !this.recording.recordingData) {
            console.error('No recording data available');
            return;
        }
        
        const encodedData = this.recording.recordingData;
        
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
        const bytesPerFrame = 4 + (segmentCount * 8);
        const frameCount = buffer.byteLength / bytesPerFrame;
        
        console.log('Decoding binary frames:', {
            bufferSize: buffer.byteLength,
            segmentCount,
            bytesPerFrame,
            expectedFrames: frameCount
        });
        
        let offset = 0;
        for (let f = 0; f < frameCount; f++) {
            const timestamp = view.getUint32(offset, true);
            offset += 4;
            
            const segments = [];
            for (let s = 0; s < segmentCount; s++) {
                const x = view.getFloat32(offset, true);
                offset += 4;
                const y = view.getFloat32(offset, true);
                offset += 4;
                segments.push({ x, y });
            }
            
            frames.push({ timestamp, segments });
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
        
        // Update frame counter display
        if (this.frameCounterText) {
            const displayTime = this.elapsedTime;
            const totalTime = this.recording?.duration || 0;
            
            this.frameCounterText.setText(
                `Frame: ${this.currentFrameIndex}/${this.frames.length} | ${this.formatTime(displayTime)}/${this.formatTime(totalTime)}`
            );
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
            // Reached end, stop and reset
            this.pause();
            this.currentFrameIndex = 0;
            this.elapsedTime = 0;
            this.trailPoints = [];
            this.trailGraphics.clear();
            this.renderFrameInterpolated(0);
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
                
                // Update trail for head segment (less frequently to avoid trail buildup)
                if (i === 0) {
                    const lastPoint = this.trailPoints[this.trailPoints.length - 1];
                    // Only add point if it's far enough from the last one
                    if (!lastPoint || 
                        Math.abs(lastPoint.x - position.x) > 2 || 
                        Math.abs(lastPoint.y - position.y) > 2) {
                        this.trailPoints.push({ x: position.x, y: position.y });
                        
                        // Limit trail length
                        if (this.trailPoints.length > this.maxTrailLength) {
                            this.trailPoints.shift();
                        }
                        
                        // Redraw entire trail
                        this.renderTrail();
                    }
                }
                
                // Set the Matter.js body position directly
                // This works because we've made the bodies static
                this.matter.body.setPosition(segment, position);
            }
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
     * Render the trail efficiently
     */
    private renderTrail() {
        this.trailGraphics.clear();
        
        if (this.trailPoints.length < 2) return;
        
        // Draw the trail with gradient alpha
        for (let i = 1; i < this.trailPoints.length; i++) {
            const alpha = (i / this.trailPoints.length) * 0.3; // Fade from transparent to 0.3
            this.trailGraphics.lineStyle(2, 0x4ecdc4, alpha);
            this.trailGraphics.moveTo(this.trailPoints[i - 1].x, this.trailPoints[i - 1].y);
            this.trailGraphics.lineTo(this.trailPoints[i].x, this.trailPoints[i].y);
            this.trailGraphics.strokePath();
        }
    }

    /**
     * Start playback
     */
    public play() {
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
            this.trailPoints = [];
            const startFrame = Math.max(0, frameIndex - this.maxTrailLength);
            
            for (let i = startFrame; i <= frameIndex; i++) {
                if (this.frames[i] && this.frames[i].segments.length > 0) {
                    this.trailPoints.push({
                        x: this.frames[i].segments[0].x,
                        y: this.frames[i].segments[0].y
                    });
                }
            }
            
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
        this.trailPoints = []; // Clear trail points
        this.trailGraphics.clear();
        this.renderFrameInterpolated(0);
        this.play();
    }

    /**
     * Format time for display
     */
    private formatTime(milliseconds: number): string {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Clean up when scene shuts down
     */
    cleanup() {
        super.cleanup();
        
        // Clean up playback-specific elements
        if (this.trailGraphics) {
            this.trailGraphics.destroy();
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

    // Private properties for UI elements
    private frameCounterText: Phaser.GameObjects.Text;
}
