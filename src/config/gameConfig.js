import TestScene from '../scenes/TestScene';

export const gameConfig = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#232333',
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },  // Start with gravity off
            debug: {
                wireframes: false,
                showBody: true,
                showConstraint: true,
                showStaticBody: true,
                showAngleIndicator: true,
                //showVelocity: true,
                //showCollisions: true,
                //showAxes: false,
            },
            positionIterations: 10,   // Even higher for better collision resolution
            velocityIterations: 16,
            constraintIterations: 2,
        }
    },
    scene: TestScene
};