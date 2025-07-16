import TestScene from '../scenes/TestScene';
import TowerScene from '../scenes/TowerScene';
import LevelsScene from '../scenes/LevelsScene';
import GamepadTest from '../scenes/GamepadTest';
import { BasicWormScene } from '../worm-examples';

// Detect if device is in portrait mode
const isPortrait = window.innerHeight > window.innerWidth;
const baseWidth = isPortrait ? 768 : 1024;
const baseHeight = isPortrait ? 1366 : 768;

export const gameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#232333',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%',
        min: {
            width: 320,
            height: 480
        },
        max: {
            width: 1920,
            height: 2560
        }
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
    scene: [TestScene, TowerScene, LevelsScene, GamepadTest, BasicWormScene]
};
