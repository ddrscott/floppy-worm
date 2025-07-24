import Phaser from 'phaser';

export default class Sticker {
    constructor(scene, x, y, text, config = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.text = text;
        
        // Default configuration
        this.config = {
            fontSize: config.fontSize || '18px',
            fontFamily: config.fontFamily || 'Arial, sans-serif',
            color: config.color || '#ffffff',
            backgroundColor: config.backgroundColor || 'rgba(0, 0, 0, 0.7)',
            padding: config.padding || { x: 8, y: 4 },
            borderRadius: config.borderRadius || 4,
            strokeColor: config.strokeColor || '#333333',
            strokeWidth: config.strokeWidth || 1,
            depth: config.depth || 15, // Above grid (10) but below platforms (20)
            maxWidth: config.maxWidth || 300,
            wordWrap: config.wordWrap !== undefined ? config.wordWrap : true,
            align: config.align || 'center',
            ...config
        };
        
        // Create the text object
        this.createTextObject();
        
        // Store original data for serialization
        this.data = {
            id: config.id || `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: x,
            y: y,
            text: text,
            config: this.config
        };
    }
    
    createTextObject() {
        // Create text style
        const style = {
            fontSize: this.config.fontSize,
            fontFamily: this.config.fontFamily,
            color: this.config.color,
            backgroundColor: this.config.backgroundColor,
            padding: this.config.padding,
            align: this.config.align
        };
        
        // Add word wrapping if enabled
        if (this.config.wordWrap && this.config.maxWidth) {
            style.wordWrap = {
                width: this.config.maxWidth,
                useAdvancedWrap: true
            };
        }
        
        // Add stroke if specified
        if (this.config.strokeColor && this.config.strokeWidth > 0) {
            style.stroke = this.config.strokeColor;
            style.strokeThickness = this.config.strokeWidth;
        }
        
        // Create the text object
        this.textObject = this.scene.add.text(this.x, this.y, this.text, style);
        this.textObject.setOrigin(0.5, 0.5); // Center the text
        this.textObject.setDepth(this.config.depth);
        
        // Store reference back to this sticker
        this.textObject.stickerInstance = this;
    }
    
    // Update the text content
    setText(newText) {
        this.text = newText;
        this.data.text = newText;
        if (this.textObject) {
            this.textObject.setText(newText);
        }
    }
    
    // Update the position
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.data.x = x;
        this.data.y = y;
        if (this.textObject) {
            this.textObject.setPosition(x, y);
        }
    }
    
    // Update the style
    updateStyle(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.data.config = this.config;
        
        // Recreate the text object with new style
        if (this.textObject) {
            this.textObject.destroy();
        }
        this.createTextObject();
    }
    
    // Get bounds for collision detection
    getBounds() {
        if (this.textObject) {
            return this.textObject.getBounds();
        }
        return new Phaser.Geom.Rectangle(this.x - 50, this.y - 10, 100, 20);
    }
    
    // Check if a point is within the sticker bounds
    containsPoint(x, y) {
        const bounds = this.getBounds();
        return Phaser.Geom.Rectangle.Contains(bounds, x, y);
    }
    
    // Highlight the sticker (for editor selection)
    setHighlight(enabled) {
        if (!this.textObject) return;
        
        if (enabled) {
            // Add a selection outline
            if (!this.selectionOutline) {
                const bounds = this.getBounds();
                this.selectionOutline = this.scene.add.graphics();
                this.selectionOutline.lineStyle(2, 0x00ff00, 1);
                this.selectionOutline.strokeRect(
                    bounds.x - 2, 
                    bounds.y - 2, 
                    bounds.width + 4, 
                    bounds.height + 4
                );
                this.selectionOutline.setDepth(this.config.depth + 1);
            }
        } else {
            // Remove selection outline
            if (this.selectionOutline) {
                this.selectionOutline.destroy();
                this.selectionOutline = null;
            }
        }
    }
    
    // Make the sticker interactive for dragging
    setInteractive(enabled = true) {
        if (!this.textObject) return;
        
        if (enabled) {
            this.textObject.setInteractive();
        } else {
            this.textObject.disableInteractive();
        }
    }
    
    // Destroy the sticker
    destroy() {
        if (this.textObject) {
            this.textObject.destroy();
            this.textObject = null;
        }
        if (this.selectionOutline) {
            this.selectionOutline.destroy();
            this.selectionOutline = null;
        }
    }
    
    // Serialize to JSON for saving
    toJSON() {
        return {
            id: this.data.id,
            x: this.data.x,
            y: this.data.y,
            text: this.data.text,
            config: this.data.config
        };
    }
    
    // Create from JSON data
    static fromJSON(scene, data) {
        return new Sticker(scene, data.x, data.y, data.text, { ...data.config, id: data.id });
    }
    
    // Get common sticker presets
    static getPresets() {
        return {
            tip: {
                fontSize: '16px',
                color: '#00ff00',
                backgroundColor: 'rgba(0, 50, 0, 0.8)',
                strokeColor: '#00aa00',
                strokeWidth: 1
            },
            warning: {
                fontSize: '18px',
                color: '#ffff00',
                backgroundColor: 'rgba(50, 50, 0, 0.8)',
                strokeColor: '#aaaa00',
                strokeWidth: 1
            },
            taunt: {
                fontSize: '20px',
                color: '#ff6666',
                backgroundColor: 'rgba(50, 0, 0, 0.8)',
                strokeColor: '#aa3333',
                strokeWidth: 1
            },
            info: {
                fontSize: '16px',
                color: '#66ccff',
                backgroundColor: 'rgba(0, 25, 50, 0.8)',
                strokeColor: '#3388aa',
                strokeWidth: 1
            },
            celebrate: {
                fontSize: '24px',
                color: '#ffd700',
                backgroundColor: 'rgba(50, 40, 0, 0.8)',
                strokeColor: '#cc9900',
                strokeWidth: 2
            }
        };
    }
}