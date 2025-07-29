import Phaser from 'phaser';
import * as dat from 'dat.gui';
import MapSelectScene from './scenes/MapSelectScene';
import { BaseGameConfig } from './config/phaser';
import { getSceneDebugger } from './utils/SceneDebugger';

window.dat = dat;

// Create and start the game
export const game = new Phaser.Game({
    ...BaseGameConfig,
    parent: 'game-container',
    scene: [
        MapSelectScene,
    ]
});

// Make game available globally for debugging
window.game = game;

// Initialize scene debugger (disabled by default)
const sceneDebugger = getSceneDebugger(game);

// Enable scene debugging in development
if (process.env.NODE_ENV === 'development') {
    // Uncomment to enable scene debugging by default in dev
    // sceneDebugger.enable('info');
    
    // Log instructions
    console.log('%cScene Debugger available. Use window.enableSceneDebug() to enable.', 'color: #4ecdc4');
}
