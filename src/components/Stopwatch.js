export default class Stopwatch {
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Default options
        this.options = {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 },
            showBestTime: true,
            onPause: null,  // Callback for when pause is triggered
            ...options
        };
        
        this.startTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.pausedTime = 0;  // Accumulated time when paused
        this.bestTime = null;
        
        this.create();
    }
    
    create() {
        // Create timer display with pause icon
        this.timerText = this.scene.add.text(this.x, this.y, '⏸ ' + this.formatTime(0), {
            fontSize: this.options.fontSize,
            color: this.options.color,
            backgroundColor: this.options.backgroundColor,
            padding: this.options.padding
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);
        
        // Make timer clickable for pause
        this.timerText.setInteractive({ useHandCursor: true });
        this.timerText.on('pointerdown', () => {
            if (this.options.onPause) {
                this.options.onPause();
            }
        });
        
        // Create best time display if enabled
        if (this.options.showBestTime) {
            this.bestTimeText = this.scene.add.text(this.x, this.y + 35, '', {
                fontSize: '16px',
                color: '#ffd700',
                backgroundColor: this.options.backgroundColor,
                padding: { x: 10, y: 3 }
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);
            
            this.updateBestTimeDisplay();
        }
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
        this.updateDisplay();
    }
    
    update() {
        if (this.isRunning && !this.isPaused) {
            // Calculate elapsed time as: time since last resume + accumulated paused time
            this.elapsedTime = (Date.now() - this.startTime) + this.pausedTime;
            this.updateDisplay();
        }
    }
    
    updateDisplay() {
        if (this.timerText) {
            this.timerText.setText('⏸ ' + this.formatTime(this.elapsedTime));
        }
    }
    
    updateBestTimeDisplay() {
        if (this.bestTimeText && this.bestTime !== null) {
            this.bestTimeText.setText(`Best: ${this.formatTime(this.bestTime)}`);
        }
    }
    
    setBestTime(time) {
        this.bestTime = time;
        this.updateBestTimeDisplay();
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10); // Show centiseconds
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    destroy() {
        if (this.timerText) this.timerText.destroy();
        if (this.bestTimeText) this.bestTimeText.destroy();
    }
}