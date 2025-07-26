import { useEffect, useState } from 'react';

interface TestGameProps {
  filename: string;
  mapData: any;
}

export function TestGame({ filename, mapData }: TestGameProps) {
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
          datGuiModule
        ] = await Promise.all([
          import('phaser'),
          import('dat.gui')
        ]);

        // Set dat.gui globally
        (window as any).dat = datGuiModule as any;

        // Load game scenes
        const { default: JsonMapScene } = await import('/src/scenes/JsonMapScene');

        if (!mounted) return;

        // Create a scene directly from the map data
        const TestScene = JsonMapScene.create(`test-${filename}`, mapData);

        // Create and start the game with just the test scene
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'test-game-container',
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
              gravity: { x: 0, y: 1 },
              debug: {
                showBody: true,
                showStaticBody: true,
                showVelocity: false,
                // bodyColor: 0xff0000
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
          scene: [TestScene]
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
  }, [filename, mapData]);

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Test Info Bar */}
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'monospace'
        }}
      >
        <div>Testing: {filename}.json</div>
        <div style={{ marginTop: '5px', fontSize: '12px', opacity: 0.8 }}>
          Press R to reload • ESC to quit
        </div>
      </div>
      
      {/* Quick Reload Button */}
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000
        }}
      >
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'}
        >
          Reload (R)
        </button>
      </div>
      
      <div id="test-game-container" style={{ width: '100%', height: '100%' }}>
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
    </div>
  );
}
