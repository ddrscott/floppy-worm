/**
 * Shared goal collection logic and effects
 * Used by both JsonMapBase and PlaybackScene to ensure consistent behavior
 */
export default class GoalCollectionManager {
    constructor(scene) {
        this.scene = scene;
        this.goals = [];
        this.collectedGoals = new Set();
    }

    /**
     * Initialize goals from map data
     * @param {Object} entitiesData - Map entities data containing goal/goals
     */
    initializeGoals(entitiesData) {
        this.goals = [];
        this.collectedGoals.clear();

        // Support both single goal and multiple goals
        if (entitiesData.goals && entitiesData.goals.length > 0) {
            // Multiple goals - must collect ALL to win
            entitiesData.goals.forEach((goalData, index) => {
                const goal = this.createGoal(goalData.x, goalData.y, `goal_${index}`);
                this.goals.push(goal);
            });
        } else if (entitiesData.goal) {
            // Single goal
            const goal = this.createGoal(entitiesData.goal.x, entitiesData.goal.y, 'goal_0');
            this.goals.push(goal);
        }
    }

    /**
     * Create a single goal with visual elements
     */
    createGoal(x, y, id) {
        const goal = this.scene.add.star(x, y, 5, 15, 25, 0xffd700);
        const innerStar = this.scene.add.star(x, y, 5, 10, 20, 0xffed4e).setDepth(1);
        
        // Store data for collision detection
        goal.x = x;
        goal.y = y;
        goal.innerStar = innerStar;
        goal.id = id;
        goal.collected = false;
        
        // Rotate the goal
        this.scene.tweens.add({
            targets: [goal, innerStar],
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
        
        return goal;
    }

    /**
     * Check collision between worm segments and goals
     * @param {Array} segments - Worm segments to check
     * @param {Array} segmentRadii - Radii of worm segments
     * @returns {boolean} - True if all goals are collected
     */
    checkGoalCollisions(segments, segmentRadii) {
        if (!this.goals || !segments) return false;

        let newCollections = false;

        // Check each uncollected goal for collision
        for (let goalIndex = 0; goalIndex < this.goals.length; goalIndex++) {
            const goal = this.goals[goalIndex];
            
            // Skip already collected goals
            if (goal.collected) continue;
            
            // Check if any worm segment is touching this goal
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const distance = Phaser.Math.Distance.Between(
                    segment.position.x, segment.position.y,
                    goal.x, goal.y
                );
                
                const segmentRadius = segmentRadii[i] || 15;
                const goalRadius = 20;
                const collisionDistance = segmentRadius + goalRadius;
                
                if (distance < collisionDistance && !goal.collected) {
                    // Mark goal as collected
                    goal.collected = true;
                    this.collectedGoals.add(goal.id);
                    newCollections = true;
                    
                    // Visual feedback for collection
                    this.collectGoalEffect(goal);
                    
                    // Check if all goals are collected
                    if (this.collectedGoals.size === this.goals.length) {
                        return true; // All goals collected!
                    } else {
                        // Show progress
                        this.showGoalProgress();
                    }
                    
                    break; // Move to next goal after collecting this one
                }
            }
        }

        return false; // Not all goals collected yet
    }

    /**
     * Goal collection effect - visual feedback when a goal is collected
     */
    collectGoalEffect(goal) {
        // Stop rotation
        this.scene.tweens.killTweensOf([goal, goal.innerStar]);
        
        // Create simple star particles as fallback
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 200 + Math.random() * 200;
            const particle = this.scene.add.star(goal.x, goal.y, 5, 3, 6, 0xffd700);
            particle.setScale(0.3 + Math.random() * 0.3);
            particle.setDepth(999);
            
            this.scene.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * speed,
                y: particle.y + Math.sin(angle) * speed + 100,
                alpha: 0,
                scale: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Fade and scale effect
        this.scene.tweens.add({
            targets: [goal, goal.innerStar],
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                goal.visible = false;
                if (goal.innerStar) {
                    goal.innerStar.visible = false;
                }
            }
        });
        
        // Play sound if available
        if (this.scene.sound) {
            if (this.scene.sound.get && this.scene.sound.get('goalCollect')) {
                this.scene.sound.play('goalCollect');
            } else if (this.scene.sound.get && this.scene.sound.get('collect')) {
                this.scene.sound.play('collect');
            }
        }

        // Hide from minimap if available
        if (this.scene.minimap) {
            this.scene.minimap.ignore(goal);
            this.scene.minimap.ignore(goal.innerStar);
        }

        // Update star counter if the scene has one
        if (this.scene.updateStarCounter) {
            this.scene.updateStarCounter();
        }
        
        // Animate star to counter if the scene has one
        if (this.scene.animateStarToCounter) {
            this.scene.animateStarToCounter(goal.x, goal.y);
        }
    }

