import Phaser from 'phaser';
import WhooshSynthesizer from '../audio/WhooshSynthesizer.js';
import ZzfxSplatWrapper from '../audio/ZzfxSplatWrapper.js';
import Tick from '../utils/Tick.js';
import Random from '../utils/Random.js';

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
            segmentFrictionStatic: 10,
            segmentRestitution: 0.0001,
            linkConstraint: {
                angularStiffness: 0.1,
                stiffness: 1,
                damping: 0,
                length: 1,
                render: {
                    visible: true,
                }
            },
            spacingConstraint: {
                angularStiffness: 0.1,
                stiffness: 1,
                damping: 0,
                render: {
                    visible: true,
                }
            },
            surfaceConstraint: {
                stiffness: 0.01,
                damping: 0.2,
                length: 2,
                render: {
                    visible: true,
                },
                // Normal vector threshold for determining if a collision is "from above"
                // In Matter.js, Y coordinates increase downward, so:
                // - normal.y = -1.0 means collision from directly above (worm landing on top)
                // - normal.y = 0.0 means collision from the side
                // - normal.y = 1.0 means collision from below (worm hitting ceiling)
                // We use -0.3 as threshold to include slightly angled surfaces (slopes)
                normalThreshold: -0.5,
                // Maximum stretch factor before breaking constraint (e.g., 3.0 = break at 3x original length)
                maxStretchFactor: 5.0
            },
            // Audio configuration
            splatSound: {
                minVelocityThreshold: 10,    // Minimum velocity before playing splat sounds
                maxVelocityThreshold: 40,    // Maximum velocity for volume scaling
                cooldownMs: 50               // Minimum ms between splat sounds
            },
            showDebug: false,
            ...config
        };
        
        // Initialize collision tracking for stickiness system
        this.segmentCollisions = [];
        
        // Track surface constraints for better friction
        this.surfaceConstraints = new Map(); // segment -> constraint
        
        // Initialize audio system
        this.initializeAudio();
        
        // Initialize splat synthesizer for collision sounds
        this.initializeSplatSynthesizer();
        
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
                label: 'worm',
                friction: this.config.segmentFriction,
                frictionStatic: this.config.segmentFrictionStatic,
                frictionAir: this.config.airFriction || 0,
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
            segment.isWorm = true;
            
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
                ...this.config.linkConstraint,
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: radiusA + 1 },
                pointB: { x: 0, y: -radiusB - 1 },
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
                ...this.config.spacingConstraint,
                bodyA: segA,
                bodyB: segB,
                pointA: { x: 0, y: 0 },
                pointB: { x: 0, y: 0 },
                length: minDistance,
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
        
        // Clean up overstretched surface constraints
        this.cleanupOverstretchedConstraints();
        
        // Update audio based on flight physics
        this.updateAudio(delta);
    }

    updateMovement(delta) {
        console.error('WormBase.updateMovement() not implemented');
    }
    
    updateAudio(delta) {
        if (!this.whooshSynthesizer) {
            let synth = null;
            try {
                synth = new WhooshSynthesizer({
                    pitch: 1.1,
                    filterBase: 900,
                    resonance: 16.0,
                    lowBoost: 1,
                    reverb: 0.03,
                    swishFactor: 0.8
                });
                synth.start();
                this.whooshSynthesizer = synth;
            } catch (error) {
                return;
            }
        }
        
        if (!this.whooshSynthesizer) return;
        
        // Get head and tail segments for velocity tracking
        const head = this.getHead();
        const tail = this.getTail();
        
        // Calculate head and tail velocities
        const headVel = Math.sqrt(head.velocity.x ** 2 + head.velocity.y ** 2);
        const tailVel = Math.sqrt(tail.velocity.x ** 2 + tail.velocity.y ** 2);
        
        // Plot velocities on the scene as line charts with auto-scaling
        // Max velocity is around 48
        // Tick.push('head vel', headVel, 0xff6b6b); // Red for head velocity
        // Tick.push('tail vel', tailVel, 0x4ecdc4); // Cyan for tail velocity

        // Use maximum velocity of head/tail (whichever is moving faster creates the whoosh)
        const maxEndVelocity = Math.max(headVel, tailVel);
        
        // Apply velocity threshold and curve mapping
        const thresholdVel = Math.max(0, maxEndVelocity - this.audioState.volumeThreshold);
        const velocityRange = this.audioState.maxVelocity - this.audioState.volumeThreshold;
        
        // Prevent division by zero and ensure valid normalized value
        const normalizedVel = velocityRange > 0 ? thresholdVel / velocityRange : 0;

        // Smooth velocity curve (exponential for more dramatic effect)
        // Ensure the result is finite
        const velocityCurve = Number.isFinite(normalizedVel) ? 
            Math.pow(Math.min(1, normalizedVel), 1.4) : 0;
        
        // Calculate airborne ratio for gating (still useful to avoid ground scraping sounds)
        const airborneCount = this.segments.filter((_, i) => 
            !this.segmentCollisions[i].isColliding
        ).length;
        const airborneRatio = airborneCount / this.segments.length;
        
        // Volume: pure speed-based, gated by being somewhat airborne
        this.audioState.targetVolume = airborneRatio > 0.2 ? velocityCurve * 0.7 : 0;
        
        // Frequency: also pure speed-based (faster = higher pitch)
        this.audioState.targetFrequency = velocityCurve;
        
        // Smooth interpolation (tweening)
        const smoothing = this.audioState.smoothingFactor;
        this.audioState.currentVolume += (this.audioState.targetVolume - this.audioState.currentVolume) * smoothing;
        this.audioState.currentFrequency += (this.audioState.targetFrequency - this.audioState.currentFrequency) * smoothing;
        
        // Ensure values are finite before passing to synthesizer
        if (!Number.isFinite(this.audioState.currentVolume)) {
            this.audioState.currentVolume = 0;
        }
        if (!Number.isFinite(this.audioState.currentFrequency)) {
            this.audioState.currentFrequency = 0;
        }
        
        // Apply fade-out threshold to prevent tiny volume levels
        const finalVolume = this.audioState.currentVolume < 0.02 ? 0 : this.audioState.currentVolume;
        
        // Update the synthesizer with smoothed values
        this.whooshSynthesizer.update(finalVolume, this.audioState.currentFrequency);
    }
    
    initializeAudio() {
        // Audio will be initialized automatically on first update
        this.whooshSynthesizer = null;
        
        // Audio smoothing/tweening state
        this.audioState = {
            targetVolume: 0,
            currentVolume: 0,
            targetFrequency: 0, 
            currentFrequency: 0,
            smoothingFactor: 0.5, // How quickly audio follows physics (0-1)
            volumeThreshold: 10.0,  // Minimum velocity for audio to start
            maxVelocity: 30.0       // Velocity at which volume reaches maximum
        };
    }
    
    initializeSplatSynthesizer() {
        // Initialize splat synthesizer for collision sounds
        this.splatSynthesizer = null;
        this.lastSplatTime = 0;
    }
    
    playSplatSound(velocity = 10, mass = 0.1, surfaceHardness = 0.5) {
        // Use config values for minimum velocity and cooldown
        if (velocity < this.config.splatSound.minVelocityThreshold) {
            return;
        }
        
        // Check cooldown to prevent overwhelming mobile devices
        const now = Date.now();
        if (now - this.lastSplatTime < this.config.splatSound.cooldownMs) {
            return;
        }
        this.lastSplatTime = now;
        
        // Initialize synthesizer on first use
        if (!this.splatSynthesizer) {
            try {
                this.splatSynthesizer = new ZzfxSplatWrapper();
            } catch (error) {
                // Audio not available
                return;
            }
        }
        
        if (this.splatSynthesizer) {
            // Map velocity to volume multiplier (0.3 to 1.5 range)
            const velocityRange = this.config.splatSound.maxVelocityThreshold - this.config.splatSound.minVelocityThreshold;
            const normalizedVelocity = Math.min(1, Math.max(0, 
                (velocity - this.config.splatSound.minVelocityThreshold) / velocityRange
            ));
            const volumeMultiplier = 0.3 + normalizedVelocity * 1.2;
            
            this.splatSynthesizer.playSplat(volumeMultiplier);
        }
    }
    
    
    stopAudio() {
        if (this.whooshSynthesizer) {
            this.whooshSynthesizer.stop();
            this.whooshSynthesizer = null;
        }
    }
    
    retryAudioInit() {
        this.stopAudio();
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
                if (this.matter && this.matter.world) {
                    this.matter.world.remove(segment);
                }
            });
        }
        
        if (this.constraints) {
            this.constraints.forEach((constraint, index) => {
                if (this.matter && this.matter.world) {
                    this.matter.world.remove(constraint);
                }
            });
        }
        
        // Clean up compression springs
        if (this.compressionSprings) {
            this.compressionSprings.forEach((spring, index) => {
                if (this.matter && this.matter.world) {
                    this.matter.world.remove(spring);
                }
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
        
        // Clean up splat synthesizer
        if (this.splatSynthesizer) {
            this.splatSynthesizer.stopAll();
            this.splatSynthesizer = null;
        }
        
        // Clean up Tick helper
        Tick.clearAll();
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
            
            // Track collisions with both static and dynamic platforms
            // Skip other worm segments
            if (otherBody.label === 'worm' || otherBody.label === 'worm_anchor') return;
            
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
            
            // Check if colliding with ice platform
            const isIcePlatform = otherBody.isIcePlatform || false;
            
            // Update collision data
            this.segmentCollisions[segmentIndex] = {
                isColliding: true,
                contactPoint: contactPoint,
                surfaceBody: otherBody,
                surfaceNormal: normal,
                isOnIce: isIcePlatform
            };
            
            // Call platform's collision handler if it exists
            if (otherBody.platformInstance && typeof otherBody.platformInstance.onCollision === 'function') {
                otherBody.platformInstance.onCollision(segment, {
                    contactPoint: contactPoint,
                    normal: normal,
                    surfaceBody: otherBody
                });
            }
            
            // Create surface constraint for better friction (if not already exists)
            if (!this.surfaceConstraints.has(segment) && !otherBody.isSensor) {
                // Check if segment is roughly on top of surface (not hitting from side)
                // Using configurable threshold to determine what counts as "landing on top"
                const isOnTop = normal.y < this.config.surfaceConstraint.normalThreshold;
                
                if (isOnTop) {
                    // Get stiffness scale from platform (default to 1.0 if not set)
                    const stiffnessScale = otherBody.surfaceStiffnessScale || 1.0;
                    
                    // Apply scale to base stiffness
                    const adjustedStiffness = this.config.surfaceConstraint.stiffness * stiffnessScale;
                    
                    const constraint = this.scene.matter.add.constraint(
                        otherBody,
                        segment,
                        this.config.surfaceConstraint.length,
                        adjustedStiffness,
                        {
                            ...this.config.surfaceConstraint,
                            stiffness: adjustedStiffness, // Override with adjusted value
                            pointA: {
                                x: contactPoint.x - otherBody.position.x,
                                y: contactPoint.y - otherBody.position.y
                            },
                            pointB: {
                                x: contactPoint.x - segment.position.x,
                                y: contactPoint.y - segment.position.y
                            },
                            render: {
                                visible: true
                            }
                        }
                    );
                    
                    this.surfaceConstraints.set(segment, constraint);
                    
                    // Calculate collision properties for sound
                    const segmentVelocity = Math.sqrt(segment.velocity.x ** 2 + segment.velocity.y ** 2);
                    const segmentMass = segment.mass || 0.1;
                    const surfaceHardness = otherBody.surfaceHardness || 0.5; // Can be set on platforms
                    
                    Tick.push('segment velocity', segmentVelocity, 0xff6b6b);
                    // Play splat sound with collision properties
                    this.playSplatSound(segmentVelocity, segmentMass, surfaceHardness);
                }
            }
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
            
            // Skip other worm segments and anchors
            if (otherBody.label === 'worm' || otherBody.label === 'worm_anchor') return;
            
            // Call platform's collision end handler if it exists
            if (otherBody.platformInstance && typeof otherBody.platformInstance.onCollisionEnd === 'function') {
                otherBody.platformInstance.onCollisionEnd(segment, {
                    surfaceBody: otherBody
                });
            }
            
            // Remove surface constraint when collision ends
            const constraint = this.surfaceConstraints.get(segment);
            if (constraint) {
                this.scene.matter.world.remove(constraint);
                this.surfaceConstraints.delete(segment);
                
                // No sound on constraint removal to keep it minimal for mobile
            }
            
            // Clear collision data
            this.segmentCollisions[segmentIndex] = {
                isColliding: false,
                contactPoint: { x: 0, y: 0 },
                surfaceBody: null,
                surfaceNormal: { x: 0, y: 1 },
                isOnIce: false
            };
        });
    }
    
    cleanupOverstretchedConstraints() {
        // Maximum allowed constraint length before breaking
        const maxStretchFactor = this.config.surfaceConstraint.maxStretchFactor || 3.0;
        
        // Track constraints to remove
        const constraintsToRemove = [];
        
        this.surfaceConstraints.forEach((constraint, segment) => {
            if (!constraint || !constraint.bodyA || !constraint.bodyB) return;
            
            // Calculate current distance between constraint points
            const bodyA = constraint.bodyA;
            const bodyB = constraint.bodyB;
            
            // Get world positions of the constraint attachment points
            const pointAWorld = {
                x: bodyA.position.x + constraint.pointA.x,
                y: bodyA.position.y + constraint.pointA.y
            };
            
            const pointBWorld = {
                x: bodyB.position.x + constraint.pointB.x,
                y: bodyB.position.y + constraint.pointB.y
            };
            
            // Calculate current distance
            const currentDistance = Math.sqrt(
                Math.pow(pointAWorld.x - pointBWorld.x, 2) +
                Math.pow(pointAWorld.y - pointBWorld.y, 2)
            );
            
            // Check if constraint is overstretched
            const originalLength = constraint.length || this.config.surfaceConstraint.length;
            const maxAllowedLength = originalLength * maxStretchFactor;
            
            //Tick.push('currentDistance', currentDistance, 0xff6b6b);
            if (currentDistance > maxAllowedLength) {
                constraintsToRemove.push({ segment, constraint, distance: currentDistance });
            }
        });
        
        // Remove overstretched constraints
        constraintsToRemove.forEach(({ segment, constraint, distance }) => {
            // Calculate the contact point from the constraint attachment
            // Use the segment's attachment point (bodyB) as it's where the worm connects to the surface
            const contactX = segment.position.x + constraint.pointB.x;
            const contactY = segment.position.y + constraint.pointB.y;
            
            // Create a visual break effect at the contact point
            this.createConstraintBreakEffect(contactX, contactY);
            
            try {
                this.scene.matter.world.remove(constraint);
            } catch (e) {
                // Constraint might already be removed
            }
            
            this.surfaceConstraints.delete(segment);
            
            // Small splat sound when constraint breaks
            const breakIntensity = Math.min(30, distance * 2);
            this.playSplatSound(breakIntensity * 0.5, 0.05, 0.2); // Softer, wetter sound for breaks
            
            // Also clear collision data for this segment
            const segmentIndex = this.segments.indexOf(segment);
            if (segmentIndex !== -1 && this.segmentCollisions[segmentIndex]) {
                this.segmentCollisions[segmentIndex].isColliding = false;
            }
        });
    }
    
    cleanupCollisionDetection() {
        if (this.matter && this.matter.world) {
            this.matter.world.off('collisionstart', this.handleCollisionStart);
            this.matter.world.off('collisionend', this.handleCollisionEnd);
            
            // Remove all surface constraints
            this.surfaceConstraints.forEach(constraint => {
                try {
                    this.matter.world.remove(constraint);
                } catch (e) {
                    // Constraint might already be removed
                }
            });
            this.surfaceConstraints.clear();
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
    
    // Get segments on ice platforms in range
    getIceSegmentsInRange(startPercent, endPercent) {
        if (!this.segments || !this.segmentCollisions) return [];
        
        const { startIndex, endIndex } = this.getSegmentRange(startPercent, endPercent);
        const iceSegments = [];
        
        for (let i = startIndex; i < endIndex && i < this.segments.length; i++) {
            const collision = this.segmentCollisions[i];
            if (collision && collision.isColliding && collision.isOnIce) {
                iceSegments.push({
                    index: i,
                    segment: this.segments[i],
                    collision: collision
                });
            }
        }
        
        return iceSegments;
    }
    
    // Check if any segments in a range are on ice (for grab prevention)
    hasIceInRange(startPercent, endPercent) {
        return this.getIceSegmentsInRange(startPercent, endPercent).length > 0;
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
        setTimeout(() => {
            if (this.segments && this.segments.length > 0) {
                const middleIndex = Math.floor(this.segments.length / 2);
                const targetSegment = this.segments[middleIndex];
                
                if (targetSegment && targetSegment.position) {
                    const randomForceX = (Random.random() - 0.5) * 0.00002;
                    const randomForceY = (Random.random() - 0.5) * 0.00002;
                    
                    this.scene.matter.body.applyForce(targetSegment, targetSegment.position, {
                        x: randomForceX,
                        y: randomForceY
                    });
                }
            }
        }, 5);
    }
    
    // Create a visual effect when a surface constraint breaks
    createConstraintBreakEffect(x, y) {
        // TODO convert to particle emitter and make it looks like water splashing
        const numParticles = 6;
        const lightBlue = 0x00bfff; // Light blue color for particles
        for (let i = 0; i < numParticles; i++) {
            const particle = this.scene.add.circle(x, y, 1.5, lightBlue, 0.5);
            
            // Randomize the angle more for a natural scatter effect
            const baseAngle = (Math.PI * 2 * i) / numParticles;
            const angleVariation = (Random.random() - 0.5) * Math.PI / 3; // ±30 degrees variation
            const angle = baseAngle + angleVariation;
            
            // Randomize speed slightly
            const speed = 10 + Random.random() * 20; // 40-70 pixels
            
            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0.5,
                duration: 50 + Random.random() * 100, // 250-350ms
                ease: 'Power2',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }
}
