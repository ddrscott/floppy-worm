import { useState, useEffect } from "react";

interface MapMetadata {
  name: string;
  difficulty: number;
  description: string;
}

interface MapDimensions {
  width: number;
  height: number;
}

interface ToolSettings {
  platformType: string;
  platformColor: string;
  friction: number;
  frictionStatic: number;
  restitution: number;
  polygonSides: number;
  trapezoidSlope: number;
}

interface PropertyPanelProps {
  // Map data
  mapMetadata: MapMetadata;
  mapDimensions: MapDimensions;
  
  // Tool settings
  selectedTool: string;
  toolSettings: ToolSettings;
  gridSnapEnabled: boolean;
  
  // Selected platform properties
  selectedPlatform: any;
  
  // Callbacks
  onMapMetadataChange: (metadata: MapMetadata) => void;
  onMapDimensionsChange: (dimensions: MapDimensions) => void;
  onToolChange: (tool: string) => void;
  onToolSettingsChange: (settings: ToolSettings) => void;
  onGridSnapChange: (enabled: boolean) => void;
  onPlatformPropertyChange: (property: string, value: any) => void;
  
  // Actions
  onLoadMap: (mapName: string) => void;
  onNewMap: (mapData: any) => void;
  onSaveToLibrary: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
}

export default function PropertyPanel({
  mapMetadata,
  mapDimensions,
  selectedTool,
  toolSettings,
  gridSnapEnabled,
  selectedPlatform,
  onMapMetadataChange,
  onMapDimensionsChange,
  onToolChange,
  onToolSettingsChange,
  onGridSnapChange,
  onPlatformPropertyChange,
  onLoadMap,
  onNewMap,
  onSaveToLibrary,
  onExportJSON,
  onImportJSON
}: PropertyPanelProps) {
  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [newMapData, setNewMapData] = useState({
    filename: '',
    name: '',
    difficulty: 1,
    description: '',
    width: 1920,
    height: 1152
  });
  
  const platformTypes = {
    'normal': 'Normal',
    'ice': 'Ice',
    'bouncy': 'Bouncy',
    'electric': 'Electric',
    'fire': 'Fire'
  };
  
  const stickerPresets = {
    'tip': 'Tip (Green)',
    'warning': 'Warning (Yellow)',
    'taunt': 'Taunt (Red)',
    'info': 'Info (Blue)',
    'celebrate': 'Celebrate (Gold)'
  };

  const tools = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'circle', label: 'Circle' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'trapezoid', label: 'Trapezoid' },
    { value: 'custom', label: 'Custom' },
    { value: 'sticker', label: 'Sticker' }
  ];

  // Helper function to get preset background colors for preview
  const getPresetBackgroundColor = (preset: string) => {
    const presetColors = {
      'tip': 'rgba(0, 50, 0, 0.8)',
      'warning': 'rgba(50, 50, 0, 0.8)',
      'taunt': 'rgba(50, 0, 0, 0.8)',
      'info': 'rgba(0, 25, 50, 0.8)',
      'celebrate': 'rgba(50, 40, 0, 0.8)'
    };
    return presetColors[preset] || presetColors.tip;
  };

  return (
    <div className="w-80 bg-gray-800 text-white p-4 overflow-y-auto h-full">
      {/* Map Management */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-300">Map Management</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Map Name</label>
            <input
              type="text"
              value={mapMetadata.name}
              onChange={(e) => onMapMetadataChange({ ...mapMetadata, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            />
          </div>
        </div>
      </div>

      {/* Map Properties */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-300">Map Properties</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mapMetadata.difficulty}
              onChange={(e) => onMapMetadataChange({ ...mapMetadata, difficulty: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{mapMetadata.difficulty}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Width (pixels)</label>
            <input
              type="range"
              min="480"
              max="3840"
              step="96"
              value={mapDimensions.width}
              onChange={(e) => onMapDimensionsChange({ ...mapDimensions, width: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{mapDimensions.width}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Height (pixels)</label>
            <input
              type="range"
              min="288"
              max="2160"
              step="96"
              value={mapDimensions.height}
              onChange={(e) => onMapDimensionsChange({ ...mapDimensions, height: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{mapDimensions.height}</span>
          </div>
        </div>
      </div>

      {/* Shape Tools */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-300">Shape Tools</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tool Mode</label>
            <select
              value={selectedTool}
              onChange={(e) => onToolChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              {tools.map(tool => (
                <option key={tool.value} value={tool.value}>{tool.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Platform Type</label>
            <select
              value={toolSettings.platformType}
              onChange={(e) => {
                const newType = e.target.value;
                const colors = {
                  'normal': '#ff6b6b',
                  'ice': '#b3e5fc',
                  'bouncy': '#ff69b4', 
                  'electric': '#ffff00',
                  'fire': '#f44336'
                };
                onToolSettingsChange({ 
                  ...toolSettings, 
                  platformType: newType,
                  platformColor: colors[newType] || '#ff6b6b'
                });
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              {Object.entries(platformTypes).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Platform Color</label>
            <input
              type="color"
              value={toolSettings.platformColor}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, platformColor: e.target.value })}
              className="w-full h-10 bg-gray-700 border border-gray-600 rounded-md"
            />
          </div>
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={gridSnapEnabled}
                onChange={(e) => onGridSnapChange(e.target.checked)}
                className="mr-2"
              />
              Snap to Grid
            </label>
          </div>
        </div>
      </div>

      {/* Physics Properties */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-300">Physics Properties</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Friction</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={toolSettings.friction}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, friction: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{toolSettings.friction.toFixed(1)}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Static Friction</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={toolSettings.frictionStatic}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, frictionStatic: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{toolSettings.frictionStatic.toFixed(1)}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Restitution (Bounciness)</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={toolSettings.restitution}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, restitution: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{toolSettings.restitution.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Shape Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-300">Shape Settings</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Polygon Sides</label>
            <input
              type="range"
              min="3"
              max="12"
              step="1"
              value={toolSettings.polygonSides}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, polygonSides: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{toolSettings.polygonSides}</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Trapezoid Slope</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={toolSettings.trapezoidSlope}
              onChange={(e) => onToolSettingsChange({ ...toolSettings, trapezoidSlope: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-300">{toolSettings.trapezoidSlope.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Sticker Settings - only show when sticker tool is selected */}
      {selectedTool === 'sticker' && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-300">Sticker Settings</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Sticker Text</label>
              <input
                type="text"
                value={toolSettings.stickerText || 'New Sticker'}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerText: e.target.value })}
                placeholder="Enter sticker text..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Preset Style</label>
              <select
                value={toolSettings.stickerPreset || 'tip'}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerPreset: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                {Object.entries(stickerPresets).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Font Size</label>
              <select
                value={toolSettings.stickerFontSize || '18px'}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerFontSize: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="12px">Small (12px)</option>
                <option value="16px">Medium (16px)</option>
                <option value="18px">Normal (18px)</option>
                <option value="20px">Large (20px)</option>
                <option value="24px">Extra Large (24px)</option>
                <option value="28px">Huge (28px)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Text Color</label>
              <input
                type="color"
                value={toolSettings.stickerColor || '#ffffff'}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerColor: e.target.value })}
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded-md"
              />
            </div>
            
            <div className="p-3 bg-gray-700 rounded border border-gray-600">
              <div className="text-xs text-gray-300 mb-2">Preview:</div>
              <div 
                className="inline-block px-2 py-1 rounded text-center"
                style={{
                  fontSize: toolSettings.stickerFontSize || '18px',
                  color: toolSettings.stickerColor || '#ffffff',
                  backgroundColor: getPresetBackgroundColor(toolSettings.stickerPreset || 'tip')
                }}
              >
                {toolSettings.stickerText || 'New Sticker'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Platform Properties */}
      {selectedPlatform && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-300">Selected Platform</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">X Position</label>
              <input
                type="number"
                value={selectedPlatform.data?.x || 0}
                onChange={(e) => onPlatformPropertyChange('x', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Y Position</label>
              <input
                type="number"
                value={selectedPlatform.data?.y || 0}
                onChange={(e) => onPlatformPropertyChange('y', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            
            {selectedPlatform.data?.shape === 'rectangle' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    type="number"
                    value={selectedPlatform.data?.width || 0}
                    onChange={(e) => onPlatformPropertyChange('width', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedPlatform.data?.height || 0}
                    onChange={(e) => onPlatformPropertyChange('height', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </>
            )}
            
            {selectedPlatform.data?.shape === 'circle' && (
              <div>
                <label className="block text-sm font-medium mb-1">Radius</label>
                <input
                  type="number"
                  value={selectedPlatform.data?.radius || 0}
                  onChange={(e) => onPlatformPropertyChange('radius', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* New Map Modal */}
      {showNewMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 text-white p-6 rounded-lg w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Map</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Filename (without .json)</label>
                <input
                  type="text"
                  value={newMapData.filename}
                  onChange={(e) => setNewMapData({ ...newMapData, filename: e.target.value })}
                  placeholder="e.g. MyAwesomeMap"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Map Name</label>
                <input
                  type="text"
                  value={newMapData.name}
                  onChange={(e) => setNewMapData({ ...newMapData, name: e.target.value })}
                  placeholder="e.g. My Awesome Map"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newMapData.description}
                  onChange={(e) => setNewMapData({ ...newMapData, description: e.target.value })}
                  placeholder="Describe your map..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white h-20"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newMapData.difficulty}
                    onChange={(e) => setNewMapData({ ...newMapData, difficulty: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    type="number"
                    value={newMapData.width}
                    onChange={(e) => setNewMapData({ ...newMapData, width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Height</label>
                <input
                  type="number"
                  value={newMapData.height}
                  onChange={(e) => setNewMapData({ ...newMapData, height: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (newMapData.filename && newMapData.name) {
                    onNewMap(newMapData);
                    setShowNewMapModal(false);
                    setNewMapData({
                      filename: '',
                      name: '',
                      difficulty: 1,
                      description: '',
                      width: 1920,
                      height: 1152
                    });
                  }
                }}
                disabled={!newMapData.filename || !newMapData.name}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm"
              >
                Create Map
              </button>
              <button
                onClick={() => {
                  setShowNewMapModal(false);
                  setNewMapData({
                    filename: '',
                    name: '',
                    difficulty: 1,
                    description: '',
                    width: 1920,
                    height: 1152
                  });
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
