import Phaser from 'phaser';
import MapSelectScene from '../src/scenes/MapSelectScene';
import TestScene from '../src/scenes/TestScene';
import TowerScene from '../src/scenes/TowerScene';
import MapEditor from '../src/scenes/MapEditor';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#232333',
    physics: {
        default: 'matter',
        matter: {
            debug: false,
            gravity: { y: 1 }
        }
    },
    scene: [
        MapSelectScene,
        TestScene,
        TowerScene,
        MapEditor
    ]
};

// Initialize game
const game = new Phaser.Game(config);

// Store game reference globally for debugging
(window as any).game = game;