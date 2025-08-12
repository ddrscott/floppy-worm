import Phaser from 'phaser';
import Random from '../utils/Random.js';

export default class Sticker {
    constructor(scene, x, y, text, config = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.text = text;
        
        // Default configuration
        this.config = {
            fontSize: config.fontSize || 18,
            fontFamily: config.fontFamily || 'Arial',
            color: config.color || '#888888',
            backgroundColor: config.backgroundColor || null, // null = use scene background color
            backgroundAlpha: config.backgroundAlpha || 1,
            padding: config.padding || { x: 0, y: 0 },
            chamfer: config.chamfer || 16,
            strokeColor: config.strokeColor || 0x888888,
            strokeWidth: config.strokeWidth || 1,
            strokeAlpha: config.strokeAlpha || 0.5,
            depth: config.depth || -90, // Above grid (10) but below platforms (20)
            maxWidth: config.maxWidth || 240,
            wordWrap: config.wordWrap !== undefined ? config.wordWrap : true,
            align: config.align || 'center',
            ...config
        };
        
        // Create the container with rounded rect background and text
        this.createContainer();
        
        // Store original data for serialization
        this.data = {
            id: config.id || `sticker_${Date.now()}_${Random.random().toString(36).substr(2, 9)}`,
            x: x,
            y: y,
            text: text,
            config: this.config
        };
    }
    
    colorToHex(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }

    createContainer() {
        // Create container
        this.container = this.scene.add.container(this.x, this.y);
        this.container.setDepth(this.config.depth);
        
        // Create text first to measure bounds
        const style = {
            fontSize: this.config.fontSize,
            fontFamily: this.config.fontFamily,
            color: this.config.color,
            align: this.config.align,
            padding: this.config.chamfer // Use chamfer as padding to ensure text doesn't overlap corners
        };
        
        // Add word wrapping if enabled
        if (this.config.wordWrap && this.config.maxWidth) {
            style.wordWrap = {
                width: this.config.maxWidth - (this.config.padding.x * 2),
                useAdvancedWrap: true
            };
        }
        
        // Create the text object
        this.textObject = this.scene.add.text(0, 0, this.text, style);
        
        // Measure text bounds to size the background
        const textBounds = this.textObject.getBounds();
        const width = textBounds.width + (this.config.padding.x * 2);
        const height = textBounds.height + (this.config.padding.y * 2);
        
        // Get background color (use scene background if not specified)
        let bgColor = this.config.backgroundColor;
        if (bgColor === null) {
            bgColor = this.scene.game.config.backgroundColor.color;
        } else if (typeof bgColor === 'string' && bgColor.startsWith('#')) {
            bgColor = parseInt(bgColor.replace('#', '0x'));
        }
        
        // Create rounded rectangle background
        this.background = this.scene.add.graphics({
            fillStyle: {
                color: bgColor,
                alpha: this.config.backgroundAlpha
            },
            lineStyle: {
                width: this.config.strokeWidth,
                color: this.config.strokeColor,
                alpha: this.config.strokeAlpha
            }
        });
        
        // Draw rounded rectangle centered
        this.background.fillRoundedRect(-width/2, -height/2, width, height, this.config.chamfer);
        this.background.strokeRoundedRect(-width/2, -height/2, width, height, this.config.chamfer);
        
        // Position text centered
        this.textObject.setOrigin(0.5, 0.5);
        
        // Add to container
        this.container.add([this.background, this.textObject]);
        
        // Store reference back to this sticker
        this.container.stickerInstance = this;
        
        // Set up interactive hit area to match the background
        this.container.setSize(width, height);
        this.container.setInteractive();
    }
    
    // Update the text content
    setText(newText) {
        this.text = newText;
        this.data.text = newText;
        if (this.textObject) {
            this.textObject.setText(newText);
            // Recreate background to fit new text
            this.updateBackground();
        }
    }
    
