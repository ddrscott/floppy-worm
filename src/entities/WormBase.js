import Phaser from 'phaser';
import WhooshSynthesizer from '../audio/WhooshSynthesizer.js';

export default class WormBase {
    constructor(scene, x, y, config = {}) {
        this.scene = scene;
        this.matter = scene.matter;
        this.Matter = Phaser.Physics.Matter.Matter;
        
        // Default configuration for structure and appearance
        this.config = {
            baseRadius: 10,
            baseColor: 0xffa502,
            segmentSizes: [0.75, 1, 1, 0.90, 0.85, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            segmentDensity: 0.015,
            segmentFriction: 1,
            segmentFrictionStatic: 0.8,
            segmentRestitution: 0.0001,
            constraintStiffness: 0.8,
            constraintDamping: 0.2,
            constraintLength: 1,
            showDebug: true,
            ...config
        };
        
        // Initialize collision tracking for stickiness system
        this.segmentCollisions = [];
        
        // Initialize audio system
        this.initializeAudio();
        
        // Create the worm structure
        this.create(x, y);
        
        // Set up collision detection after segments are created
        this.setupCollisionDetection();
    }

    colorToHex(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }

    create(x, y) {
        const segments = [];
        const constraints = [];
        const segmentRadii = [];
        
        // Create segments with variable sizes
        let currentY = y;
        
        for (let i = 0; i < this.config.segmentSizes.length; i++) {
            const radius = this.config.baseRadius * this.config.segmentSizes[i];
            segmentRadii.push(radius);
            
            const segment = this.matter.add.circle(x, currentY, radius, {
                friction: this.config.segmentFriction,
                frictionStatic: this.config.segmentFrictionStatic,
                density: this.config.segmentDensity,
                restitution: this.config.segmentRestitution,
                slop: 0.01,
                render: {
                    fillStyle: '#' + this.getSegmentColor(i, this.config.segmentSizes.length).toString(16).padStart(6, '0'),
                    strokeStyle: '#' + this.getDarkerColor(this.getSegmentColor(i, this.config.segmentSizes.length)).toString(16).padStart(6, '0'),
                    lineWidth: 2,
                    visible: true,
                },
            });
            
            // Add visual circle using Phaser graphics
            const segmentGraphics = this.scene.add.graphics();
            segmentGraphics.fillStyle(this.getSegmentColor(i, this.config.segmentSizes.length), 1);
            segmentGraphics.lineStyle(2, this.getDarkerColor(this.getSegmentColor(i, this.config.segmentSizes.length)), 1);
            segmentGraphics.fillCircle(0, 0, radius);
            segmentGraphics.strokeCircle(0, 0, radius);
            
            segment.graphics = segmentGraphics;
            segments.push(segment);
            
            if (i < this.config.segmentSizes.length - 1) {
                const nextRadius = this.config.baseRadius * this.config.segmentSizes[i + 1];
                currentY += radius + nextRadius + 2;
            }
        }
        
        // Create connection dots at constraint points
        this.connectionDots = [];

        // Create main constraints between segments.
        // Prevents rotation and keeps segments aligned
        for (let i = 0; i < segments.length - 1; i++) {
            const segA = segments[i];
            const segB = segments[i + 1];
            const radiusA = segmentRadii[i];
            const radiusB = segmentRadii[i + 1];
            
            const constraint = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: radiusA + 1 },
                pointB: { x: 0, y: -radiusB - 1 },
                length: this.config.constraintLength,
                stiffness: this.config.constraintStiffness,
                damping: this.config.constraintDamping,
                render: {
                    visible: true,
                }
            });
            
            this.Matter.World.add(this.matter.world.localWorld, constraint);
            constraints.push(constraint);


            // Calculate connection point between segments
            const midX = (segA.position.x + segB.position.x) / 2;
            const midY = (segA.position.y + segB.position.y) / 2;
            
            // Create small dot graphics
            const dot = this.scene.add.graphics();
            dot.fillStyle(this.config.baseColor, 1); // Dark gray color
            dot.fillCircle(0, 0, this.config.baseRadius * 0.4); // Small dot
            dot.setPosition(midX, midY);
            
