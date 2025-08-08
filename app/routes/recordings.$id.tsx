import { useEffect, useState } from 'react';
import { Link, useParams } from '@remix-run/react';
import RecordingDatabase from '/src/storage/RecordingDatabase';

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
    segmentCount: number;
    screenshot: string;
    recordingData: any;
    compression?: string;
    encoding?: string;
}

export default function RecordingViewer() {
    const params = useParams();
    const recordingId = params.id ? parseInt(params.id) : null;
    const [recording, setRecording] = useState<Recording | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Override the body overflow style for this page
        document.body.style.overflow = 'auto';
        
        // Cleanup: restore overflow hidden when leaving the page
        return () => {
            document.body.style.overflow = 'hidden';
        };
    }, []);

    useEffect(() => {
        if (recordingId) {
            loadRecording(recordingId);
        }
    }, [recordingId]);

    const loadRecording = async (id: number) => {
        setLoading(true);
        setError(null);
        
        try {
            const db = new RecordingDatabase();
            const data = await db.getRecording(id);
            
            if (!data) {
                setError('Recording not found');
            } else {
                setRecording(data as Recording);
            }
        } catch (err) {
            console.error('Failed to load recording:', err);
            setError('Failed to load recording');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms: number | null) => {
        if (!ms) return '-';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = ms % 1000;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const exportRecording = () => {
        if (!recording) return;
        
        const dataStr = JSON.stringify({
            mapKey: recording.mapKey,
            mapTitle: recording.mapTitle,
            timestamp: recording.timestamp,
            duration: recording.duration,
            frameCount: recording.frameCount,
            segmentCount: recording.segmentCount,
            compression: recording.compression,
            encoding: recording.encoding,
            data: recording.recordingData
        }, null, 2);
        
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `${recording.mapKey}_${recording.id}_${recording.success ? 'success' : 'fail'}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-2xl">Loading recording...</div>
            </div>
        );
    }

    if (error || !recording) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
                <div className="text-2xl text-red-500 mb-4">{error || 'Recording not found'}</div>
                <Link 
                    to="/recordings" 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                    Back to Recordings
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Recording #{recording.id}</h1>
                    <div className="flex gap-4">
                        <Link 
                            to="/recordings" 
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                            Back to List
                        </Link>
                        <button 
                            onClick={exportRecording}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                        >
                            Export JSON
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Screenshot */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Screenshot</h2>
                        <div className={`relative rounded-lg overflow-hidden border-4 ${
                            recording.success ? 'border-green-600' : 'border-red-600'
                        }`}>
                            <img 
                                src={recording.screenshot} 
                                alt="Recording screenshot"
                                className="w-full"
                            />
                            <div className={`absolute top-4 right-4 px-4 py-2 rounded text-lg font-bold ${
                                recording.success ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                                {recording.success ? 'SUCCESS' : 'FAILED'}
                            </div>
                        </div>
                    </div>

                    {/* Recording Details */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Details</h2>
                        <div className="bg-gray-800 rounded-lg p-6 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Map:</span>
                                <span className="font-bold">{recording.mapTitle}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Map Key:</span>
                                <span className="font-mono">{recording.mapKey}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Status:</span>
                                <span className={`font-bold ${recording.success ? 'text-green-500' : 'text-red-500'}`}>
                                    {recording.success ? 'Success' : 'Failed'}
                                </span>
                            </div>
                            {recording.completionTime && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Completion Time:</span>
                                    <span className="font-bold">{formatTime(recording.completionTime)}</span>
                                </div>
                            )}
                            {recording.deathReason && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Death Reason:</span>
                                    <span className="font-bold text-red-400">
                                        {recording.deathReason.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-400">Duration:</span>
                                <span>{formatTime(recording.duration)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Recorded:</span>
                                <span>{formatDate(recording.timestamp)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Frame Count:</span>
                                <span>{recording.frameCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Segment Count:</span>
                                <span>{recording.segmentCount}</span>
                            </div>
                            {recording.compression && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Compression:</span>
                                    <span className="font-mono">{recording.compression}</span>
                                </div>
                            )}
                            {recording.encoding && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Encoding:</span>
                                    <span className="font-mono">{recording.encoding}</span>
                                </div>
                            )}
                        </div>

                        {/* Play Recording Buttons */}
                        <div className="mt-6 space-y-3">
                            <Link 
                                to={`/playback/${recording.id}`}
                                className="w-full block text-center px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-lg font-bold transition-colors"
                            >
                                ▶ Watch Playback
                            </Link>
                            <Link 
                                to={`/maps/${recording.mapKey}?playRecording=${recording.id}`}
                                className="w-full block text-center px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-lg font-bold transition-colors"
                            >
                                Play as Ghost in Game
                            </Link>
                            <p className="text-sm text-gray-400 text-center">
                                Watch the recording or play alongside it as a ghost
                            </p>
                        </div>
                    </div>
                </div>

                {/* Recording Data Preview */}
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">Recording Data</h2>
                    <div className="bg-gray-800 rounded-lg p-6">
                        <p className="text-gray-400 mb-2">
                            This recording contains {recording.frameCount} frames of movement data.
                        </p>
                        <p className="text-gray-400">
                            Data size: {recording.recordingData ? recording.recordingData.length : 0} characters
                        </p>
                        {recording.compression && (
                            <p className="text-gray-400 mt-2">
                                Compression type: {recording.compression}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}