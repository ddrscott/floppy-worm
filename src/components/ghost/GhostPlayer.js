export default class GhostPlayer {
    constructor(scene, segmentCount = 12) {
        this.scene = scene;
        this.segmentCount = segmentCount;
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.ghostSegments = [];
        this.visible = true;
        this.completionTime = 0;
        
        // Visual configuration
        this.segmentColors = [
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
            0x5b2c6f,
        ];
        this.alpha = 0.5;
    }
    
    // Decode base64 to array buffer
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes.buffer;
    }
    
    // Decompress data if compressed
    async decompressData(base64Data, compression) {
        const buffer = this.base64ToArrayBuffer(base64Data);
        
        if (compression === 'gzip' && typeof window !== 'undefined' && window.DecompressionStream) {
            try {
                const stream = new Blob([buffer]).stream();
                const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
                const decompressedBlob = await new Response(decompressedStream).blob();
                return await decompressedBlob.arrayBuffer();
            } catch (error) {
                console.error('Decompression failed:', error);
                return buffer; // Return as-is, might be uncompressed
            }
        }
        
        return buffer;
    }
    
    // Decode binary frames
    decodeFrames(buffer, frameCount, encoding = 'binary-v1') {
        const view = new DataView(buffer);
        const frames = [];
        
        // Determine bytes per frame based on encoding version
        const hasInputData = encoding === 'binary-v2';
        const inputBytesPerFrame = hasInputData ? 24 : 0; // 6 floats * 4 bytes
        const bytesPerFrame = 4 + (this.segmentCount * 8) + inputBytesPerFrame;
        
        console.log('Decoding frames:', {
            frameCount,
            segmentCount: this.segmentCount,
            encoding,
            hasInputData,
            bytesPerFrame,
            bufferSize: buffer.byteLength,
            expectedSize: frameCount * bytesPerFrame
        });
        
        let offset = 0;
        for (let i = 0; i < frameCount; i++) {
            // Read timestamp
            const timestamp = view.getUint32(offset, true);
            offset += 4;
            
            // Read segments
            const segments = [];
            for (let j = 0; j < this.segmentCount; j++) {
                const x = view.getFloat32(offset, true);
                offset += 4;
                const y = view.getFloat32(offset, true);
                offset += 4;
                segments.push({ x, y });
            }
            
            // Skip input data if present (we don't need it for ghost playback)
            if (hasInputData) {
                offset += 24; // Skip 6 floats (left stick x/y, right stick x/y, triggers l/r)
            }
            
            frames.push({ timestamp, segments });
        }
        
        console.log(`Decoded ${frames.length} frames, first timestamp: ${frames[0]?.timestamp}, last timestamp: ${frames[frames.length-1]?.timestamp}`);
        
        return frames;
    }
    
    // Load ghost data
    async loadGhostData(ghostData) {
        if (!ghostData || !ghostData.data) {
            console.warn('No ghost data to load');
            return false;
        }
        
        try {
            // Decompress and decode
            const decompressedBuffer = await this.decompressData(
                ghostData.data, 
                ghostData.compression
            );
            
            this.frames = this.decodeFrames(decompressedBuffer, ghostData.frameCount, ghostData.encoding);
            this.completionTime = ghostData.duration;
            this.currentFrameIndex = 0;
            
            // Create ghost visual segments
            this.createGhostSegments();
            
            // Position segments at first frame
            if (this.frames.length > 0 && this.frames[0].segments) {
                this.updateSegmentPositions(this.frames[0].segments);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load ghost data:', error);
            return false;
        }
    }
    
    createGhostSegments() {
        // Clean up existing segments
        this.destroyGhostSegments();
        
        // Create new ghost segments
        for (let i = 0; i < this.segmentCount; i++) {
            const radius = this.getSegmentRadius(i);
            const color = this.segmentColors[i] || this.segmentColors[this.segmentColors.length - 1];
            
            const segment = this.scene.add.graphics();
            // segment.fillStyle(color, this.alpha);
            segment.fillStyle(color, this.alpha);
            //segment.lineStyle(2, this.getDarkerColor(color), this.alpha);
            segment.lineStyle(2, color, 0.8);
            segment.fillCircle(0, 0, radius);
            segment.strokeCircle(0, 0, radius);
            segment.setDepth(-1); // Behind real worm
            segment.setVisible(this.visible);
            
            this.ghostSegments.push(segment);
        }
    }
    
    getSegmentRadius(index) {
        // Match the worm's segment sizes
        const baseRadius = 15;
        const sizes = [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8];
        return baseRadius * (sizes[index] || 0.8);
    }
    
    getDarkerColor(color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        return ((r * 0.7) << 16) | ((g * 0.7) << 8) | (b * 0.7);
    }
    
    start() {
        if (this.frames.length === 0) {
            console.warn('No frames to play');
            return;
        }
        
        this.isPlaying = true;
        this.currentFrameIndex = 0;
        
        // Position ghost at first frame
        const firstFrame = this.frames[0];
        if (firstFrame && firstFrame.segments) {
            this.updateSegmentPositions(firstFrame.segments);
        }
    }
    
    stop() {
        this.isPlaying = false;
    }
    
    reset() {
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.hideSegments();
    }
    
    update(elapsedTime) {
        if (!this.isPlaying || this.frames.length === 0) {
            return;
        }
        
        // Find the appropriate frame for current time
        let targetFrameIndex = this.currentFrameIndex;
        
        // Search forward for the right frame
        while (targetFrameIndex < this.frames.length - 1 &&
               this.frames[targetFrameIndex + 1].timestamp <= elapsedTime) {
            targetFrameIndex++;
        }
        
        // Search backward if we've gone too far (e.g., after reset)
        while (targetFrameIndex > 0 &&
               this.frames[targetFrameIndex].timestamp > elapsedTime) {
            targetFrameIndex--;
        }
        
        this.currentFrameIndex = targetFrameIndex;
        
        // Check if ghost has finished
        if (this.currentFrameIndex >= this.frames.length - 1) {
            this.hideSegments();
            return;
        }
        
        // Get current and next frame for interpolation
        const currentFrame = this.frames[this.currentFrameIndex];
        const nextFrame = this.frames[this.currentFrameIndex + 1];
        
        if (!nextFrame) {
            // Last frame, just show current positions
            this.updateSegmentPositions(currentFrame.segments);
            return;
        }
        
        // Calculate interpolation factor
        const frameDuration = nextFrame.timestamp - currentFrame.timestamp;
        const frameProgress = elapsedTime - currentFrame.timestamp;
        const t = Math.min(1, frameProgress / frameDuration);
        
        // Interpolate positions
        const interpolatedSegments = currentFrame.segments.map((segment, i) => {
            const nextSegment = nextFrame.segments[i];
            return {
                x: segment.x + (nextSegment.x - segment.x) * t,
                y: segment.y + (nextSegment.y - segment.y) * t
            };
        });
        
        this.updateSegmentPositions(interpolatedSegments);
    }
    
    updateSegmentPositions(segments) {
        segments.forEach((segment, i) => {
            if (this.ghostSegments[i]) {
                this.ghostSegments[i].x = segment.x;
                this.ghostSegments[i].y = segment.y;
                this.ghostSegments[i].setVisible(this.visible);
            }
        });
        
    }
    
    hideSegments() {
        this.ghostSegments.forEach(segment => {
            segment.setVisible(false);
        });
    }
    
    setVisible(visible) {
        this.visible = visible;
        if (!visible) {
            this.hideSegments();
        }
    }
    
    getProgress() {
        if (this.frames.length === 0) return 0;
        const lastFrame = this.frames[this.frames.length - 1];
        const currentFrame = this.frames[this.currentFrameIndex];
        return currentFrame.timestamp / lastFrame.timestamp;
    }
    
    destroyGhostSegments() {
        this.ghostSegments.forEach(segment => {
            segment.destroy();
        });
        this.ghostSegments = [];
    }
    
    destroy() {
        this.destroyGhostSegments();
        this.frames = [];
        this.isPlaying = false;
    }
}
