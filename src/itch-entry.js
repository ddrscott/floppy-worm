import Phaser from 'phaser';
import * as dat from 'dat.gui';
import TitleScene from './scenes/TitleScene';
import MapSelectScene from './scenes/MapSelectScene';
import { BaseGameConfig } from './config/phaser';

// Import all map scenes statically to bundle them
import './scenes/maps/MapDataRegistry';

// Make dat.gui available globally for debug UI
window.dat = dat;

// Hide loading message when game starts
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

// Create the game configuration for itch.io
const itchConfig = {
    parent: 'game-container',
    scene: [TitleScene, MapSelectScene],
    callbacks: {
        postBoot: function(game) {
            // Hide loading screen once game is ready
            hideLoading();
        }
    },
    ...BaseGameConfig
};

// Create and start the game
const game = new Phaser.Game(itchConfig);

// Make game available globally for potential debugging
window.game = game;

// Log version info
console.log('Floppy Worm - itch.io build');
console.log('Static build with all maps bundled');
