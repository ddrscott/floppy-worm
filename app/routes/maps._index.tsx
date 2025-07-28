import { Link } from "@remix-run/react";
import { useEffect, useState } from "react";

interface MapData {
  filename: string;
  title: string;
  difficulty: number;
  lastModified: string;
  error?: string;
}

export default function MapsIndex() {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [newMapData, setNewMapData] = useState({
    filename: '',
    name: '',
    difficulty: 1,
    description: '',
    width: 1920,
    height: 1152
  });

  useEffect(() => {
    // Load maps data directly from the filesystem via API
    const loadMaps = async () => {
      try {
        const response = await fetch('/api/maps');
        
        if (response.ok) {
          const result = await response.json();
          if (result.maps) {
            // Sort maps using the same logic as MapDataRegistry
            const sortedMaps = result.maps.sort((a: MapData, b: MapData) => {
              // Extract numeric part for proper sorting (Map001, Map002, etc.)
              const numA = parseInt(a.filename.replace(/\D/g, '')) || 999;
              const numB = parseInt(b.filename.replace(/\D/g, '')) || 999;
              return numA - numB;
            });
            setMaps(sortedMaps);
          } else if (result.error) {
            setError(result.error);
          }
        } else {
          setError('Failed to fetch maps from server');
        }
      } catch (err) {
        console.error('Failed to load maps:', err);
        setError('Failed to load maps from server');
      } finally {
        setLoading(false);
      }
    };

    loadMaps();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-8 max-w-4xl mx-auto">
        <div className="flex justify-center items-center min-h-64">
          <div className="text-gray-600">Loading maps...</div>
        </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Floppy Worm - Server Mode</h1>
          <p className="text-gray-600 mt-1">Map Management & Editor</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewMapModal(true)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            New Map
          </button>
          <a
            href="/game"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Play Game
          </a>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difficulty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {maps.map((map) => (
              <tr key={map.filename} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {map.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {map.title}
                  {map.error && (
                    <span className="ml-2 text-red-500 text-xs">({map.error})</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {'★'.repeat(map.difficulty)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(map.lastModified).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <a
                    href={`/maps/${encodeURIComponent(map.filename)}/edit`}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </a>
                  <a
                    href={`/maps/${encodeURIComponent(map.filename)}`}
                    className="text-green-600 hover:text-green-900 mr-4"
                  >
                    View
                  </a>
                  <a
                    href={`/test/${map.filename.replace('.json', '')}`}
                    className="text-orange-600 hover:text-orange-900"
                  >
                    Test
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {maps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No maps found in the data directory.</p>
          </div>
        )}
      </div>
      
      {/* New Map Modal */}
      {showNewMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Map</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filename (without .json)</label>
                <input
                  type="text"
                  value={newMapData.filename}
                  onChange={(e) => setNewMapData({ ...newMapData, filename: e.target.value })}
                  placeholder="e.g. MyAwesomeMap"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Map Name</label>
                <input
                  type="text"
                  value={newMapData.name}
                  onChange={(e) => setNewMapData({ ...newMapData, name: e.target.value })}
                  placeholder="e.g. My Awesome Map"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newMapData.description}
                  onChange={(e) => setNewMapData({ ...newMapData, description: e.target.value })}
                  placeholder="Describe your map..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-20"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newMapData.difficulty}
                    onChange={(e) => setNewMapData({ ...newMapData, difficulty: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                  <input
                    type="number"
                    value={newMapData.width}
                    onChange={(e) => setNewMapData({ ...newMapData, width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="number"
                  value={newMapData.height}
                  onChange={(e) => setNewMapData({ ...newMapData, height: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (newMapData.filename && newMapData.name) {
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
                  }
                }}
                disabled={!newMapData.filename || !newMapData.name}
                className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md text-sm"
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
                className="px-4 py-2 bg-gray-500 text-white hover:bg-gray-600 rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}