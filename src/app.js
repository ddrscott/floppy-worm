import Phaser from 'phaser';
import * as dat from 'dat.gui';
import MapSelectScene from './scenes/MapSelectScene';
import TowerScene from './scenes/TowerScene';

window.dat = dat;

// Create and start the game
export const game = new Phaser.Game(
{
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
            velocityIterations: 20,
            constraintIterations: 2,
            enableSleeping: true
        }
    },
    input: {
        gamepad: true
    },
    scene: [
        MapSelectScene,
        TowerScene,
    ]
}
);
