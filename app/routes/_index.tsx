import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from '~/components/ClientOnly';
import { MainGame } from '~/components/MainGame';
import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';

export const meta: MetaFunction = () => {
    return [
        { title: 'Floppy Worm' },
        { name: 'description', content: 'A physics-based worm game built with Phaser 3 and Matter.js' },
    ];
};

export default function Index() {
    const navigate = useNavigate();
    const [showGame, setShowGame] = useState(false);
    
    useEffect(() => {
        // Check if API is available (server mode)
        fetch('/api/maps', { method: 'HEAD' })
            .then(res => {
                if (res.ok || res.status === 405) {
                    // Server mode - redirect to maps view
                    navigate('/maps');
                } else {
                    // Static mode - show game
                    setShowGame(true);
                }
            })
            .catch(() => {
                // No API - static mode, show game
                setShowGame(true);
            });
    }, [navigate]);
    
    if (!showGame) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#232333',
                color: 'white'
            }}>
                Detecting mode...
            </div>
        );
    }
    
    return (
        <ClientOnly
            fallback={
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: '#232333',
                    color: 'white'
                }}>
                    Loading Floppy Worm...
                </div>
            }
        >
            <MainGame />
        </ClientOnly>
    );
}
