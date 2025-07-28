import Phaser from 'phaser';
import MapSelectScene from '/src/scenes/MapSelectScene';
import { clearMapCache } from '/src/scenes/maps/MapDataRegistry';
import { BaseGameConfig } from '/src/config/phaser';

const StartGame = (parent: string) => {
    // Expose clearMapCache globally for editor integration
    (window as any).clearMapCache = clearMapCache;
    
    return new Phaser.Game({
        ...BaseGameConfig,
        parent,
        scene: [
            MapSelectScene,
        ]
    });
}

export default StartGame;
