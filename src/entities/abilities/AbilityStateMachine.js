export default class AbilityStateMachine {
    constructor() {
        this.states = {
            DEFAULT: 'default',
            ROLLING: 'rolling', 
            JUMPING: 'jumping'
        };
        
        this.currentState = this.states.DEFAULT;
        this.previousState = null;
        this.listeners = new Map();
        
        // Define valid state transitions
        this.validTransitions = {
            [this.states.DEFAULT]: [this.states.ROLLING, this.states.JUMPING],
            [this.states.ROLLING]: [this.states.DEFAULT, this.states.JUMPING],
            [this.states.JUMPING]: [this.states.DEFAULT, this.states.ROLLING]
        };
    }
    
    canTransitionTo(newState) {
        const validStates = this.validTransitions[this.currentState];
        return validStates && validStates.includes(newState);
    }
    
    transitionTo(newState) {
        if (!this.canTransitionTo(newState)) {
            console.warn(`Invalid state transition from ${this.currentState} to ${newState}`);
            return false;
        }
        
        const oldState = this.currentState;
        this.previousState = oldState;
        this.currentState = newState;
        
        // Emit state change event
        this.emit('stateChange', {
            from: oldState,
            to: newState,
            timestamp: performance.now()
        });
        
        // Emit specific exit/enter events
        this.emit(`exit:${oldState}`, { to: newState });
        this.emit(`enter:${newState}`, { from: oldState });
        
        return true;
    }
    
    getCurrentState() {
        return this.currentState;
    }
    
    getPreviousState() {
        return this.previousState;
    }
    
    isInState(state) {
        return this.currentState === state;
    }
    
    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
    
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in state machine event handler for ${event}:`, error);
            }
        });
    }
    
    // Handle button inputs and determine state transitions
    handleModeInputs(rollButtonPressed, jumpButtonPressed, rollButtonJustPressed, jumpButtonJustPressed) {
        const currentState = this.currentState;
        let requestedTransition = null;
        
        switch (currentState) {
            case this.states.DEFAULT:
                if (rollButtonJustPressed) {
                    requestedTransition = this.states.ROLLING;
                } else if (jumpButtonJustPressed) {
                    requestedTransition = this.states.JUMPING;
                }
                break;
                
            case this.states.ROLLING:
                if (jumpButtonJustPressed) {
                    // Jump takes priority - exit roll and enter jump
                    requestedTransition = this.states.JUMPING;
                } else if (!rollButtonPressed) {
                    // Roll released - check if jump is held
                    if (jumpButtonPressed) {
                        requestedTransition = this.states.JUMPING;
                    } else {
                        requestedTransition = this.states.DEFAULT;
                    }
                }
                break;
                
            case this.states.JUMPING:
                if (rollButtonJustPressed) {
                    // Roll takes priority - exit jump and enter roll
                    requestedTransition = this.states.ROLLING;
                } else if (!jumpButtonPressed) {
                    // Jump released - check if roll is held
                    if (rollButtonPressed) {
                        requestedTransition = this.states.ROLLING;
                    } else {
                        requestedTransition = this.states.DEFAULT;
                    }
                }
                break;
        }
        
        if (requestedTransition !== null) {
            return this.transitionTo(requestedTransition);
        }
        
        return false;
    }
    
    reset() {
        const oldState = this.currentState;
        this.currentState = this.states.DEFAULT;
        this.previousState = null;
        
        if (oldState !== this.states.DEFAULT) {
            this.emit('stateChange', {
                from: oldState,
                to: this.states.DEFAULT,
                timestamp: performance.now()
            });
            this.emit(`exit:${oldState}`, { to: this.states.DEFAULT });
            this.emit(`enter:${this.states.DEFAULT}`, { from: oldState });
        }
    }
}