/**
 * Centralized map loading service to ensure consistent map loading
 * across all entry points (main game, test mode, editor, etc.)
 */
export default class MapLoader {
    /**
     * Load map data from API or registry
     * @param {string} mapKey - The map identifier (filename without extension)
     * @returns {Promise<Object>} Map data object
     */
    static async loadMapData(mapKey) {
        // Clean up the map key - remove .json extension if present
        const cleanMapKey = mapKey.replace(/\.json$/i, '');
        
        // Use build-time constant instead of runtime detection
        // @ts-ignore - import.meta.env is defined by Vite
        const hasAPI = import.meta?.env?.HAS_API === true || import.meta?.env?.HAS_API === 'true';
        
        // Try API endpoint first if available (server/dev mode)
        if (hasAPI) {
            try {
                // Always use .json extension for API
                const filename = `${cleanMapKey}.json`;
                const response = await fetch(`/api/maps/${filename}`);
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.mapData) {
                        console.log(`Loaded map "${cleanMapKey}" from API`);
                        return result.mapData;
                    }
                }
            } catch (err) {
                console.warn(`Failed to load map from API:`, err);
            }
        }
        
        // Try loading from static registry (for built-in maps or when API unavailable)
        try {
            const { loadMapData } = await import('../scenes/maps/MapDataRegistry');
            const mapData = loadMapData(cleanMapKey);
            if (mapData) {
                console.log(`Loaded map "${cleanMapKey}" from registry${!hasAPI ? ' (static build)' : ''}`);
                return mapData;
            }
        } catch (err) {
            console.warn(`Failed to load map from registry:`, err);
        }
        
        throw new Error(`Failed to load map data for "${cleanMapKey}" from any source`);
    }
    
    /**
     * Create a standardized map scene instance
     * @param {string} sceneKey - Unique key for the scene
     * @param {Object} mapData - Map data object
     * @param {Object} options - Scene configuration options
     * @returns {Phaser.Scene} Scene instance
     */
    static async createMapScene(sceneKey, mapData, options = {}) {
        const {
            returnScene = 'MapSelectScene',
            testMode = false,
            editorMode = false,
            showDebug = false
        } = options;
        
        // Dynamically import JsonMapBase to avoid circular dependency
        const { default: JsonMapBase } = await import('../scenes/JsonMapBase');
        
        // Create a dynamic scene class that extends JsonMapBase
        class DynamicMapScene extends JsonMapBase {
            constructor() {
                super({
                    key: sceneKey,
                    mapKey: sceneKey.replace('test-', '').replace('editor-', ''),
                    title: mapData.metadata?.name || sceneKey,
                    mapData: mapData,
                    returnScene: testMode || editorMode ? null : returnScene,
                    showDebug: showDebug
                });
                
                // Store mode flags
                this.testMode = testMode;
                this.editorMode = editorMode;
            }
            
            create() {
                super.create();
                
                // Add mode-specific UI elements
                if (this.testMode) {
                    this.addTestModeUI();
                } else if (this.editorMode) {
                    this.addEditorModeUI();
                }
            }
            
            addTestModeUI() {
                // Add test mode indicator
                const testText = this.add.text(20, 80, 'TEST MODE', {
                    fontSize: '16px',
                    color: '#ff6b6b',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 8, y: 4 }
                }).setScrollFactor(0).setDepth(1000);
                
                // Add reload hint
                const hintText = this.add.text(20, 110, 'Press R to reload', {
                    fontSize: '14px',
                    color: '#95a5a6',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 8, y: 4 }
                }).setScrollFactor(0).setDepth(1000);
                
                // R key to reload
                this.input.keyboard.on('keydown-R', () => {
                    window.location.reload();
                });
                
                if (this.minimap) {
                    this.minimap.ignore(testText);
                    this.minimap.ignore(hintText);
                }
            }
            
            addEditorModeUI() {
                // Add editor mode indicator
                const editorText = this.add.text(20, 80, 'EDITOR PREVIEW', {
                    fontSize: '16px',
                    color: '#4ecdc4',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: { x: 8, y: 4 }
                }).setScrollFactor(0).setDepth(1000);
                
                if (this.minimap) {
                    this.minimap.ignore(editorText);
                }
            }
            
            // Override victory to handle test/editor modes
            async victory() {
                if (this.testMode || this.editorMode) {
                    // Simple victory message for test/editor modes
                    const victoryText = this.add.text(
                        this.scale.width / 2, 
                        this.scale.height / 2, 
                        'LEVEL COMPLETE!\nPress ESC to exit', 
                        {
                            fontSize: '48px',
                            color: '#ffd700',
                            stroke: '#000000',
                            strokeThickness: 6,
                            align: 'center'
                        }
                    ).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
                    
                    this.victoryAchieved = true;
                    
                    if (this.minimap) {
                        this.minimap.ignore(victoryText);
                    }
                } else {
                    // Normal victory flow
                    await super.victory();
                }
            }
        }
        
        return DynamicMapScene;
    }
    
    /**
     * Load map data and start the scene
     * @param {Phaser.Scene} currentScene - Current active scene
     * @param {string} mapKey - Map identifier
     * @param {Object} options - Scene options
     */
    static async loadAndStart(currentScene, mapKey, options = {}) {
        try {
            // Load map data
            const mapData = await this.loadMapData(mapKey);
            
            // Generate unique scene key based on mode
            let sceneKey = mapKey;
            if (options.testMode) {
                sceneKey = `test-${mapKey}`;
            } else if (options.editorMode) {
                sceneKey = `editor-${mapKey}`;
            }
            
            // Check if scene already exists and remove it
            if (currentScene.scene.manager.getScene(sceneKey)) {
                currentScene.scene.manager.remove(sceneKey);
            }
            
            // Create and add the scene
            const SceneClass = await this.createMapScene(sceneKey, mapData, options);
            currentScene.scene.manager.add(sceneKey, SceneClass, false);
            
            // Stop current scene and start the map
            if (currentScene.scene.key !== sceneKey) {
                currentScene.scene.stop();
            }
            currentScene.scene.start(sceneKey);
            
        } catch (error) {
            console.error(`Failed to load and start map "${mapKey}":`, error);
            throw error;
        }
    }
    
    /**
     * Preload a map scene without starting it
     * @param {Phaser.Scene} scene - Scene to add the map to
     * @param {string} mapKey - Map identifier
     * @param {Object} options - Scene options
     */
    static async preloadMap(scene, mapKey, options = {}) {
        try {
            const mapData = await this.loadMapData(mapKey);
            const SceneClass = await this.createMapScene(mapKey, mapData, options);
            
            if (!scene.scene.manager.getScene(mapKey)) {
                scene.scene.manager.add(mapKey, SceneClass, false);
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to preload map "${mapKey}":`, error);
            return false;
        }
    }
}