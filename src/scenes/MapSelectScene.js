import Phaser from 'phaser';
import { getCategories, loadMapData, createMapScene } from './maps/MapDataRegistry';
import MapLoader from '../services/MapLoader';
import { getCachedBuildMode, BuildConfig } from '../utils/buildMode';
import GameStateManager from '../services/GameStateManager';
import Random from '../utils/Random';
import WhooshSynthesizer from '../audio/WhooshSynthesizer';

export default class MapSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapSelectScene' });
        
        this.categories = [];
        this.selectedCategoryIndex = 0;
        this.selectedMapIndex = 0;
        this.currentCategory = null;
        this.currentMaps = [];
        this.stateManager = null;
        this.isTransitioning = false;
        
        // UI elements
        this.mapCarousel = null;
        this.mapCards = [];
        this.leftArrow = null;
        this.rightArrow = null;
        this.upArrow = null;
        this.downArrow = null;
        this.categoryLabel = null;
        this.categoryLabelAbove = null;
        this.categoryLabelBelow = null;
        
        // Gamepad state tracking
        this.upWasPressed = false;
        this.downWasPressed = false;
        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.aWasPressed = false;
        this.bWasPressed = false;
        
        // Audio
        this.menuWhoosh = null;
    }
    
    init() {
        // Reset random seed for consistent behavior
        Random.setSeed(12345); // Fixed seed for menu scene
        
        // Reset state
        this.selectedCategoryIndex = 0;
        this.selectedMapIndex = 0;
        this.isTransitioning = false;
        this.mapCards = [];
        
        // Input cooldown to prevent catching input from previous scenes
        this.inputCooldown = 250; // milliseconds
        
        // Reset gamepad state
        this.upWasPressed = false;
        this.downWasPressed = false;
        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.aWasPressed = false;
        this.bWasPressed = false;
        
        // Initialize state manager
        this.stateManager = GameStateManager.getFromScene(this);
        
        // Listen for progress updates from other scenes
        this.registry.events.on(this.stateManager.events.PROGRESS_UPDATED, this.onProgressUpdated, this);
    }
    
    async create() {
        // Reset transitioning flag
        this.isTransitioning = false;
        
        // Get build mode
        this.buildMode = await getCachedBuildMode();
        this.buildConfig = BuildConfig[this.buildMode];
        
        // Initialize keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // Clear any lingering keyboard state from previous scenes
        this.input.keyboard.resetKeys();
        
        // Initialize menu sound
        this.menuWhoosh = new WhooshSynthesizer({
            pitch: 1.3,
            filterBase: 900,
            resonance: 16.0,
            lowBoost: 1,
            reverb: 0.03,
            swishFactor: 0.8
        });
        
        // Load categories
        this.categories = getCategories();
        
        // Responsive design detection
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;
        const centerX = gameWidth / 2;
        
        // Create background
        this.createBackground();
        
        // Create stacked carousel
        this.createStackedCarousel();
        
        // Create UI buttons
        this.createUIButtons();
        
        // Instructions
        this.add.text(centerX, gameHeight - 30, 
            'ARROWS/D-PAD: Navigate (↑↓ Category, ←→ Map) • ENTER/A: Play • ESC/B: Refresh', {
            fontSize: '13px',
            color: '#7f8c8d',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(100);
        
        // Load the first category
        if (this.categories.length > 0) {
            this.selectCategory(0);
        }
        
        // Clean up events on shutdown
        this.events.once('shutdown', this.cleanup, this);
        
        // Fullscreen toggle
        this.f11Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F11);
        this.f11Key.on('down', function () {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        }, this);
    }
    
    createBackground() {
        // Solid background
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 
            this.scale.width, this.scale.height, 0x232333);
        
        // Grid pattern
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x333333, 0.2);
        
        const width = this.scale.width;
        const height = this.scale.height;
        
        for (let x = 0; x <= width; x += 40) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }
        
        for (let y = 0; y <= height; y += 40) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }
        
        graphics.strokePath();
        graphics.setDepth(-100);
    }
    
    createStackedCarousel() {
        const centerX = this.scale.width / 2;
        const carouselY = this.scale.height / 2;
        const cardWidth = 280;
        const cardHeight = 180;
        
        // Font sizes for category labels
        const currentCategoryFontSize = 24;
        const otherCategoryFontSize = 16;
        
        // Vertical spacing using em units (relative to font size)
        const categoryLabelSpacing = currentCategoryFontSize * 3; // Space between current and prev/next labels
        const arrowFromCategorySpacing = currentCategoryFontSize * 1; // Space between arrow and current category
        const carouselFromCategorySpacing = currentCategoryFontSize * 5; // Space from category to carousel
        
        // Calculate positions
        const currentCategoryY = carouselY - carouselFromCategorySpacing;
        const upArrowY = currentCategoryY - arrowFromCategorySpacing;
        const prevCategoryY = currentCategoryY - categoryLabelSpacing;
        const downArrowY = carouselY + cardHeight/2 + otherCategoryFontSize * 4;
        const nextCategoryY = downArrowY + otherCategoryFontSize * 3;
        
        // Create category labels
        // Create vertical arrows for category navigation
        this.upArrow = this.add.triangle(
            centerX, upArrowY,
            0, 15, 15, 15, 7.5, 0,
            0x4ecdc4, 0.6
        ).setInteractive();
        
        // Previous category (above)
        this.categoryLabelAbove = this.add.text(centerX, prevCategoryY, '', {
            fontSize: `${otherCategoryFontSize}px`,
            color: '#5a6c7d',
            fontStyle: 'italic'
        }).setOrigin(0.5).setAlpha(0.5);
        
        // Current category (center)
        this.categoryLabel = this.add.text(centerX, currentCategoryY, '', {
            fontSize: `${currentCategoryFontSize}px`,
            color: '#4ecdc4',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Next category (below)
        this.categoryLabelBelow = this.add.text(centerX, nextCategoryY, '', {
            fontSize: `${otherCategoryFontSize}px`,
            color: '#5a6c7d',
            fontStyle: 'italic'
        }).setOrigin(0.5).setAlpha(0.5);
        
        this.downArrow = this.add.triangle(
            centerX, downArrowY,
            0, 0, 15, 0, 7.5, 15,
            0x4ecdc4, 0.6
        ).setInteractive();
        
        // Arrow click handlers for categories
        this.upArrow.on('pointerup', () => {
            this.navigateCategory(-1);
        });
        
        this.downArrow.on('pointerup', () => {
            this.navigateCategory(1);
        });
        
        this.upArrow.on('pointerover', () => {
            this.upArrow.setAlpha(0.8);
        });
        
        this.upArrow.on('pointerout', () => {
            this.upArrow.setAlpha(0.6);
        });
        
        this.downArrow.on('pointerover', () => {
            this.downArrow.setAlpha(0.8);
        });
        
        this.downArrow.on('pointerout', () => {
            this.downArrow.setAlpha(0.6);
        });
        
        // Create carousel container
        this.mapCarousel = this.add.container(centerX, carouselY);
        
        // Create left/right arrows for map navigation
        this.leftArrow = this.add.triangle(
            centerX - cardWidth * 0.6, carouselY,
            20, 0, 20, 40, 0, 20,
            0x4ecdc4, 0.8
        ).setInteractive();
        
        this.rightArrow = this.add.triangle(
            centerX + cardWidth * 0.6, carouselY,
            0, 0, 20, 20, 0, 40,
            0x4ecdc4, 0.8
        ).setInteractive();
        
        // Arrow click handlers for maps
        this.leftArrow.on('pointerup', () => {
            this.navigateMap(-1);
        });
        
        this.rightArrow.on('pointerup', () => {
            this.navigateMap(1);
        });
        
        this.leftArrow.on('pointerover', () => {
            this.leftArrow.setAlpha(1);
        });
        
        this.leftArrow.on('pointerout', () => {
            this.leftArrow.setAlpha(0.8);
        });
        
        this.rightArrow.on('pointerover', () => {
            this.rightArrow.setAlpha(1);
        });
        
        this.rightArrow.on('pointerout', () => {
            this.rightArrow.setAlpha(0.8);
        });
        
        // Create map cards (3 visible at a time)
        for (let i = -1; i <= 1; i++) {
            const x = i * (cardWidth + 20);
            
            // Create a container for each card
            const cardContainer = this.add.container(x, 0);
            
            // Card background
            const cardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x2c3e50, 0.9);
            cardBg.setStrokeStyle(3, 0x34495e, 1);
            
            // Card title
            const titleText = this.add.text(0, -60, '', {
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            // Card description
            const descText = this.add.text(0, -20, '', {
                fontSize: '14px',
                color: '#95a5a6',
                wordWrap: { width: cardWidth - 40 }
            }).setOrigin(0.5);
            
            // Best time
            const timeText = this.add.text(0, 35, '', {
                fontSize: '16px',
                color: '#4ecdc4'
            }).setOrigin(0.5);
            
            // Play button
            const playButton = this.add.rectangle(0, 65, 100, 30, 0x27ae60, 1);
            playButton.setStrokeStyle(2, 0x2ecc71, 1);
            playButton.setInteractive();
            
            const playText = this.add.text(0, 65, 'PLAY', {
                fontSize: '18px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            // Status icon - large checkmark for completed levels (centered)
            const statusIcon = this.add.text(40, -15, '', {
                fontSize: '72px',
                color: '#2ecc71'
            }).setOrigin(-1, 1).setAlpha(0.8);
            
            // Add all elements to the card container
            cardContainer.add([cardBg, statusIcon, titleText, descText, timeText, playButton, playText]);
            
            // Add card container to carousel
            this.mapCarousel.add(cardContainer);
            
            // Store card reference
            this.mapCards.push({
                container: cardContainer,
                background: cardBg,
                title: titleText,
                description: descText,
                time: timeText,
                status: statusIcon,
                playButton: playButton,
                playText: playText,
                position: i // -1 = left, 0 = center, 1 = right
            });
            
            // Play button handler
            playButton.on('pointerup', () => {
                if (i === 0) { // Only center card can be played
                    this.playCurrentMap();
                }
            });
            
            playButton.on('pointerover', () => {
                if (i === 0) {
                    playButton.setFillStyle(0x27ae60, 1);
                }
            });
            
            playButton.on('pointerout', () => {
                playButton.setFillStyle(0x27ae60, 0.9);
            });
        }
        
        // Map counter
        this.mapCounter = this.add.text(centerX, carouselY + 120, '', {
            fontSize: '16px',
            color: '#95a5a6'
        }).setOrigin(0.5);
    }
    
    createUIButtons() {
        // Progress summary
        // const stats = this.stateManager.getCompletionStats();
        
        // View Recordings button (top left)
        const recordingsButton = this.add.text(20, 20, 'Floppy Worm', {
            fontSize: '16px',
            color: '#9b59b6',
            backgroundColor: 'rgba(155, 89, 182, 0.2)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0, 0)
        //
        // recordingsButton.on('pointerup', () => {
        //     if (window.location.hostname === 'localhost' && window.location.port === '8080') {
        //         window.location.href = '/recordings';
        //     } else {
        //         window.open('/recordings', '_blank');
        //     }
        // });
        //
        // recordingsButton.on('pointerover', () => {
        //     recordingsButton.setBackgroundColor('rgba(155, 89, 182, 0.4)');
        // });
        //
        // recordingsButton.on('pointerout', () => {
        //     recordingsButton.setBackgroundColor('rgba(155, 89, 182, 0.2)');
        // });
        
        // Reset progress button (top right)
        // const resetButton = this.add.text(this.scale.width - 20, 20, 'Reset Progress', {
        //     fontSize: '16px',
        //     color: '#e74c3c',
        //     backgroundColor: 'rgba(231, 76, 60, 0.2)',
        //     padding: { x: 10, y: 5 }
        // }).setOrigin(1, 0).setInteractive();
        //
        // resetButton.on('pointerup', () => {
        //     this.resetProgress();
        // });
        //
        // resetButton.on('pointerover', () => {
        //     resetButton.setBackgroundColor('rgba(231, 76, 60, 0.4)');
        // });
        //
        // resetButton.on('pointerout', () => {
        //     resetButton.setBackgroundColor('rgba(231, 76, 60, 0.2)');
        // });
    }
    
    selectCategory(index) {
        if (index < 0 || index >= this.categories.length) return;
        
        this.selectedCategoryIndex = index;
        this.currentCategory = this.categories[index];
        this.currentMaps = this.currentCategory.getMaps();
        this.selectedMapIndex = 0;
        
        // Update category labels
        this.updateCategoryLabels();
        
        // Update carousel
        this.updateCarousel();
    }
    
    updateCategoryLabels() {
        // Current category
        this.categoryLabel.setText(this.currentCategory.displayName);
        
        // Previous category
        if (this.selectedCategoryIndex > 0) {
            const prevCategory = this.categories[this.selectedCategoryIndex - 1];
            this.categoryLabelAbove.setText('↑ ' + prevCategory.displayName);
            this.categoryLabelAbove.setVisible(true);
            this.upArrow.setAlpha(0.6);
        } else {
            this.categoryLabelAbove.setVisible(false);
            this.upArrow.setAlpha(0.2);
        }
        
        // Next category
        if (this.selectedCategoryIndex < this.categories.length - 1) {
            const nextCategory = this.categories[this.selectedCategoryIndex + 1];
            this.categoryLabelBelow.setText('↓ ' + nextCategory.displayName);
            this.categoryLabelBelow.setVisible(true);
            this.downArrow.setAlpha(0.6);
        } else {
            this.categoryLabelBelow.setVisible(false);
            this.downArrow.setAlpha(0.2);
        }
    }
    
    updateCarousel() {
        if (!this.currentMaps || this.currentMaps.length === 0) {
            // Hide carousel if no maps
            this.mapCards.forEach(card => {
                card.container.setVisible(false);
            });
            this.leftArrow.setVisible(false);
            this.rightArrow.setVisible(false);
            this.mapCounter.setVisible(false);
            return;
        }
        
        // Show carousel elements
        this.leftArrow.setVisible(true);
        this.rightArrow.setVisible(true);
        this.mapCounter.setVisible(true);
        
        // Update each card
        this.mapCards.forEach((card, cardIndex) => {
            const mapIndex = this.selectedMapIndex + card.position;
            
            if (mapIndex >= 0 && mapIndex < this.currentMaps.length) {
                const map = this.currentMaps[mapIndex];
                const progress = this.stateManager.getMapProgress(map.key);
                
                // Show card container
                card.container.setVisible(true);
                
                // Show/hide status checkmark based on completion
                card.status.setVisible(progress.completed);
                
                // Update content
                card.title.setText(map.title);
                card.description.setText(map.description || 'No description');
                
                // Best time
                if (progress.bestTime) {
                    card.time.setText(`Best: ${this.formatTime(progress.bestTime)}`);
                } else {
                    card.time.setText('Not completed');
                }
                
                // Status icon checkmark
                card.status.setText(progress.completed ? '✓' : '');
                
                // Card styling based on position
                if (card.position === 0) {
                    // Center card (selected)
                    card.container.setScale(1.05);
                    card.background.setStrokeStyle(4, 0xffffff, 1);
                    card.playButton.setInteractive();
                    card.playButton.setAlpha(1);
                } else {
                    // Side cards
                    card.container.setScale(0.85);
                    card.background.setStrokeStyle(3, 0x34495e, 0.7);
                    card.playButton.disableInteractive();
                    card.playButton.setAlpha(0.5);
                }
                
                // Keep consistent background color
                card.background.setFillStyle(0x2c3e50, 0.9);
            } else {
                // Hide card if out of range
                card.container.setVisible(false);
            }
        });
        
        // Update arrow visibility
        this.leftArrow.setAlpha(this.selectedMapIndex > 0 ? 0.8 : 0.2);
        this.rightArrow.setAlpha(this.selectedMapIndex < this.currentMaps.length - 1 ? 0.8 : 0.2);
        
        // Update map counter
        if (this.currentMaps.length > 0) {
            this.mapCounter.setText(`Map ${this.selectedMapIndex + 1} of ${this.currentMaps.length}`);
        }
    }
    
    playMenuSound(type) {
        if (!this.menuWhoosh) return;
        
        // Start the whoosh if not playing
        if (!this.menuWhoosh.isPlaying) {
            this.menuWhoosh.start();
        }
        
        // Quick swish effect
        if (type === 'map') {
            // Navigation sound - quick swish
            this.menuWhoosh.update(0.7, 0.6);
            this.time.delayedCall(50, () => {
                if (this.menuWhoosh) {
                    this.menuWhoosh.update(0, 0);
                }
            });
        } else if (type === 'category') {
            // Selection sound - stronger swish
            this.menuWhoosh.update(0.7, 0.3);
            this.time.delayedCall(100, () => {
                if (this.menuWhoosh) {
                    this.menuWhoosh.update(0, 0);
                }
            });
        } else if (type === 'select') {
            // Selection sound - stronger swish
            this.menuWhoosh.update(0.9, 1.0);
            this.time.delayedCall(100, () => {
                if (this.menuWhoosh) {
                    this.menuWhoosh.update(0, 0);
                }
            });
        }
    }
    
    navigateCategory(direction) {
        const newIndex = this.selectedCategoryIndex + direction;
        if (newIndex >= 0 && newIndex < this.categories.length) {
            this.playMenuSound('category');
            this.selectCategory(newIndex);
        }
    }
    
    navigateMap(direction) {
        const newIndex = this.selectedMapIndex + direction;
        if (newIndex >= 0 && newIndex < this.currentMaps.length) {
            this.playMenuSound('map');
            this.selectedMapIndex = newIndex;
            this.updateCarousel();
        }
    }
    
    playCurrentMap() {
        if (this.isTransitioning) return;
        if (!this.currentMaps || this.selectedMapIndex >= this.currentMaps.length) return;
        
        this.playMenuSound('select');
        const map = this.currentMaps[this.selectedMapIndex];
        this.isTransitioning = true;
        
        // Fade out and load map
        this.cameras.main.fadeOut(250, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', async () => {
            try {
                await MapLoader.loadAndStart(this, map.key, {
                    returnScene: 'MapSelectScene'
                });
            } catch (error) {
                console.error('Failed to load map:', error);
                this.scene.restart();
            }
        });
    }
    
    update(time, delta) {
        if (this.isTransitioning) return;
        
        // Apply input cooldown to prevent input from previous scenes
        if (this.inputCooldown > 0) {
            this.inputCooldown -= delta;
            
            // Reset keyboard state during cooldown
            if (this.inputCooldown > 0) {
                // Track gamepad state but don't act on it
                const pad = this.input.gamepad ? this.input.gamepad.getPad(0) : null;
                if (pad) {
                    this.upWasPressed = pad.up || (pad.leftStick && pad.leftStick.y < -0.5);
                    this.downWasPressed = pad.down || (pad.leftStick && pad.leftStick.y > 0.5);
                    this.leftWasPressed = pad.left || (pad.leftStick && pad.leftStick.x < -0.5);
                    this.rightWasPressed = pad.right || (pad.leftStick && pad.leftStick.x > 0.5);
                    this.aWasPressed = pad.A;
                    this.bWasPressed = pad.B;
                }
                return;
            }
        }
        
        // Get gamepad if available
        const pad = this.input.gamepad ? this.input.gamepad.getPad(0) : null;
        
        // Vertical navigation (categories)
        const moveUp = Phaser.Input.Keyboard.JustDown(this.cursors.up) || 
                      Phaser.Input.Keyboard.JustDown(this.wasd.W) ||
                      (pad && (pad.up || (pad.leftStick && pad.leftStick.y < -0.5)));
        const moveDown = Phaser.Input.Keyboard.JustDown(this.cursors.down) || 
                        Phaser.Input.Keyboard.JustDown(this.wasd.S) ||
                        (pad && (pad.down || (pad.leftStick && pad.leftStick.y > 0.5)));
        
        if (moveUp && !this.upWasPressed) {
            this.navigateCategory(-1);
        }
        if (moveDown && !this.downWasPressed) {
            this.navigateCategory(1);
        }
        
        // Horizontal navigation (maps)
        const moveLeft = Phaser.Input.Keyboard.JustDown(this.cursors.left) || 
                        Phaser.Input.Keyboard.JustDown(this.wasd.A) ||
                        (pad && (pad.left || (pad.leftStick && pad.leftStick.x < -0.5)));
        const moveRight = Phaser.Input.Keyboard.JustDown(this.cursors.right) || 
                         Phaser.Input.Keyboard.JustDown(this.wasd.D) ||
                         (pad && (pad.right || (pad.leftStick && pad.leftStick.x > 0.5)));
        
        if (moveLeft && !this.leftWasPressed) {
            this.navigateMap(-1);
        }
        if (moveRight && !this.rightWasPressed) {
            this.navigateMap(1);
        }
        
        // Play map
        const playPressed = Phaser.Input.Keyboard.JustDown(this.enterKey) || 
                           Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
                           (pad && pad.A && !this.aWasPressed);
        if (playPressed) {
            this.playCurrentMap();
        }
        
        // B button or ESC to refresh
        const refreshPressed = Phaser.Input.Keyboard.JustDown(this.escKey) ||
                              (pad && pad.B && !this.bWasPressed);
        if (refreshPressed) {
            this.scene.restart();
        }
        
        // Track gamepad state
        if (pad) {
            this.upWasPressed = pad.up || (pad.leftStick && pad.leftStick.y < -0.5);
            this.downWasPressed = pad.down || (pad.leftStick && pad.leftStick.y > 0.5);
            this.leftWasPressed = pad.left || (pad.leftStick && pad.leftStick.x < -0.5);
            this.rightWasPressed = pad.right || (pad.leftStick && pad.leftStick.x > 0.5);
            this.aWasPressed = pad.A;
            this.bWasPressed = pad.B;
        } else {
            // Reset states when no gamepad
            this.upWasPressed = false;
            this.downWasPressed = false;
            this.leftWasPressed = false;
            this.rightWasPressed = false;
            this.aWasPressed = false;
            this.bWasPressed = false;
        }
    }
    
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            this.stateManager.resetProgress();
            this.scene.restart();
        }
    }
    
    onProgressUpdated(progress) {
        // Refresh when progress is updated
        this.scene.restart();
    }
    
    cleanup() {
        // Remove event listeners
        this.registry.events.off(this.stateManager.events.PROGRESS_UPDATED, this.onProgressUpdated, this);
        
        // Clean up audio
        if (this.menuWhoosh) {
            this.menuWhoosh.stop();
            this.menuWhoosh = null;
        }
    }
}

// Export function to be called when a map is completed
export function completeMap(mapKey, scene) {
    const stateManager = GameStateManager.getFromScene(scene);
    stateManager.completeMap(mapKey);
}
