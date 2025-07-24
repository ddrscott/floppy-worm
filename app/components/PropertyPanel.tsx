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

  const tools = [
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'circle', label: 'Circle' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'trapezoid', label: 'Trapezoid' },
    { value: 'custom', label: 'Custom' }
  ];

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
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewMapModal(true)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm"
            >
              New Map
            </button>
            <button
              onClick={onSaveToLibrary}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm"
            >
              Save to Library
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onExportJSON}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm"
            >
              Export JSON
            </button>
            <label className="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded-md text-sm cursor-pointer">
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && onImportJSON(e.target.files[0])}
                className="hidden"
              />
            </label>
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
              onChange={(e) => onToolSettingsChange({ ...toolSettings, platformType: e.target.value })}
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