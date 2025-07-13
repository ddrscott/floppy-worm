// Movement animation keyframe system
// Saved for potential future use - this approach created too much curling/rolling behavior

class MovementAnimator {
    constructor() {
        this.keyframes = this.createDefaultKeyframes();
        this.currentKeyframeIndex = 0;
        this.keyframeProgress = 0;
        this.isPlaying = false;
        this.segmentDelays = [];
        this.segmentStates = [];
    }
    
    createDefaultKeyframes() {
        return [
            {
                name: 'idle',
                duration: 100,
                easing: 'linear',
                segments: [
                    // Define physics for specific segment ranges
                    {
                        range: [0, 13],  // All segments
                        physics: {
                            torqueMultiplier: 0,  // No active torque in idle
                            constraintLengthRatio: 1.0,
                            constraintStiffness: 0.8,
                            frictionMultiplier: 1.0
                        }
                    }
                ]
            },
            {
                name: 'prepare',
                duration: 300,
                easing: 'easeOut',
                segments: [
                    {
                        range: [0, 0],  // Head - stays grounded
                        physics: {
                            torqueMultiplier: 0,  // No rotation for head
                            constraintLengthRatio: 1.0,
                            constraintStiffness: 0.9,
                            frictionMultiplier: 3.0  // High friction anchor
                        }
                    },
                    {
                        range: [1, 3],  // Neck - winds back
                        physics: {
                            torqueMultiplier: -0.1,  // Very gentle backward tilt
                            constraintLengthRatio: 0.95,  // Minimal compression
                            constraintStiffness: 0.9,
                            frictionMultiplier: 0.8  // Some friction
                        },
                        cascadeDelay: 20  // Per-segment delay
                    },
                    {
                        range: [4, 8],  // Body - moderate compression
                        physics: {
                            torqueMultiplier: -0.1,  // Very slight tilt
                            constraintLengthRatio: 0.9,  // Gentle compression
                            constraintStiffness: 0.85,
                            frictionMultiplier: 1.5
                        },
                        cascadeDelay: 30
                    },
                    {
                        range: [9, 12],  // Tail - anchors
                        physics: {
                            torqueMultiplier: 0.1,
                            constraintLengthRatio: 0.95,
                            constraintStiffness: 0.7,
                            frictionMultiplier: 2.0  // High friction for anchor
                        },
                        cascadeDelay: 40
                    }
                ]
            },
            {
                name: 'plant',
                duration: 200,
                easing: 'easeIn',
                segments: [
                    {
                        range: [0, 0],  // Head
                        physics: {
                            torqueMultiplier: 0.05,  // Slight forward lean
                            constraintLengthRatio: 1.0,
                            constraintStiffness: 0.95,
                            frictionMultiplier: 3.0
                        }
                    },
                    {
                        range: [1, 3],  // Neck - strong plant
                        physics: {
                            torqueMultiplier: 0.15,  // Gentle forward push
                            constraintLengthRatio: 1.05,  // Minimal extension
                            constraintStiffness: 0.95,
                            frictionMultiplier: 5.0  // Maximum grip for push
                        },
                        cascadeDelay: 10
                    },
                    {
                        range: [4, 8],  // Body
                        physics: {
                            torqueMultiplier: 0.2,  // Gentle follow
                            constraintLengthRatio: 1.05,  // Slight extension
                            constraintStiffness: 0.9,
                            frictionMultiplier: 3.0  // Good grip
                        },
                        cascadeDelay: 20
                    },
                    {
                        range: [9, 12],  // Tail - release anchor
                        physics: {
                            torqueMultiplier: 0.3,
                            constraintLengthRatio: 1.05,
                            constraintStiffness: 0.8,
                            frictionMultiplier: 0.3  // Low friction to follow
                        },
                        cascadeDelay: 30
                    }
                ]
            },
            {
                name: 'pull',
                duration: 400,
                easing: 'easeInOut',
                segments: [
                    {
                        range: [0, 0],  // Head - low friction to slide
                        physics: {
                            torqueMultiplier: 0.02,  // Nearly level
                            constraintLengthRatio: 1.0,
                            constraintStiffness: 0.7,
                            frictionMultiplier: 0.4  // Low but not too low
                        }
                    },
                    {
                        range: [1, 3],  // Neck - maintains grip
                        physics: {
                            torqueMultiplier: 0.1,  // Slight hold
                            constraintLengthRatio: 1.1,  // Still extended
                            constraintStiffness: 0.85,
                            frictionMultiplier: 4.0  // Strong grip anchor
                        },
                        cascadeDelay: 0
                    },
                    {
                        range: [4, 12],  // Body & tail - follows
                        physics: {
                            torqueMultiplier: 0.05,  // Very gentle follow
                            constraintLengthRatio: 1.02,  // Nearly relaxed
                            constraintStiffness: 0.7,
                            frictionMultiplier: 0.5  // Low friction to slide forward
                        },
                        cascadeDelay: 40
                    }
                ]
            },
            {
                name: 'follow',
                duration: 300,
                easing: 'easeOut',
                segments: [
                    {
                        range: [0, 12],  // All segments return to normal
                        physics: {
                            torqueMultiplier: 0.02,  // Gentle settling
                            constraintLengthRatio: 1.0,
                            constraintStiffness: 0.8,
                            frictionMultiplier: 1.2  // Normal friction
                        },
                        cascadeDelay: 50
                    }
                ]
            }
        ];
    }
    
