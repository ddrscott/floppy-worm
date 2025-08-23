import PlatformBase from './PlatformBase.js';

export default class SwitchPlatform extends PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        const switchConfig = {
            color: 0x808080,         // Gray base color
            strokeColor: 0x606060,   // Darker gray border
            strokeWidth: 2,
            friction: 0.8,
            restitution: 0.1,
            ...config
        };
        
        super(scene, x, y, width, height, switchConfig);
        
        // Switch-specific properties
        this.switchId = config.switchId || 'default';
        this.isActivated = false;
        this.toggleMode = config.toggleMode !== false; // Default to toggle mode
        this.lastToggleTime = 0;
        this.toggleCooldown = 100; // 100ms cooldown between toggles
        
        // Visual indicator colors
        this.switchColor = this.getColorForId(this.switchId);
        this.indicatorColorOn = config.indicatorColorOn || this.switchColor;
        this.indicatorColorOff = config.indicatorColorOff || this.getDimColor(this.switchColor);
        
        // Button visual properties
        this.buttonHeight = Math.min(height * 0.3, 15);
        this.buttonPressed = false;
        
        // Create visual elements
        this.createSwitchVisuals();
        
        // Track colliding bodies for toggle behavior
        this.collidingBodies = new Set();
    }
    
    getColorForId(id) {
        // Generate consistent colors for different switch IDs
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
    
    createSwitchVisuals() {
        // Get the actual switch color for this ID
        const switchColor = this.getColorForId(this.switchId);
        
        // Create button on top of platform using switch color (dim initially)
        this.button = this.scene.add.rectangle(
            0,
            -this.height/2 - this.buttonHeight/2,
            this.width * 0.8,
            this.buttonHeight,
            switchColor  // Use switch color
        );
        this.button.setStrokeStyle(2, switchColor);
        this.button.setAlpha(0.6);  // Start with reduced opacity
        this.container.add(this.button);
        
        // Create indicator dot
        const indicatorRadius = Math.min(this.width, this.height) * 0.15;
        this.indicator = this.scene.add.circle(
            0,
            0,
            indicatorRadius,
            this.indicatorColorOff
        );
        this.indicator.setStrokeStyle(2, 0x303030);
        this.container.add(this.indicator);
        
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
    
    onCollision(segment, collision) {
        // Check if collision is from above (worm falling on switch)
        const fromAbove = collision.normal.y > 0.5;
        
        if (fromAbove && !this.collidingBodies.has(segment)) {
            this.collidingBodies.add(segment);
            
            if (this.toggleMode) {
                // Toggle mode: switch state on each new collision
                if (this.collidingBodies.size === 1) {
                    this.toggleSwitch();
                }
            } else {
                // Pressure mode: activate while pressed
                this.activateSwitch();
            }
        }
    }
    
    onCollisionEnd(segment) {
        this.collidingBodies.delete(segment);
        
        if (!this.toggleMode && this.collidingBodies.size === 0) {
            // Pressure mode: deactivate when nothing is pressing
            this.deactivateSwitch();
        }
    }
    
    toggleSwitch() {
        // Check cooldown to prevent rapid re-triggering
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastToggleTime < this.toggleCooldown) {
            return; // Still in cooldown period
        }
        
        this.lastToggleTime = currentTime;
        
        if (this.isActivated) {
            this.deactivateSwitch();
        } else {
            this.activateSwitch();
        }
    }
    
    activateSwitch() {
        if (!this.isActivated) {
            // For pressure mode, also check cooldown
            const currentTime = this.scene.time.now;
            if (!this.toggleMode && currentTime - this.lastToggleTime < this.toggleCooldown) {
                return; // Still in cooldown period
            }
            
            this.isActivated = true;
            this.lastToggleTime = currentTime;
            this.updateVisuals();
            this.emitSwitchEvent();
            
            // Play activation sound
            if (this.scene.registry.get('splatSynthesizer')) {
                const splatSynth = this.scene.registry.get('splatSynthesizer');
                splatSynth.playUIClick(0.3);
            }
        }
    }
    
    deactivateSwitch() {
        if (this.isActivated) {
            // For pressure mode, also check cooldown
            const currentTime = this.scene.time.now;
            if (!this.toggleMode && currentTime - this.lastToggleTime < this.toggleCooldown) {
                return; // Still in cooldown period
            }
            
            this.isActivated = false;
            this.lastToggleTime = currentTime;
            this.updateVisuals();
            this.emitSwitchEvent();
            
            // Play deactivation sound
            if (this.scene.registry.get('splatSynthesizer')) {
                const splatSynth = this.scene.registry.get('splatSynthesizer');
                splatSynth.playUIHover(0.3);
            }
        }
    }
    
    updateVisuals() {
        // Update button position (pressed or released) and color
        const buttonY = this.isActivated ? 
            -this.height/2 - this.buttonHeight/4 : 
            -this.height/2 - this.buttonHeight/2;
        
        // Update button color and brightness
        const buttonColor = this.isActivated ? this.indicatorColorOn : this.indicatorColorOff;
        const buttonAlpha = this.isActivated ? 1.0 : 0.6;
        
        this.button.setFillStyle(buttonColor);
        this.button.setStrokeStyle(2, buttonColor);
        
        this.scene.tweens.add({
            targets: this.button,
            y: buttonY,
            alpha: buttonAlpha,
            duration: 100,
            ease: 'Power2'
        });
        
        // Update indicator color
        this.indicator.setFillStyle(
            this.isActivated ? this.indicatorColorOn : this.indicatorColorOff
        );
        
        // Add glow effect when activated
        if (this.isActivated) {
            this.indicator.setScale(1.2);
            this.scene.tweens.add({
                targets: this.indicator,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Back.easeOut'
            });
        }
    }
    
    emitSwitchEvent() {
        // Emit event for doors to listen to
        this.scene.events.emit('switch-toggled', {
            switchId: this.switchId,
            isActivated: this.isActivated,
            position: { x: this.x, y: this.y }
        });
        
        console.log(`Switch ${this.switchId} ${this.isActivated ? 'activated' : 'deactivated'}`);
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // Pulse effect for active indicator
        if (this.isActivated && this.indicator) {
            const pulse = Math.sin(time * 0.003) * 0.1 + 1;
            this.indicator.setAlpha(0.8 + pulse * 0.2);
        } else if (this.indicator) {
            this.indicator.setAlpha(1);
        }
    }
    
    destroy() {
        if (this.button) {
            this.button.destroy();
        }
        if (this.indicator) {
            this.indicator.destroy();
        }
        super.destroy();
    }
}