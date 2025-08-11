import { useRef, useEffect, useState } from 'react';

export function MainGame() {
  const [gameLoaded, setGameLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAPI, setHasAPI] = useState(false);

  useEffect(() => {
    // Check for API support
    fetch('/api/maps', { method: 'HEAD' })
      .then(res => setHasAPI(res.ok || res.status === 405))
      .catch(() => setHasAPI(false));
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadGame = async () => {
      try {
        // Load Phaser and dat.gui
        const [
          { default: Phaser },
          datGuiModule,
          { BaseGameConfig }
        ] = await Promise.all([
          import('phaser'),
          import('dat.gui'),
          import('/src/config/phaser')
        ]);

        // Set dat.gui globally
        (window as any).dat = datGuiModule;

        // Load game scenes
        const { default: MapSelectScene } = await import('/src/scenes/MapSelectScene');

        if (!mounted) return;

        // Create and start the game (matching your src/app.js)
        const game = new Phaser.Game({
          ...BaseGameConfig,
          parent: 'game-container',
          scene: [
            MapSelectScene,
          ]
        });

        // Store game reference globally
        (window as any).game = game;

        if (mounted) {
          setGameLoaded(true);
        }

        // Cleanup
        return () => {
          if (game) {
            game.destroy(true);
          }
        };
      } catch (err) {
        console.error('Failed to load game:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load game');
        }
      }
    };

    const cleanup = loadGame();
    
    return () => {
      mounted = false;
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#232333',
        color: 'red',
        fontFamily: 'Arial'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Failed to load game</h2>
          <p>Error: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '10px', padding: '10px' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100svh', position: 'relative' }}>
      <div id="game-container" style={{ width: '100%', height: '100%' }}>
        {!gameLoaded && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100svh',
            background: '#232333',
            color: 'white',
            fontFamily: 'Arial'
          }}>
            Loading Floppy Worm...
          </div>
        )}
      </div>
    </div>
  );
}
