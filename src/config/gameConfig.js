import TowerScene from '../scenes/TowerScene';
import LevelsScene from '../scenes/LevelsScene';
import GamepadTest from '../scenes/GamepadTest';

export const gameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#232333',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%',
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: {
                showBody: true,
                showStaticBody: true,
                showVelocity: false,
                bodyColor: 0xff0000
            },
            positionIterations: 20,
            velocityIterations: 10,
            constraintIterations: 2,
        }
    },
    input: {
        gamepad: true
    },
    scene: [TowerScene, LevelsScene, GamepadTest]
};
