import { Link, useParams } from "@remix-run/react";
import { useRef, useEffect, useState } from "react";
import PropertyPanel from "~/components/PropertyPanel";

// Client-only map editor component
function MapEditorClient({ mapData, filename }: { mapData: any, filename: string }) {
  const [saveStatus, setSaveStatus] = useState<{ state: string; message?: string; error?: string }>({ state: 'idle' });
  const [gameLoaded, setGameLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Property panel state
  const [mapMetadata, setMapMetadata] = useState({
    name: mapData?.title || filename?.replace('.json', '') || 'New Map',
    difficulty: mapData?.difficulty || 1,
    description: mapData?.description || 'A custom level'
  });
  
  const [mapDimensions, setMapDimensions] = useState({
    width: mapData?.dimensions?.width || 1920,
    height: mapData?.dimensions?.height || 1152
  });
  
  const [selectedTool, setSelectedTool] = useState('rectangle');
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);
  const [selectedConstraint, setSelectedConstraint] = useState<any>(null);
  
  const [toolSettings, setToolSettings] = useState({
    platformType: 'standard',
    platformColor: '#ff6b6b',
    friction: 0.8,
    frictionStatic: 0.9,
    restitution: 0.3,
    polygonSides: 6,
    trapezoidSlope: 0.5,
    // Sticker settings
    stickerText: 'New Sticker',
    stickerPreset: 'tip',
    stickerFontSize: '18px',
    stickerColor: '#ffffff',
    // Constraint settings
    constraintStiffness: 0.8,
    constraintDamping: 0.2,
    constraintLength: null,
    constraintRender: true
  });

  useEffect(() => {
    // Update editor callbacks whenever React state changes
    if (typeof window !== 'undefined') {
      (window as any).editorCallbacks = {
        onToolChange: setSelectedTool,
        onGridSnapChange: setGridSnapEnabled,
        onPlatformSelect: setSelectedPlatform,
        onConstraintSelected: setSelectedConstraint,
        onToolSettingsChange: setToolSettings,
        mapMetadata,
        mapDimensions,
        selectedTool,
        gridSnapEnabled,
        toolSettings
      };
    }
  }, [mapMetadata, mapDimensions, selectedTool, gridSnapEnabled, toolSettings]);

  // Update toolSettings when a platform is selected
  useEffect(() => {
    console.log('React: selectedPlatform changed:', selectedPlatform);
    if (selectedPlatform && selectedPlatform.data) {
      const platformData = selectedPlatform.data;
      console.log('React: Platform data received:', JSON.stringify(platformData, null, 2));
      console.log('React: platformData.type =', platformData.type);
      console.log('React: platformData.platformType =', platformData.platformType);
      
      setToolSettings(prevSettings => ({
        ...prevSettings,
        platformType: platformData.platformType || platformData.type || 'standard',
        platformColor: platformData.color || prevSettings.platformColor,
        friction: platformData.friction ?? prevSettings.friction,
        frictionStatic: platformData.frictionStatic ?? prevSettings.frictionStatic,
        restitution: platformData.restitution ?? prevSettings.restitution,
        polygonSides: platformData.polygonSides ?? prevSettings.polygonSides,
        trapezoidSlope: platformData.trapezoidSlope ?? prevSettings.trapezoidSlope
      }));
    }
  }, [selectedPlatform]);

  useEffect(() => {
    // No more dat.gui cleanup needed - using React PropertyPanel
    
    // Dynamically load game only on client
    let mounted = true;

    const loadMapEditor = async () => {
      try {
        // No dat.gui cleanup needed anymore
        
        // Use dynamic imports to avoid SSR issues and load dependencies in order
        const [
          { default: Phaser },
          { BaseGameConfig }
        ] = await Promise.all([
          import('phaser'),
          import('/src/config/phaser')
        ]);
        
        // Initial setup of communication between React and Phaser
        (window as any).editorCallbacks = {
          onToolChange: setSelectedTool,
          onGridSnapChange: setGridSnapEnabled,
          onPlatformSelect: setSelectedPlatform,
          onToolSettingsChange: setToolSettings,
          mapMetadata,
          mapDimensions,
          selectedTool,
          gridSnapEnabled,
          toolSettings
        };
        
        // No need to load dat.gui anymore
        
        // Load base dependencies first to avoid circular issues
        await import('/src/entities/WormBase');
        await import('/src/entities/PlatformBase');
        await import('/src/entities/DoubleWorm');
        
        // Now load MapEditor (without JsonMapBase to avoid circular dependency)
        const { default: MapEditor } = await import('/src/scenes/MapEditor');

        if (!mounted) return;

        // Create game configuration for MapEditor
        const config = {
          ...BaseGameConfig,
          parent: 'map-editor-container',
          scene: [MapEditor]
        };

        // Store map data globally for the MapEditor to access
        (window as any).serverMapData = mapData;
        
        // Also ensure the window object is available before game creation
        console.log('Setting server map data:', mapData);

        // Initialize game
        const game = new Phaser.Game(config);
        
        // Store game reference globally for property updates
        (window as any).game = game;

        // Set up save functionality (POST to API)
        const handleSave = async () => {
          const scene = game.scene.getScene('MapEditor') as any;
          if (scene && scene.mapData) {
            // Update map data with current state (like the editor does)
            scene.mapData.entities = scene.entities;
            scene.mapData.platforms = scene.platforms.map((p: any) => p.data);
            scene.mapData.metadata.modified = new Date().toISOString();
            
            const currentMapData = scene.mapData;
            
            setSaveStatus({ state: 'submitting' });
            
            try {
              // Submit to API endpoint
              const formData = new FormData();
              formData.append("mapData", JSON.stringify(currentMapData));
              
              const response = await fetch(`/api/maps/${filename}`, {
                method: 'POST',
                body: formData
              });
              
              const result = await response.json();
              
              if (result.success) {
                setSaveStatus({ state: 'success', message: result.message });
                setTimeout(() => setSaveStatus({ state: 'idle' }), 3000);
              } else {
                setSaveStatus({ state: 'error', error: result.error });
                setTimeout(() => setSaveStatus({ state: 'idle' }), 5000);
              }
            } catch (error) {
              setSaveStatus({ state: 'error', error: 'Failed to save map' });
              setTimeout(() => setSaveStatus({ state: 'idle' }), 5000);
            }
          }
        };

        // Keyboard save shortcut
        const handleKeyDown = (event: KeyboardEvent) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            handleSave();
          }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        // Expose save function globally
        (window as any).saveMap = handleSave;

        if (mounted) {
          setGameLoaded(true);
        }

        // Cleanup
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
          delete (window as any).saveMap;
          
          // No dat.gui cleanup needed anymore
          
          if (game) {
            game.destroy(true);
          }
        };
      } catch (err) {
        console.error('Failed to load map editor:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map editor');
        }
      }
    };

    const cleanup = loadMapEditor();
    
    return () => {
      mounted = false;
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [mapData, filename]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        background: '#232333',
        color: 'red'
      }}>
        Error loading map editor: {error}
      </div>
    );
  }

  return (
    <>
      {/* Main Editor Layout */}
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Game Container */}
        <div 
          style={{ 
            flex: 1,
            height: '100%',
            position: 'relative'
          }}
        >
          <div 
            id="map-editor-container" 
            style={{ 
              width: '100%',
              height: '100%'
            }}
          >
          {!gameLoaded && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              background: '#232333',
              color: 'white'
            }}>
              Loading Map Editor...
            </div>
          )}
          </div>
        </div>
        
        {/* Property Panel - Always Visible */}
        <PropertyPanel
            mapMetadata={mapMetadata}
            mapDimensions={mapDimensions}
            selectedTool={selectedTool}
            toolSettings={toolSettings}
            gridSnapEnabled={gridSnapEnabled}
            selectedPlatform={selectedPlatform}
            selectedConstraint={selectedConstraint}
            filename={filename}
            saveStatus={saveStatus}
            onMapMetadataChange={setMapMetadata}
            onMapDimensionsChange={setMapDimensions}
            onToolChange={setSelectedTool}
            onToolSettingsChange={setToolSettings}
            onGridSnapChange={setGridSnapEnabled}
            onSaveMap={() => {
              if ((window as any).saveMap) {
                (window as any).saveMap();
              }
            }}
            onPlatformPropertyChange={(property, value) => {
              // Communicate with Phaser game to update platform
              console.log('PropertyPanel: onPlatformPropertyChange called', { property, value });
              console.log('PropertyPanel: window.game =', (window as any).game);
              
              const scene = (window as any).game?.scene?.getScene('MapEditor');
              console.log('PropertyPanel: scene =', scene);
              console.log('PropertyPanel: scene.selectedPlatform =', scene?.selectedPlatform);
              
              if (scene && scene.selectedPlatform) {
                console.log('PropertyPanel: calling scene.updatePlatformProperty');
                scene.updatePlatformProperty(property, value);
              } else {
                console.warn('PropertyPanel: Cannot update platform property - scene or selectedPlatform not available');
              }
            }}
            onLoadMap={(mapName) => {
              // TODO: Load different map
              console.log('Load map:', mapName);
            }}
            onNewMap={async (newMapData) => {
              try {
                // Create the new map structure
                const mapData = {
                  metadata: {
                    name: newMapData.name,
                    difficulty: newMapData.difficulty,
                    description: newMapData.description,
                    modified: new Date().toISOString()
                  },
                  dimensions: {
                    width: newMapData.width,
                    height: newMapData.height
                  },
                  entities: {
                    wormStart: { x: 200, y: newMapData.height - 200 },
                    goal: { x: newMapData.width - 200, y: 200 }
                  },
                  platforms: []
                };
                
                // Save the new map
                const formData = new FormData();
                formData.append("mapData", JSON.stringify(mapData));
                
                const response = await fetch(`/api/maps/${newMapData.filename}.json`, {
                  method: 'POST',
                  body: formData
                });
                
                if (response.ok) {
                  // Navigate to the new map editor
                  window.location.href = `/maps/${newMapData.filename}.json/edit`;
                } else {
                  alert('Failed to create new map');
                }
              } catch (error) {
                console.error('Error creating new map:', error);
                alert('Error creating new map');
              }
            }}
            onSaveToLibrary={() => {
              // Use existing save functionality
              if ((window as any).saveMap) {
                (window as any).saveMap();
                
                // Clear map cache so main game will reload updated data
                if ((window as any).clearMapCache) {
                  (window as any).clearMapCache();
                }
              }
            }}
            onExportJSON={() => {
              // TODO: Export JSON
              console.log('Export JSON');
            }}
            onImportJSON={(file) => {
              // TODO: Import JSON
              console.log('Import JSON:', file);
            }}
            onConstraintPropertyChange={(property, value) => {
              // Communicate with Phaser game to update constraint
              console.log('PropertyPanel: onConstraintPropertyChange called', { property, value });
              
              const scene = (window as any).game?.scene?.getScene('MapEditor');
              
              if (scene && scene.selectedConstraint) {
                console.log('PropertyPanel: calling scene.updateConstraintProperty');
                scene.updateConstraintProperty(scene.selectedConstraint, property, value);
              } else {
                console.warn('PropertyPanel: Cannot update constraint property - scene or selectedConstraint not available');
              }
            }}
          />
      </div>
    </>
  );
}

