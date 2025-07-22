class WhooshSynthesizer {
    constructor(settings = {}) {
        // Default settings
        this.settings = {
            pitch: 0.7,
            filterBase: 200,
            resonance: 4.5,
            attack: 23,
            release: 630,
            lowBoost: 0.3,
            dynamics: 0.5,
            reverb: 0.2,
            ...settings // Override with provided settings
        };

        this.audioContext = null;
        this.nodes = null;
        this.isPlaying = false;

        // Current state
        this.volume = 0;
        this.frequency = 0;
    }

    // Initialize audio context on first use
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Create white noise buffer
    createWhiteNoise(duration) {
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    // Start the continuous whoosh sound
    start() {
        this.initAudio();

        if (this.nodes) {
            this.stop();
        }

        // Create noise source
        const noiseBuffer = this.createWhiteNoise(10);
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        noiseSource.playbackRate.value = this.settings.pitch;

        // Create main filter
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = this.settings.filterBase;
        filter.Q.value = this.settings.resonance;

        // Create secondary filter for character
        const filter2 = this.audioContext.createBiquadFilter();
        filter2.type = 'bandpass';
        filter2.frequency.value = 150 * this.settings.pitch;
        filter2.Q.value = 1.5;

        // Low frequency boost
        const lowShelf = this.audioContext.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 200;
        lowShelf.gain.value = this.settings.lowBoost * 12;

        // Dynamics compressor
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24 + (this.settings.dynamics * 20);
        compressor.knee.value = 10;
        compressor.ratio.value = 2 + (this.settings.dynamics * 6);
        compressor.attack.value = 0.003;
        compressor.release.value = 0.1;

        // Reverb
        const convolver = this.audioContext.createConvolver();
        const reverbGain = this.audioContext.createGain();
        const dryGain = this.audioContext.createGain();

        // Create reverb impulse
        const reverbTime = 2;
        const reverbDecay = 3;
        const impulseBuffer = this.audioContext.createBuffer(
            2, 
            this.audioContext.sampleRate * reverbTime, 
            this.audioContext.sampleRate
        );

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulseBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * 
                    Math.pow(1 - i / channelData.length, reverbDecay);
            }
        }
        convolver.buffer = impulseBuffer;

        reverbGain.gain.value = this.settings.reverb * 0.3;
        dryGain.gain.value = 1 - (this.settings.reverb * 0.3);

        // Main gain
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;

        // LFO for subtle modulation
        const lfo = this.audioContext.createOscillator();
        lfo.frequency.value = 0.3;
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 20 * this.settings.pitch;

        // Connect LFO
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        // Connect audio path
        noiseSource.connect(filter);
        filter.connect(filter2);
        filter2.connect(lowShelf);
        lowShelf.connect(compressor);

        // Split for reverb
        compressor.connect(dryGain);
        compressor.connect(convolver);
        convolver.connect(reverbGain);

        // Both paths to gain
        dryGain.connect(gainNode);
        reverbGain.connect(gainNode);

        gainNode.connect(this.audioContext.destination);

        // Start
        noiseSource.start();
        lfo.start();

        // Store nodes
        this.nodes = {
            source: noiseSource,
            filter: filter,
            filter2: filter2,
            lowShelf: lowShelf,
            compressor: compressor,
            convolver: convolver,
            reverbGain: reverbGain,
            dryGain: dryGain,
            gain: gainNode,
            lfo: lfo
        };

        this.isPlaying = true;
    }

    // Stop the sound
    stop() {
        if (this.nodes) {
            // Stop oscillators first
            try {
                this.nodes.source.stop();
                this.nodes.lfo.stop();
            } catch (e) {
                // Nodes may already be stopped
            }
            
            // Disconnect all nodes from the audio graph
            Object.values(this.nodes).forEach(node => {
                if (node && typeof node.disconnect === 'function') {
                    try {
                        node.disconnect();
                    } catch (e) {
                        // Node may already be disconnected
                    }
                }
            });
            
            this.nodes = null;
            this.isPlaying = false;
        }
    }

    // Update sound parameters based on worm state
    update(volume, frequency) {
        if (!this.nodes || !this.isPlaying) return;

        // Clamp values to 0-1 range
        this.volume = Math.max(0, Math.min(1, volume));
        this.frequency = Math.max(0, Math.min(1, frequency));

        // Update frequency (0-1 mapped to base frequency + 0-2000Hz)
        const targetFreq = (this.settings.filterBase + (this.frequency * 2000)) * this.settings.pitch;
        this.nodes.filter.frequency.value = targetFreq;

        // Update secondary filter based on frequency
        this.nodes.filter2.frequency.value = (150 + this.frequency * 300) * this.settings.pitch;

        // Update volume
        this.nodes.gain.gain.value = this.volume * 0.8;
    }

    // Update settings on the fly
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        if (this.nodes && this.isPlaying) {
            // Update nodes that can be changed while playing
            this.nodes.source.playbackRate.value = this.settings.pitch;
            this.nodes.filter.Q.value = this.settings.resonance;
            this.nodes.lowShelf.gain.value = this.settings.lowBoost * 12;
            this.nodes.compressor.threshold.value = -24 + (this.settings.dynamics * 20);
            this.nodes.compressor.ratio.value = 2 + (this.settings.dynamics * 6);
            this.nodes.reverbGain.gain.value = this.settings.reverb * 0.3;
            this.nodes.dryGain.gain.value = 1 - (this.settings.reverb * 0.3);

            // Re-apply current state
            this.update(this.volume, this.frequency);
        }
    }

    // Get current settings
    getSettings() {
        return { ...this.settings };
    }
}

// Example usage:
/*
    // Create with custom settings
const whoosh = new WhooshSynthesizer({
    pitch: 0.5,        // Deeper sound
    filterBase: 150,   // Darker base tone
    resonance: 3.0,    // Less whistle
    lowBoost: 0.6,     // More bass
    reverb: 0.3        // More spacious
});

// Start the sound engine
whoosh.start();

// In your game loop (60fps):
// Map your physics to volume and frequency
const volume = worm.isAirborne ? worm.velocity / maxVelocity : 0;
const frequency = (worm.launchForce / maxForce) * 0.7 + (worm.height / maxHeight) * 0.3;

    // Update the sound
whoosh.update(volume, frequency);

    // When done
whoosh.stop();
*/

export default WhooshSynthesizer;
