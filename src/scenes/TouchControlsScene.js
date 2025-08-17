import Phaser from 'phaser';
import TouchControlsOverlay from '../utils/TouchControlsOverlay';

/**
 * TouchControlsScene - A dedicated overlay scene for touch controls
 * 
 * This scene runs in parallel with the game scene and renders touch controls
 * on top of everything else. Using a separate scene eliminates the need for
 * camera management and depth sorting complexities.
 */
export default class TouchControlsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TouchControlsScene' });
        this.touchControls = null;
    }
    
    create(data) {
        // data should contain a reference to the game scene
        this.gameScene = data.gameScene;
        
        // Create touch controls overlay
        this.touchControls = new TouchControlsOverlay(this, {
            onMenuPress: data.onMenuPress || null
        });
        
        // The TouchControlsOverlay already creates everything we need
        // No cameras to configure since this scene only has UI elements
    }
    
    /**
     * Get the touch controls instance
     */
    getTouchControls() {
        return this.touchControls;
    }
    
    /**
     * Get current touch input state
     */
    getState() {
        return this.touchControls ? this.touchControls.getState() : {
            leftStick: { x: 0, y: 0, active: false },
            rightStick: { x: 0, y: 0, active: false },
            buttons: {
                leftTrigger: false,
                rightTrigger: false,
                leftShoulder: false,
                rightShoulder: false,
                roll: false,
                menu: false
            }
        };
    }
    
    /**
     * Show/hide controls
     */
    setVisible(visible) {
        if (this.touchControls) {
            this.touchControls.setVisible(visible);
        }
    }
    
    destroy() {
        if (this.touchControls) {
            this.touchControls.destroy();
            this.touchControls = null;
        }
        super.destroy();
    }
}