// Main component - SPA mode with API saving
export default function MapEdit() {
  const { filename } = useParams();
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMapData = async () => {
      if (!filename) {
        setError('No filename provided');
        setLoading(false);
        return;
      }

      try {
        // Always load from the server API
        const response = await fetch(`/api/maps/${filename}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.mapData) {
            setMapData(result.mapData);
          } else {
            throw new Error('No map data received');
          }
        } else {
          // Fallback: create empty map
          setMapData({
            title: filename.replace('.json', ''),
            difficulty: 1,
            platforms: [],
            entities: {
              wormStart: { x: 200, y: 900 },
              goal: { x: 1700, y: 200 }
            },
            dimensions: {
              width: 1920,
              height: 1152
            }
          });
        }
      } catch (err) {
        console.error('Failed to load map:', err);
        // Create empty map as fallback
        setMapData({
          title: filename?.replace('.json', '') || 'New Map',
          difficulty: 1,
          platforms: [],
          entities: {
            wormStart: { x: 200, y: 900 },
            goal: { x: 1700, y: 200 }
          },
          dimensions: {
            width: 1920,
            height: 1152
          }
        });
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, [filename]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#232333', color: 'white' }}>
        Loading map data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#232333', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  if (!mapData) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#232333', color: 'white' }}>
        No map data found
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Client-only Map Editor with Property Panel */}
      <div 
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'flex'
        }}
      >
        <div style={{ flex: 1 }}>
          <MapEditorClient mapData={mapData} filename={filename || ''} />
        </div>
      </div>
    </div>
  );
}