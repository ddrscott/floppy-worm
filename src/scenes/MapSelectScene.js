import Phaser from 'phaser';
import { getCategories, loadMapData, createMapScene } from './maps/MapDataRegistry';
import MapLoader from '../services/MapLoader';
import { getCachedBuildMode, BuildConfig } from '../utils/buildMode';
import GameStateManager from '../services/GameStateManager';
import Random from '../utils/Random';
import { getMenuAudio } from '../audio/MenuAudio';

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
        
        // Remember map positions for each category
        this.categoryMapPositions = {};
        
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
        this.menuAudio = null;
    }
    
    init() {
        // Reset random seed for consistent behavior
        Random.setSeed(12345); // Fixed seed for menu scene
        
        // Load saved category positions from registry
        const savedPositions = this.registry.get('categoryMapPositions');
        if (savedPositions) {
            this.categoryMapPositions = savedPositions;
        } else {
            this.categoryMapPositions = {};
        }
        
        // Load saved category index
        this.selectedCategoryIndex = this.registry.get('selectedCategoryIndex') || 0;
        
        // Check if we're returning from a game and restore the exact position
        const lastSelectedCategory = this.registry.get('lastSelectedCategory');
        const lastSelectedMapIndex = this.registry.get('lastSelectedMapIndex');
        
        if (lastSelectedCategory !== undefined && lastSelectedMapIndex !== undefined) {
            // We're returning from a game, use the last selected map index
            this.selectedMapIndex = lastSelectedMapIndex;
            // Clear the temporary storage
            this.registry.remove('lastSelectedCategory');
            this.registry.remove('lastSelectedMapIndex');
        } else {
            // Normal initialization
            this.selectedMapIndex = 0;
        }
        
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
    
    preload() {
        // Preload background music here so it's ready for all levels
        // This prevents hitches when starting a level
        console.log('🎵 Preloading background music in MapSelectScene');
        this.load.audio('backgroundMusic', 'audio/strawberry-house-45kps.mp3');
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
        
        // Initialize menu audio from registry
        this.menuAudio = getMenuAudio(this);
        
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
        
        // Load the saved category or first category
        if (this.categories.length > 0) {
            // Ensure saved index is valid
            if (this.selectedCategoryIndex >= this.categories.length) {
                this.selectedCategoryIndex = 0;
            }
            // Check if we have a preserved map index (returning from game)
            const hasPreservedMapIndex = this.selectedMapIndex > 0;
            this.selectCategory(this.selectedCategoryIndex, hasPreservedMapIndex);
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
        this.cardWidth = 280;
        this.cardHeight = 180;
        this.cardSpacing = 20;
        
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
        const downArrowY = carouselY + this.cardHeight/2 + otherCategoryFontSize * 4;
        const nextCategoryY = downArrowY + otherCategoryFontSize * 3;
        
        // Create category labels
        // Create vertical arrows for category navigation
        this.upArrow = this.add.triangle(
            centerX, upArrowY,
            0, 15, 15, 15, 7.5, 0,
            0x4ecdc4, 0.6
        );
        // Add larger invisible hit area for mobile
        const upHitArea = this.add.rectangle(centerX, upArrowY, 80, 50, 0xffffff, 0)
            .setInteractive();
        
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
        );
        // Add larger invisible hit area for mobile
        const downHitArea = this.add.rectangle(centerX, downArrowY, 80, 50, 0xffffff, 0)
            .setInteractive();
        
        // Arrow click handlers for categories (use hit areas)
        upHitArea.on('pointerup', () => {
            this.navigateCategory(-1);
        });
        
        downHitArea.on('pointerup', () => {
            this.navigateCategory(1);
        });
        
        upHitArea.on('pointerover', () => {
            this.upArrow.setAlpha(0.8);
        });
        
        upHitArea.on('pointerout', () => {
            this.upArrow.setAlpha(0.6);
        });
        
        downHitArea.on('pointerover', () => {
            this.downArrow.setAlpha(0.8);
        });
        
        downHitArea.on('pointerout', () => {
            this.downArrow.setAlpha(0.6);
        });
        
        // Create carousel viewport container (for masking)
        this.carouselViewport = this.add.container(centerX, carouselY);
        
        // Create scrollable carousel container inside viewport
        this.mapCarousel = this.add.container(0, 0);
        this.carouselViewport.add(this.mapCarousel);
        
        // Create left/right arrows for map navigation
        this.leftArrow = this.add.triangle(
            centerX - this.cardWidth * 0.6, carouselY,
            20, 0, 20, 40, 0, 20,
            0x4ecdc4, 0.8
        );
        // Add larger invisible hit area for mobile
        const leftHitArea = this.add.rectangle(
            centerX - this.cardWidth * 0.6, carouselY, 60, 100, 0xffffff, 0
        ).setInteractive();
        
        this.rightArrow = this.add.triangle(
            centerX + this.cardWidth * 0.6, carouselY,
            0, 0, 20, 20, 0, 40,
            0x4ecdc4, 0.8
        );
        // Add larger invisible hit area for mobile
        const rightHitArea = this.add.rectangle(
            centerX + this.cardWidth * 0.6, carouselY, 60, 100, 0xffffff, 0
        ).setInteractive();
        
        // Arrow click handlers for maps (use hit areas)
        leftHitArea.on('pointerup', () => {
            this.navigateMap(-1);
        });
        
        rightHitArea.on('pointerup', () => {
            this.navigateMap(1);
        });
        
        leftHitArea.on('pointerover', () => {
            this.leftArrow.setAlpha(1);
        });
        
        leftHitArea.on('pointerout', () => {
            this.leftArrow.setAlpha(0.8);
        });
        
        rightHitArea.on('pointerover', () => {
            this.rightArrow.setAlpha(1);
        });
        
        rightHitArea.on('pointerout', () => {
            this.rightArrow.setAlpha(0.8);
        });
        
        // Initialize empty cards array
        this.mapCards = [];
        
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
    
    selectCategory(index, preserveCurrentMapIndex = false) {
        if (index < 0 || index >= this.categories.length) return;
        
        // Save current map position for the current category before switching
        if (this.currentCategory && !preserveCurrentMapIndex) {
            this.categoryMapPositions[this.currentCategory.name] = this.selectedMapIndex;
            // Save to registry for persistence
            this.registry.set('categoryMapPositions', this.categoryMapPositions);
        }
        
        this.selectedCategoryIndex = index;
        this.currentCategory = this.categories[index];
        this.currentMaps = this.currentCategory.getMaps();
        
        // Save the selected category index to registry
        this.registry.set('selectedCategoryIndex', this.selectedCategoryIndex);
        
        // If preserveCurrentMapIndex is true (returning from game), use the already set selectedMapIndex
        // Otherwise, restore the saved map position for this category
        if (!preserveCurrentMapIndex) {
            this.selectedMapIndex = this.categoryMapPositions[this.currentCategory.name] || 0;
        }
        
        // Ensure the restored position is valid for the current maps
        if (this.selectedMapIndex >= this.currentMaps.length) {
            this.selectedMapIndex = 0;
        }
        
        // Update category labels
        this.updateCategoryLabels();
        
        // Recreate carousel with new maps
        this.recreateCarousel();
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
    
    createCard(mapData, index) {
        const x = index * (this.cardWidth + this.cardSpacing);
        const cardContainer = this.add.container(x, 0);
        
        // Card background
        const cardBg = this.add.rectangle(0, 0, this.cardWidth, this.cardHeight, 0x2c3e50, 0.9);
        cardBg.setStrokeStyle(3, 0x34495e, 1);
        
        // Card title
        const titleText = this.add.text(0, -60, mapData.title, {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Card description
        const descText = this.add.text(0, -20, mapData.description || 'No description', {
            fontSize: '14px',
            color: '#95a5a6',
            wordWrap: { width: this.cardWidth - 40 }
        }).setOrigin(0.5);
        
        // Get progress
        const progress = this.stateManager.getMapProgress(mapData.key);
        
        // Best time
        const timeText = this.add.text(0, 35, '', {
            fontSize: '16px',
            color: '#4ecdc4'
        }).setOrigin(0.5);
        
        if (progress.bestTime) {
            timeText.setText(`Best: ${this.formatTime(progress.bestTime)}`);
        } else {
            timeText.setText('Not completed');
        }
        
        // Play button
        const playButton = this.add.rectangle(0, 65, 100, 30, 0x27ae60, 1);
        playButton.setStrokeStyle(2, 0x2ecc71, 1);
        
        const playText = this.add.text(0, 65, 'PLAY', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Status icon - large checkmark for completed levels
        const statusIcon = this.add.text(this.cardWidth/2 - 30, -this.cardHeight/2 + 30, progress.completed ? '✓' : '', {
            fontSize: '48px',
            color: '#2ecc71',
            fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0.9);
        statusIcon.setVisible(progress.completed);
        
        // Add all elements to the card container
        cardContainer.add([cardBg, statusIcon, titleText, descText, timeText, playButton, playText]);
        
        // Store card reference
        return {
            container: cardContainer,
            background: cardBg,
            title: titleText,
            description: descText,
            time: timeText,
            status: statusIcon,
            playButton: playButton,
            playText: playText,
            mapKey: mapData.key,
            index: index
        };
    }
    
    recreateCarousel() {
        // Clear existing cards
        this.mapCards.forEach(card => {
            card.container.destroy();
        });
        this.mapCards = [];
        
        if (!this.currentMaps || this.currentMaps.length === 0) {
            this.leftArrow.setVisible(false);
            this.rightArrow.setVisible(false);
            this.mapCounter.setVisible(false);
            return;
        }
        
        // Show navigation elements
        this.leftArrow.setVisible(true);
        this.rightArrow.setVisible(true);
        this.mapCounter.setVisible(true);
        
        // Create cards for all maps
        this.currentMaps.forEach((map, index) => {
            const card = this.createCard(map, index);
            this.mapCarousel.add(card.container);
            this.mapCards.push(card);
            
            // Set up play button interaction
            card.playButton.on('pointerup', () => {
                if (index === this.selectedMapIndex) {
                    this.playCurrentMap();
                }
            });
            
            card.playButton.on('pointerover', () => {
                if (index === this.selectedMapIndex) {
                    card.playButton.setFillStyle(0x27ae60, 1);
                }
            });
            
            card.playButton.on('pointerout', () => {
                card.playButton.setFillStyle(0x27ae60, 1);
            });
        });
        
        // Update initial state without animation (instant positioning)
        this.updateCarousel(true);
    }
    
    updateCarousel(instant = false) {
        if (!this.mapCards || this.mapCards.length === 0) return;
        
        // Calculate target position for carousel
        const targetX = -this.selectedMapIndex * (this.cardWidth + this.cardSpacing);
        
        if (instant) {
            // Instant positioning without animation (for category switches)
            this.mapCarousel.x = targetX;
        } else {
            // Animate carousel to center selected card (for horizontal navigation)
            this.tweens.add({
                targets: this.mapCarousel,
                x: targetX,
                duration: 200,
                ease: 'Power2'
            });
        }
        
        // Update each card's appearance based on selection
        this.mapCards.forEach((card, index) => {
            if (index === this.selectedMapIndex) {
                // Selected card
                if (instant) {
                    // Set scale instantly
                    card.container.setScale(1.05);
                } else {
                    // Animate scale
                    this.tweens.add({
                        targets: card.container,
                        scaleX: 1.05,
                        scaleY: 1.05,
                        duration: 150,
                        ease: 'Back.easeOut'
                    });
                }
                card.background.setStrokeStyle(4, 0xffffff, 1);
                card.playButton.setInteractive();
                card.playButton.setAlpha(1);
            } else {
                // Non-selected cards
                if (instant) {
                    // Set scale instantly
                    card.container.setScale(0.85);
                } else {
                    // Animate scale
                    this.tweens.add({
                        targets: card.container,
                        scaleX: 0.85,
                        scaleY: 0.85,
                        duration: 150,
                        ease: 'Power2'
                    });
                }
                card.background.setStrokeStyle(3, 0x34495e, 0.7);
                card.playButton.disableInteractive();
                card.playButton.setAlpha(0.5);
            }
        });
        
        // Update arrow visibility
        this.leftArrow.setAlpha(this.selectedMapIndex > 0 ? 0.8 : 0.2);
        this.rightArrow.setAlpha(this.selectedMapIndex < this.currentMaps.length - 1 ? 0.8 : 0.2);
        
        // Update map counter
        this.mapCounter.setText(`Map ${this.selectedMapIndex + 1} of ${this.currentMaps.length}`);
    }
    
    playMenuSound(type) {
        if (this.menuAudio) {
            this.menuAudio.play(type);
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
            
            // Save the new position for this category
            if (this.currentCategory) {
                this.categoryMapPositions[this.currentCategory.name] = this.selectedMapIndex;
                // Save to registry for persistence
                this.registry.set('categoryMapPositions', this.categoryMapPositions);
            }
            
            this.updateCarousel();
        }
    }
    
    playCurrentMap() {
        if (this.isTransitioning) return;
        if (!this.currentMaps || this.selectedMapIndex >= this.currentMaps.length) return;
        
        this.playMenuSound('select');
        const map = this.currentMaps[this.selectedMapIndex];
        this.isTransitioning = true;
        
        // Save current map position for this category before playing
        if (this.currentCategory) {
            this.categoryMapPositions[this.currentCategory.name] = this.selectedMapIndex;
            this.registry.set('categoryMapPositions', this.categoryMapPositions);
            
            // Also save the selected map index globally for when we return
            this.registry.set('lastSelectedMapIndex', this.selectedMapIndex);
            this.registry.set('lastSelectedCategory', this.currentCategory.name);
        }
        
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
        // Update the checkmark for the completed map without restarting the scene
        if (this.mapCards && progress && progress.mapKey) {
            // Find the card for the updated map
            const card = this.mapCards.find(c => c.mapKey === progress.mapKey);
            if (card && progress.completed) {
                // Update the checkmark visibility
                card.status.setVisible(true);
                // Update the time text
                if (progress.bestTime) {
                    card.time.setText(`Best: ${this.formatTime(progress.bestTime)}`);
                }
            }
        }
    }
    
    cleanup() {
        // Remove event listeners
        this.registry.events.off(this.stateManager.events.PROGRESS_UPDATED, this.onProgressUpdated, this);
        
        // Note: We don't destroy menuAudio here as it's shared across scenes
    }
}

// Export function to be called when a map is completed
export function completeMap(mapKey, scene) {
    const stateManager = GameStateManager.getFromScene(scene);
    stateManager.completeMap(mapKey);
}
