export default class GhostRecorder {
    constructor(scene, segmentCount = 12) {
        this.scene = scene;
        this.segmentCount = segmentCount;
        this.frames = [];
        this.isRecording = false;
        this.startTime = null;
        this.frameInterval = 1000 / 60; // 60fps
        this.lastFrameTime = 0;
    }
    
    startRecording() {
        this.frames = [];
        this.isRecording = true;
        this.startTime = Date.now();
        this.lastFrameTime = 0;
    }
    
    stopRecording() {
        this.isRecording = false;
        return this.frames;
    }
    
    recordFrame(wormSegments, currentTime, inputState = null) {
        if (!this.isRecording || !wormSegments || wormSegments.length === 0) {
            return;
        }
        
        // Calculate elapsed time from start
        const elapsedTime = currentTime || (Date.now() - this.startTime);
        
        // Skip if not enough time has passed since last frame (maintain ~60fps)
        if (elapsedTime - this.lastFrameTime < this.frameInterval) {
            return;
        }
        
        // Record segment positions
        const segmentPositions = wormSegments.map(segment => ({
            x: segment.position.x,
            y: segment.position.y
        }));
        
        // Create frame data
        const frameData = {
            timestamp: Math.round(elapsedTime),
            segments: segmentPositions
        };
        
        // Add input state if provided (for new recordings)
        if (inputState) {
            frameData.input = {
                leftStick: { x: inputState.leftStick.x, y: inputState.leftStick.y },
                rightStick: { x: inputState.rightStick.x, y: inputState.rightStick.y },
                leftTrigger: inputState.leftTrigger,
                rightTrigger: inputState.rightTrigger
            };
        }
        
        this.frames.push(frameData);
        
        this.lastFrameTime = elapsedTime;
    }
    
    // Binary encoding methods
    encodeFrames(frames) {
        if (!frames || frames.length === 0) {
            return null;
        }
        
        // Check if we have input data (new format)
        const hasInputData = frames.length > 0 && frames[0].input !== undefined;
        
        // Calculate buffer size
        // v1 format: timestamp (4 bytes) + segments (8 bytes each)
        // v2 format: v1 + input data (16 bytes: 4 floats for sticks + 2 floats for triggers)
        const inputBytesPerFrame = hasInputData ? 24 : 0; // 4*4 for sticks + 2*4 for triggers
        const bytesPerFrame = 4 + (this.segmentCount * 8) + inputBytesPerFrame;
        const buffer = new ArrayBuffer(frames.length * bytesPerFrame);
        const view = new DataView(buffer);
        
        let offset = 0;
        frames.forEach(frame => {
            // Write timestamp (uint32, little-endian)
            view.setUint32(offset, frame.timestamp, true);
            offset += 4;
            
            // Write segment positions
            frame.segments.forEach(segment => {
                view.setFloat32(offset, segment.x, true);
                offset += 4;
                view.setFloat32(offset, segment.y, true);
                offset += 4;
            });
            
            // Write input data if present
            if (hasInputData && frame.input) {
                // Write stick positions (4 floats)
                view.setFloat32(offset, frame.input.leftStick.x, true);
                offset += 4;
                view.setFloat32(offset, frame.input.leftStick.y, true);
                offset += 4;
                view.setFloat32(offset, frame.input.rightStick.x, true);
                offset += 4;
                view.setFloat32(offset, frame.input.rightStick.y, true);
                offset += 4;
                
                // Write trigger values (2 floats)
                view.setFloat32(offset, frame.input.leftTrigger, true);
                offset += 4;
                view.setFloat32(offset, frame.input.rightTrigger, true);
                offset += 4;
            }
        });
        
        return buffer;
    }
    
    // Convert binary to base64 for storage
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192; // Process in chunks to avoid stack overflow
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }
    
    // Compress data using native compression API
    async compressData(buffer) {
        // Check if compression API is available
        if (typeof window === 'undefined' || !window.CompressionStream) {
            console.warn('CompressionStream not available, storing uncompressed');
            return this.arrayBufferToBase64(buffer);
        }
        
        try {
            const stream = new Blob([buffer]).stream();
            const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
            const compressedBlob = await new Response(compressedStream).blob();
            const compressedBuffer = await compressedBlob.arrayBuffer();
            
            return this.arrayBufferToBase64(compressedBuffer);
        } catch (error) {
            console.error('Compression failed:', error);
            // Fallback to uncompressed
            return this.arrayBufferToBase64(buffer);
        }
    }
    
    // Get recording data ready for storage
    async getRecordingData() {
        if (this.frames.length === 0) {
            return null;
        }
        
        const binaryData = this.encodeFrames(this.frames);
        const compressedData = await this.compressData(binaryData);
        
        // Check if we have input data to determine version
        const hasInputData = this.frames.length > 0 && this.frames[0].input !== undefined;
        
        return {
            frameCount: this.frames.length,
            duration: this.frames[this.frames.length - 1].timestamp,
            segmentCount: this.segmentCount,
            compression: (typeof window !== 'undefined' && window.CompressionStream) ? 'gzip' : 'none',
            encoding: hasInputData ? 'binary-v2' : 'binary-v1', // v2 includes input data
            data: compressedData,
            hasInputData: hasInputData // Explicit flag for easier checking
        };
    }
    
    // Reset recorder
    reset() {
        this.frames = [];
        this.isRecording = false;
        this.startTime = null;
        this.lastFrameTime = 0;
    }
}
