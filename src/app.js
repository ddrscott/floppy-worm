import Phaser from 'phaser';
import * as dat from 'dat.gui';
import { gameConfig } from './config/gameConfig';

// Make dat.GUI available globally for compatibility with the TestScene
window.dat = dat;

// Create and start the game
export const game = new Phaser.Game(gameConfig);
