import Phaser from 'phaser';

export default class VirtualControls {
    constructor(scene) {
        this.scene = scene;
        this.joystick = null;
        this.jumpButton = null;
        this.jumpText = null;
        this.menuButton = null;
        this.cursorKeys = null;
        this.isJumpPressed = false;
        
        // Fixed control sizes for consistent experience
        this.JOYSTICK_RADIUS = 70;
        this.JUMP_BUTTON_RADIUS = 48;
        this.EDGE_MARGIN = 10;
        
        // Create controls if on mobile/touch device
        if (this.isTouchDevice()) {
            this.createControls();
            
            // Recreate controls on resize
            this.scene.scale.on('resize', () => {
                this.updatePositions();
            });
        }
    }
    
    isTouchDevice() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
    }
    
    createControls() {
        // Load the virtual joystick plugin
        const url = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js';
        this.scene.load.plugin('rexvirtualjoystickplugin', url, true);
        
        this.scene.load.once('complete', () => {
            this.setupControls();
        });
        
        this.scene.load.start();
    }
    
    setupControls() {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        
        // Create base and thumb graphics
        const baseColor = 0x888888;
        const thumbColor = 0xcccccc;
        
        // Create virtual joystick at fixed screen position
        this.joystick = this.scene.plugins.get('rexvirtualjoystickplugin').add(this.scene, {
            x: this.EDGE_MARGIN + this.JOYSTICK_RADIUS,
            y: height - this.JOYSTICK_RADIUS - this.EDGE_MARGIN,
            radius: this.JOYSTICK_RADIUS,
            base: this.scene.add.circle(0, 0, this.JOYSTICK_RADIUS, baseColor, 0.2)
                .setStrokeStyle(3, 0xffffff, 0.2),
            thumb: this.scene.add.circle(0, 0, this.JOYSTICK_RADIUS * 0.5, thumbColor, 0.5)
                .setStrokeStyle(2, 0xffffff, 0.5),
            dir: '8dir',
            forceMin: 16,
            enable: true
        });
        
        // Create cursor keys from joystick
        this.cursorKeys = this.joystick.createCursorKeys();
        
        // Create jump button
        const jumpX = width - this.EDGE_MARGIN - this.JOYSTICK_RADIUS;
        const jumpY = height - this.JOYSTICK_RADIUS - this.EDGE_MARGIN;
        
        this.jumpButton = this.scene.add.circle(jumpX, jumpY, this.JUMP_BUTTON_RADIUS, baseColor, 0.2)
            .setStrokeStyle(3, 0xffffff, 0.2)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(1000);
        
        this.jumpText = this.scene.add.text(jumpX, jumpY, 'JUMP', {
            fontSize: '22px',  // Fixed font size
            color: '#cccccc',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        
        // Jump button interactions
        this.jumpButton.on('pointerdown', () => {
            this.isJumpPressed = true;
            this.jumpButton.setScale(1.1).setAlpha(1);
            this.jumpText.setScale(1.1);
        });
        
        this.jumpButton.on('pointerup', () => {
            this.isJumpPressed = false;
            this.jumpButton.setScale(1).setAlpha(0.7);
            this.jumpText.setScale(1);
        });
        
        this.jumpButton.on('pointerout', () => {
            this.isJumpPressed = false;
            this.jumpButton.setScale(1).setAlpha(0.7);
            this.jumpText.setScale(1);
        });
        
        // Create menu button
        this.menuButton = this.scene.add.text(width - 60, 60, '☰', {
            fontSize: '28px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 15, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .setAlpha(0.8)
        .setScrollFactor(0)
        .setDepth(1000);
        
        this.menuButton.on('pointerdown', () => {
            this.menuButton.setScale(1.1).setAlpha(1);
        });
        
        this.menuButton.on('pointerup', () => {
            this.menuButton.setScale(1).setAlpha(0.8);
            this.scene.scene.start('MapSelectScene');
        });
        
        // Make joystick elements fixed to camera
        this.joystick.base.setScrollFactor(0).setDepth(1000);
        this.joystick.thumb.setScrollFactor(0).setDepth(1001);
    }
    
    updatePositions() {
        if (!this.joystick) return;
        
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        
        // Update joystick position
        this.joystick.setPosition(
            this.EDGE_MARGIN + this.JOYSTICK_RADIUS,
            height - this.EDGE_MARGIN - this.JOYSTICK_RADIUS
        );
        
        // Update jump button position
        const jumpX = width - this.EDGE_MARGIN - this.JOYSTICK_RADIUS;
        const jumpY = height - this.EDGE_MARGIN - this.JOYSTICK_RADIUS;
        this.jumpButton.setPosition(jumpX, jumpY);
        
        // Update jump text
        if (this.jumpText) {
            this.jumpText.setPosition(jumpX, jumpY);
        }
        
        // Update menu button position
        this.menuButton.setPosition(width - 60, 60);
    }
    
    // Get control states
    getLeftPressed() {
        return this.cursorKeys ? this.cursorKeys.left.isDown : false;
    }
    
    getRightPressed() {
        return this.cursorKeys ? this.cursorKeys.right.isDown : false;
    }
    
    getUpPressed() {
        return this.cursorKeys ? this.cursorKeys.up.isDown : false;
    }
    
    getDownPressed() {
        return this.cursorKeys ? this.cursorKeys.down.isDown : false;
    }
    
    getJumpPressed() {
        return this.isJumpPressed;
    }
    
    // Get joystick force (0-1)
    getForce() {
        return this.joystick ? this.joystick.force / this.joystick.radius : 0;
    }
    
    // Get joystick angle in degrees
    getAngle() {
        return this.joystick ? this.joystick.angle : 0;
    }
    
    
    destroy() {
        if (this.joystick) {
            this.joystick.base.destroy();
            this.joystick.thumb.destroy();
            this.joystick.destroy();
        }
        
        if (this.jumpButton) {
            this.jumpButton.destroy();
        }
        
        if (this.jumpText) {
            this.jumpText.destroy();
        }
        
        if (this.menuButton) {
            this.menuButton.destroy();
        }
        
        // Remove resize listener
        if (this.scene && this.scene.scale) {
            this.scene.scale.off('resize');
        }
    }
}
