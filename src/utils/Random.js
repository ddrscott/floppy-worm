/**
 * Deterministic random number generator using Linear Congruential Generator (LCG)
 * This ensures reproducible randomness across game sessions
 * 
 * IMPORTANT: Each map ALWAYS uses the same seed (derived from its mapKey)
 * This means:
 * - Electric platform sparks always appear in the same pattern
 * - Ice crystals are always in the same positions
 * - Water bubbles follow the same sequence
 * - Worm particle effects are consistent
 * 
 * This is crucial for:
 * - Speedrunning (everyone gets the same RNG)
 * - Skill-based gameplay (players can learn and master patterns)
 * - Fair competition (no lucky/unlucky runs)
 * - Recording playback (replays match original gameplay exactly)
 */
const Random = {
    seed: Date.now(), // Default seed, will be reset by scenes
    initialSeed: Date.now(), // Store initial seed for reset

    /**
     * Set the seed for the random number generator
     * @param {number} seed - The seed value
     */
    setSeed(seed) {
        this.seed = seed;
        this.initialSeed = seed;
    },

    /**
     * Reset to the initial seed
     */
    reset() {
        this.seed = this.initialSeed;
    },

    /**
     * Generate a random float between 0 (inclusive) and 1 (exclusive)
     * Equivalent to Math.random()
     * @returns {number} Random float [0, 1)
     */
    random() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    },

    /**
     * Generate a random float between min and max
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Random float [min, max)
     */
    float(min, max) {
        return min + this.random() * (max - min);
    },

    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @returns {number} Random integer [min, max]
     */
    int(min, max) {
        return Math.floor(min + this.random() * (max - min + 1));
    },

    /**
     * Generate a random boolean
     * @param {number} probability - Probability of true (0-1), default 0.5
     * @returns {boolean} Random boolean
     */
    bool(probability = 0.5) {
        return this.random() < probability;
    },

    /**
     * Pick a random element from an array
     * @param {Array} array - The array to pick from
     * @returns {*} Random element from the array
     */
    pick(array) {
        if (!array || array.length === 0) return undefined;
        return array[this.int(0, array.length - 1)];
    },

    /**
     * Shuffle an array in place using Fisher-Yates algorithm
     * @param {Array} array - The array to shuffle
     * @returns {Array} The shuffled array (same reference)
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

export default Random;