            this.connectionDots.push(dot);
        }
        
        this.compressionSprings = [];
        for (let i = 0; i < segments.length - 1; i++) {
            const segA = segments[i];
            const segB = segments[i + 1];
            const minDistance = segmentRadii[i] + segmentRadii[i + 1];
        
            const spacingConstraint = this.Matter.Constraint.create({
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: 0 },
                pointB: { x: 0, y: 0 },
                length: minDistance,
                stiffness: 0.005,
                damping: 0.9
            });
            this.compressionSprings.push(spacingConstraint);
        }
        this.Matter.World.add(this.matter.world.localWorld, this.compressionSprings);
        
        // Store references
        this.segments = segments;
        this.constraints = constraints;
        this.segmentRadii = segmentRadii;
        
        // Add small initial impulse to prevent perfectly stacked worms
        this.applyInitialImpulse();
    }
    
    update(delta) {
        
        this.updateMovement(delta);

        // Update segment graphics
        this.segments.forEach((segment) => {
            if (segment.graphics) {
                segment.graphics.x = segment.position.x;
                segment.graphics.y = segment.position.y;
            }
        });
        
        // Update connection dots positions
        this.connectionDots.forEach((dot, index) => {
            if (index < this.segments.length - 1) {
                const segA = this.segments[index];
                const segB = this.segments[index + 1];
                
                // Update dot position to stay between segments
                dot.x = (segA.position.x + segB.position.x) / 2;
                dot.y = (segA.position.y + segB.position.y) / 2;
            }
        });
        
        // Update audio based on flight physics
        this.updateAudio(delta);
    }

    updateMovement(delta) {
        console.error('WormBase.updateMovement() not implemented');
    }
    
    updateAudio(delta) {
        if (!this.whooshSynthesizer && !this.audioInitAttempted) {
            this.audioInitAttempted = true;
            try {
                this.whooshSynthesizer = new WhooshSynthesizer({
                    pitch: 0.8,
                    filterBase: 180,
                    resonance: 8.5,
                    lowBoost: 0.8,
                    reverb: 0.15
                });
                this.whooshSynthesizer.start();
            } catch (error) {
                // Audio initialization failed (likely no user interaction yet)
                return;
            }
        }
        
        if (!this.whooshSynthesizer) return;
        
        // Calculate airborne ratio (0-1)
        const airborneCount = this.segments.filter((_, i) => 
            !this.segmentCollisions[i].isColliding
        ).length;
        const airborneRatio = airborneCount / this.segments.length;
        
        // Calculate average velocity magnitude
        let totalVelocity = 0;
        this.segments.forEach(segment => {
            const vel = Math.sqrt(segment.velocity.x ** 2 + segment.velocity.y ** 2);
            totalVelocity += vel;
        });
        const avgVelocity = totalVelocity / this.segments.length;
        
        // Calculate volume (0-1): louder when airborne and fast
        const maxVelocity = 20; // Adjust based on typical worm speeds
        const velocityRatio = Math.min(avgVelocity / maxVelocity, 1);
        const volume = airborneRatio * velocityRatio * 0.8; // Cap at 80%
        
        // Calculate frequency (0-1): higher pitch for speed + height
        const head = this.getHead();
        const groundLevel = 600; // Adjust based on your scene
        const heightRatio = Math.max(0, Math.min(1, (groundLevel - head.position.y) / 400));
        const frequency = velocityRatio * 0.7 + heightRatio * 0.3;
        
        
        // Update the synthesizer
        this.whooshSynthesizer.update(volume, frequency);
    }
    
    initializeAudio() {
        // Audio will be initialized automatically on first update
        this.whooshSynthesizer = null;
        this.audioInitAttempted = false;
    }
    
    startAudio(audioSettings = {}) {
        if (!this.whooshSynthesizer) {
            this.whooshSynthesizer = new WhooshSynthesizer(audioSettings);
        }
        this.whooshSynthesizer.start();
    }
    
    stopAudio() {
        if (this.whooshSynthesizer) {
            this.whooshSynthesizer.stop();
            this.whooshSynthesizer = null;
        }
    }
    
    retryAudioInit() {
        // Reset the attempt flag so audio will try to initialize again
        this.audioInitAttempted = false;
    }
    
    // Utility methods
    getHead() {
        return this.segments[0];
    }
    
    getTail() {
        return this.segments[this.segments.length - 1];
    }
    
    // Color helpers
    getSegmentColor(index, total) {
        if (index === 0) return 0xff6b6b;
        else if (index < 3) return 0xffa502;
        else return 0xF2C40A;
    }
    
    getDarkerColor(color) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        return ((r * 0.8) << 16) | ((g * 0.8) << 8) | (b * 0.8);
    }
    
    // Configuration update methods
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Update existing constraints if needed
        if (this.segments) {
            this.segments.forEach((segment, i) => {
                segment.friction = this.config.segmentFriction;
                segment.frictionStatic = this.config.segmentFrictionStatic;
                segment.restitution = this.config.segmentRestitution;
                this.matter.body.setDensity(segment, this.config.segmentDensity);
            });
        }
        
        if (this.constraints) {
            // Update main constraints
            for (let i = 0; i < this.segments.length - 1 && i < this.constraints.length; i++) {
                this.constraints[i].stiffness = this.config.constraintStiffness;
                this.constraints[i].damping = this.config.constraintDamping;
                this.constraints[i].length = this.config.constraintLength;
            }
        }
    }
    
    // Update compression spring stiffness for dynamic body tension
    updateCompressionStiffness(newStiffness) {
        if (this.compressionSprings && Array.isArray(this.compressionSprings)) {
            this.compressionSprings.forEach(spring => {
                if (spring && typeof spring === 'object' && 'stiffness' in spring) {
                    spring.stiffness = newStiffness;
                }
            });
        }
    }
    
    // Cleanup
    destroy() {
        
        // Remove all bodies and constraints
        if (this.segments) {
            this.segments.forEach((segment, index) => {
                if (segment.graphics) {
                    segment.graphics.destroy();
                }
                this.matter.world.remove(segment);
            });
        }
        
        if (this.constraints) {
            this.constraints.forEach((constraint, index) => {
                this.matter.world.remove(constraint);
            });
        }
        
        // Clean up compression springs
        if (this.compressionSprings) {
            this.compressionSprings.forEach((spring, index) => {
                this.matter.world.remove(spring);
            });
        }
        
        // Clean up connection dots
        if (this.connectionDots) {
            this.connectionDots.forEach(dot => {
                if (dot) {
                    dot.destroy();
                }
            });
        }
        
        // Clean up collision detection
        this.cleanupCollisionDetection();
        
        // Clean up audio
        this.stopAudio();
    }
    
    // Collision Detection System for Stickiness
    setupCollisionDetection() {
        // Initialize collision data for each segment
        this.segmentCollisions = this.segments.map(() => ({
            isColliding: false,
            contactPoint: { x: 0, y: 0 },
            surfaceBody: null,
            surfaceNormal: { x: 0, y: 1 }
        }));
        
        // Set up Matter.js collision events
        this.matter.world.on('collisionstart', this.handleCollisionStart.bind(this));
        this.matter.world.on('collisionend', this.handleCollisionEnd.bind(this));
    }
    
    handleCollisionStart(event) {
        if (!this.segments) return;
        
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            
            // Check if one of the bodies is a worm segment
            const segmentIndex = this.segments.findIndex(seg => seg === bodyA || seg === bodyB);
            if (segmentIndex === -1) return;
            
            const segment = this.segments[segmentIndex];
            const otherBody = segment === bodyA ? bodyB : bodyA;
            
            // Only track collisions with static bodies (platforms, ground)
            if (!otherBody.isStatic) return;
            
            // Calculate contact point and surface normal
            const collision = pair.collision;
            // Use the first support point as the contact point
            const contactPoint = collision.supports && collision.supports.length > 0 ? 
                { x: collision.supports[0].x, y: collision.supports[0].y } :
                { x: segment.position.x, y: segment.position.y };
            
            // Surface normal points away from the static surface
            const normal = segment === bodyA ? 
                { x: collision.normal.x, y: collision.normal.y } : 
                { x: -collision.normal.x, y: -collision.normal.y };
            
            // Update collision data
            this.segmentCollisions[segmentIndex] = {
                isColliding: true,
                contactPoint: contactPoint,
                surfaceBody: otherBody,
                surfaceNormal: normal
            };
        });
    }
    
    handleCollisionEnd(event) {
        if (!this.segments) return;
        
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            
            // Check if one of the bodies is a worm segment
            const segmentIndex = this.segments.findIndex(seg => seg === bodyA || seg === bodyB);
            if (segmentIndex === -1) return;
            
            const segment = this.segments[segmentIndex];
            const otherBody = segment === bodyA ? bodyB : bodyA;
            
            // Only track static body collisions
            if (!otherBody.isStatic) return;
            
            // Clear collision data
            this.segmentCollisions[segmentIndex] = {
                isColliding: false,
                contactPoint: { x: 0, y: 0 },
                surfaceBody: null,
                surfaceNormal: { x: 0, y: 1 }
            };
        });
    }
    
    cleanupCollisionDetection() {
        if (this.matter && this.matter.world) {
            this.matter.world.off('collisionstart', this.handleCollisionStart);
            this.matter.world.off('collisionend', this.handleCollisionEnd);
        }
    }
    
    // Utility methods for segment range operations
    getSegmentRange(startPercent, endPercent) {
        if (!this.segments) return { startIndex: 0, endIndex: 0, count: 0 };
        
        const totalSegments = this.segments.length;
        const startIndex = Math.floor(totalSegments * startPercent);
        const endIndex = Math.floor(totalSegments * endPercent);
        const count = endIndex - startIndex;
        
        return { startIndex, endIndex, count };
    }
    
    getSegmentsInRange(startPercent, endPercent) {
        if (!this.segments) return [];
        
        const { startIndex, endIndex } = this.getSegmentRange(startPercent, endPercent);
        const segmentsInRange = [];
        
        for (let i = startIndex; i < endIndex && i < this.segments.length; i++) {
            segmentsInRange.push({
                index: i,
                segment: this.segments[i]
            });
        }
        
        return segmentsInRange;
    }
    
    // Utility method to get segments touching surfaces in a given range
    getTouchingSegments(startPercent, endPercent) {
        if (!this.segments || !this.segmentCollisions) return [];
        
        const { startIndex, endIndex } = this.getSegmentRange(startPercent, endPercent);
        const touchingSegments = [];
        
        for (let i = startIndex; i < endIndex && i < this.segments.length; i++) {
            if (this.segmentCollisions[i].isColliding) {
                touchingSegments.push({
                    index: i,
                    segment: this.segments[i],
                    collision: this.segmentCollisions[i]
                });
            }
        }
        
        return touchingSegments;
    }
    
    // Get segments with static body collisions in range (for ground detection)
    getGroundedSegmentsInRange(startPercent, endPercent) {
        if (!this.segments || !this.segmentCollisions) return [];
        
        const { startIndex, endIndex } = this.getSegmentRange(startPercent, endPercent);
        const groundedSegments = [];
        
        for (let i = startIndex; i < endIndex && i < this.segments.length; i++) {
            const collision = this.segmentCollisions[i];
            if (collision && collision.isColliding && collision.surfaceBody && collision.surfaceBody.isStatic) {
                groundedSegments.push({
                    index: i,
                    segment: this.segments[i],
                    collision: collision,
                    distanceFromStart: Math.abs(i - startIndex)
                });
            }
        }
        
        // Sort by distance from range start for better leverage
        groundedSegments.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
        
        return groundedSegments;
    }
    
    // Input processing utilities
    calculateStickMagnitude(stick) {
        return Math.sqrt(stick.x * stick.x + stick.y * stick.y);
    }
    
    normalizeStickDirection(stick) {
        const magnitude = this.calculateStickMagnitude(stick);
        if (magnitude === 0) return { x: 0, y: 0 };
        
        return {
            x: stick.x / magnitude,
            y: stick.y / magnitude
        };
    }
    
    applyInitialImpulse() {
        // Apply a small random force to prevent perfectly stacked worms
        // Use setTimeout to delay slightly (equivalent to scene.time.delayedCall)
        setTimeout(() => {
            if (this.segments && this.segments.length > 0) {
                const middleIndex = Math.floor(this.segments.length / 2);
                const targetSegment = this.segments[middleIndex];
                
                if (targetSegment && targetSegment.position) {
                    const randomForceX = (Math.random() - 0.5) * 0.004;
                    const randomForceY = (Math.random() - 0.5) * 0.002; // Smaller Y force to avoid too much vertical movement
                    
                    this.scene.matter.body.applyForce(targetSegment, targetSegment.position, {
                        x: randomForceX,
                        y: randomForceY
                    });
                    
                    console.log(`Applied initial impulse to worm: (${randomForceX.toFixed(6)}, ${randomForceY.toFixed(6)})`);
                }
            }
        }, 5); // 5ms delay, equivalent to the original scene timer
    }
}
