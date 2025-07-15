export const defaultPhysicsParams = {
    // World physics
    gravityEnabled: true,
    gravityY: 1,
    
    // Segment physics
    segmentFriction: 1,
    segmentFrictionStatic: 0.8,
    segmentDensity: 0.03,
    segmentRestitution: 0.0001,
    
    // Main constraint parameters
    constraintStiffness: 1,
    constraintDamping: 0.08,
    constraintLength: 1.8, // Small gap to prevent overlap
    
    // Motor parameters
    motorSpeed: 5, // rotations per second
    motorAxelOffset: 40,
    
    // Action parameters
    straightenTorque: 2.0, // Angular acceleration in rad/s²
    straightenDamping: 0.1, // Damping to prevent oscillation
    
    flattenIdle: 0.000001,
    flattenStiffness: 0.5, // Stiffness for flatten constraints
    
    jumpIdle: 0.000001,
    jumpStiffness: 0.05, // Stiffness for jump constraint

    // Debug
    showDebug: true,
    showGrid: true,
    
    // Camera
    cameraFollowTail: true,
    cameraZoom: 2
};