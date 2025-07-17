export default class ControlsDisplay {
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Default options
        this.options = {
            showRecommendation: true,
            showZoom: false,
            fontSize: '14px',
            titleFontSize: '16px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 10, y: 8 },
            lineSpacing: 4,
            ...options
        };
        
        this.create();
    }
    
    create() {
        const elements = [];
        
        // Controller recommendation
        if (this.options.showRecommendation) {
            const recommendation = this.scene.add.text(this.x, this.y, '🎮 Best played with a controller!', {
                fontSize: this.options.titleFontSize,
                color: '#ffd700',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: { x: 10, y: 5 }
            }).setScrollFactor(0);
            elements.push(recommendation);
        }
        
        // Control mapping
        const controlLines = [
            'Controls:',
            '─────────',
            'WASD: Head control (Left stick)',
            '↑←↓→: Tail control (Right stick)', 
            'Space/L2: Head jump',
            '/ or R2: Tail jump'
        ];
        
        if (this.options.showZoom) {
            controlLines.push('Scroll: Zoom');
        }
        
        controlLines.push('ESC: Menu');
        
        const controlsText = controlLines.join('\n');
        
        const yOffset = this.options.showRecommendation ? 40 : 0;
        const controls = this.scene.add.text(this.x, this.y + yOffset, controlsText, {
            fontSize: this.options.fontSize,
            color: '#ffffff',
            backgroundColor: this.options.backgroundColor,
            padding: this.options.padding,
            lineSpacing: this.options.lineSpacing
        }).setScrollFactor(0);
        
        elements.push(controls);
        
        // Store references for potential cleanup
        this.elements = elements;
    }
    
    destroy() {
        this.elements.forEach(element => element.destroy());
    }
    
    setVisible(visible) {
        this.elements.forEach(element => element.setVisible(visible));
    }
}