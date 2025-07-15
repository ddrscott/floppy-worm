import Phaser from 'phaser';

export default class CoordinateDisplay extends Phaser.GameObjects.Container {
    constructor(scene, x, y, config = {}) {
        super(scene, x, y);
        
        // Default configuration
        const defaultConfig = {
            backgroundColor: 0x000000,
            backgroundAlpha: 0.7,
            textColor: '#ffffff',
            fontSize: '14px',
            padding: 10,
            updateFrequency: 100 // milliseconds
        };
        
        this.config = { ...defaultConfig, ...config };
        
        // Create background
        this.background = scene.add.rectangle(0, 0, 100, 30, this.config.backgroundColor);
        this.background.setAlpha(this.config.backgroundAlpha);
        this.background.setOrigin(0, 0);
        this.add(this.background);
        
        // Create text
        this.coordText = scene.add.text(this.config.padding, this.config.padding, '(0, 0)', {
            fontSize: this.config.fontSize,
            color: this.config.textColor,
            fontFamily: 'monospace'
        });
        this.coordText.setOrigin(0, 0);
        this.add(this.coordText);
        
        // Add to scene
        scene.add.existing(this);
        
        // Make draggable
        this.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 30), Phaser.Geom.Rectangle.Contains);
        scene.input.setDraggable(this);
        
        // Update timer
        this.lastUpdate = 0;
        
        // Enable drag
        this.on('drag', (pointer, dragX, dragY) => {
            this.x = dragX;
            this.y = dragY;
        });
        
        // Initial update
        this.updateCoordinates();
    }
    
    updateCoordinates() {
        const worldX = Math.round(this.x);
        const worldY = Math.round(this.y);
        this.coordText.setText(`(${worldX}, ${worldY})`);
        
        // Adjust background size to fit text
        const textBounds = this.coordText.getBounds();
        this.background.setSize(
            textBounds.width + this.config.padding * 2,
            textBounds.height + this.config.padding * 2
        );
    }
    
    preUpdate(time, delta) {
        // Update coordinates at specified frequency
        if (time - this.lastUpdate > this.config.updateFrequency) {
            this.updateCoordinates();
            this.lastUpdate = time;
        }
    }
}