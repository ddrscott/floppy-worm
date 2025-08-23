import PlatformBase from './PlatformBase.js';

export default class DoorPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const doorConfig = {
            color: 0x808080,         // Gray base color
            strokeColor: 0x606060,   // Darker gray border
            strokeWidth: 3,
            friction: 0.8,
            restitution: 0.1,
            ...config
        };
        
        super(scene, x, y, width, height, doorConfig);
        
        // Door-specific properties
        this.doorId = config.doorId || config.switchId || 'default'; // Match switch ID
        this.slideDirection = config.slideDirection || 'up';
        this.slideDistance = config.slideDistance || Math.max(width, height) * 1.5;
        this.isOpen = false;
        this.isMoving = false;
        
        // Store original position - use the x,y passed to constructor
        this.closedPosition = { x: x, y: y };
        this.openPosition = this.calculateOpenPosition();
        
        // Visual indicator colors (matches switch colors)
        this.doorColor = this.getColorForId(this.doorId);
        this.indicatorColorOn = config.indicatorColorOn || this.doorColor;
        this.indicatorColorOff = config.indicatorColorOff || this.getDimColor(this.doorColor);
        
        // Create visual elements
        this.createDoorVisuals();
        
        // Listen for switch events
        this.setupSwitchListener();
    }
    
    getColorForId(id) {
        // Same color mapping as SwitchPlatform
        const colors = {
            'red': 0xff0000,
            'blue': 0x0000ff,
            'green': 0x00ff00,
            'yellow': 0xffff00,
            'purple': 0xff00ff,
            'cyan': 0x00ffff,
            'orange': 0xffa500,
            'pink': 0xff69b4,
            'default': 0x00ff00
        };
        
        return colors[id] || colors['default'];
    }
    
    getDimColor(color) {
        // Create a dimmed version of the color (about 40% brightness)
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        
        const dimR = Math.floor(r * 0.4);
        const dimG = Math.floor(g * 0.4);
        const dimB = Math.floor(b * 0.4);
        
        return (dimR << 16) | (dimG << 8) | dimB;
    }
    
    calculateOpenPosition() {
        const pos = { ...this.closedPosition };
        
        switch(this.slideDirection) {
            case 'up':
                pos.y -= this.slideDistance;
                break;
            case 'down':
                pos.y += this.slideDistance;
                break;
            case 'left':
                pos.x -= this.slideDistance;
                break;
            case 'right':
                pos.x += this.slideDistance;
                break;
        }
        
        return pos;
    }
    
    createDoorVisuals() {
        // Create direction arrow (now serves as the indicator)
        this.createDirectionArrow();
        
        // Add door pattern based on slide direction using the door's color
        // Vertical lines for up/down movement, horizontal for left/right
        const lineColor = this.getDimColor(this.doorColor); // Use dimmed door color for lines
        
        if (this.slideDirection === 'up' || this.slideDirection === 'down') {
            // Vertical lines for vertical movement
            const plankWidth = this.width / 5;
            for (let i = 1; i < 5; i++) {
                const line = this.scene.add.rectangle(
                    -this.width/2 + i * plankWidth,
                    0,
                    3,  // Slightly thicker lines
                    this.height * 0.9,
                    lineColor
                );
                line.setAlpha(0.4);  // Semi-transparent
                this.container.add(line);
            }
        } else {
            // Horizontal lines for horizontal movement
            const plankHeight = this.height / 5;
            for (let i = 1; i < 5; i++) {
                const line = this.scene.add.rectangle(
                    0,
                    -this.height/2 + i * plankHeight,
                    this.width * 0.9,
                    3,  // Slightly thicker lines
                    lineColor
                );
                line.setAlpha(0.4);  // Semi-transparent
                this.container.add(line);
            }
        }
        
        // Add label if provided
        if (this.config.label) {
            const label = this.scene.add.text(0, this.height/2 + 15, this.config.label, {
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            label.setOrigin(0.5, 0);
            this.container.add(label);
        }
    }
    
    createDirectionArrow() {
        const arrow = this.scene.add.graphics();
        
        // Use the door's color (dim when inactive)
        const arrowColor = this.indicatorColorOff;
        arrow.lineStyle(12, arrowColor, 0.5);  // Triple thick (was 4, now 12)
        
        // Draw arrow with shaft and head based on direction
        const shaftLength = Math.min(this.width, this.height) * 0.4;
        const arrowHeadSize = shaftLength * 0.4;
        
        switch(this.slideDirection) {
            case 'up':
                // Shaft
                arrow.moveTo(0, shaftLength/2);
                arrow.lineTo(0, -shaftLength/2);
                // Arrowhead
                arrow.moveTo(-arrowHeadSize/2, -shaftLength/2 + arrowHeadSize);
                arrow.lineTo(0, -shaftLength/2);
                arrow.lineTo(arrowHeadSize/2, -shaftLength/2 + arrowHeadSize);
                break;
            case 'down':
                // Shaft
                arrow.moveTo(0, -shaftLength/2);
                arrow.lineTo(0, shaftLength/2);
                // Arrowhead
                arrow.moveTo(-arrowHeadSize/2, shaftLength/2 - arrowHeadSize);
                arrow.lineTo(0, shaftLength/2);
                arrow.lineTo(arrowHeadSize/2, shaftLength/2 - arrowHeadSize);
                break;
            case 'left':
                // Shaft
                arrow.moveTo(shaftLength/2, 0);
                arrow.lineTo(-shaftLength/2, 0);
                // Arrowhead
                arrow.moveTo(-shaftLength/2 + arrowHeadSize, -arrowHeadSize/2);
                arrow.lineTo(-shaftLength/2, 0);
                arrow.lineTo(-shaftLength/2 + arrowHeadSize, arrowHeadSize/2);
                break;
            case 'right':
                // Shaft
                arrow.moveTo(-shaftLength/2, 0);
                arrow.lineTo(shaftLength/2, 0);
                // Arrowhead
                arrow.moveTo(shaftLength/2 - arrowHeadSize, -arrowHeadSize/2);
                arrow.lineTo(shaftLength/2, 0);
                arrow.lineTo(shaftLength/2 - arrowHeadSize, arrowHeadSize/2);
                break;
        }
        
        arrow.strokePath();
        
        this.arrow = arrow;
        this.container.add(arrow);
    }
    
    setupSwitchListener() {
        // Listen for switch toggle events
        this.scene.events.on('switch-toggled', this.handleSwitchToggle, this);
    }
    
    handleSwitchToggle(data) {
        // Check if this door responds to the switch
        if (data.switchId === this.doorId) {
            if (data.isActivated) {
                this.open();
            } else {
                this.close();
            }
        }
    }
    
    open() {
        if (this.isOpen || this.isMoving) return;
        
        this.isMoving = true;
        this.isOpen = true;
        
        // Update arrow color to active color
        this.updateArrowColor(true);
        
        // Create a temporary position object for animation
        const animPos = { x: this.closedPosition.x, y: this.closedPosition.y };
        
        // Animate door sliding open
        this.scene.tweens.add({
            targets: animPos,
            x: this.openPosition.x,
            y: this.openPosition.y,
            duration: 500,
            ease: 'Power2.inOut',
            onUpdate: () => {
                // Update physics body position during animation
                this.setPosition(animPos.x, animPos.y);
            },
            onComplete: () => {
                this.isMoving = false;
                
                // Play door open sound
                if (this.scene.registry.get('splatSynthesizer')) {
                    const splatSynth = this.scene.registry.get('splatSynthesizer');
                    splatSynth.playUIClick(0.3);
                }
            }
        });
        
        // Arrow is now bright when open, no need to fade
        
        console.log(`Door ${this.doorId} opening`);
    }
    
    close() {
        if (!this.isOpen || this.isMoving) return;
        
        this.isMoving = true;
        this.isOpen = false;
        
        // Update arrow color back to dim
        this.updateArrowColor(false);
        
        // Store the actual open position (in case it was modified)
        const currentPos = { x: this.body.position.x, y: this.body.position.y };
        
        // Animate door sliding closed
        this.scene.tweens.add({
            targets: currentPos,
            x: this.closedPosition.x,
            y: this.closedPosition.y,
            duration: 500,
            ease: 'Power2.inOut',
            onUpdate: () => {
                // Update physics body position during animation
                this.setPosition(currentPos.x, currentPos.y);
            },
            onComplete: () => {
                this.isMoving = false;
                // Play door close sound
                if (this.scene.registry.get('splatSynthesizer')) {
                    const splatSynth = this.scene.registry.get('splatSynthesizer');
                    splatSynth.playUIHover(0.3);
                }
            }
        });
        
        // Arrow color is already updated, no need for fade
        
        console.log(`Door ${this.doorId} closing`);
    }
    
    updateArrowColor(isActive) {
        if (!this.arrow) return;
        
        // Clear and redraw arrow with new color
        this.arrow.clear();
        
        const arrowColor = isActive ? this.indicatorColorOn : this.indicatorColorOff;
        const arrowAlpha = isActive ? 0.9 : 0.5;
        this.arrow.lineStyle(12, arrowColor, arrowAlpha);  // Triple thick to match creation
        
        // Redraw arrow with shaft and head based on direction
        const shaftLength = Math.min(this.width, this.height) * 0.4;
        const arrowHeadSize = shaftLength * 0.4;
        
        switch(this.slideDirection) {
            case 'up':
                // Shaft
                this.arrow.moveTo(0, shaftLength/2);
                this.arrow.lineTo(0, -shaftLength/2);
                // Arrowhead
                this.arrow.moveTo(-arrowHeadSize/2, -shaftLength/2 + arrowHeadSize);
                this.arrow.lineTo(0, -shaftLength/2);
                this.arrow.lineTo(arrowHeadSize/2, -shaftLength/2 + arrowHeadSize);
                break;
            case 'down':
                // Shaft
                this.arrow.moveTo(0, -shaftLength/2);
                this.arrow.lineTo(0, shaftLength/2);
                // Arrowhead
                this.arrow.moveTo(-arrowHeadSize/2, shaftLength/2 - arrowHeadSize);
                this.arrow.lineTo(0, shaftLength/2);
                this.arrow.lineTo(arrowHeadSize/2, shaftLength/2 - arrowHeadSize);
                break;
            case 'left':
                // Shaft
                this.arrow.moveTo(shaftLength/2, 0);
                this.arrow.lineTo(-shaftLength/2, 0);
                // Arrowhead
                this.arrow.moveTo(-shaftLength/2 + arrowHeadSize, -arrowHeadSize/2);
                this.arrow.lineTo(-shaftLength/2, 0);
                this.arrow.lineTo(-shaftLength/2 + arrowHeadSize, arrowHeadSize/2);
                break;
            case 'right':
                // Shaft
                this.arrow.moveTo(-shaftLength/2, 0);
                this.arrow.lineTo(shaftLength/2, 0);
                // Arrowhead
                this.arrow.moveTo(shaftLength/2 - arrowHeadSize, -arrowHeadSize/2);
                this.arrow.lineTo(shaftLength/2, 0);
                this.arrow.lineTo(shaftLength/2 - arrowHeadSize, arrowHeadSize/2);
                break;
        }
        
        this.arrow.strokePath();
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // Pulse effect for active arrow
        if (this.isOpen && this.arrow) {
            const pulse = Math.sin(time * 0.003) * 0.1 + 0.9;
            this.arrow.setAlpha(pulse);
        }
    }
    
    destroy() {
        // Remove event listener
        this.scene.events.off('switch-toggled', this.handleSwitchToggle, this);
        
        if (this.arrow) {
            this.arrow.destroy();
        }
        super.destroy();
    }
}