    /**
     * Show progress when collecting multiple goals
     */
    showGoalProgress() {
        if (!this.goals || this.goals.length <= 1) {
            return;
        }
        
        // Don't show if we're already showing progress text (for JsonMapBase compatibility)
        if (this.scene.activeProgressText) {
            return;
        }
        
        const remaining = this.goals.length - this.collectedGoals.size;
        const message = remaining === 1 
            ? '1 goal remaining!' 
            : `${remaining} goals remaining!`;
        
        // Create temporary text
        const progressText = this.scene.add.text(
            this.scene.scale.width / 2,
            100,
            message,
            {
                fontSize: '32px',
                color: '#ffd700',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 }
            }
        );
        progressText.setOrigin(0.5);
        progressText.setScrollFactor(0);
        progressText.setDepth(1000);
        
        // Track the active progress text if the scene supports it
        if (this.scene.activeProgressText !== undefined) {
            this.scene.activeProgressText = progressText;
        }
        
        // Hide from minimap if available
        if (this.scene.minimap) {
            this.scene.minimap.ignore(progressText);
        }
        
        // Pulse animation
        this.scene.tweens.add({
            targets: progressText,
            scale: 1.2,
            duration: 300,
            yoyo: true,
            ease: 'Power2'
        });
        
        // Fade out and remove
        this.scene.tweens.add({
            targets: progressText,
            alpha: 0,
            duration: 1500,
            delay: 500,
            onComplete: () => {
                progressText.destroy();
                // Clear the active progress text if the scene tracks it
                if (this.scene.activeProgressText === progressText) {
                    this.scene.activeProgressText = null;
                }
            }
        });
    }

    /**
     * Show victory celebration effect
     */
    showVictoryEffect() {
        // Create victory text
        const victoryText = this.scene.add.text(
            this.scene.scale.width / 2,
            this.scene.scale.height / 2,
            'All Goals Collected!',
            {
                fontSize: '48px',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 6
            }
        );
        victoryText.setOrigin(0.5);
        victoryText.setScrollFactor(0);
        victoryText.setDepth(1000);
        
        // Create celebration particles
        const colors = [0xffd700, 0xffed4e, 0xff6b6b, 0x74b9ff];
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 300 + Math.random() * 300;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = this.scene.add.star(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2 - 50,
                5, 4, 8, color
            );
            particle.setScale(0.5 + Math.random() * 0.5);
            particle.setDepth(999);
            particle.setScrollFactor(0);
            
            this.scene.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * speed,
                y: particle.y + Math.sin(angle) * speed + 150,
                alpha: 0,
                scale: 0,
                rotation: Math.random() * Math.PI * 4,
                duration: 2000,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Animate victory text
        this.scene.tweens.add({
            targets: victoryText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 2,
            ease: 'Power2',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: victoryText,
                    alpha: 0,
                    duration: 1000,
                    delay: 1000,
                    onComplete: () => {
                        victoryText.destroy();
                    }
                });
            }
        });
    }

    /**
     * Reset all goals for replay
     */
    resetGoals() {
        this.collectedGoals.clear();
        this.goals.forEach(goal => {
            goal.collected = false;
            goal.visible = true;
            if (goal.innerStar) {
                goal.innerStar.visible = true;
            }
            // Restart rotation animation
            this.scene.tweens.add({
                targets: [goal, goal.innerStar],
                rotation: Math.PI * 2,
                duration: 3000,
                repeat: -1
            });
        });
    }

    /**
     * Get current collection status
     */
    getStatus() {
        return {
            total: this.goals.length,
            collected: this.collectedGoals.size,
            remaining: this.goals.length - this.collectedGoals.size,
            allCollected: this.collectedGoals.size === this.goals.length
        };
    }

    /**
     * Clean up
     */
    destroy() {
        this.goals.forEach(goal => {
            if (goal.innerStar) {
                goal.innerStar.destroy();
            }
            goal.destroy();
        });
        this.goals = [];
        this.collectedGoals.clear();
    }
}