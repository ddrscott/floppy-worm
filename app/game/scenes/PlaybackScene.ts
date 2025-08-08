import JsonMapBase from '/src/scenes/JsonMapBase';

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
    private lastUpdateTime: number = 0;
    private frameTime: number = 16.67; // ~60fps
    private accumulatedTime: number = 0;
    
    // Visual worm segments (no physics)
    private wormSegments: Phaser.GameObjects.Arc[] = [];
    private segmentRadii: number[] = [];
    private trailGraphics: Phaser.GameObjects.Graphics;
    
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
        
        // Start playback timer
        this.time.addEvent({
            delay: 16, // ~60fps
            callback: this.updatePlayback,
            callbackScope: this,
            loop: true
        });
        
        // Auto-play
        this.play();
    }

    /**
     * Override entity creation to create visual-only worm segments
     */
    createEntitiesFromJSON(entitiesData: any) {
        const { goal } = entitiesData;
        
        // Create visual worm segments (no physics)
        this.createVisualWorm();
        
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
     * Create visual-only worm segments
     */
    private createVisualWorm() {
        const segmentCount = this.recording?.segmentCount || 12;
        const baseRadius = 15;
        
        for (let i = 0; i < segmentCount; i++) {
            const radius = i === 0 ? baseRadius * 1.5 : baseRadius * (1 - i * 0.03);
            this.segmentRadii.push(radius);
            
            // Create segment visual
            const segment = this.add.circle(0, 0, radius, i === 0 ? 0xffeb3b : 0x4ecdc4);
            segment.setStrokeStyle(2, i === 0 ? 0xffd93d : 0x2e86ab);
            segment.setDepth(segmentCount - i + 10); // Head on top
            
            this.wormSegments.push(segment);
        }
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
                this.renderFrame(0);
                
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
        
        // Render constraints
        if (this.constraints && this.constraints.length > 0) {
            this.renderConstraints();
        }
        
        // Update minimap if visible
        if (this.minimap && this.miniMapConfig.visible && this.wormSegments.length > 0) {
            const headSegment = this.wormSegments[0];
            this.minimap.centerOn(headSegment.x, headSegment.y);
            this.updateViewportIndicator();
        }
        
        // Update frame counter display
        if (this.frameCounterText) {
            const currentTime = this.currentFrameIndex > 0 && this.frames[this.currentFrameIndex] 
                ? this.frames[this.currentFrameIndex].timestamp : 0;
            const totalTime = this.recording?.duration || 0;
            
            this.frameCounterText.setText(
                `Frame: ${this.currentFrameIndex}/${this.frames.length} | ${this.formatTime(currentTime)}/${this.formatTime(totalTime)}`
            );
        }
    }

    /**
     * Update playback based on timer
     */
    private updatePlayback() {
        if (!this.isPlaying || this.frames.length === 0) return;
        
        const currentTime = this.time.now;
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;
        
        // Accumulate time based on playback speed
        this.accumulatedTime += deltaTime * this.playbackSpeed;
        
        // Update frames based on accumulated time
        while (this.accumulatedTime >= this.frameTime) {
            this.accumulatedTime -= this.frameTime;
            
            if (this.currentFrameIndex < this.frames.length - 1) {
                this.currentFrameIndex++;
                this.renderFrame(this.currentFrameIndex);
                
                if (this.onFrameUpdate) {
                    this.onFrameUpdate(this.currentFrameIndex);
                }
            } else {
                // Reached end, loop or stop
                this.pause();
                this.currentFrameIndex = 0;
                this.renderFrame(0);
            }
        }
    }

    /**
     * Render a specific frame
     */
    private renderFrame(frameIndex: number) {
        if (frameIndex < 0 || frameIndex >= this.frames.length) return;
        
        const frame = this.frames[frameIndex];
        
        // Update worm segment positions
        for (let i = 0; i < this.wormSegments.length && i < frame.segments.length; i++) {
            const segment = this.wormSegments[i];
            const position = frame.segments[i];
            
            // Add trail for head segment
            if (i === 0 && frameIndex > 0) {
                const prevFrame = this.frames[frameIndex - 1];
                const prevPos = prevFrame.segments[0];
                
                this.trailGraphics.lineStyle(2, 0x4ecdc4, 0.3);
                this.trailGraphics.moveTo(prevPos.x, prevPos.y);
                this.trailGraphics.lineTo(position.x, position.y);
                this.trailGraphics.strokePath();
            }
            
            segment.setPosition(position.x, position.y);
        }
        
        // Update camera target to follow worm
        if (this.cameraTarget && frame.segments.length > 0) {
            // Position camera between head and tail for better view
            const head = frame.segments[0];
            const tail = frame.segments[frame.segments.length - 1];
            this.cameraTarget.x = (head.x + tail.x) / 2;
            this.cameraTarget.y = (head.y + tail.y) / 2;
        }
    }

    /**
     * Start playback
     */
    public play() {
        this.isPlaying = true;
        this.lastUpdateTime = this.time.now;
        
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
            this.renderFrame(frameIndex);
            
            // Clear trail when seeking
            this.trailGraphics.clear();
            
            // Redraw trail up to current frame
            for (let i = 1; i <= frameIndex; i++) {
                const frame = this.frames[i];
                const prevFrame = this.frames[i - 1];
                
                if (frame.segments.length > 0 && prevFrame.segments.length > 0) {
                    this.trailGraphics.lineStyle(2, 0x4ecdc4, 0.3);
                    this.trailGraphics.moveTo(prevFrame.segments[0].x, prevFrame.segments[0].y);
                    this.trailGraphics.lineTo(frame.segments[0].x, frame.segments[0].y);
                    this.trailGraphics.strokePath();
                }
            }
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
        this.renderFrame(0);
        this.trailGraphics.clear();
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
        
        this.wormSegments.forEach(segment => segment.destroy());
        this.wormSegments = [];
        
        this.frames = [];
        this.isPlaying = false;
    }

    // Private properties for UI elements
    private frameCounterText: Phaser.GameObjects.Text;
}