// Shared physics configuration for consistent worm behavior
const WORM_PHYSICS = {
    // Worm structure
    WORM_SEGMENTS: 13,
    SEGMENT_RADIUS: 10,  // Original value
    
    // Segment physics
    HEAD_DENSITY: 0.0005,
    TAIL_DENSITY: 0.0022,  // Slightly heavier than body for original behavior
    BODY_DENSITY: 0.002,   // Middle segments
    TAIL_SEGMENTS: 3,
    
    // Friction values
    TAIL_FRICTION: 0.95,
    TAIL_STATIC_FRICTION: 0.95,
    BODY_FRICTION: 0.8,
    BODY_STATIC_FRICTION: 0.8,
    FRICTION_AIR: 0.02,
    
    // Constraint physics
    CONSTRAINT_STIFFNESS: 0.8,
    CONSTRAINT_DAMPING: 0.2,
    CONSTRAINT_LENGTH_MULTIPLIER: 2,  // segment radius * this
    
    // Movement forces
    MOVEMENT_FORCE: 0.003,
    UPWARD_FORCE: 0.002,  // Separate upward force like original
    TORQUE_AMOUNT: 0.12,  // Match original value
    NUM_HEAD_SEGMENTS: 3,  // How many segments from head to control
    
    // Spacebar mechanics
    CONTRACTION_FORCE: 0.2,
    STRAIGHTEN_DAMPING: 0.9,
    LAUNCH_UPWARD_COMPONENT: 0.5,
    
    // Visual colors (as hex for both renderers)
    COLORS: {
        head: '#ff6b6b',
        tail: '#4ecdc4',
        body: '#95e1d3',
        headBright: '#ff9999',
        tailBright: '#6eddd6',
        bodyBright: '#b5f1e3'
    },
    
    // Platform properties
    PLATFORM_THICKNESS: 40,
    
    // Physics engine settings
    POSITION_ITERATIONS: 10,
    VELOCITY_ITERATIONS: 10,
    GRAVITY_SCALE: 0.001,  // Original uses very weak gravity
    
    // Helper function to convert hex to Phaser color
    hexToPhaser: function(hex) {
        return parseInt(hex.replace('#', '0x'));
    }
};

// Density calculation function based on segment index
function getSegmentDensity(index, totalSegments) {
    if (index === totalSegments - 1) {
        // Head is lightest
        return WORM_PHYSICS.HEAD_DENSITY;
    } else if (index < WORM_PHYSICS.TAIL_SEGMENTS) {
        // Tail segments are heavier
        return WORM_PHYSICS.TAIL_DENSITY;
    } else {
        // Body segments
        return WORM_PHYSICS.BODY_DENSITY;
    }
}

// Friction calculation function based on segment index
function getSegmentFriction(index, totalSegments) {
    if (index < WORM_PHYSICS.TAIL_SEGMENTS) {
        return {
            friction: WORM_PHYSICS.TAIL_FRICTION,
            frictionStatic: WORM_PHYSICS.TAIL_STATIC_FRICTION
        };
    } else {
        return {
            friction: WORM_PHYSICS.BODY_FRICTION,
            frictionStatic: WORM_PHYSICS.BODY_STATIC_FRICTION
        };
    }
}

// Export for use in both environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WORM_PHYSICS, getSegmentDensity, getSegmentFriction };
}