/**
 * Analytics utility for tracking game events with Plausible
 */

// Initialize Plausible function if not already defined
function initPlausible() {
    if (typeof window !== 'undefined') {
        window.plausible = window.plausible || function() { 
            (window.plausible.q = window.plausible.q || []).push(arguments);
        };
        return window.plausible;
    }
    return null;
}

/**
 * Track when a game/map starts
 * @param {string} mapKey - The identifier of the map being started
 */
export function trackGameStart(mapKey) {
    if (!initPlausible()) return;
    
    window.plausible('game-start', { 
        props: {
            map: mapKey
        }
    });
}

/**
 * Track when a game ends (victory or restart)
 * @param {string} mapKey - The identifier of the map
 * @param {string} state - Either "victory" or "restart" 
 * @param {number} duration - Time in milliseconds
 * @param {string} [deathReason] - Optional reason for restart/death
 */
export function trackGameFinish(mapKey, state, duration, deathReason = null) {
    if (!initPlausible()) return;
    
    // Convert duration from ms to seconds, rounded to 1 decimal
    const durationInSeconds = Math.round(duration / 100) / 10;
    
    const props = {
        map: mapKey,
        state: state,
        duration: durationInSeconds
    };
    
    // Add death reason if it's a restart
    if (state === 'restart' && deathReason) {
        props.death_reason = deathReason;
    }
    
    window.plausible('game-finish', { props });
}

/**
 * Track map selection from the menu
 * @param {string} mapKey - The identifier of the map selected
 * @param {string} category - The category of the map
 */
export function trackMapSelect(mapKey, category) {
    if (!initPlausible()) return;
    window.plausible('map-select', { 
        props: {
            map: mapKey,
            category: category
        }
    });
}
