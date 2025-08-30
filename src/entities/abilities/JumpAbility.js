import BaseAbility from './BaseAbility';

export default class JumpAbility extends BaseAbility {
    constructor(worm, config = {}) {
        super(worm, config);
        
        // Trigger threshold for activation
        this.triggerThreshold = config.triggerThreshold || 0.01;
        
        // Compression spring parameters
        this.baseCompressionStiffness = config.baseCompressionStiffness || 0.05;
        this.maxCompressionStiffness = config.maxCompressionStiffness || 0.7;
        this.compressionTriggerSensitivity = config.compressionTriggerSensitivity || 1.0;
        
        // Lattice spring configuration
        this.latticeEnabled = config.latticeEnabled !== false;
        
        // Lattice configurations with shared defaults
        const latticeDefaults = {
            baseStiffness: 0.0001,
            activeStiffness: 0.9,
            damping: 0.2,
            lengthMultiplier: 1.1,
        };
        
        this.latticeConfigs = {
            head: config.latticeHead || {
                ...latticeDefaults,
                pairs: [
                    [0, 4],
                    [1, 5],
                    [2, 6],
                    [3, 7],
                    [4, 8],
                ],
                color: '#ff6b6b'
            },
            tail: config.latticeTail || {
                ...latticeDefaults,
                pairs: [
                    [3, 7],
                    [4, 8],
                    [5, 9],
                    [6, 10],
                    [7, 11],
                ],
                color: '#74b9ff'
            }
        };
        
        // Colors for head/tail (passed from parent config)
        this.headColor = this.worm.config.headColor || 0xff6b6b;
        this.tailColor = this.worm.config.tailColor || 0x74b9ff;
        
        // Storage for lattice springs
        this.latticeSprings = {
            head: [],
            tail: []
        };
        
        // Initialize lattice springs if enabled
        if (this.latticeEnabled) {
            this.initializeLattice();
        }
    }
    
    onActivate() {
        // Re-initialize lattice if it was destroyed
        if (this.latticeEnabled && this.latticeSprings.head.length === 0 && this.latticeSprings.tail.length === 0) {
            this.initializeLattice();
        }
    }
    
    onDeactivate() {
        // Clean up lattice springs
        this.destroyLattice();
    }
    
    initializeLattice() {
        if (!this.worm.segments || this.worm.segments.length < 3) return;
        
        const segments = this.worm.segments;
        const totalSegments = segments.length;
        
        // Store ideal rest lengths calculated when worm is at rest
        // These should be based on the worm's natural segment spacing
        const idealRestLengths = [];
        
        // Calculate ideal rest lengths based on segment radii and natural spacing
        for (let skip = 1; skip <= 10; skip++) {
            let totalLength = 0;
            // Sum up the natural spacing between segments
            for (let j = 0; j <= skip; j++) {
                if (j < this.worm.segmentRadii.length - 1) {
                    // Add segment radius + spacing + next segment radius
                    totalLength += this.worm.segmentRadii[j] * 2 + 2; // 2 pixels spacing between segments
                }
            }
            idealRestLengths[skip] = totalLength;
        }
        
        // Helper function to create springs for a pattern group
        const createSpringsForGroup = (config, color, springArray) => {
            const { pairs, baseStiffness, damping, lengthMultiplier } = config;
            
            // Create springs for each explicit pair
            pairs.forEach(pair => {
                const [fromIndex, toIndex] = pair;
                
                // Make sure both segments exist
                if (fromIndex >= 0 && fromIndex < totalSegments && 
                    toIndex >= 0 && toIndex < totalSegments) {
                    const fromSegment = segments[fromIndex];
                    const toSegment = segments[toIndex];
                    
                    // Calculate expected rest length based on worm structure
                    // This gives consistent lengths regardless of current position
                    let expectedLength = 0;
                    for (let i = fromIndex; i < toIndex; i++) {
                        // Add diameter of current segment plus spacing
                        if (this.worm.segmentRadii && this.worm.segmentRadii[i]) {
                            expectedLength += this.worm.segmentRadii[i] * 2 + 2; // 2 pixel spacing
                        } else {
                            expectedLength += 20; // Fallback if radii not available
                        }
                    }
                    
                    // Use calculated expected length for consistent spring behavior
                    const restLength = expectedLength * lengthMultiplier;
                    
                    // Create the spring constraint with calculated rest length
                    const spring = this.Matter.Constraint.create({
                        bodyA: fromSegment,
                        bodyB: toSegment,
                        pointA: { x: 0, y: 0 },
                        pointB: { x: 0, y: 0 },
                        length: restLength,
                        stiffness: baseStiffness,
                        damping: damping,
                        render: {
                            visible: false,  // Initially hidden (will show when activated)
                            strokeStyle: color,
                            lineWidth: 1
                        }
                    });
                    
                    // Store spring with metadata
                    springArray.push({
                        constraint: spring,
                        fromIndex: fromIndex,
                        toIndex: toIndex,
                        restLength: restLength,
                        pair: pair
                    });
                    
                    // Add to physics world
                    this.addConstraint(spring);
                }
            });
        };
        
        // Create springs for both head and tail
        Object.entries(this.latticeConfigs).forEach(([type, config]) => {
            createSpringsForGroup(
                config,
                config.color,
                this.latticeSprings[type]
            );
        });
    }
    
