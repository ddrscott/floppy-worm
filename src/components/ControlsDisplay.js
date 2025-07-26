export default class ControlsDisplay {
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Default options
        this.options = {
            showRecommendation: true,
            showZoom: false,
            worldSpace: true,
            textOptions: {
                fontSize: '14px',
                color: '#888888',
                backgroundColor: '#232333',
                borderColor: '#888888',
                padding: { x: 10, y: 5 },
                stroke: '#888888',
                strokeThickness: 0.5,
                lineSpacing: 6,
                fontFamily: 'Comic Sans'
            },
            ...options
        };
        
        this.create();
    }
    
    create() {
        const elements = [];
        
        // Controller recommendation
        if (this.options.showRecommendation) {
            const recommendation = this.scene.add.text(this.x, this.y, '🎮 Best played with a controller!', 
                this.options.textOptions
            );
            if (!this.options.worldSpace) recommendation.setScrollFactor(0);
            recommendation.setDepth(-50); // Place above grid (-100) but behind game objects
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
        const controls = this.scene.add.text(this.x, this.y + yOffset, controlsText, 
            this.options.textOptions
        );
        if (!this.options.worldSpace) controls.setScrollFactor(0);
        controls.setDepth(-50); // Place above grid (-100) but behind game objects
        
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
