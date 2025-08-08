import JsonMapBase from '/src/scenes/JsonMapBase';
import DoubleWorm from '/src/entities/DoubleWorm';
import Stopwatch from '/src/components/Stopwatch';
import GhostRecorder from '/src/components/ghost/GhostRecorder';
import GhostPlayer from '/src/components/ghost/GhostPlayer';
import GhostStorage from '/src/components/ghost/GhostStorage';
import RecordingDatabase from '/src/storage/RecordingDatabase';
import VictoryDialog from '/src/scenes/VictoryDialog';
import PauseMenu from '/src/scenes/PauseMenu';
import GameStateManager from '/src/services/GameStateManager';

/**
 * GameScene extends JsonMapBase to provide gameplay functionality
 * This includes worm physics, input handling, victory conditions, etc.
 */
export default class GameScene extends JsonMapBase {
    // Gameplay-specific properties
    protected worm: any;
    protected victoryAchieved: boolean = false;
    protected isPaused: boolean = false;
    protected stopwatch: any;
    protected ghostRecorder: any;
    protected ghostPlayer: any;
    protected ghostStorage: any;
    protected ghostVisible: boolean = true;
    protected recordingDb: any;
    protected stateManager: any;
    protected ghostIndicator: any;
    
    // Input properties
    protected cursors: any;
    protected spaceKey: any;
    protected escKey: any;
    protected mKey: any;
    protected shiftKey: any;
    protected tabKey: any;
    protected rKey: any;
    protected gKey: any;
    protected f11Key: any;
    protected optionButtonWasPressed: boolean = false;

    constructor(config: any = {}) {
        super(config);
        
        // Initialize gameplay-specific properties
        this.victoryAchieved = false;
        this.isPaused = false;
        this.ghostVisible = true;
        this.ghostStorage = new GhostStorage();
    }

    init(data: any) {
        super.init(data);
        
        // Initialize gameplay systems
        this.stateManager = GameStateManager.getFromScene(this);
        this.recordingDb = new RecordingDatabase();
        this.victoryAchieved = false;
        this.isPaused = false;
        this.ghostRecorder = null;
        this.ghostPlayer = null;
        this.ghostVisible = true;
    }

    async create() {
        await super.create();
        
        // Set up gameplay-specific systems
        this.setupControls();
        this.createGameplayUI();
        await this.initializeGhostSystem();
        
        // Start the timer
        if (this.stopwatch) {
            this.stopwatch.start();
        }
        
        // Set up collision detection for special platforms
        this.setupSpecialPlatformCollisions();
    }

