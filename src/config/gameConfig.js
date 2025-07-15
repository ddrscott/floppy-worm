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
            debug: false,  // Turn off debug globally
            positionIterations: 10,
            velocityIterations: 16,
            constraintIterations: 2,
        }
    },
    scene: [TowerScene, LevelsScene, TestScene, BasicWormScene]
};
