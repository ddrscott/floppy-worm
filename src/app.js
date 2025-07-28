import Phaser from 'phaser';
import * as dat from 'dat.gui';
import MapSelectScene from './scenes/MapSelectScene';
import { BaseGameConfig } from './config/phaser';

window.dat = dat;

// Create and start the game
export const game = new Phaser.Game({
    ...BaseGameConfig,
    parent: 'game-container',
    scene: [
        MapSelectScene,
    ]
});
