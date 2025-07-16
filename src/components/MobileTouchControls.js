import Phaser from 'phaser';

export default class MobileTouchControls {
    constructor(scene) {
        this.scene = scene;
        this.buttons = {};
        this.activeButtons = new Set();
        this.buttonWidth = 48; // Standard touch target size
        
        // Create controls if on mobile/touch device
        if (this.isTouchDevice()) {
            this.createControls();
            
            // Recreate controls on resize
            this.scene.scale.on('resize', () => {
                this.destroyControls();
                this.createControls();
            });
        }
    }
    
    isTouchDevice() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
    }
    
    createControls() {
        // Use actual canvas size instead of config size
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const isPortrait = height > width * 1.2;
        
        // Control button style - adjust size for orientation
        const buttonStyle = {
            fontSize: isPortrait ? '32px' : '24px',
            color: '#ffffff',
            backgroundColor: isPortrait ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
            padding: isPortrait ? { x: 24, y: 20 } : { x: 18, y: 15 }
        };
        
        // D-pad style positioning - always anchor to edges
        const buttonSpacing = this.buttonWidth * 1.5;
        const edgeMargin = this.buttonWidth; // Margin from edges
        
        // Always position from edges
        const dpadX = edgeMargin; // Center of d-pad
        const dpadY = (height - 80);
        
        // Left button
        this.createButton('left', dpadX - buttonSpacing, dpadY, '◀', buttonStyle);
        
        // Up button (lift)
        this.createButton('up', dpadX, dpadY - buttonSpacing, '▲', buttonStyle);
        
        // Down button (flatten)
        this.createButton('down', dpadX, dpadY + buttonSpacing, '▼', buttonStyle);
        
        // Right button
        this.createButton('right', dpadX + buttonSpacing, dpadY, '▶', buttonStyle);
        
        // Jump button - always anchor to right edge
        const jumpX = width - edgeMargin;
        const jumpY = (height - 80);
        this.createButton('jump', jumpX, jumpY, 'JUMP', {
            fontSize: isPortrait ? '28px' : '20px',
            color: '#ffffff',
            backgroundColor: 'rgba(74, 144, 226, 0.7)',
            padding: isPortrait ? { x: 35, y: 30 } : { x: 25, y: 20 }
        });
        
        // Menu button - anchor to top-right corner
        this.createButton('menu', width - 60, 60, '☰', {
            fontSize: '28px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 15, y: 10 }
        });
        
        // Make all buttons fixed to camera
        Object.values(this.buttons).forEach(button => {
            button.setScrollFactor(0);
            button.setDepth(1000);
        });
    }
    
    createButton(key, x, y, text, style) {
        const button = this.scene.add.text(x, y, text, style)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: false })
            .setAlpha(0.6);
        
        // Add minimum touch area
        const hitArea = new Phaser.Geom.Rectangle(-this.buttonWidth/2, -this.buttonWidth/2, this.buttonWidth, this.buttonWidth);
        button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        // Visual feedback for touch
        button.on('pointerdown', () => {
            this.activeButtons.add(key);
            button.setAlpha(1);
            button.setScale(1.15);
            button.setTint(0xffff88);
        });
        
        button.on('pointerup', () => {
            this.activeButtons.delete(key);
            button.setAlpha(0.6);
            button.setScale(1);
            button.clearTint();
        });
        
        button.on('pointerout', () => {
            this.activeButtons.delete(key);
            button.setAlpha(0.6);
            button.setScale(1);
            button.clearTint();
        });
        
        this.buttons[key] = button;
    }
    
    isPressed(key) {
        return this.activeButtons.has(key);
    }
    
    update() {
        // Handle menu button
        if (this.isPressed('menu')) {
            this.activeButtons.delete('menu');
            this.scene.scene.start('LevelsScene');
        }
    }
    
    destroyControls() {
        Object.values(this.buttons).forEach(button => {
            button.destroy();
        });
        this.buttons = {};
        this.activeButtons.clear();
    }
    
    destroy() {
        this.destroyControls();
        // Remove resize listener
        if (this.scene && this.scene.scale) {
            this.scene.scale.off('resize');
        }
    }
}
