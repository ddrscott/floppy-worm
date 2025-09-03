import GhostRecorder from '../components/ghost/GhostRecorder';
import GhostPlayer from '../components/ghost/GhostPlayer';
import GhostStorage from '../components/ghost/GhostStorage';

/**
 * GhostSystemManager - Manages ghost recording and playback for speedrun competitions
 * 
 * This system handles:
 * - Recording player movements during gameplay
 * - Loading and playing back best run ghosts
 * - Saving ghost data when new best times are achieved
 * - UI indicators for ghost racing
 */
export default class GhostSystemManager {
    constructor(scene, mapKey, mapData) {
        this.scene = scene;
        this.mapKey = mapKey;
        this.mapData = mapData;
        
        // Core components
        this.recorder = null;
        this.player = null;
        this.storage = new GhostStorage();
        
        // State
        this.visible = true;
        this.indicator = null;
    }
    
    /**
     * Initialize the ghost system
     * @param {Object} worm - The worm entity to record
     * @returns {Promise<void>}
     */
    async initialize(worm) {
        // Initialize recorder
        const segmentCount = worm ? worm.segments.length : 12;
        this.recorder = new GhostRecorder(this.scene, segmentCount);
        this.recorder.startRecording();
        
        // Try to load existing ghost
        const ghostData = await this.storage.loadGhost(this.mapKey, this.mapData);
        if (ghostData) {
            console.log('Ghost data loaded:', {
                segmentCount: ghostData.segmentCount,
                frameCount: ghostData.frameCount,
                duration: ghostData.duration,
                completionTime: ghostData.completionTime,
                dataLength: ghostData.data?.length
            });
            
            const loadedSegmentCount = ghostData.segmentCount || 12;
            this.player = new GhostPlayer(this.scene, loadedSegmentCount);
            const loaded = await this.player.loadGhostData(ghostData);
            
            if (loaded && this.player.frames && this.player.frames.length > 0) {
                console.log(`Ghost loaded successfully with ${this.player.frames.length} frames, time: ${this.formatTime(ghostData.completionTime)}`);
                // Create ghost indicator UI
                this.createIndicator(ghostData.completionTime);
                return true;
            } else {
                console.error('Failed to load ghost data into player');
                this.player = null;
            }
        }
        return false;
    }
    
    /**
     * Start ghost playback (call after stopwatch starts)
     */
    startPlayback() {
        if (this.player && this.player.frames && this.player.frames.length > 0) {
            console.log('Starting ghost player with', this.player.frames.length, 'frames');
            this.player.start();
        }
    }
    
    /**
     * Record a frame of ghost data
     * @param {Array} segments - Worm segments to record
     * @param {number} elapsedTime - Current elapsed time
     * @param {Object} inputState - Current input state
     */
    recordFrame(segments, elapsedTime, inputState) {
        if (this.recorder && this.recorder.isRecording && segments) {
            this.recorder.recordFrame(segments, elapsedTime, inputState);
        }
    }
    
    /**
     * Update ghost playback
     * @param {number} elapsedTime - Current elapsed time
     */
    updatePlayback(elapsedTime) {
        if (this.player) {
            this.player.update(elapsedTime);
        }
    }
    
    /**
     * Stop recording and get the data
     * @returns {Promise<Object>} Recording data
     */
    async stopRecording() {
        if (this.recorder && this.recorder.isRecording) {
            this.recorder.stopRecording();
        }
        return this.recorder ? await this.recorder.getRecordingData() : null;
    }
    
    /**
     * Save ghost if it's the best time
     * @param {number} completionTime - Time to complete the level
     * @param {Object} recordingData - Optional pre-existing recording data
     * @returns {Promise<boolean>} True if saved
     */
    async saveIfBest(completionTime, recordingData = null) {
        if (!this.recorder || !this.storage) {
            return false;
        }
        
        // Check if this is the best time
        if (!this.storage.shouldSaveGhost(this.mapKey, completionTime)) {
            return false;
        }
        
        // Use provided recording data or get it from recorder
        if (!recordingData) {
            recordingData = await this.stopRecording();
        }
        
        if (recordingData) {
            await this.storage.saveGhost(
                this.mapKey,
                this.mapData,
                recordingData,
                completionTime
            );
            return true;
        }
        return false;
    }
    
    /**
     * Toggle ghost visibility
     */
    toggle() {
        this.visible = !this.visible;
        
        if (this.player) {
            this.player.setVisible(this.visible);
        }
        
        // Show feedback
        const text = this.scene.add.text(this.scene.scale.width / 2, 80, 
            this.visible ? 'Ghost ON' : 'Ghost OFF', {
            fontSize: '20px',
            color: this.visible ? '#9b59b6' : '#e74c3c',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        if (this.scene.minimap) {
            this.scene.minimap.ignore(text);
        }
        
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });
    }
    
    /**
     * Create ghost indicator UI
     * @param {number} ghostTime - The ghost's completion time
     */
    createIndicator(ghostTime) {
        // Emit event to show ghost indicator in UI
        this.scene.events.emit('ui-show-ghost', ghostTime);
        
        // Auto-hide after a few seconds
        this.scene.time.delayedCall(5000, () => {
            this.scene.events.emit('ui-hide-ghost');
        });
    }
    
    /**
     * Format time for display
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Clean up the ghost system
     */
    destroy() {
        if (this.recorder) {
            this.recorder.reset();
            this.recorder = null;
        }
        
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }
    }
}