import { useEffect, useState } from 'react';

interface TestGameProps {
  filename: string;
}

export function TestGame({ filename }: TestGameProps) {
  const [gameLoaded, setGameLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        window.location.reload();
      } else if (e.key === 'Escape') {
        window.location.href = '/';
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    let mounted = true;
    let game: any = null;

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
        (window as any).dat = datGuiModule as any;

        // Load MapLoader service
        const { default: MapLoader } = await import('/src/services/MapLoader');

        if (!mounted) return;

        // Create a temporary scene to bootstrap the test
        class TestBootstrapScene extends Phaser.Scene {
          constructor() {
            super({ key: 'test-bootstrap' });
          }
          
          async create() {
            // Use unified loader to start the test map
            await MapLoader.loadAndStart(this, filename, {
              testMode: true
            });
          }
        }

        // Create and start the game with bootstrap scene
        game = new Phaser.Game({
          ...BaseGameConfig,
          parent: 'test-game-container',
          scene: [TestBootstrapScene]
        });

        // Store game reference globally
        (window as any).testGame = game;

        if (mounted) {
          setGameLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load test game:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load test game');
        }
      }
    };

    loadGame();
    
    return () => {
      mounted = false;
      if (game) {
        game.destroy(true);
        delete (window as any).testGame;
      }
    };
  }, [filename]);

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
          <h2>Failed to load test map</h2>
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
  <div id="test-game-container" style={{ width: '100vw', height: '100vh' }}>
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
        Loading test map: {filename}...
      </div>
    )}
  </div>
  );
}
