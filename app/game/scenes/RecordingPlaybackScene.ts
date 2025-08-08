import Phaser from 'phaser';

export default class RecordingPlaybackScene extends Phaser.Scene {
    private recording: any;
    private frames: any[];
    private currentFrameIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private lastUpdateTime: number = 0;
    private frameTime: number = 16.67; // ~60fps
    private accumulatedTime: number = 0;
    
    private wormSegments: Phaser.GameObjects.Arc[] = [];
    private segmentRadii: number[] = [];
    private trailGraphics: Phaser.GameObjects.Graphics;
    
    private onFrameUpdate?: (frame: number) => void;
    private onPlayStateChange?: (playing: boolean) => void;
    
    // Map-related properties
    private mapData: any;
    private platforms: Phaser.GameObjects.Graphics[] = [];
    private electricPlatforms: Phaser.GameObjects.Graphics[] = [];
    private blackholePlatforms: Phaser.GameObjects.Graphics[] = [];
    private goal: Phaser.GameObjects.Graphics;
    private levelWidth: number = 1000;
    private levelHeight: number = 800;

    constructor() {
        super({ key: 'RecordingPlaybackScene' });
    }

    init(data: any) {
        console.log('RecordingPlaybackScene init called with data:', data);
        this.recording = data.recording;
        this.onFrameUpdate = data.onFrameUpdate;
        this.onPlayStateChange = data.onPlayStateChange;
        
        console.log('Recording structure:', {
            hasRecordingData: !!this.recording.recordingData,
            recordingDataType: typeof this.recording.recordingData,
            recordingDataLength: this.recording.recordingData?.length,
            encoding: this.recording.encoding,
            compression: this.recording.compression,
            frameCount: this.recording.frameCount,
            segmentCount: this.recording.segmentCount,
            mapKey: this.recording.mapKey
        });
        
        // Decode recording data
        try {
            this.frames = this.decodeRecordingData(this.recording.recordingData);
            console.log('Successfully decoded frames:', this.frames.length);
        } catch (error) {
            console.error('Failed to decode frames:', error);
            this.frames = [];
        }
        
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
    }

    async create() {
        // Load the map data
        await this.loadMapData();
        
        // Set up level dimensions
        if (this.mapData?.dimensions) {
            this.levelWidth = this.mapData.dimensions.width;
            this.levelHeight = this.mapData.dimensions.height;
        }
        
        // Set up camera and world bounds
        this.cameras.main.setBackgroundColor(0x333333);
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        
        // Create map elements
        this.createMapVisualization();
        
        // Create trail graphics for worm path
        this.trailGraphics = this.add.graphics();
        this.trailGraphics.setAlpha(0.3);
        
        // Create worm segments
        this.createWormSegments();
        
        // Set up camera to follow the worm head
        if (this.wormSegments.length > 0) {
            this.cameras.main.startFollow(this.wormSegments[0], true, 0.1, 0.1);
            this.cameras.main.setZoom(1.2);
        }
        
        // Start playback
        this.time.addEvent({
            delay: 16, // ~60fps
            callback: this.updatePlayback,
            callbackScope: this,
            loop: true
        });
        
        // Auto-play
        this.play();
    }

