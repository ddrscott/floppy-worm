import Phaser from 'phaser';
import MapSelectScene from '/src/scenes/MapSelectScene';
import { clearMapCache } from '/src/scenes/maps/MapDataRegistry';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
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
    ]
};

const StartGame = (parent: string) => {
    // Expose clearMapCache globally for editor integration
    (window as any).clearMapCache = clearMapCache;
    
    return new Phaser.Game({ ...config, parent });
}

export default StartGame;
