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
  // Sticker settings
  stickerText: string;
  stickerPreset: string;
  stickerFontSize: string;
  stickerColor: string;
  // Constraint settings
  constraintStiffness: number;
  constraintDamping: number;
  constraintLength: number | null;
  constraintRender: boolean;
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
  selectedConstraint: any;
  
  // Editor info
  filename?: string;
  saveStatus?: { state: string; message?: string; error?: string };
  
  // Callbacks
  onMapMetadataChange: (metadata: MapMetadata) => void;
  onMapDimensionsChange: (dimensions: MapDimensions) => void;
  onToolChange: (tool: string) => void;
  onToolSettingsChange: (settings: ToolSettings) => void;
  onGridSnapChange: (enabled: boolean) => void;
  onPlatformPropertyChange: (property: string, value: any) => void;
  onConstraintPropertyChange: (property: string, value: any) => void;
  
  // Actions
  onLoadMap: (mapName: string) => void;
  onNewMap: (mapData: any) => void;
  onSaveToLibrary: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onSaveMap?: () => void;
}

export default function PropertyPanel({
  mapMetadata,
  mapDimensions,
  selectedTool,
  toolSettings,
  gridSnapEnabled,
  selectedPlatform,
  selectedConstraint,
  filename,
  saveStatus,
  onMapMetadataChange,
  onMapDimensionsChange,
  onToolChange,
  onToolSettingsChange,
  onGridSnapChange,
  onPlatformPropertyChange,
  onConstraintPropertyChange,
  onLoadMap,
  onNewMap,
  onSaveToLibrary,
  onExportJSON,
  onImportJSON,
  onSaveMap
}: PropertyPanelProps) {
  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [activeTab, setActiveTab] = useState('platform');
  const [newMapData, setNewMapData] = useState({
    filename: '',
    name: '',
    difficulty: 1,
    description: '',
    width: 1920,
    height: 1152
  });
  
  const platformTypes = {
    'standard': 'Standard',
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
    { value: 'sticker', label: 'Sticker' },
    { value: 'constraint', label: 'Constraint (L)' }
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
    <div className="w-80 bg-gray-800 text-white overflow-y-auto h-full flex flex-col">
      {/* Header Section with Save Button and Status */}
      <div className="p-2 border-b border-gray-700 space-y-2">
        {/* Filename and save status */}
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <div className="font-semibold text-blue-300">
              {filename ? `Editing: ${filename}` : 'Map Editor'}
            </div>
            <div className="text-gray-400 text-[10px]">
              Press Ctrl/Cmd+S to save
            </div>
          </div>
          {onSaveMap && (
            <button
              onClick={onSaveMap}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
            >
              Save
            </button>
          )}
        </div>
        
        {/* Save status */}
        {saveStatus && saveStatus.state !== 'idle' && (
          <div className="text-xs">
            {saveStatus.state === 'submitting' && (
              <span className="text-yellow-400">Saving...</span>
            )}
            {saveStatus.state === 'success' && (
              <span className="text-green-400">✓ {saveStatus.message || 'Saved!'}</span>
            )}
            {saveStatus.state === 'error' && (
              <span className="text-red-400">✗ {saveStatus.error || 'Error saving'}</span>
            )}
          </div>
        )}
        
        {/* Map Name */}
        <input
          type="text"
          value={mapMetadata.name}
          onChange={(e) => onMapMetadataChange({ ...mapMetadata, name: e.target.value })}
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
          placeholder="Map Name"
        />
      </div>
      
      {/* Navigation Links */}
      <div className="px-2 pb-2 flex gap-2">
        <a
          href="/maps"
          className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-center text-xs rounded transition-colors"
        >
          Back to Maps
        </a>
        <button
          onClick={() => setShowNewMapModal(true)}
          className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-xs rounded transition-colors"
        >
          New Map
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('platform')}
          className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
            activeTab === 'platform' 
              ? 'bg-gray-700 text-blue-300 border-b-2 border-blue-300' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Platform
        </button>
        <button
          onClick={() => setActiveTab('physics')}
          className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
            activeTab === 'physics' 
              ? 'bg-gray-700 text-blue-300 border-b-2 border-blue-300' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Physics
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
            activeTab === 'map' 
              ? 'bg-gray-700 text-blue-300 border-b-2 border-blue-300' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Map
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 p-2 overflow-y-auto">
        {/* Platform Tab */}
        {activeTab === 'platform' && (
          <div className="space-y-2">
            {/* Platform Header */}
            <div className="text-xs font-semibold text-blue-300">
              {selectedPlatform ? 'Selected Platform' : 'Double-click to create'}
            </div>
            
            {/* Position controls - only show when platform is selected */}
            {selectedPlatform && (
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-400">X</label>
                  <input
                    type="number"
                    value={selectedPlatform.data?.x || 0}
                    onChange={(e) => onPlatformPropertyChange('x', parseFloat(e.target.value))}
                    className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400">Y</label>
                  <input
                    type="number"
                    value={selectedPlatform.data?.y || 0}
                    onChange={(e) => onPlatformPropertyChange('y', parseFloat(e.target.value))}
                    className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                  />
                </div>
              </div>
            )}
            
            {/* Shape and Type in grid */}
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="block text-xs text-gray-400">Shape</label>
                <select
                  value={selectedPlatform ? (selectedPlatform.data?.type || 'rectangle') : selectedTool}
                  onChange={(e) => {
                    if (selectedPlatform) {
                      onPlatformPropertyChange('shape', e.target.value);
                    } else {
                      onToolChange(e.target.value);
                    }
                  }}
                  className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                >
                  {tools.map(tool => (
                    <option key={tool.value} value={tool.value}>{tool.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-400">Type</label>
                <select
                  value={selectedPlatform ? (selectedPlatform.data?.platformType || 'standard') : toolSettings.platformType}
                  onChange={(e) => {
                    if (selectedPlatform) {
                      onPlatformPropertyChange('platformType', e.target.value);
                    } else {
                      const newType = e.target.value;
                      const colors = {
                        'standard': '#ff6b6b',
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
                    }
                  }}
                  className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                >
                  {Object.entries(platformTypes).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Color */}
            <div>
              <label className="block text-xs text-gray-400">Color</label>
              <input
                type="color"
                value={selectedPlatform ? (selectedPlatform.data?.color || toolSettings.platformColor) : toolSettings.platformColor}
                onChange={(e) => {
                  if (selectedPlatform) {
                    onPlatformPropertyChange('color', e.target.value);
                  } else {
                    onToolSettingsChange({ ...toolSettings, platformColor: e.target.value });
                  }
                }}
                className="w-full h-6 bg-gray-700 border border-gray-600 rounded"
              />
            </div>
            
            {/* Size controls - show for selected platform or based on selected tool */}
            {((selectedPlatform && (selectedPlatform.data?.type === 'rectangle' || selectedPlatform.data?.type === 'trapezoid')) || 
              (!selectedPlatform && (selectedTool === 'rectangle' || selectedTool === 'trapezoid'))) && (
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-400">Width</label>
                  <input
                    type="number"
                    value={selectedPlatform ? (selectedPlatform.data?.width || 0) : 96}
                    onChange={(e) => {
                      if (selectedPlatform) {
                        onPlatformPropertyChange('width', parseFloat(e.target.value));
                      }
                    }}
                    className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                    readOnly={!selectedPlatform}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">Height</label>
                  <input
                    type="number"
                    value={selectedPlatform ? (selectedPlatform.data?.height || 0) : 48}
                    onChange={(e) => {
                      if (selectedPlatform) {
                        onPlatformPropertyChange('height', parseFloat(e.target.value));
                      }
                    }}
                    className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                    readOnly={!selectedPlatform}
                  />
                </div>
              </div>
            )}
            
            {/* Radius control for circles and polygons */}
            {((selectedPlatform && (selectedPlatform.data?.type === 'circle' || selectedPlatform.data?.type === 'polygon')) || 
              (!selectedPlatform && (selectedTool === 'circle' || selectedTool === 'polygon'))) && (
              <div>
                <label className="block text-xs text-gray-400">Radius</label>
                <input
                  type="number"
                  value={selectedPlatform ? (selectedPlatform.data?.radius || 0) : 40}
                  onChange={(e) => {
                    if (selectedPlatform) {
                      onPlatformPropertyChange('radius', parseFloat(e.target.value));
                    }
                  }}
                  className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                  readOnly={!selectedPlatform}
                />
              </div>
            )}
            
            {/* Polygon sides */}
            {((selectedPlatform && selectedPlatform.data?.type === 'polygon') || 
              (!selectedPlatform && selectedTool === 'polygon')) && (
              <div>
                <label className="block text-xs text-gray-400">Sides: {selectedPlatform ? (selectedPlatform.data?.sides || 6) : toolSettings.polygonSides}</label>
                <input
                  type="range"
                  min="3"
                  max="12"
                  step="1"
                  value={selectedPlatform ? (selectedPlatform.data?.sides || 6) : toolSettings.polygonSides}
                  onChange={(e) => {
                    if (selectedPlatform) {
                      onPlatformPropertyChange('polygonSides', parseInt(e.target.value));
                    } else {
                      onToolSettingsChange({ ...toolSettings, polygonSides: parseInt(e.target.value) });
                    }
                  }}
                  className="w-full h-4"
                />
              </div>
            )}
            
            {/* Trapezoid slope */}
            {((selectedPlatform && selectedPlatform.data?.type === 'trapezoid') || 
              (!selectedPlatform && selectedTool === 'trapezoid')) && (
              <div>
                <label className="block text-xs text-gray-400">Slope: {(selectedPlatform ? (selectedPlatform.data?.slope || 0.5) : toolSettings.trapezoidSlope).toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedPlatform ? (selectedPlatform.data?.slope || 0.5) : toolSettings.trapezoidSlope}
                  onChange={(e) => {
                    if (selectedPlatform) {
                      onPlatformPropertyChange('trapezoidSlope', parseFloat(e.target.value));
                    } else {
                      onToolSettingsChange({ ...toolSettings, trapezoidSlope: parseFloat(e.target.value) });
                    }
                  }}
                  className="w-full h-4"
                />
              </div>
            )}
            
            {/* Sticker Settings - only show when sticker tool is selected */}
            {selectedTool === 'sticker' && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <h4 className="text-xs font-semibold text-blue-300 mb-1">Sticker Settings</h4>
                
                <div className="space-y-1">
                  <div>
                    <label className="block text-xs text-gray-400">Text</label>
                    <input
                      type="text"
                      value={toolSettings.stickerText || 'New Sticker'}
                      onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerText: e.target.value })}
                      placeholder="Enter sticker text..."
                      className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="block text-xs text-gray-400">Style</label>
                      <select
                        value={toolSettings.stickerPreset || 'tip'}
                        onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerPreset: e.target.value })}
                        className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                      >
                        {Object.entries(stickerPresets).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-400">Size</label>
                      <select
                        value={toolSettings.stickerFontSize || '18px'}
                        onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerFontSize: e.target.value })}
                        className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
                      >
                        <option value="12px">12px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="24px">24px</option>
                        <option value="28px">28px</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400">Color</label>
                    <input
                      type="color"
                      value={toolSettings.stickerColor || '#ffffff'}
                      onChange={(e) => onToolSettingsChange({ ...toolSettings, stickerColor: e.target.value })}
                      className="w-full h-6 bg-gray-700 border border-gray-600 rounded"
                    />
                  </div>
                  
                  <div className="p-1 bg-gray-700 rounded border border-gray-600">
                    <div className="text-xs text-gray-300">Preview:</div>
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
          </div>
        )}
        
        {/* Physics Tab */}
        {activeTab === 'physics' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">Friction: {toolSettings.friction.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={toolSettings.friction}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, friction: parseFloat(e.target.value) })}
                className="w-full h-4"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-400">Static Friction: {toolSettings.frictionStatic.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={toolSettings.frictionStatic}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, frictionStatic: parseFloat(e.target.value) })}
                className="w-full h-4"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-400">Restitution (Bounciness): {toolSettings.restitution.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={toolSettings.restitution}
                onChange={(e) => onToolSettingsChange({ ...toolSettings, restitution: parseFloat(e.target.value) })}
                className="w-full h-4"
              />
            </div>
            
            {/* Constraint Settings */}
            <div className="border-t border-gray-700 pt-2 mt-2">
              <h4 className="text-xs font-semibold text-gray-300 mb-2">Constraint Settings</h4>
              
              <div>
                <label className="block text-xs text-gray-400">Stiffness: {toolSettings.constraintStiffness?.toFixed(2) || 0.8}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={toolSettings.constraintStiffness || 0.8}
                  onChange={(e) => onToolSettingsChange({ ...toolSettings, constraintStiffness: parseFloat(e.target.value) })}
                  className="w-full h-4"
                />
                <div className="text-[10px] text-gray-500">≤0.5: Spring, &gt;0.5: Rigid</div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-400">Damping: {toolSettings.constraintDamping?.toFixed(2) || 0.2}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={toolSettings.constraintDamping || 0.2}
                  onChange={(e) => onToolSettingsChange({ ...toolSettings, constraintDamping: parseFloat(e.target.value) })}
                  className="w-full h-4"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="constraintRender"
                  checked={toolSettings.constraintRender ?? true}
                  onChange={(e) => onToolSettingsChange({ ...toolSettings, constraintRender: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="constraintRender" className="text-xs text-gray-400">
                  Visible in game
                </label>
              </div>
            </div>
            
            {/* Selected Constraint Properties */}
            {selectedConstraint && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Selected Constraint</h4>
                
                <div>
                  <label className="block text-xs text-gray-400">Length: {selectedConstraint.data.length?.toFixed(0) || 'Auto'}</label>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={selectedConstraint.data.length || 100}
                    onChange={(e) => onConstraintPropertyChange('length', parseFloat(e.target.value))}
                    className="w-full h-4"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">Stiffness: {selectedConstraint.data.stiffness?.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedConstraint.data.stiffness || 0.8}
                    onChange={(e) => onConstraintPropertyChange('stiffness', parseFloat(e.target.value))}
                    className="w-full h-4"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400">Damping: {selectedConstraint.data.damping?.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedConstraint.data.damping || 0.2}
                    onChange={(e) => onConstraintPropertyChange('damping', parseFloat(e.target.value))}
                    className="w-full h-4"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="selectedConstraintRender"
                    checked={selectedConstraint.data.render?.visible || false}
                    onChange={(e) => onConstraintPropertyChange('visible', e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="selectedConstraintRender" className="text-xs text-gray-400">
                    Visible in game
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">Difficulty: {mapMetadata.difficulty}</label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={mapMetadata.difficulty}
                onChange={(e) => onMapMetadataChange({ ...mapMetadata, difficulty: parseInt(e.target.value) })}
                className="w-full h-4"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="block text-xs text-gray-400">Width: {mapDimensions.width}px</label>
                <input
                  type="range"
                  min="480"
                  max="3840"
                  step="96"
                  value={mapDimensions.width}
                  onChange={(e) => onMapDimensionsChange({ ...mapDimensions, width: parseInt(e.target.value) })}
                  className="w-full h-4"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400">Height: {mapDimensions.height}px</label>
                <input
                  type="range"
                  min="288"
                  max="2160"
                  step="96"
                  value={mapDimensions.height}
                  onChange={(e) => onMapDimensionsChange({ ...mapDimensions, height: parseInt(e.target.value) })}
                  className="w-full h-4"
                />
              </div>
            </div>
            
            <div className="mt-2">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={gridSnapEnabled}
                  onChange={(e) => onGridSnapChange(e.target.checked)}
                  className="mr-1"
                />
                Snap to Grid
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* New Map Modal */}
      {showNewMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 text-white p-4 rounded-lg w-96 max-w-full">
            <h3 className="text-sm font-semibold mb-3">Create New Map</h3>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium mb-1">Filename (without .json)</label>
                <input
                  type="text"
                  value={newMapData.filename}
                  onChange={(e) => setNewMapData({ ...newMapData, filename: e.target.value })}
                  placeholder="e.g. MyAwesomeMap"
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1">Map Name</label>
                <input
                  type="text"
                  value={newMapData.name}
                  onChange={(e) => setNewMapData({ ...newMapData, name: e.target.value })}
                  placeholder="e.g. My Awesome Map"
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  value={newMapData.description}
                  onChange={(e) => setNewMapData({ ...newMapData, description: e.target.value })}
                  placeholder="Describe your map..."
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs h-16"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Difficulty (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newMapData.difficulty}
                    onChange={(e) => setNewMapData({ ...newMapData, difficulty: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1">Width</label>
                  <input
                    type="number"
                    value={newMapData.width}
                    onChange={(e) => setNewMapData({ ...newMapData, width: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium mb-1">Height</label>
                <input
                  type="number"
                  value={newMapData.height}
                  onChange={(e) => setNewMapData({ ...newMapData, height: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
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
                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs"
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
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
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