    start(segmentCount) {
        this.isPlaying = true;
        this.currentKeyframeIndex = 0;
        this.keyframeProgress = 0;
        
        // Initialize segment states
        this.segmentStates = Array(segmentCount).fill(null).map(() => ({
            keyframeIndex: 0,
            progress: 0,
            delayRemaining: 0
        }));
    }
    
    stop() {
        this.isPlaying = false;
        // Reset to idle state immediately
        this.currentKeyframeIndex = 0;
        this.keyframeProgress = 0;
        // Clear all segment states
        this.segmentStates.forEach(state => {
            state.keyframeIndex = 0;
            state.progress = 0;
            state.delayRemaining = 0;
        });
    }
    
    update(deltaTime, segmentCount) {
        if (!this.isPlaying) return;
        
        const currentKeyframe = this.keyframes[this.currentKeyframeIndex];
        const nextKeyframeIndex = (this.currentKeyframeIndex + 1) % this.keyframes.length;
        const nextKeyframe = this.keyframes[nextKeyframeIndex];
        
        // Update main timeline
        this.keyframeProgress += deltaTime;
        
        // Check if we should advance to next keyframe
        if (this.keyframeProgress >= currentKeyframe.duration) {
            this.currentKeyframeIndex = nextKeyframeIndex;
            this.keyframeProgress = 0;
            
            // Reset segment delays based on segment ranges
            for (let i = 0; i < segmentCount; i++) {
                // Find which segment definition this belongs to
                let cascadeDelay = 0;
                let baseDelay = 0;
                
                for (const segDef of nextKeyframe.segments) {
                    if (i >= segDef.range[0] && i <= segDef.range[1]) {
                        cascadeDelay = segDef.cascadeDelay || 0;
                        // Calculate delay within the range
                        const positionInRange = i - segDef.range[0];
                        baseDelay = positionInRange * cascadeDelay;
                        break;
                    }
                }
                
                this.segmentStates[i].delayRemaining = baseDelay;
            }
        }
        
        // Update each segment's individual state
        for (let i = 0; i < segmentCount; i++) {
            const state = this.segmentStates[i];
            
            // Handle cascade delay
            if (state.delayRemaining > 0) {
                state.delayRemaining -= deltaTime;
                continue;
            }
            
            // Update segment's keyframe progress
            if (state.keyframeIndex !== this.currentKeyframeIndex) {
                state.keyframeIndex = this.currentKeyframeIndex;
                state.progress = 0;
            }
            
            state.progress = Math.min(state.progress + deltaTime, currentKeyframe.duration);
        }
    }
    
    getSegmentPhysics(segmentIndex, baseValues) {
        if (!this.isPlaying || segmentIndex >= this.segmentStates.length) {
            // Return relaxed/idle physics when not playing
            return {
                torque: 0,  // No torque when relaxed
                constraintLength: baseValues.constraintLength,
                constraintStiffness: baseValues.constraintStiffness * 0.8,  // Slightly looser when idle
                friction: baseValues.friction * 0.5  // Lower friction for natural flopping
            };
        }
        
        const state = this.segmentStates[segmentIndex];
        const keyframe = this.keyframes[state.keyframeIndex];
        const nextKeyframeIndex = (state.keyframeIndex + 1) % this.keyframes.length;
        const nextKeyframe = this.keyframes[nextKeyframeIndex];
        
        // Find which segment definition applies to this segment
        const findSegmentPhysics = (kf, index) => {
            for (const segDef of kf.segments) {
                if (index >= segDef.range[0] && index <= segDef.range[1]) {
                    return segDef.physics;
                }
            }
            // Fallback to first segment definition if not found
            return kf.segments[0].physics;
        };
        
        const currentPhysics = findSegmentPhysics(keyframe, segmentIndex);
        const nextPhysics = findSegmentPhysics(nextKeyframe, segmentIndex);
        
        // Calculate interpolation progress
        const t = this.easeProgress(state.progress / keyframe.duration, keyframe.easing);
        
        // Interpolate physics values
        return {
            torque: this.lerp(currentPhysics.torqueMultiplier, nextPhysics.torqueMultiplier, t) * baseValues.torqueStrength,
            constraintLength: this.lerp(currentPhysics.constraintLengthRatio, nextPhysics.constraintLengthRatio, t) * baseValues.constraintLength,
            constraintStiffness: this.lerp(currentPhysics.constraintStiffness, nextPhysics.constraintStiffness, t),
            friction: this.lerp(currentPhysics.frictionMultiplier, nextPhysics.frictionMultiplier, t) * baseValues.friction
        };
    }
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    easeProgress(t, easing) {
        switch (easing) {
            case 'linear':
                return t;
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return t * (2 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            default:
                return t;
        }
    }
}

// Export for potential future use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementAnimator;
}