    private async loadMapData() {
        if (!this.recording.mapKey) {
            console.warn('No map key in recording');
            return;
        }
        
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

    private createMapVisualization() {
        if (!this.mapData) {
            // Draw a simple border if no map data
            const border = this.add.graphics();
            border.lineStyle(2, 0x4ecdc4, 0.3);
            border.strokeRect(0, 0, this.levelWidth, this.levelHeight);
            return;
        }
        
        // Create platforms
        if (this.mapData.platforms) {
            this.mapData.platforms.forEach((platform: any) => {
                this.createPlatform(platform);
            });
        }
        
        // Create entities
        if (this.mapData.entities) {
            this.createEntities(this.mapData.entities);
        }
        
        // Create boundaries
        this.createBoundaries();
    }

    private createPlatform(platformData: any) {
        const graphics = this.add.graphics();
        
        // Determine platform color based on type
        let fillColor = 0x4ecdc4; // Default cyan
        let strokeColor = 0x2e86ab;
        let alpha = 1;
        
        if (platformData.type === 'electric') {
            fillColor = 0xff6b6b; // Red for electric
            strokeColor = 0xc92a2a;
            this.electricPlatforms.push(graphics);
        } else if (platformData.type === 'blackhole') {
            fillColor = 0x495057; // Dark gray for blackhole
            strokeColor = 0x212529;
            this.blackholePlatforms.push(graphics);
        } else if (platformData.isStatic === false) {
            fillColor = 0x74c0fc; // Light blue for dynamic
            strokeColor = 0x339af0;
        }
        
        // Set styles
        graphics.fillStyle(fillColor, alpha);
        graphics.lineStyle(2, strokeColor, 1);
        
        // Draw based on shape
        if (platformData.shape === 'circle') {
            const radius = platformData.radius || 50;
            graphics.fillCircle(platformData.x, platformData.y, radius);
            graphics.strokeCircle(platformData.x, platformData.y, radius);
        } else if (platformData.shape === 'polygon' && platformData.vertices) {
            const points: number[] = [];
            platformData.vertices.forEach((vertex: any) => {
                points.push(vertex.x, vertex.y);
            });
            graphics.fillPoints(points);
            graphics.strokePoints(points);
        } else {
            // Rectangle (default)
            const width = platformData.width || 100;
            const height = platformData.height || 20;
            const x = (platformData.x || 0) - width / 2;
            const y = (platformData.y || 0) - height / 2;
            
            graphics.fillRect(x, y, width, height);
            graphics.strokeRect(x, y, width, height);
        }
        
        // Handle rotation if specified
        if (platformData.rotation) {
            graphics.setRotation(platformData.rotation);
        }
        
        this.platforms.push(graphics);
    }

    private createEntities(entities: any) {
        // Create goal/star
        if (entities.goal) {
            this.goal = this.add.graphics();
            this.goal.fillStyle(0xffd93d, 1);
            this.goal.lineStyle(3, 0xf59f00, 1);
            
            // Draw star shape
            const x = entities.goal.x;
            const y = entities.goal.y;
            const outerRadius = 30;
            const innerRadius = 15;
            const points = 5;
            
            const starPoints: number[] = [];
            for (let i = 0; i < points * 2; i++) {
                const angle = (Math.PI * i) / points - Math.PI / 2;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                starPoints.push(
                    x + Math.cos(angle) * radius,
                    y + Math.sin(angle) * radius
                );
            }
            
            this.goal.fillPoints(starPoints);
            this.goal.strokePoints(starPoints);
        }
        
        // Worm start position is in the recording frames
    }

    private createBoundaries() {
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x1a1a1a, 1);
        
        // Draw boundary walls
        graphics.strokeRect(-2, -2, this.levelWidth + 4, this.levelHeight + 4);
    }

    private createWormSegments() {
        // Calculate segment sizes (head is larger)
        const segmentCount = this.recording.segmentCount || 12;
        const baseRadius = 15;
        
        for (let i = 0; i < segmentCount; i++) {
            const radius = i === 0 ? baseRadius * 1.5 : baseRadius * (1 - i * 0.03);
            this.segmentRadii.push(radius);
            
            // Create segment visual
            const segment = this.add.circle(0, 0, radius, i === 0 ? 0xffeb3b : 0x4ecdc4);
            segment.setStrokeStyle(2, i === 0 ? 0xffd93d : 0x2e86ab);
            segment.setDepth(segmentCount - i); // Head on top
            
            this.wormSegments.push(segment);
        }
    }

    private decodeRecordingData(encodedData: string): any[] {
        console.log('Decoding recording data with encoding:', this.recording.encoding, 'compression:', this.recording.compression);
        console.log('Encoded data length:', encodedData?.length || 0);
        
        // For async decompression, we'll need to handle this differently
        // For now, start the async decompression
        this.startAsyncDecoding(encodedData);
        
        // Return empty array initially - frames will be loaded async
        return [];
    }
    
    private async startAsyncDecoding(encodedData: string) {
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
                    // Assume it's not actually compressed
                }
            }
            
            // Decode frames from buffer
            this.frames = this.decodeFramesFromBuffer(decompressedBuffer);
            console.log('Successfully decoded frames:', this.frames.length);
            
            // Start rendering if we have frames
            if (this.frames.length > 0) {
                this.renderFrame(0);
                
                // Position camera at start
                if (this.wormSegments.length > 0 && this.frames[0]?.segments?.length > 0) {
                    const startPos = this.frames[0].segments[0];
                    this.cameras.main.centerOn(startPos.x, startPos.y);
                }
            }
        } catch (error) {
            console.error('Failed to decode recording data:', error);
            this.frames = [];
        }
    }
    
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
    }

    public play() {
        this.isPlaying = true;
        this.lastUpdateTime = this.time.now;
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(true);
        }
    }

    public pause() {
        this.isPlaying = false;
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
    }

    public togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

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
                
                this.trailGraphics.lineStyle(2, 0x4ecdc4, 0.3);
                this.trailGraphics.moveTo(prevFrame.segments[0].x, prevFrame.segments[0].y);
                this.trailGraphics.lineTo(frame.segments[0].x, frame.segments[0].y);
                this.trailGraphics.strokePath();
            }
        }
    }

    public setPlaybackSpeed(speed: number) {
        this.playbackSpeed = speed;
    }

    public restart() {
        this.currentFrameIndex = 0;
        this.renderFrame(0);
        this.trailGraphics.clear();
        this.play();
    }
}