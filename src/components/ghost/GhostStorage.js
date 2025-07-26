export default class GhostStorage {
    constructor() {
        this.storagePrefix = 'floppyworm_ghost_';
        this.metadataPrefix = 'floppyworm_ghost_meta_';
    }
    
    // Generate a hash for the map to detect changes
    async generateMapHash(mapData) {
        // Create a string representation of important map features
        const mapString = JSON.stringify({
            platforms: mapData.platforms,
            entities: mapData.entities,
            dimensions: mapData.dimensions
        });
        
        // Simple hash function (could use crypto.subtle.digest for better hash)
        let hash = 0;
        for (let i = 0; i < mapString.length; i++) {
            const char = mapString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }
    
    // Save ghost data
    async saveGhost(mapKey, mapData, recordingData, completionTime) {
        if (!mapKey || !recordingData) {
            console.error('Invalid data for saving ghost');
            return false;
        }
        
        try {
            const mapHash = await this.generateMapHash(mapData);
            
            // Create metadata
            const metadata = {
                version: 1,
                mapKey: mapKey,
                mapHash: mapHash,
                completionTime: completionTime,
                recordedAt: new Date().toISOString(),
                compression: recordingData.compression,
                encoding: recordingData.encoding,
                segmentCount: recordingData.segmentCount,
                frameCount: recordingData.frameCount,
                duration: recordingData.duration
            };
            
            // Create full ghost data object
            const ghostData = {
                ...metadata,
                frames: recordingData.data
            };
            
            // Check storage size before saving
            const dataSize = JSON.stringify(ghostData).length;
            const estimatedSizeMB = dataSize / (1024 * 1024);
            
            if (estimatedSizeMB > 2) {
                console.warn(`Ghost data is large: ${estimatedSizeMB.toFixed(2)}MB`);
            }
            
            // Save to localStorage
            const storageKey = this.storagePrefix + mapKey;
            localStorage.setItem(storageKey, JSON.stringify(ghostData));
            
            // Also save metadata separately for quick access
            const metaKey = this.metadataPrefix + mapKey;
            localStorage.setItem(metaKey, JSON.stringify(metadata));
            
            console.log(`Ghost saved for ${mapKey}: ${completionTime}ms, ${recordingData.frameCount} frames`);
            return true;
            
        } catch (error) {
            console.error('Failed to save ghost:', error);
            
            // Handle quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded. Consider clearing old ghosts.');
                // Could implement auto-cleanup of oldest ghosts here
            }
            
            return false;
        }
    }
    
    // Load ghost data
    async loadGhost(mapKey, mapData) {
        if (!mapKey) {
            return null;
        }
        
        try {
            const storageKey = this.storagePrefix + mapKey;
            const storedData = localStorage.getItem(storageKey);
            
            if (!storedData) {
                return null;
            }
            
            const ghostData = JSON.parse(storedData);
            
            // Validate version
            if (ghostData.version !== 1) {
                console.warn(`Unsupported ghost version: ${ghostData.version}`);
                return null;
            }
            
            // Validate map hasn't changed
            const currentMapHash = await this.generateMapHash(mapData);
            if (ghostData.mapHash !== currentMapHash) {
                console.warn('Map has changed since ghost was recorded. Clearing ghost.');
                this.deleteGhost(mapKey);
                return null;
            }
            
            return {
                completionTime: ghostData.completionTime,
                frameCount: ghostData.frameCount,
                duration: ghostData.duration,
                segmentCount: ghostData.segmentCount,
                compression: ghostData.compression,
                encoding: ghostData.encoding,
                data: ghostData.frames
            };
            
        } catch (error) {
            console.error('Failed to load ghost:', error);
            return null;
        }
    }
    
    // Get ghost metadata without loading full data
    getGhostMetadata(mapKey) {
        try {
            const metaKey = this.metadataPrefix + mapKey;
            const metadata = localStorage.getItem(metaKey);
            
            if (!metadata) {
                // Try to extract from full data
                const fullData = localStorage.getItem(this.storagePrefix + mapKey);
                if (!fullData) return null;
                
                const ghostData = JSON.parse(fullData);
                const { frames, ...meta } = ghostData;
                return meta;
            }
            
            return JSON.parse(metadata);
        } catch (error) {
            console.error('Failed to get ghost metadata:', error);
            return null;
        }
    }
    
    // Check if a ghost exists for a map
    hasGhost(mapKey) {
        return localStorage.getItem(this.storagePrefix + mapKey) !== null;
    }
    
    // Delete ghost for a specific map
    deleteGhost(mapKey) {
        localStorage.removeItem(this.storagePrefix + mapKey);
        localStorage.removeItem(this.metadataPrefix + mapKey);
        console.log(`Ghost deleted for ${mapKey}`);
    }
    
    // Get all ghost metadata
    getAllGhosts() {
        const ghosts = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key.startsWith(this.metadataPrefix)) {
                const mapKey = key.substring(this.metadataPrefix.length);
                const metadata = this.getGhostMetadata(mapKey);
                
                if (metadata) {
                    ghosts.push({
                        mapKey,
                        ...metadata
                    });
                }
            }
        }
        
        return ghosts;
    }
    
    // Clear all ghosts
    clearAllGhosts() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.storagePrefix) || key.startsWith(this.metadataPrefix)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} ghost entries`);
    }
    
    // Get storage size used by ghosts
    getStorageSize() {
        let totalSize = 0;
        let ghostCount = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key.startsWith(this.storagePrefix) || key.startsWith(this.metadataPrefix)) {
                const value = localStorage.getItem(key);
                totalSize += key.length + value.length;
                
                if (key.startsWith(this.storagePrefix)) {
                    ghostCount++;
                }
            }
        }
        
        return {
            bytes: totalSize,
            megabytes: (totalSize / (1024 * 1024)).toFixed(2),
            ghostCount
        };
    }
    
    // Check if we should save a new ghost (is it better than existing?)
    shouldSaveGhost(mapKey, newTime) {
        const metadata = this.getGhostMetadata(mapKey);
        
        if (!metadata) {
            return true; // No existing ghost
        }
        
        return newTime < metadata.completionTime;
    }
}