    /**
     * Override entity creation to create physics-based worm
     */
    createEntitiesFromJSON(entitiesData: any) {
        const { wormStart, goal } = entitiesData;
        
        // Use pixel coordinates directly for entity placement
        const wormX = wormStart.x;
        const wormY = wormStart.y;
        
        // Check URL for debug parameter
        const urlParams = new URLSearchParams(window.location.search);
        const debugEnabled = urlParams.get('debug') === '1';
        
        this.worm = new DoubleWorm(this, wormX, wormY, {
            baseRadius: 15,
            segmentSizes: [0.75, 1, 1, 0.95, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            showDebug: debugEnabled
        });

        // Set Matter.js debug rendering based on worm's showDebug config
        this.matter.world.drawDebug = this.worm.config.showDebug;
        
        // Create camera target
        this.cameraTarget = this.add.rectangle(wormX, wormY, 10, 10, 0xff0000, 0);
        
        // Create goal at pixel coordinates
        const goalX = goal.x;
        const goalY = goal.y;
        
        this.goal = this.add.star(goalX, goalY, 5, 15, 25, 0xffd700);
        this.add.star(goalX, goalY, 5, 10, 20, 0xffed4e).setDepth(1);
        
        // Rotate the goal
        this.tweens.add({
            targets: this.goal,
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
        
        // Set up camera
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        this.handleResize();
        this.scale.on('resize', this.handleResize, this);
    }

    /**
     * Set up keyboard and gamepad controls
     */
    setupControls() {
        // Set up keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.gKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        
        // Set up F11 fullscreen toggle
        this.f11Key.on('down', function () {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        }, this);
        
        // Track gamepad button states
        this.button0WasPressed = false;
        this.optionButtonWasPressed = false;
    }

    /**
     * Create gameplay-specific UI elements
     */
    createGameplayUI() {
        // Create stopwatch in top center
        this.stopwatch = new Stopwatch(this, this.scale.width / 2, 20);
        
        // Load best time from state manager
        const bestTime = this.stateManager.getBestTime(this.mapKey);
        if (bestTime !== null) {
            this.stopwatch.setBestTime(bestTime);
        }
        
        this.minimapIgnoreList.push(this.stopwatch.timerText);
        if (this.stopwatch.bestTimeText) {
            this.minimapIgnoreList.push(this.stopwatch.bestTimeText);
        }
        
        // Pause hint (small text in top right)
        const pauseHint = this.add.text(this.scale.width - 20, 20, 'ESC: Pause', {
            fontSize: '14px',
            color: '#95a5a6',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 5, y: 2 }
        }).setOrigin(1, 0).setScrollFactor(0);
        
        this.minimapIgnoreList.push(pauseHint);
    }

    /**
     * Initialize the ghost recording and playback system
     */
    async initializeGhostSystem() {
        // Initialize recorder
        this.ghostRecorder = new GhostRecorder(this, this.worm ? this.worm.segments.length : 12);
        this.ghostRecorder.startRecording();
        
        // Try to load existing ghost
        const ghostData = await this.ghostStorage.loadGhost(this.mapKey, this.mapData);
        if (ghostData) {
            this.ghostPlayer = new GhostPlayer(this, ghostData.segmentCount);
            await this.ghostPlayer.loadGhostData(ghostData);
            this.ghostPlayer.start();
            
            console.log(`Loaded ghost with time: ${this.formatTime(ghostData.completionTime)}`);
            
            // Create ghost indicator UI
            this.createGhostIndicator(ghostData.completionTime);
        }
    }

    /**
     * Create ghost indicator UI
     */
    createGhostIndicator(ghostTime: number) {
        this.ghostIndicator = this.add.text(20, 60, `Racing ghost! (${this.formatTime(ghostTime)})`, {
            fontSize: '18px',
            color: '#9b59b6',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0).setDepth(1000);
        
        // Add pulsing effect to indicator
        this.tweens.add({
            targets: this.ghostIndicator,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        if (this.minimap) {
            this.minimap.ignore(this.ghostIndicator);
        }
    }

    /**
     * Main update loop for gameplay
     */
    update(time: number, delta: number) {
        // Don't update during victory or pause states
        if (this.victoryAchieved || this.isPaused) {
            return;
        }
        
        // Update worm physics
        if (this.worm && typeof this.worm.update === 'function') {
            this.worm.update(delta);
        }
        
        // Update stopwatch
        if (this.stopwatch && !this.victoryAchieved) {
            this.stopwatch.update();
        }
        
        // Record ghost frame
        if (this.ghostRecorder && this.ghostRecorder.isRecording && this.worm && this.worm.segments) {
            this.ghostRecorder.recordFrame(this.worm.segments, this.stopwatch.elapsedTime);
        }
        
        // Update ghost playback
        if (this.ghostPlayer && this.ghostPlayer.isPlaying && this.stopwatch) {
            this.ghostPlayer.update(this.stopwatch.elapsedTime);
        }
        
        // Handle input
        this.handleInput();
        
        // Update camera target to follow worm
        if (this.cameraTarget && this.worm) {
            const head = this.worm.getHead();
            const tail = this.worm.getTail();
            if (head && tail) {
                this.cameraTarget.x = (head.position.x + tail.position.x) / 2;
                this.cameraTarget.y = (head.position.y + tail.position.y) / 2;
            }
        }
        
        // Update platforms and constraints (from base class)
        this.updatePlatforms(time, delta);
        this.renderConstraints();
        
        // Update minimap
        this.updateMinimap();
        
        // Check game conditions
        this.checkWormFallOff();
        this.checkVictoryCondition();
    }

    /**
     * Handle keyboard and gamepad input
     */
    handleInput() {
        // ESC key opens pause menu
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.showPauseMenu();
            return;
        }
        
        // Check for gamepad option button (button 9 is typically Options/Start)
        const pad = this.input.gamepad.getPad(0);
        if (pad && pad.buttons[9]) {
            const optionButtonPressed = pad.buttons[9].pressed;
            if (optionButtonPressed && !this.optionButtonWasPressed) {
                this.showPauseMenu();
            }
            this.optionButtonWasPressed = optionButtonPressed;
        } else {
            this.optionButtonWasPressed = false;
        }
        
        // Server mode keyboard shortcuts
        if (this.buildMode === 'server') {
            // TAB key to toggle between play and edit modes
            if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
                if (this.returnScene === 'MapEditor' && this.scene.manager.getScene('MapEditor')) {
                    this.scene.stop();
                    this.scene.start('MapEditor');
                }
                return;
            }
            
            // R key to reset level
            if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
                this.handleRestart('manual_restart');
                return;
            }
        }
        
        // M key to toggle mini-map
        if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
            this.toggleMiniMap();
        }
        
        // G key to toggle ghost
        if (Phaser.Input.Keyboard.JustDown(this.gKey)) {
            this.toggleGhost();
        }
        
        // Check for gamepad button M to toggle mini-map
        if (pad && pad.buttons[2] && pad.buttons[2].pressed && !this.buttonMWasPressed) {
            this.toggleMiniMap();
        }
        this.buttonMWasPressed = pad && pad.buttons[2] && pad.buttons[2].pressed;
    }

    /**
     * Update platforms (dynamic ones need position sync)
     */
    updatePlatforms(time: number, delta: number) {
        this.platforms.forEach(platform => {
            if (platform.isSpecial && platform.instance && platform.instance.update) {
                platform.instance.update(time, delta);
            }
            
            // Sync visual with physics body for dynamic platforms
            if (platform.body && !platform.body.isStatic && platform.visual) {
                platform.visual.x = platform.body.position.x;
                platform.visual.y = platform.body.position.y;
                platform.visual.rotation = platform.body.angle;
            }
        });
    }

    /**
     * Update minimap if visible
     */
    updateMinimap() {
        if (this.minimap && this.worm && this.miniMapConfig.visible) {
            const head = this.worm.getHead();
            if (head) {
                this.minimap.centerOn(head.position.x, head.position.y);
            }
            this.updateViewportIndicator();
        }
    }

    /**
     * Check if worm has fallen off the map
     */
    checkWormFallOff() {
        if (!this.worm || !this.worm.segments || this.victoryAchieved) {
            return;
        }
        
        const fallThreshold = this.levelHeight + 100;
        
        for (let segment of this.worm.segments) {
            if (segment.position.y > fallThreshold) {
                this.handleRestart('fell_off_map');
                return;
            }
        }
    }

    /**
     * Check victory condition - any part of worm touching goal
     */
    checkVictoryCondition() {
        if (this.goal && this.worm && this.worm.segments) {
            for (let i = 0; i < this.worm.segments.length; i++) {
                const segment = this.worm.segments[i];
                const distance = Phaser.Math.Distance.Between(
                    segment.position.x, segment.position.y,
                    this.goal.x, this.goal.y
                );
                
                const segmentRadius = this.worm.segmentRadii[i] || 15;
                const goalRadius = 20;
                const collisionDistance = segmentRadius + goalRadius;
                
                if (distance < collisionDistance) {
                    this.victory();
                    return;
                }
            }
        }
    }

    /**
     * Handle victory
     */
    victory() {
        this.victoryAchieved = true;
        
        // Stop the timer and save best time
        if (this.stopwatch) {
            const completionTime = this.stopwatch.stop();
            const elapsedTime = this.stopwatch.elapsedTime;
            
            this.saveRecordingToIndexedDB(true, elapsedTime);
            this.saveBestTime(completionTime);
            this.saveGhostIfBest(completionTime);
        }
        
        // Clean up worm
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        // Set up victory UI
        this.setupVictoryUI();
    }

    /**
     * Set up victory UI
     */
    async setupVictoryUI() {
        // Add VictoryDialog scene if not already added
        if (!this.scene.manager.getScene('VictoryDialog')) {
            this.scene.manager.add('VictoryDialog', VictoryDialog, false);
        }
        
        // Sleep this scene and launch victory dialog
        this.scene.sleep();
        this.scene.launch('VictoryDialog', {
            gameScene: this,
            mapKey: this.mapKey || this.scene.key,
            sceneTitle: this.sceneTitle,
            stopwatch: this.stopwatch,
            getBestTime: () => this.stateManager.getBestTime(this.mapKey)
        });
    }

    /**
     * Handle restart
     */
    async handleRestart(reason: string = 'unknown') {
        console.log('🔄 Restarting with reason:', reason);
        
        // Save the recording as a failure before restarting
        const elapsedTime = this.stopwatch ? this.stopwatch.elapsedTime : 0;
        await this.saveRecordingToIndexedDB(false, elapsedTime, reason);
        
        // Restart the scene
        this.scene.restart();
    }

    /**
     * Show pause menu
     */
    showPauseMenu() {
        // Add PauseMenu scene if not already added
        if (!this.scene.manager.getScene('PauseMenu')) {
            this.scene.manager.add('PauseMenu', PauseMenu, false);
        }
        
        this.isPaused = true;
        
        // Pause this scene and launch pause menu
        this.scene.pause();
        this.scene.launch('PauseMenu', {
            gameScene: this,
            mapKey: this.mapKey || this.scene.key
        });
    }

    /**
     * Toggle ghost visibility
     */
    toggleGhost() {
        this.ghostVisible = !this.ghostVisible;
        
        if (this.ghostPlayer) {
            this.ghostPlayer.setVisible(this.ghostVisible);
        }
        
        // Show feedback
        const text = this.add.text(this.scale.width / 2, 80, 
            this.ghostVisible ? 'Ghost ON' : 'Ghost OFF', {
            fontSize: '20px',
            color: this.ghostVisible ? '#9b59b6' : '#e74c3c',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        
        if (this.minimap) {
            this.minimap.ignore(text);
        }
        
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1500,
            onComplete: () => text.destroy()
        });
    }

    /**
     * Save best time
     */
    saveBestTime(time: number) {
        const isNewBest = this.stateManager.updateBestTime(this.mapKey, time);
        
        if (isNewBest) {
            this.stopwatch.setBestTime(time);
        }
        
        // Mark map as completed
        this.stateManager.completeMap(this.mapKey, time);
    }

    /**
     * Save ghost if best
     */
    async saveGhostIfBest(completionTime: number) {
        if (!this.ghostRecorder || !this.ghostStorage) {
            return;
        }
        
        // Check if this is the best time
        if (!this.ghostStorage.shouldSaveGhost(this.mapKey, completionTime)) {
            return;
        }
        
        // Stop recording and get data
        this.ghostRecorder.stopRecording();
        const recordingData = await this.ghostRecorder.getRecordingData();
        
        if (recordingData) {
            await this.ghostStorage.saveGhost(
                this.mapKey,
                this.mapData,
                recordingData,
                completionTime
            );
        }
    }

    /**
     * Capture screenshot
     */
    captureScreenshot() {
        try {
            const canvas = this.game.canvas;
            if (!canvas) {
                return null;
            }
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            return dataUrl;
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            return null;
        }
    }

    /**
     * Save recording to IndexedDB
     */
    async saveRecordingToIndexedDB(success: boolean, completionTime: number | null = null, deathReason: string | null = null) {
        if (!this.ghostRecorder || !this.recordingDb) {
            return;
        }
        
        // Capture screenshot BEFORE stopping recording
        const screenshot = this.captureScreenshot();
        
        // Stop recording and get data
        this.ghostRecorder.stopRecording();
        const recordingData = await this.ghostRecorder.getRecordingData();
        
        if (!recordingData) {
            return;
        }
        
        // Prepare recording data for IndexedDB
        const dbRecordingData = {
            mapKey: this.mapKey,
            mapTitle: this.sceneTitle || this.mapKey,
            success: success,
            completionTime: completionTime,
            deathReason: deathReason,
            timestamp: new Date().toISOString(),
            duration: recordingData.duration,
            frameCount: recordingData.frameCount,
            segmentCount: recordingData.segmentCount,
            compression: recordingData.compression,
            encoding: recordingData.encoding,
            screenshot: screenshot,
            recordingData: recordingData.data,
            mapData: {
                platforms: this.mapData.platforms?.length || 0,
                entities: this.mapData.entities?.length || 0,
                dimensions: this.mapData.dimensions
            }
        };
        
        try {
            const recordingId = await this.recordingDb.saveRecording(dbRecordingData);
            console.log(`Recording saved with ID: ${recordingId}`);
            
            // Show feedback to user
            const message = success ? 'Victory recording saved!' : 'Recording saved!';
            const color = success ? '#4ecdc4' : '#e74c3c';
            
            const text = this.add.text(this.scale.width / 2, 120, message, {
                fontSize: '18px',
                color: color,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            
            this.tweens.add({
                targets: text,
                alpha: 0,
                duration: 2000,
                delay: 1000,
                onComplete: () => text.destroy()
            });
        } catch (error) {
            console.error('Failed to save recording:', error);
        }
    }

    /**
     * Set up collision detection for special platforms
     */
    setupSpecialPlatformCollisions() {
        // Set up Matter.js collision events for special platforms
        this.matter.world.on('collisionstart', (event: any) => {
            event.pairs.forEach((pair: any) => {
                const { bodyA, bodyB } = pair;

                if (bodyA.isWorm && bodyB.isWorm) {
                    return;
                }
                
                // Check if one body is a worm segment and the other is a special platform
                const wormSegment = this.isWormSegment(bodyA) ? bodyA : (this.isWormSegment(bodyB) ? bodyB : null);
                const platformBody = wormSegment === bodyA ? bodyB : bodyA;
                
                if (wormSegment && platformBody.platformInstance) {
                    const platform = platformBody.platformInstance;
                    if (platform.onCollision) {
                        platform.onCollision(wormSegment, pair.collision);
                    }
                }
            });
        });
        
        this.matter.world.on('collisionend', (event: any) => {
            event.pairs.forEach((pair: any) => {
                const { bodyA, bodyB } = pair;
                
                if (bodyA.isWorm && bodyB.isWorm) {
                    return;
                }

                const wormSegment = this.isWormSegment(bodyA) ? bodyA : (this.isWormSegment(bodyB) ? bodyB : null);
                const platformBody = wormSegment === bodyA ? bodyB : bodyA;
                
                if (wormSegment && platformBody.platformInstance) {
                    const platform = platformBody.platformInstance;
                    if (platform.onCollisionEnd) {
                        platform.onCollisionEnd(wormSegment);
                    }
                }
            });
        });
    }

    /**
     * Check if a body is a worm segment
     */
    isWormSegment(body: any): boolean {
        return this.worm && this.worm.segments && this.worm.segments.includes(body);
    }

    /**
     * Format time for display
     */
    formatTime(milliseconds: number): string {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    /**
     * Clean up when scene shuts down
     */
    cleanup() {
        super.cleanup();
        
        // Clean up gameplay-specific elements
        if (this.worm) {
            this.worm.destroy();
            this.worm = null;
        }
        
        if (this.stopwatch) {
            this.stopwatch.destroy();
            this.stopwatch = null;
        }
        
        if (this.ghostRecorder) {
            this.ghostRecorder.reset();
            this.ghostRecorder = null;
        }
        
        if (this.ghostPlayer) {
            this.ghostPlayer.destroy();
            this.ghostPlayer = null;
        }
        
        this.victoryAchieved = false;
        this.isPaused = false;
    }
}