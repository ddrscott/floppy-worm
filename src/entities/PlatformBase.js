import Phaser from 'phaser';

export default class PlatformBase {
    constructor(scene, x, y, width, height, config = {}) {
        this.scene = scene;
        this.matter = scene.matter;
        this.Matter = Phaser.Physics.Matter.Matter;
        
        // Default configuration
        this.config = {
            color: 0x666666,
            friction: 1.0,
            restitution: 0.0,
            density: 1.0,
            angle: 0,
            strokeColor: null,
            strokeWidth: 2,
            shape: 'rectangle', // Default shape
            ...config
        };
        
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        
        // For circles, use width as diameter
        this.radius = this.width / 2;
        
        // Create the platform
        this.create();
        
        // Set up collision detection if needed
        this.setupCollisionDetection();
    }
    
    create() {
        // Debug logging
        console.log(`PlatformBase.create() - ${this.constructor.name} at (${this.x}, ${this.y}) size: ${this.width}x${this.height} shape: ${this.config.shape}`);
        
        // Create visual representation based on shape
        if (this.config.shape === 'circle') {
            this.graphics = this.scene.add.circle(
                this.x, 
                this.y, 
                this.radius, 
                this.config.color
            );
        } else {
            // Default to rectangle
            this.graphics = this.scene.add.rectangle(
                this.x, 
                this.y, 
                this.width, 
                this.height, 
                this.config.color
            );
        }
        
        // Add stroke if specified
        if (this.config.strokeColor !== null) {
            this.graphics.setStrokeStyle(this.config.strokeWidth, this.config.strokeColor);
        }
        
        // Create physics body based on shape using the same approach as regular platforms
        // This ensures coordinate system consistency
        if (this.config.shape === 'circle') {
            this.body = this.scene.matter.add.circle(this.x, this.y, this.radius, {
                isStatic: true,
                friction: this.config.friction,
                restitution: this.config.restitution,
                density: this.config.density
            });
        } else {
            // Default to rectangle
            this.body = this.scene.matter.add.rectangle(this.x, this.y, this.width, this.height, {
                isStatic: true,
                friction: this.config.friction,
                restitution: this.config.restitution,
                density: this.config.density
            });
        }
        
        // Apply rotation if specified
        if (this.config.angle !== 0) {
            this.body.setAngle(this.config.angle);
        }
        
        // Store platform type for collision detection
        this.body.platformType = this.constructor.name;
        this.body.platformInstance = this;
    }
    
    setupCollisionDetection() {
        // Override in subclasses for special collision behavior
    }
    
    // Handle collision with worm segment
    onCollision(segment, collision) {
        // Override in subclasses for special effects
    }
    
    // Handle collision end with worm segment
    onCollisionEnd(segment) {
        // Override in subclasses for cleanup
    }
    
    // Update method called each frame
    update(delta) {
        // Override in subclasses for dynamic behavior
    }
    
    // Utility methods
    getPosition() {
        return { x: this.body.position.x, y: this.body.position.y };
    }
    
    setPosition(x, y) {
        this.scene.matter.body.setPosition(this.body, { x, y });
        this.graphics.setPosition(x, y);
    }
    
    setAngle(angle) {
        this.body.setAngle(angle);
        this.config.angle = angle;
    }
    
    // Cleanup
    destroy() {
        if (this.graphics) {
            this.graphics.destroy();
        }
        if (this.body) {
            this.scene.matter.world.remove(this.body);
        }
    }
}