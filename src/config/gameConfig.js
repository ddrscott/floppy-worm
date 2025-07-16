import TestScene from '../scenes/TestScene';
import TowerScene from '../scenes/TowerScene';
import LevelsScene from '../scenes/LevelsScene';
import { BasicWormScene } from '../worm-examples';

export const gameConfig = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#232333',
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
    scene: [TowerScene, LevelsScene, TestScene, BasicWormScene]
};
