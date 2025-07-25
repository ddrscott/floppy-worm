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
        console.log(`PlatformBase.create() - ${this.constructor.name} at (${this.x}, ${this.y}) size: ${this.width}x${this.height} shape: ${this.config.shape} angle: ${this.config.angle}`);
        
        // Create container for all visual elements at the platform position
        this.container = this.scene.add.container(this.x, this.y);
        
        // Create visual representation based on shape (centered in container at 0,0)
        this.createVisualElements();
        
        // Create physics body (separate from container for flexible collision shapes)
        if (this.config.shape === 'circle') {
            this.body = this.scene.matter.add.circle(this.x, this.y, this.radius, {
                isStatic: true,
                friction: this.config.friction,
                restitution: this.config.restitution,
                density: this.config.density
            });
        } else {
            this.body = this.scene.matter.add.rectangle(this.x, this.y, this.width, this.height, {
                isStatic: true,
                friction: this.config.friction,
                restitution: this.config.restitution,
                density: this.config.density
            });
        }
        
        // Apply rotation if specified
        if (this.config.angle !== 0) {
            this.scene.matter.body.setAngle(this.body, this.config.angle);
            this.container.setRotation(this.config.angle);
        }
        
        // Initial sync of container to physics body
        this.syncVisualWithPhysics();
        
        // Store platform type for collision detection
        this.body.platformType = this.constructor.name;
        this.body.platformInstance = this;
    }
    
    createVisualElements() {
        // Create basic visual representation (can be overridden in subclasses)
        if (this.config.shape === 'circle') {
            this.graphics = this.scene.add.circle(
                0, 
                0, 
                this.radius, 
                this.config.color
            );
        } else {
            // Default to rectangle - using default origin (0.5, 0.5 for rectangles)
            this.graphics = this.scene.add.rectangle(
                0, 
                0, 
                this.width, 
                this.height, 
                this.config.color
            );
        }
        
        // Add stroke if specified
        if (this.config.strokeColor !== null) {
            this.graphics.setStrokeStyle(this.config.strokeWidth, this.config.strokeColor);
        }
        
        // Add main graphics to container
        this.container.add(this.graphics);
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
        // Keep visual container synchronized with physics body
        this.syncVisualWithPhysics();
        
        // Override in subclasses for dynamic behavior
    }
    
    // Synchronize visual container with physics body (source of truth)
    syncVisualWithPhysics() {
        if (this.container && this.body) {
            // Update container position to match physics body
            this.container.setPosition(this.body.position.x, this.body.position.y);
            
            // Update container rotation to match physics body
            this.container.setRotation(this.body.angle);
            
            // Debug logging for physics/visual misalignment
            const posDiff = Math.abs(this.body.position.x - this.container.x) + Math.abs(this.body.position.y - this.container.y);
            if (Math.abs(this.body.angle) > 0.01 || posDiff > 1) {
                // console.log(`Platform sync: Physics pos=(${this.body.position.x.toFixed(1)}, ${this.body.position.y.toFixed(1)}) angle=${this.body.angle.toFixed(3)}`);
                // console.log(`               Container pos=(${this.container.x.toFixed(1)}, ${this.container.y.toFixed(1)}) rotation=${this.container.rotation.toFixed(3)}`);
            }
        }
    }
    
    // Utility methods
    getPosition() {
        return { x: this.body.position.x, y: this.body.position.y };
    }
    
    setPosition(x, y) {
        console.log(`PlatformBase.setPosition(${x}, ${y}) called`);
        // Update physics body first (source of truth)
        this.scene.matter.body.setPosition(this.body, { x, y });
        console.log(`Physics body now at: (${this.body.position.x}, ${this.body.position.y})`);
        
        // Sync visual to physics
        this.syncVisualWithPhysics();
    }
    
    setAngle(angle) {
        // Update physics body first (source of truth)
        this.scene.matter.body.setAngle(this.body, angle);
        this.config.angle = angle;
        
        // Sync visual to physics
        this.syncVisualWithPhysics();
    }
    
    // Cleanup
    destroy() {
        if (this.container) {
            this.container.destroy();
        } else if (this.graphics) {
            this.graphics.destroy();
        }
        if (this.body && this.scene.matter && this.scene.matter.world) {
            this.scene.matter.world.remove(this.body);
        }
    }
}
