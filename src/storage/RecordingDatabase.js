export default class RecordingDatabase {
    constructor() {
        this.dbName = 'FloppyWormRecordings';
        this.dbVersion = 1;
        this.db = null;
        this.initPromise = this.initDatabase();
    }
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create recordings store if it doesn't exist
                if (!db.objectStoreNames.contains('recordings')) {
                    const recordingsStore = db.createObjectStore('recordings', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // Create indexes for efficient querying
                    recordingsStore.createIndex('mapKey', 'mapKey', { unique: false });
                    recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recordingsStore.createIndex('success', 'success', { unique: false });
                    recordingsStore.createIndex('mapKey_success', ['mapKey', 'success'], { unique: false });
                }
            };
        });
    }
    
    async ensureDatabase() {
        if (!this.db) {
            await this.initPromise;
        }
        return this.db;
    }
    
    async saveRecording(data) {
        console.log('📀 RecordingDatabase.saveRecording called with:', {
            mapKey: data.mapKey,
            success: data.success,
            deathReason: data.deathReason,
            hasScreenshot: !!data.screenshot,
            hasRecordingData: !!data.recordingData
        });
        
        const db = await this.ensureDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            
            // Create a copy of data without the id field
            const { id, ...dataWithoutId } = data;
            const recordingData = {
                ...dataWithoutId,
                timestamp: data.timestamp || new Date().toISOString()
                // Don't include id field at all - IndexedDB will auto-generate it
            };
            
            console.log('📀 Adding to IndexedDB store...');
            const request = store.add(recordingData);
            
            request.onsuccess = () => {
                console.log('✅ Recording saved to IndexedDB with ID:', request.result);
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error('❌ Failed to save recording to IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }
    
    async getRecording(id) {
        const db = await this.ensureDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    async getAllRecordings(mapKey = null, successOnly = null) {
        const db = await this.ensureDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            
            let request;
            if (mapKey && successOnly !== null) {
                const index = store.index('mapKey_success');
                request = index.getAll([mapKey, successOnly]);
            } else if (mapKey) {
                const index = store.index('mapKey');
                request = index.getAll(mapKey);
            } else if (successOnly !== null) {
                const index = store.index('success');
                request = index.getAll(successOnly);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => {
                // Sort by timestamp (newest first)
                const recordings = request.result.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                resolve(recordings);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    async getRecordingsSummary() {
        const db = await this.ensureDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const recordings = request.result;
                const summary = {};
                
                recordings.forEach(recording => {
                    const mapKey = recording.mapKey;
                    if (!summary[mapKey]) {
                        summary[mapKey] = {
                            total: 0,
                            successful: 0,
                            failed: 0,
                            bestTime: null,
                            latestTimestamp: null
                        };
                    }
                    
                    summary[mapKey].total++;
                    if (recording.success) {
                        summary[mapKey].successful++;
                        if (!summary[mapKey].bestTime || recording.completionTime < summary[mapKey].bestTime) {
                            summary[mapKey].bestTime = recording.completionTime;
                        }
                    } else {
                        summary[mapKey].failed++;
                    }
                    
                    if (!summary[mapKey].latestTimestamp || 
                        new Date(recording.timestamp) > new Date(summary[mapKey].latestTimestamp)) {
                        summary[mapKey].latestTimestamp = recording.timestamp;
                    }
                });
                
                resolve(summary);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    async deleteRecording(id) {
        const db = await this.ensureDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                console.log('Recording deleted:', id);
                resolve();
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    async deleteAllRecordings(mapKey = null) {
        const db = await this.ensureDatabase();
        
        return new Promise(async (resolve, reject) => {
            try {
                const recordings = await this.getAllRecordings(mapKey);
                const transaction = db.transaction(['recordings'], 'readwrite');
                const store = transaction.objectStore('recordings');
                
                let deletedCount = 0;
                recordings.forEach(recording => {
                    store.delete(recording.id);
                    deletedCount++;
                });
                
                transaction.oncomplete = () => {
                    console.log(`Deleted ${deletedCount} recordings`);
                    resolve(deletedCount);
                };
                
                transaction.onerror = () => {
                    reject(transaction.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async getStorageSize() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                return {
                    usage: estimate.usage,
                    quota: estimate.quota,
                    usageInMB: (estimate.usage / (1024 * 1024)).toFixed(2),
                    quotaInMB: (estimate.quota / (1024 * 1024)).toFixed(2),
                    percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                };
            }
        } catch (error) {
            console.error('Failed to estimate storage:', error);
        }
        return null;
    }
}