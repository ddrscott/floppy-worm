export const defaultPhysicsParams = {
    // World physics
    gravityEnabled: true,
    gravityY: 1,
    
    // Segment physics
    segmentFriction: 0.7,
    segmentFrictionStatic: 0.6,
    segmentDensity: 0.05,
    segmentRestitution: 0.05,
    
    // Main constraint parameters
    constraintStiffness: 0.9,
    constraintDamping: 0.1,
    constraintLength: 1.8, // Small gap to prevent overlap
    
    // Swing parameters
    swingSpeed: 2.5, // rotations per second
    swingPivotOffset: 40,
    
    // Action parameters
    straightenTorque: 2.0, // Angular acceleration in rad/s²
    straightenDamping: 0.1, // Damping to prevent oscillation
    
    flattenIdle: 0.000001,
    flattenStiffness: 0.7, // Stiffness for flatten constraints
    
    jumpIdle: 0.000001,
    jumpStiffness: 0.08, // Stiffness for jump constraint

    // Compression spring parameters
    baseCompressionStiffness: 0.005,
    maxCompressionStiffness: 0.05,
    compressionTriggerSensitivity: 1.0,

    // Debug
    showDebug: true,
    showGrid: true,
    
    // Camera
    cameraFollowTail: true,
    cameraZoom: 1
};
