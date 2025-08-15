import { useEffect, useState } from 'react';
import { Link } from '@remix-run/react';
import RecordingDatabase from '/src/storage/RecordingDatabase';
import { LazyImage } from '~/components/LazyImage';

interface Recording {
    id: number;
    mapKey: string;
    mapTitle: string;
    success: boolean;
    completionTime: number | null;
    deathReason: string | null;
    timestamp: string;
    duration: number;
    frameCount: number;
    screenshot: string;
}

interface RecordingSummary {
    [mapKey: string]: {
        total: number;
        successful: number;
        failed: number;
        bestTime: number | null;
        latestTimestamp: string | null;
    };
}

export default function RecordingsIndex() {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [summary, setSummary] = useState<RecordingSummary>({});
    const [selectedMap, setSelectedMap] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [storageInfo, setStorageInfo] = useState<any>(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [recordingsPerPage] = useState(12); // Show 12 recordings per page
    const [allRecordings, setAllRecordings] = useState<Recording[]>([]);
    
    // Filter state
    const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

    useEffect(() => {
        // Override the body overflow style for this page
        document.body.style.overflow = 'auto';
        
        // Cleanup: restore overflow hidden when leaving the page
        return () => {
            document.body.style.overflow = 'hidden';
        };
    }, []);

    useEffect(() => {
        loadRecordings();
    }, [selectedMap]);

    const loadRecordings = async () => {
        setLoading(true);
        const db = new RecordingDatabase();
        
        try {
            const [recordings, summaryData, storage] = await Promise.all([
                db.getAllRecordings(selectedMap),
                db.getRecordingsSummary(),
                db.getStorageSize()
            ]);
            
            setAllRecordings(recordings);
            setSummary(summaryData);
            setStorageInfo(storage);
            setCurrentPage(1); // Reset to first page when filter changes
        } catch (error) {
            console.error('Failed to load recordings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this recording?')) {
            const db = new RecordingDatabase();
            await db.deleteRecording(id);
            loadRecordings();
        }
    };
    
    // Apply filters
    const filteredRecordings = allRecordings.filter(recording => {
        if (statusFilter === 'success') return recording.success;
        if (statusFilter === 'failed') return !recording.success;
        return true; // 'all'
    });
    
    // Calculate pagination
    const indexOfLastRecording = currentPage * recordingsPerPage;
    const indexOfFirstRecording = indexOfLastRecording - recordingsPerPage;
    const currentRecordings = filteredRecordings.slice(indexOfFirstRecording, indexOfLastRecording);
    const totalPages = Math.ceil(filteredRecordings.length / recordingsPerPage);
    
    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter]);
    
    const paginate = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        // Scroll to top of recordings grid
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteAll = async () => {
        if (confirm('Are you sure you want to delete ALL recordings? This cannot be undone.')) {
            const db = new RecordingDatabase();
            await db.deleteAllRecordings(selectedMap);
            loadRecordings();
        }
    };

    const formatTime = (ms: number | null) => {
        if (!ms) return '-';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-2xl">Loading recordings...</div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-white" style={{ minHeight: '100vh' }}>
            <div className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-gray-900 z-10 pb-4">
                    <h1 className="text-4xl font-bold">Ghost Recordings</h1>
                    <Link 
                        to="/" 
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                        Back to Game
                    </Link>
                </div>

                {storageInfo && (
                    <div className="mb-6 p-4 bg-gray-800 rounded">
                        <p className="text-sm text-gray-400">
                            Storage Used: {storageInfo.usageInMB} MB / {storageInfo.quotaInMB} MB ({storageInfo.percentUsed}%)
                        </p>
                    </div>
                )}

                {/* Filters */}
                <div className="mb-6 flex flex-wrap gap-4">
                    {/* Map Filter */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Filter by Map:</label>
                        <select 
                            value={selectedMap || ''} 
                            onChange={(e) => setSelectedMap(e.target.value || null)}
                            className="px-4 py-2 bg-gray-800 rounded border border-gray-700 text-white"
                        >
                            <option value="">All Maps</option>
                            {Object.keys(summary).map(mapKey => (
                                <option key={mapKey} value={mapKey}>
                                    {mapKey} ({summary[mapKey].total} recordings)
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Filter by Status:</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'all' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                            >
                                All ({allRecordings.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('success')}
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'success' 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                            >
                                ✓ Success ({allRecordings.filter(r => r.success).length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('failed')}
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'failed' 
                                        ? 'bg-red-600 text-white' 
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                            >
                                ✗ Failed ({allRecordings.filter(r => !r.success).length})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                {selectedMap && summary[selectedMap] && (
                    <div className="mb-6 grid grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-800 rounded">
                            <p className="text-sm text-gray-400">Total Attempts</p>
                            <p className="text-2xl font-bold">{summary[selectedMap].total}</p>
                        </div>
                        <div className="p-4 bg-green-900 rounded">
                            <p className="text-sm text-gray-400">Successful</p>
                            <p className="text-2xl font-bold">{summary[selectedMap].successful}</p>
                        </div>
                        <div className="p-4 bg-red-900 rounded">
                            <p className="text-sm text-gray-400">Failed</p>
                            <p className="text-2xl font-bold">{summary[selectedMap].failed}</p>
                        </div>
                        <div className="p-4 bg-blue-900 rounded">
                            <p className="text-sm text-gray-400">Best Time</p>
                            <p className="text-2xl font-bold">{formatTime(summary[selectedMap].bestTime)}</p>
                        </div>
                    </div>
                )}

                {/* Pagination Controls - Top */}
                {totalPages > 1 && (
                    <div className="mb-6 flex justify-center items-center gap-2">
                        <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Previous
                        </button>
                        
                        <div className="flex gap-1">
                            {[...Array(Math.min(5, totalPages))].map((_, index) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = index + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = index + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + index;
                                } else {
                                    pageNum = currentPage - 2 + index;
                                }
                                
                                return (
                                    <button
                                        key={index}
                                        onClick={() => paginate(pageNum)}
                                        className={`px-3 py-1 rounded transition-colors ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 hover:bg-gray-700'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next →
                        </button>
                        
                        <span className="ml-4 text-gray-400 text-sm">
                            Page {currentPage} of {totalPages} ({filteredRecordings.length} filtered, {allRecordings.length} total)
                        </span>
                    </div>
                )}
                
                {/* Recordings Grid */}
                {filteredRecordings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-xl">
                            {allRecordings.length === 0 
                                ? 'No recordings found' 
                                : `No ${statusFilter === 'all' ? '' : statusFilter} recordings found`}
                        </p>
                        <p className="mt-2">
                            {allRecordings.length === 0 
                                ? 'Play some levels to see your recordings here!'
                                : 'Try adjusting your filters to see more recordings.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentRecordings.map(recording => (
                            <div 
                                key={recording.id} 
                                className={`bg-gray-800 rounded-lg overflow-hidden ${
                                    recording.success ? 'border-2 border-green-600' : 'border-2 border-red-600'
                                }`}
                            >
                                {/* Screenshot */}
                                <div className="aspect-video bg-gray-900 relative">
                                    <LazyImage 
                                        src={recording.screenshot} 
                                        alt="Recording screenshot"
                                        className="w-full h-full object-contain"
                                    />
                                    <div className={`absolute top-2 right-2 px-2 py-1 rounded text-sm font-bold ${
                                        recording.success ? 'bg-green-600' : 'bg-red-600'
                                    }`}>
                                        {recording.success ? 'SUCCESS' : 'FAILED'}
                                    </div>
                                </div>
                                
                                {/* Recording Info */}
                                <div className="p-4">
                                    <h3 className="font-bold text-lg mb-2">{recording.mapTitle}</h3>
                                    <div className="text-sm text-gray-400 space-y-1">
                                        <p>Time: {formatTime(recording.completionTime || recording.duration)}</p>
                                        {recording.deathReason && (
                                            <p>Reason: {recording.deathReason.replace('_', ' ')}</p>
                                        )}
                                        <p>Frames: {recording.frameCount}</p>
                                        <p>Date: {formatDate(recording.timestamp)}</p>
                                    </div>
                                    
                                    <div className="mt-4 flex gap-2">
                                        <Link 
                                            to={`/playback/${recording.id}`}
                                            className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-center transition-colors"
                                        >
                                            ▶ Play
                                        </Link>
                                        <Link 
                                            to={`/recordings/${recording.id}`}
                                            className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-center transition-colors"
                                        >
                                            Details
                                        </Link>
                                        <button 
                                            onClick={() => handleDelete(recording.id)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Pagination Controls - Bottom */}
                {totalPages > 1 && (
                    <div className="mt-8 flex justify-center items-center gap-2">
                        <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Previous
                        </button>
                        
                        <div className="flex gap-1">
                            {[...Array(Math.min(5, totalPages))].map((_, index) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = index + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = index + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + index;
                                } else {
                                    pageNum = currentPage - 2 + index;
                                }
                                
                                return (
                                    <button
                                        key={index}
                                        onClick={() => paginate(pageNum)}
                                        className={`px-3 py-1 rounded transition-colors ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 hover:bg-gray-700'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        
                        <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
                
                {/* Delete All Button - Moved to bottom for safety */}
                {allRecordings.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-700">
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-gray-400 text-sm">Danger Zone</p>
                            <button 
                                onClick={handleDeleteAll}
                                className="px-6 py-3 bg-red-900 hover:bg-red-800 border-2 border-red-600 rounded transition-colors"
                            >
                                🗑️ Delete {selectedMap ? `All ${selectedMap}` : 'ALL'} Recordings
                            </button>
                            <p className="text-gray-500 text-xs max-w-md text-center">
                                This will permanently delete {selectedMap ? `all recordings for ${selectedMap}` : 'all your recordings'}. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}