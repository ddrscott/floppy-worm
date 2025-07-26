import { useRef, useEffect, useState } from 'react';

export function MainGame() {
  const [gameLoaded, setGameLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadGame = async () => {
      try {
        // Load Phaser and dat.gui
        const [
          { default: Phaser },
          datGuiModule
        ] = await Promise.all([
          import('phaser'),
          import('dat.gui')
        ]);

        // Set dat.gui globally
        (window as any).dat = datGuiModule;

        // Load game scenes
        const { default: MapSelectScene } = await import('/src/scenes/MapSelectScene');

        if (!mounted) return;

        // Create and start the game (matching your src/app.js)
        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'game-container',
          backgroundColor: '#232333',
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: '100%',
            height: '100%',
          },
          physics: {
            default: 'matter',
            matter: {
              gravity: { y: 1 },
              debug: {
                showBody: true,
                showStaticBody: true,
                showVelocity: false,
                bodyColor: 0xff0000
              },
              positionIterations: 20,
              velocityIterations: 20,
              constraintIterations: 2,
              enableSleeping: true
            }
          },
          input: {
            gamepad: true
          },
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
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Map Editor Link - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000
          }}
        >
          <a 
            href="/maps" 
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '8px 16px',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            Map Editor
          </a>
        </div>
      )}
      
      <div id="game-container" style={{ width: '100%', height: '100%' }}>
        {!gameLoaded && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
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
