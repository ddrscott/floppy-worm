import Phaser from 'phaser';
import * as dat from 'dat.gui';
import MapSelectScene from './scenes/MapSelectScene';
import TowerScene from './scenes/TowerScene';
import TestScene from './scenes/TestScene';
import LevelsScene from './scenes/LevelsScene';
import GamepadTest from './scenes/GamepadTest';
import Map001 from './scenes/maps/map_001';
import Map002 from './scenes/maps/map_002';
import Map003 from './scenes/maps/map_003';
import Map004 from './scenes/maps/map_004';
import Map005 from './scenes/maps/map_005';
import MapEditor from './scenes/MapEditor';
import JsonMapBase from './scenes/JsonMapBase';
import SwingMap from './scenes/maps/json/SwingMap';

// Make dat.GUI available globally for compatibility with the TestScene
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
        TestScene,
        LevelsScene,
        GamepadTest,
        MapEditor,
        SwingMap,
        Map001,
        Map002,
        Map003,
        Map004,
        Map005,
    ]
}
);
