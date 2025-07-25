import { Link, useParams } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function MapView() {
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
        // Try localStorage first
        const savedData = localStorage.getItem(`map_${filename}`);
        if (savedData) {
          setMapData(JSON.parse(savedData));
          setLoading(false);
          return;
        }

        // Load from the server API
        const response = await fetch(`/api/maps/${filename}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.mapData) {
            setMapData(result.mapData);
          } else {
            setError('No map data received');
          }
        } else {
          setError('Map not found');
        }
      } catch (err) {
        console.error('Failed to load map:', err);
        setError('Failed to load map data');
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, [filename]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex justify-center items-center min-h-64">
          <div className="text-gray-600">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Map not found'}</p>
          <Link to="/maps" className="text-blue-600 hover:text-blue-800">
            Back to Maps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Map: {mapData.title || filename}
        </h1>
        <div className="flex gap-2">
          <Link
            to={`/test/${filename.replace('.json', '')}`}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            Test Map
          </Link>
          <Link
            to={`/maps/${encodeURIComponent(filename)}/edit`}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
          >
            Edit Map
          </Link>
          <Link
            to="/maps"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Back to Maps
          </Link>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Map Details</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-600">Title</dt>
                <dd className="text-sm text-gray-900">{mapData.title || 'Untitled'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Difficulty</dt>
                <dd className="text-sm text-gray-900">
                  {'★'.repeat(mapData.difficulty || 1)} ({mapData.difficulty || 1})
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Platforms</dt>
                <dd className="text-sm text-gray-900">
                  {mapData.platforms?.length || 0} platforms
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Start Position</dt>
                <dd className="text-sm text-gray-900">
                  {mapData.startPosition ? 
                    `(${mapData.startPosition.x}, ${mapData.startPosition.y})` : 
                    'Not set'
                  }
                </dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Map Statistics</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-600">Total Objects</dt>
                <dd className="text-sm text-gray-900">
                  {(mapData.platforms?.length || 0) + (mapData.decorations?.length || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Map Bounds</dt>
                <dd className="text-sm text-gray-900">
                  {mapData.bounds ? 
                    `${mapData.bounds.width} × ${mapData.bounds.height}` : 
                    'Not defined'
                  }
                </dd>
              </div>
            </dl>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Raw JSON Data</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(mapData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}