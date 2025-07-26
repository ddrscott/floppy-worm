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
            ...options
        };
        
        this.startTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.bestTime = null;
        
        this.create();
    }
    
    create() {
        // Create timer display
        this.timerText = this.scene.add.text(this.x, this.y, this.formatTime(0), {
            fontSize: this.options.fontSize,
            color: this.options.color,
            backgroundColor: this.options.backgroundColor,
            padding: this.options.padding
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);
        
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
            this.startTime = Date.now() - this.elapsedTime;
            this.isRunning = true;
        }
    }
    
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            return this.elapsedTime;
        }
        return this.elapsedTime;
    }
    
    reset() {
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.isRunning = false;
        this.updateDisplay();
    }
    
    update() {
        if (this.isRunning) {
            this.elapsedTime = Date.now() - this.startTime;
            this.updateDisplay();
        }
    }
    
    updateDisplay() {
        if (this.timerText) {
            this.timerText.setText(this.formatTime(this.elapsedTime));
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