    // Update the position
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.data.x = x;
        this.data.y = y;
        if (this.container) {
            this.container.setPosition(x, y);
        }
    }
    
    // Update background to fit current text
    updateBackground() {
        if (!this.background || !this.textObject) return;
        
        // Measure text bounds to size the background
        const textBounds = this.textObject.getBounds();
        const width = textBounds.width + (this.config.padding.x * 2);
        const height = textBounds.height + (this.config.padding.y * 2);
        
        // Get background color
        let bgColor = this.config.backgroundColor;
        if (bgColor === null) {
            bgColor = this.scene.game.config.backgroundColor.color;
        } else if (typeof bgColor === 'string' && bgColor.startsWith('#')) {
            bgColor = parseInt(bgColor.replace('#', '0x'));
        }
        
        // Clear and redraw
        this.background.clear();
        this.background.fillStyle(bgColor, this.config.backgroundAlpha);
        this.background.lineStyle(this.config.strokeWidth, this.config.strokeColor, this.config.strokeAlpha);
        this.background.fillRoundedRect(-width/2, -height/2, width, height, this.config.chamfer);
        this.background.strokeRoundedRect(-width/2, -height/2, width, height, this.config.chamfer);
    }
    
    // Update the style
    updateStyle(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.data.config = this.config;
        
        // Recreate the container with new style
        if (this.container) {
            this.container.destroy();
        }
        this.createContainer();
    }
    
    // Get bounds for collision detection
    getBounds() {
        if (this.container && this.background) {
            // Calculate bounds based on background size
            const textBounds = this.textObject.getBounds();
            const width = textBounds.width + (this.config.padding.x * 2);
            const height = textBounds.height + (this.config.padding.y * 2);
            return new Phaser.Geom.Rectangle(
                this.container.x - width/2,
                this.container.y - height/2,
                width,
                height
            );
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
        if (!this.container) return;
        
        if (enabled) {
            // Add a selection outline
            if (!this.selectionOutline) {
                const bounds = this.getBounds();
                this.selectionOutline = this.scene.add.graphics();
                this.selectionOutline.lineStyle(3, 0x00ff00, 1);
                this.selectionOutline.strokeRoundedRect(
                    bounds.x - 2, 
                    bounds.y - 2, 
                    bounds.width + 4, 
                    bounds.height + 4,
                    this.config.chamfer
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
        if (!this.container) return;
        
        if (enabled) {
            // Don't override if already interactive
            if (!this.container.input) {
                // Make container interactive with proper hit area
                const textBounds = this.textObject.getBounds();
                const width = textBounds.width + (this.config.padding.x * 2);
                const height = textBounds.height + (this.config.padding.y * 2);
                this.container.setSize(width, height);
                this.container.setInteractive(
                    new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
                    Phaser.Geom.Rectangle.Contains
                );
            }
        } else {
            this.container.disableInteractive();
        }
    }
    
    // Destroy the sticker
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
            this.textObject = null;
            this.background = null;
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
        return new Sticker(scene, data.x, data.y, data.text, { ...data.config });
    }
    
    // Get common sticker presets
    static getPresets() {
        return {
            tip: {
                fontSize: 16,
                color: '#00ff00',
                backgroundColor: 0x003200,
                backgroundAlpha: 0.8,
                strokeColor: 0x00aa00,
                strokeWidth: 1,
                strokeAlpha: 0.6
            },
            warning: {
                fontSize: 18,
                color: '#ffff00',
                backgroundColor: 0x323200,
                backgroundAlpha: 0.8,
                strokeColor: 0xaaaa00,
                strokeWidth: 1,
                strokeAlpha: 0.6
            },
            taunt: {
                fontSize: 20,
                color: '#ff6666',
                backgroundColor: 0x320000,
                backgroundAlpha: 0.8,
                strokeColor: 0xaa3333,
                strokeWidth: 1,
                strokeAlpha: 0.6
            },
            info: {
                fontSize: 16,
                color: '#66ccff',
                backgroundColor: 0x001932,
                backgroundAlpha: 0.8,
                strokeColor: 0x3388aa,
                strokeWidth: 1,
                strokeAlpha: 0.6
            },
            celebrate: {
                fontSize: 24,
                color: '#ffd700',
                backgroundColor: 0x322800,
                backgroundAlpha: 0.8,
                strokeColor: 0xcc9900,
                strokeWidth: 3,
                strokeAlpha: 0.7
            }
        };
    }
}
