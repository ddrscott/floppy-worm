import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from '@remix-run/react';
import RecordingDatabase from '/src/storage/RecordingDatabase';
import { ClientOnly } from '~/components/ClientOnly';

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

function RecordingPlayer({ recording }: { recording: Recording }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [game, setGame] = useState<any>(null);
    const [loadingState, setLoadingState] = useState('initializing');

    // Test rendering first
    useEffect(() => {
        console.log('RecordingPlayer component rendered!');
        console.log('Recording data:', {
            id: recording.id,
            mapKey: recording.mapKey,
            hasRecordingData: !!recording.recordingData,
            recordingDataLength: recording.recordingData?.length
        });
    }, []);

    useEffect(() => {
        console.log('RecordingPlayer mounted with recording:', recording.id);
        if (!containerRef.current || !recording) {
            console.log('Missing container or recording:', { 
                hasContainer: !!containerRef.current, 
                hasRecording: !!recording 
            });
            return;
        }

        let gameInstance: any = null;

        // Add a small delay to ensure the container is fully rendered
        const timer = setTimeout(() => {
            loadGame();
        }, 100);

        // Dynamically import Phaser and the playback scene
        const loadGame = async () => {
            try {
                setLoadingState('loading-phaser');
                console.log('Loading Phaser and playback scene...');
                console.log('Container element:', containerRef.current);
                console.log('Container dimensions:', {
                    width: containerRef.current?.offsetWidth,
                    height: containerRef.current?.offsetHeight
                });
                
                const Phaser = (await import('phaser')).default;
                const { default: RecordingPlaybackScene } = await import('~/game/scenes/RecordingPlaybackScene');

                console.log('Phaser loaded:', !!Phaser);
                console.log('RecordingPlaybackScene loaded:', !!RecordingPlaybackScene);
                setLoadingState('creating-game');

                const config = {
                    type: Phaser.AUTO,
                    parent: containerRef.current,
                    width: 800,
                    height: 600,
                    backgroundColor: '#333333',
                    physics: {
                        default: 'matter',
                        matter: {
                            gravity: { y: 1 },
                            debug: false
                        }
                    },
                    scene: [RecordingPlaybackScene]
                };

                console.log('Creating Phaser game with config:', config);
                gameInstance = new Phaser.Game(config);
                setGame(gameInstance);

                // Pass recording data to the scene
                console.log('Starting playback scene with recording:', recording.id);
                gameInstance.scene.start('RecordingPlaybackScene', {
                    recording: recording,
                    onFrameUpdate: (frame: number) => setCurrentFrame(frame),
                    onPlayStateChange: (playing: boolean) => setIsPlaying(playing)
                });
                setLoadingState('ready');
            } catch (error) {
                console.error('Failed to load playback scene:', error);
                setLoadingState('error');
            }
        };

        return () => {
            clearTimeout(timer);
            if (gameInstance) {
                console.log('Destroying Phaser game');
                gameInstance.destroy(true);
            }
        };
    }, [recording]);

    const handlePlayPause = () => {
        if (game) {
            const scene = game.scene.getScene('RecordingPlaybackScene');
            if (scene) {
                scene.togglePlayPause();
            }
        }
    };

    const handleSeek = (frame: number) => {
        if (game) {
            const scene = game.scene.getScene('RecordingPlaybackScene');
            if (scene) {
                scene.seekToFrame(frame);
                setCurrentFrame(frame);
            }
        }
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (game) {
            const scene = game.scene.getScene('RecordingPlaybackScene');
            if (scene) {
                scene.setPlaybackSpeed(speed);
            }
        }
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const currentTime = (currentFrame / recording.frameCount) * recording.duration;

    return (
        <div className="flex flex-col h-full">
            {/* Game Container */}
            <div className="flex-1 flex items-center justify-center bg-gray-800 relative">
                <div ref={containerRef} className="relative" />
                {loadingState !== 'ready' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                        <div className="text-white text-lg">
                            {loadingState === 'initializing' && 'Initializing...'}
                            {loadingState === 'loading-phaser' && 'Loading Phaser...'}
                            {loadingState === 'creating-game' && 'Creating game...'}
                            {loadingState === 'error' && 'Failed to load playback'}
                        </div>
                    </div>
                )}
            </div>

            {/* Playback Controls */}
            <div className="bg-gray-900 p-4 border-t border-gray-700">
                {/* Progress Bar / Scrubber */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <span>{formatTime(currentTime)}</span>
                        <div className="flex-1" />
                        <span>{formatTime(recording.duration)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max={recording.frameCount}
                        value={currentFrame}
                        onChange={(e) => handleSeek(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                            background: `linear-gradient(to right, #4ecdc4 0%, #4ecdc4 ${(currentFrame / recording.frameCount) * 100}%, #374151 ${(currentFrame / recording.frameCount) * 100}%, #374151 100%)`
                        }}
                    />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                    {/* Play/Pause Button */}
                    <button
                        onClick={handlePlayPause}
                        className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                    >
                        {isPlaying ? (
                            // Pause icon
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            // Play icon
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>

                    {/* Speed Control */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Speed:</span>
                        <select
                            value={playbackSpeed}
                            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                        >
                            <option value="0.25">0.25x</option>
                            <option value="0.5">0.5x</option>
                            <option value="1">1x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2x</option>
                        </select>
                    </div>

                    {/* Frame Counter */}
                    <div className="text-sm text-gray-400">
                        Frame: {currentFrame} / {recording.frameCount}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RecordingPlayback() {
    const params = useParams();
    const recordingId = params.id ? parseInt(params.id) : null;
    const [recording, setRecording] = useState<Recording | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Override the body overflow style for this page
        document.body.style.overflow = 'hidden';
        
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
        <div className="h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Recording Playback</h1>
                        <p className="text-gray-400">
                            {recording.mapTitle} - {recording.success ? 'Victory' : 'Failed'} - {new Date(recording.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Link 
                            to={`/recordings/${recording.id}`}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        >
                            View Details
                        </Link>
                        <Link 
                            to="/recordings" 
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                            Back to List
                        </Link>
                    </div>
                </div>
            </div>

            {/* Player */}
            <div className="flex-1">
                <ClientOnly fallback={<div className="flex items-center justify-center h-full text-white">Loading player...</div>}>
                    <RecordingPlayer recording={recording} />
                </ClientOnly>
            </div>
        </div>
    );
}