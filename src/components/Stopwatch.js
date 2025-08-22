/**
 * Stopwatch - Pure logic component for time tracking
 * Emits events to the UI scene instead of rendering
 */
export default class Stopwatch {
    constructor(scene, options = {}) {
        this.scene = scene;
        
        // Default options
        this.options = {
            onPause: null,  // Callback for when pause is triggered
            ...options
        };
        
        this.startTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.pausedTime = 0;  // Accumulated time when paused
        this.bestTime = null;
    }
    
    start() {
        if (!this.isRunning) {
            // Reset elapsed time when starting fresh
            this.elapsedTime = 0;
            this.pausedTime = 0;
            this.startTime = Date.now();
            this.isRunning = true;
            this.isPaused = false;
        }
    }
    
    pause() {
        if (this.isRunning && !this.isPaused) {
            // Store the elapsed time up to this point
            this.pausedTime = this.elapsedTime;
            this.isPaused = true;
        }
    }
    
    resume() {
        if (this.isRunning && this.isPaused) {
            // Reset start time to now, but keep the accumulated pausedTime
            this.startTime = Date.now();
            this.isPaused = false;
        }
    }
    
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = false;
            return this.elapsedTime;
        }
        return this.elapsedTime;
    }
    
    reset() {
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.pausedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        // Emit event to reset UI
        this.scene.events.emit('ui-update-time', 0);
    }
    
    update() {
        if (this.isRunning && !this.isPaused) {
            // Calculate elapsed time as: time since last resume + accumulated paused time
            this.elapsedTime = (Date.now() - this.startTime) + this.pausedTime;
            // Emit event to update UI
            this.scene.events.emit('ui-update-time', this.elapsedTime);
        }
    }
    
    setBestTime(time) {
        this.bestTime = time;
        // Emit event to update UI
        this.scene.events.emit('ui-set-best', time);
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10); // Show centiseconds
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}