    destroyLattice() {
        // Remove all springs from physics world
        Object.keys(this.latticeSprings).forEach(type => {
            this.latticeSprings[type].forEach(springData => {
                if (springData.constraint) {
                    this.removeConstraint(springData.constraint);
                }
            });
            // Clear the array
            this.latticeSprings[type] = [];
        });
    }
    
    updateLatticeStiffness(headTriggerValue, tailTriggerValue) {
        if (!this.latticeEnabled) return;
        
        const triggerValues = { head: headTriggerValue, tail: tailTriggerValue };
        
        // Update springs for both head and tail
        Object.entries(triggerValues).forEach(([type, triggerValue]) => {
            const config = this.latticeConfigs[type];
            
            // Direct mapping: trigger value directly controls stiffness
            const stiffness = config.baseStiffness + 
                (triggerValue * (config.activeStiffness - config.baseStiffness));
            
            // Update springs for this type
            this.latticeSprings[type].forEach(springData => {
                const { constraint } = springData;
                
                // ALWAYS enforce the original rest length to prevent Matter.js from changing it
                constraint.length = springData.restLength;
                
                // Directly set stiffness - no transition
                constraint.stiffness = stiffness;
                
                // Visual feedback
                if (constraint.render) {
                    const active = triggerValue > 0.1;
                    constraint.render.visible = active;
                    if (active) {
                        constraint.render.lineWidth = 1 + triggerValue * 3;
                    }
                }
            });
        });
    }
    
    
    handleInput(inputs) {
        if (!this.isActive) return;
        
        // Check if we're in roll mode
        const isInRollMode = this.worm.stateMachine && 
                           this.worm.stateMachine.isInState(this.worm.stateMachine.states.ROLLING);
        
        // Disable springs during roll mode to prevent trajectory manipulation
        if (isInRollMode) {
            // Reset lattice stiffness to base values when in roll mode
            if (this.latticeEnabled) {
                this.updateLatticeStiffness(0, 0);  // Both triggers at 0
            }
            return;
        }
        
        const { leftTrigger, rightTrigger, swapControls, delta } = inputs;
        
        // Determine which triggers control which springs
        const headTriggerValue = swapControls ? rightTrigger : leftTrigger;
        const tailTriggerValue = swapControls ? leftTrigger : rightTrigger;
        
        // Direct control - triggers immediately affect spring stiffness
        if (this.latticeEnabled) {
            this.updateLatticeStiffness(headTriggerValue, tailTriggerValue);
        }
        
        // Update compression springs based on trigger values
        const maxTriggerValue = Math.max(headTriggerValue, tailTriggerValue);
        const compressionStiffness = this.baseCompressionStiffness + 
            (maxTriggerValue * this.compressionTriggerSensitivity * 
             (this.maxCompressionStiffness - this.baseCompressionStiffness));
        
        this.worm.updateCompressionStiffness(compressionStiffness);
    }
    
    // Clean up everything when the worm is destroyed
    destroy() {
        // Clean up lattice springs
        this.destroyLattice();
    }
}
